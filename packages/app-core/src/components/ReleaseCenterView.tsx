import { Button, Input } from "@miladyai/ui";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import {
  invokeDesktopBridgeRequest,
  isElectrobunRuntime,
  subscribeDesktopBridgeEvent,
} from "../bridge";
import { useApp } from "../state";
import { openDesktopSurfaceWindow } from "../utils/desktop-workspace";

type DesktopBuildInfo = {
  platform: string;
  arch: string;
  defaultRenderer: "native" | "cef";
  availableRenderers: Array<"native" | "cef">;
  cefVersion?: string;
  bunVersion?: string;
  runtime?: Record<string, unknown>;
};

type DesktopUpdaterSnapshot = {
  currentVersion: string;
  currentHash?: string;
  channel?: string;
  baseUrl?: string;
  updateAvailable: boolean;
  updateReady: boolean;
  latestVersion?: string | null;
  latestHash?: string | null;
  error?: string | null;
  lastStatus?: {
    status: string;
    message: string;
    timestamp: number;
  } | null;
};

type DesktopSessionCookie = {
  name: string;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  session?: boolean;
  expirationDate?: number;
};

type DesktopSessionSnapshot = {
  partition: string;
  persistent: boolean;
  cookieCount: number;
  cookies: DesktopSessionCookie[];
};

type DesktopReleaseNotesWindowInfo = {
  url: string;
  windowId: number | null;
  webviewId: number | null;
};

type WebGpuBrowserStatus = {
  available: boolean;
  reason: string;
  renderer: string;
  chromeBetaPath: string | null;
  downloadUrl: string | null;
};

type WgpuTagElement = HTMLElement & {
  runTest?: () => void;
  toggleTransparent?: (transparent?: boolean) => void;
  togglePassthrough?: (enabled?: boolean) => void;
  toggleHidden?: (hidden?: boolean) => void;
  on?: (event: "ready", listener: (event: CustomEvent) => void) => void;
  off?: (event: "ready", listener: (event: CustomEvent) => void) => void;
};

const DEFAULT_RELEASE_NOTES_URL = "https://milady.ai/releases/";
const RELEASE_NOTES_PARTITION = "persist:milady-release-notes";
const SESSION_PARTITIONS = [
  { partition: "persist:default", label: "Default app session" },
  { partition: RELEASE_NOTES_PARTITION, label: "Release notes BrowserView" },
] as const;

function summarizeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeReleaseNotesUrl(url?: string | null): string {
  const candidate = url?.trim() || DEFAULT_RELEASE_NOTES_URL;
  try {
    return new URL(candidate).toString();
  } catch {
    return DEFAULT_RELEASE_NOTES_URL;
  }
}

function formatTimestamp(timestamp?: number | null): string {
  if (!timestamp) {
    return "Not yet";
  }
  return new Date(timestamp).toLocaleString();
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "good" | "warning";
}) {
  const className =
    tone === "good"
      ? "border-ok/40 bg-ok/10 text-ok"
      : tone === "warning"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border bg-bg-accent text-muted";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${className}`}
    >
      {label}
    </span>
  );
}

function DefinitionRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="text-xs text-muted">{label}</div>
      <div className="text-right text-xs text-txt break-all">
        {value ?? "Unavailable"}
      </div>
    </div>
  );
}

function partitionDescription(partition: string): string {
  return partition === "persist:default"
    ? "Renderer default session"
    : "Sandboxed release notes session";
}

export function ReleaseCenterView() {
  const desktopRuntime = isElectrobunRuntime();
  const { loadUpdateStatus, updateLoading, updateStatus } = useApp();

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [nativeUpdater, setNativeUpdater] =
    useState<DesktopUpdaterSnapshot | null>(null);
  const [buildInfo, setBuildInfo] = useState<DesktopBuildInfo | null>(null);
  const [dockVisible, setDockVisible] = useState<boolean>(true);
  const [sessionSnapshots, setSessionSnapshots] = useState<
    Record<string, DesktopSessionSnapshot | undefined>
  >({});
  const [webGpuStatus, setWebGpuStatus] = useState<WebGpuBrowserStatus | null>(
    null,
  );
  const [releaseNotesWindow, setReleaseNotesWindow] =
    useState<DesktopReleaseNotesWindowInfo | null>(null);
  const [releaseNotesUrl, setReleaseNotesUrl] = useState(
    DEFAULT_RELEASE_NOTES_URL,
  );
  const [releaseNotesUrlDirty, setReleaseNotesUrlDirty] = useState(false);
  const [wgpuTagAvailable, setWgpuTagAvailable] = useState(false);
  const [wgpuReady, setWgpuReady] = useState(false);
  const [wgpuTransparent, setWgpuTransparent] = useState(false);
  const [wgpuPassthrough, setWgpuPassthrough] = useState(false);
  const [wgpuHidden, setWgpuHidden] = useState(false);
  const wgpuRef = useRef<WgpuTagElement | null>(null);

  const refreshNativeState = useCallback(async () => {
    if (!desktopRuntime) {
      return;
    }

    const [updater, build, dock, gpuStatus, ...sessionResults] =
      await Promise.all([
        invokeDesktopBridgeRequest<DesktopUpdaterSnapshot>({
          rpcMethod: "desktopGetUpdaterState",
          ipcChannel: "desktop:getUpdaterState",
        }),
        invokeDesktopBridgeRequest<DesktopBuildInfo>({
          rpcMethod: "desktopGetBuildInfo",
          ipcChannel: "desktop:getBuildInfo",
        }),
        invokeDesktopBridgeRequest<{ visible: boolean }>({
          rpcMethod: "desktopGetDockIconVisibility",
          ipcChannel: "desktop:getDockIconVisibility",
        }),
        invokeDesktopBridgeRequest<WebGpuBrowserStatus>({
          rpcMethod: "desktopGetWebGpuBrowserStatus",
          ipcChannel: "desktop:getWebGpuBrowserStatus",
        }),
        ...SESSION_PARTITIONS.map(({ partition }) =>
          invokeDesktopBridgeRequest<DesktopSessionSnapshot>({
            rpcMethod: "desktopGetSessionSnapshot",
            ipcChannel: "desktop:getSessionSnapshot",
            params: { partition },
          }),
        ),
      ]);

    setNativeUpdater(updater);
    setBuildInfo(build);
    setDockVisible(dock?.visible ?? true);
    setWebGpuStatus(gpuStatus);
    setSessionSnapshots(
      Object.fromEntries(
        SESSION_PARTITIONS.map((entry, index) => [
          entry.partition,
          sessionResults[index] ?? undefined,
        ]),
      ),
    );
    setReleaseNotesUrl((current) =>
      releaseNotesUrlDirty
        ? current
        : normalizeReleaseNotesUrl(updater?.baseUrl ?? current),
    );
  }, [desktopRuntime, releaseNotesUrlDirty]);

  useEffect(() => {
    if (!desktopRuntime) {
      return;
    }

    void loadUpdateStatus();
    void refreshNativeState();
  }, [desktopRuntime, loadUpdateStatus, refreshNativeState]);

  useEffect(() => {
    setWgpuTagAvailable(
      typeof window !== "undefined" &&
        Boolean(window.customElements.get("electrobun-wgpu")),
    );
  }, []);

  useEffect(() => {
    const element = wgpuRef.current;
    if (!desktopRuntime || !wgpuTagAvailable || !element) {
      return;
    }

    const onReady = () => {
      setWgpuReady(true);
    };

    element.on?.("ready", onReady);
    return () => {
      element.off?.("ready", onReady);
    };
  }, [desktopRuntime, wgpuTagAvailable]);

  useEffect(() => {
    if (!desktopRuntime) {
      return;
    }

    const unsubscribers = [
      subscribeDesktopBridgeEvent({
        rpcMessage: "desktopUpdateAvailable",
        ipcChannel: "desktop:updateAvailable",
        listener: () => {
          void refreshNativeState();
        },
      }),
      subscribeDesktopBridgeEvent({
        rpcMessage: "desktopUpdateReady",
        ipcChannel: "desktop:updateReady",
        listener: () => {
          void refreshNativeState();
        },
      }),
      subscribeDesktopBridgeEvent({
        rpcMessage: "webGpuBrowserStatus",
        ipcChannel: "webgpu:browserStatus",
        listener: (payload) => {
          setWebGpuStatus(payload as WebGpuBrowserStatus);
        },
      }),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
    };
  }, [desktopRuntime, refreshNativeState]);

  const runAction = useCallback(
    async <T,>(
      id: string,
      action: () => Promise<T>,
      successMessage?: string,
    ): Promise<T | null> => {
      setBusyAction(id);
      setActionError(null);
      setActionMessage(null);
      try {
        const result = await action();
        if (successMessage) {
          setActionMessage(successMessage);
        }
        return result;
      } catch (error) {
        setActionError(summarizeError(error));
        return null;
      } finally {
        setBusyAction(null);
      }
    },
    [],
  );

  if (!desktopRuntime) {
    return (
      <div className="rounded-2xl border border-border bg-bg-accent px-4 py-4 text-sm text-muted">
        Release Center is available in the Electrobun desktop runtime.
      </div>
    );
  }

  const appReleaseTone = updateStatus?.updateAvailable ? "warning" : "good";
  const nativeReleaseTone = nativeUpdater?.updateReady
    ? "good"
    : nativeUpdater?.updateAvailable
      ? "warning"
      : "neutral";

  const detachReleaseCenter = async () => {
    await openDesktopSurfaceWindow("release");
  };

  const refreshReleaseState = async () => {
    await Promise.all([loadUpdateStatus(true), refreshNativeState()]);
  };

  const checkForDesktopUpdate = async () => {
    const snapshot = await invokeDesktopBridgeRequest<DesktopUpdaterSnapshot>({
      rpcMethod: "desktopCheckForUpdates",
      ipcChannel: "desktop:checkForUpdates",
    });
    setNativeUpdater(snapshot);
    if (!releaseNotesUrlDirty && snapshot?.baseUrl) {
      setReleaseNotesUrl(normalizeReleaseNotesUrl(snapshot.baseUrl));
    }
  };

  const applyDesktopUpdate = async () => {
    await invokeDesktopBridgeRequest<void>({
      rpcMethod: "desktopApplyUpdate",
      ipcChannel: "desktop:applyUpdate",
    });
  };

  const toggleDockIcon = async () => {
    const next = await invokeDesktopBridgeRequest<{ visible: boolean }>({
      rpcMethod: "desktopSetDockIconVisibility",
      ipcChannel: "desktop:setDockIconVisibility",
      params: { visible: !dockVisible },
    });
    setDockVisible(next?.visible ?? dockVisible);
  };

  const openReleaseNotesWindow = async () => {
    const info =
      await invokeDesktopBridgeRequest<DesktopReleaseNotesWindowInfo>({
        rpcMethod: "desktopOpenReleaseNotesWindow",
        ipcChannel: "desktop:openReleaseNotesWindow",
        params: {
          url: releaseNotesUrl,
          title: "Milady Release Notes",
        },
      });
    setReleaseNotesWindow(info);
    const refreshedSession =
      await invokeDesktopBridgeRequest<DesktopSessionSnapshot>({
        rpcMethod: "desktopGetSessionSnapshot",
        ipcChannel: "desktop:getSessionSnapshot",
        params: { partition: RELEASE_NOTES_PARTITION },
      });
    if (refreshedSession) {
      setSessionSnapshots((current) => ({
        ...current,
        [RELEASE_NOTES_PARTITION]: refreshedSession,
      }));
    }
  };

  const clearSession = async (partition: string) => {
    const snapshot = await invokeDesktopBridgeRequest<DesktopSessionSnapshot>({
      rpcMethod: "desktopClearSessionData",
      ipcChannel: "desktop:clearSessionData",
      params: {
        partition,
        storageTypes: "all",
        clearCookies: true,
      },
    });
    if (snapshot) {
      setSessionSnapshots((current) => ({
        ...current,
        [partition]: snapshot,
      }));
    }
  };

  const clearCookiesOnly = async (partition: string) => {
    const snapshot = await invokeDesktopBridgeRequest<DesktopSessionSnapshot>({
      rpcMethod: "desktopClearSessionData",
      ipcChannel: "desktop:clearSessionData",
      params: {
        partition,
        storageTypes: ["cookies"],
        clearCookies: true,
      },
    });
    if (snapshot) {
      setSessionSnapshots((current) => ({
        ...current,
        [partition]: snapshot,
      }));
    }
  };

  const runWgpuAction = (action: () => void, stateMessage: string) => {
    setActionError(null);
    setActionMessage(stateMessage);
    action();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill
          label={`App: ${updateStatus?.currentVersion ?? "loading"}`}
          tone={appReleaseTone}
        />
        <StatusPill
          label={`Desktop: ${nativeUpdater?.currentVersion ?? "loading"}`}
          tone={nativeReleaseTone}
        />
        {nativeUpdater?.channel ? (
          <StatusPill
            label={`Channel: ${nativeUpdater.channel}`}
            tone="neutral"
          />
        ) : null}
      </div>

      {actionError ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}
      {actionMessage ? (
        <div className="rounded-xl border border-ok/30 bg-ok/10 px-4 py-3 text-sm text-ok">
          {actionMessage}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-bg-accent p-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-txt">Release Status</h3>
              <p className="mt-1 text-xs text-muted">
                Compare backend release metadata with the native Electrobun
                updater state.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busyAction === "refresh" || updateLoading}
                onClick={() =>
                  void runAction(
                    "refresh",
                    refreshReleaseState,
                    "Release status refreshed.",
                  )
                }
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyAction === "detach-release"}
                onClick={() =>
                  void runAction(
                    "detach-release",
                    detachReleaseCenter,
                    "Detached release center opened.",
                  )
                }
              >
                Open Detached Release Center
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-border bg-bg p-3">
              <div className="text-xs font-semibold text-txt">
                App Release Service
              </div>
              <DefinitionRow
                label="Current version"
                value={updateStatus?.currentVersion}
              />
              <DefinitionRow
                label="Latest version"
                value={updateStatus?.latestVersion ?? "Current"}
              />
              <DefinitionRow label="Channel" value={updateStatus?.channel} />
              <DefinitionRow
                label="Last checked"
                value={
                  updateStatus?.lastCheckAt
                    ? new Date(updateStatus.lastCheckAt).toLocaleString()
                    : "Not yet"
                }
              />
            </div>

            <div className="rounded-xl border border-border bg-bg p-3">
              <div className="mb-3 text-xs font-semibold text-txt">
                Native Electrobun Updater
              </div>
              <DefinitionRow
                label="Current version"
                value={nativeUpdater?.currentVersion}
              />
              <DefinitionRow
                label="Latest version"
                value={nativeUpdater?.latestVersion ?? "Current"}
              />
              <DefinitionRow
                label="Last status"
                value={nativeUpdater?.lastStatus?.message ?? "Idle"}
              />
              <DefinitionRow
                label="Status time"
                value={formatTimestamp(nativeUpdater?.lastStatus?.timestamp)}
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busyAction === "check-updates"}
                  onClick={() =>
                    void runAction(
                      "check-updates",
                      checkForDesktopUpdate,
                      "Desktop update check started.",
                    )
                  }
                >
                  Check / Download Update
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    busyAction === "apply-update" || !nativeUpdater?.updateReady
                  }
                  onClick={() =>
                    void runAction(
                      "apply-update",
                      applyDesktopUpdate,
                      "Applying downloaded update.",
                    )
                  }
                >
                  Apply Downloaded Update
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-bg-accent p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-txt">
              Release Notes BrowserView
            </h3>
            <p className="mt-1 text-xs text-muted">
              Opens release notes in a dedicated sandboxed BrowserView on its
              own persistent session.
            </p>
          </div>

          <div className="space-y-3">
            <Input
              value={releaseNotesUrl}
              onChange={(event) => {
                setReleaseNotesUrlDirty(true);
                setReleaseNotesUrl(event.target.value);
              }}
              placeholder={DEFAULT_RELEASE_NOTES_URL}
              className="font-mono text-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={busyAction === "open-release-notes"}
                onClick={() =>
                  void runAction(
                    "open-release-notes",
                    openReleaseNotesWindow,
                    "Release notes window opened.",
                  )
                }
              >
                Open BrowserView Window
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busyAction === "reset-release-url"}
                onClick={() =>
                  void runAction(
                    "reset-release-url",
                    async () => {
                      setReleaseNotesUrlDirty(false);
                      setReleaseNotesUrl(
                        normalizeReleaseNotesUrl(nativeUpdater?.baseUrl),
                      );
                    },
                    "Release notes URL reset from updater metadata.",
                  )
                }
              >
                Reset URL
              </Button>
            </div>

            {releaseNotesWindow ? (
              <div className="rounded-xl border border-border bg-bg p-3 text-xs text-txt">
                <DefinitionRow
                  label="Window ID"
                  value={releaseNotesWindow.windowId}
                />
                <DefinitionRow
                  label="BrowserView ID"
                  value={releaseNotesWindow.webviewId}
                />
                <DefinitionRow label="URL" value={releaseNotesWindow.url} />
              </div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-bg-accent p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-txt">
              BuildConfig and Shell Runtime
            </h3>
            <p className="mt-1 text-xs text-muted">
              Native runtime metadata sourced directly from Electrobun
              BuildConfig and shell APIs.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-bg p-3">
            <DefinitionRow label="Platform" value={buildInfo?.platform} />
            <DefinitionRow label="Architecture" value={buildInfo?.arch} />
            <DefinitionRow
              label="Default renderer"
              value={buildInfo?.defaultRenderer}
            />
            <DefinitionRow
              label="Available renderers"
              value={buildInfo?.availableRenderers.join(", ")}
            />
            <DefinitionRow label="Bun version" value={buildInfo?.bunVersion} />
            <DefinitionRow label="CEF version" value={buildInfo?.cefVersion} />
            <DefinitionRow
              label="Updater base URL"
              value={nativeUpdater?.baseUrl ?? DEFAULT_RELEASE_NOTES_URL}
            />
            <DefinitionRow
              label="Dock icon visible"
              value={
                buildInfo?.platform === "darwin"
                  ? String(dockVisible)
                  : "macOS only"
              }
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={
                  busyAction === "toggle-dock" ||
                  buildInfo?.platform !== "darwin"
                }
                onClick={() =>
                  void runAction(
                    "toggle-dock",
                    toggleDockIcon,
                    dockVisible ? "Dock icon hidden." : "Dock icon shown.",
                  )
                }
              >
                {dockVisible ? "Hide Dock Icon" : "Show Dock Icon"}
              </Button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-bg-accent p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-txt">
              Session and Cookie Controls
            </h3>
            <p className="mt-1 text-xs text-muted">
              Explicit Session APIs for inspecting and clearing renderer
              storage.
            </p>
          </div>

          <div className="space-y-3">
            {SESSION_PARTITIONS.map(({ label, partition }) => {
              const snapshot = sessionSnapshots[partition];
              return (
                <div
                  key={partition}
                  className="rounded-xl border border-border bg-bg p-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-txt">
                        {label}
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        {partitionDescription(partition)}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyAction === `clear-cookies:${partition}`}
                        onClick={() =>
                          void runAction(
                            `clear-cookies:${partition}`,
                            () => clearCookiesOnly(partition),
                            `Cleared cookies for ${partition}.`,
                          )
                        }
                      >
                        Clear Cookies
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyAction === `clear-session:${partition}`}
                        onClick={() =>
                          void runAction(
                            `clear-session:${partition}`,
                            () => clearSession(partition),
                            `Cleared storage for ${partition}.`,
                          )
                        }
                      >
                        Clear Storage
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3">
                    <DefinitionRow
                      label="Partition"
                      value={snapshot?.partition ?? partition}
                    />
                    <DefinitionRow
                      label="Persistent"
                      value={snapshot ? String(snapshot.persistent) : undefined}
                    />
                    <DefinitionRow
                      label="Cookie count"
                      value={snapshot?.cookieCount}
                    />
                  </div>

                  {snapshot?.cookies.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {snapshot.cookies.slice(0, 8).map((cookie) => (
                        <span
                          key={`${partition}:${cookie.name}:${cookie.domain ?? ""}`}
                          className="inline-flex items-center rounded-full border border-border bg-bg-accent px-2 py-1 text-[11px] text-txt"
                        >
                          {cookie.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-[11px] text-muted">
                      No cookies stored for this partition.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-bg-accent p-4">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-txt">
            Browser WGPU Surface
          </h3>
          <p className="mt-1 text-xs text-muted">
            Inline <code>&lt;electrobun-wgpu&gt;</code> preview plus browser
            WebGPU compatibility status from the active desktop renderer.
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {wgpuTagAvailable ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-black/5">
                {createElement("electrobun-wgpu", {
                  ref: (node: WgpuTagElement | null) => {
                    wgpuRef.current = node;
                  },
                  className: "block h-56 w-full",
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
                The WGPU custom element is not available in this renderer.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                disabled={!wgpuTagAvailable}
                onClick={() =>
                  runWgpuAction(
                    () => wgpuRef.current?.runTest?.(),
                    "WGPU test requested.",
                  )
                }
              >
                Run Test
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!wgpuTagAvailable}
                onClick={() => {
                  const next = !wgpuTransparent;
                  setWgpuTransparent(next);
                  runWgpuAction(
                    () => wgpuRef.current?.toggleTransparent?.(next),
                    next
                      ? "WGPU transparency enabled."
                      : "WGPU transparency disabled.",
                  );
                }}
              >
                {wgpuTransparent ? "Opaque" : "Transparent"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!wgpuTagAvailable}
                onClick={() => {
                  const next = !wgpuPassthrough;
                  setWgpuPassthrough(next);
                  runWgpuAction(
                    () => wgpuRef.current?.togglePassthrough?.(next),
                    next
                      ? "WGPU passthrough enabled."
                      : "WGPU passthrough disabled.",
                  );
                }}
              >
                {wgpuPassthrough ? "Passthrough Off" : "Passthrough On"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!wgpuTagAvailable}
                onClick={() => {
                  const next = !wgpuHidden;
                  setWgpuHidden(next);
                  runWgpuAction(
                    () => wgpuRef.current?.toggleHidden?.(next),
                    next ? "WGPU preview hidden." : "WGPU preview shown.",
                  );
                }}
              >
                {wgpuHidden ? "Show Surface" : "Hide Surface"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-bg p-3">
            <div className="mb-3 text-xs font-semibold text-txt">
              Browser WebGPU Status
            </div>
            <DefinitionRow
              label="Inline surface ready"
              value={String(wgpuReady)}
            />
            <DefinitionRow
              label="Renderer support"
              value={webGpuStatus?.available ? "Available" : "Not available"}
            />
            <DefinitionRow
              label="Renderer type"
              value={webGpuStatus?.renderer}
            />
            <DefinitionRow
              label="Chrome Beta"
              value={webGpuStatus?.chromeBetaPath ?? "Not detected"}
            />
            <div className="mt-3 rounded-lg border border-border bg-bg-accent px-3 py-2 text-xs text-muted">
              {webGpuStatus?.reason ?? "Waiting for desktop renderer status."}
            </div>
            {webGpuStatus?.downloadUrl ? (
              <div className="mt-3 text-xs">
                <a
                  className="text-accent underline-offset-2 hover:underline"
                  href={webGpuStatus.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download Chrome Beta fallback
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
