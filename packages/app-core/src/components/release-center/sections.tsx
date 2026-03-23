import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "@miladyai/ui";
import { createElement } from "react";
import {
  DefinitionRow,
  formatTimestamp,
  partitionDescription,
  StatusPill,
} from "./shared";
import type {
  AppReleaseStatus,
  DesktopBuildInfo,
  DesktopReleaseNotesWindowInfo,
  DesktopSessionSnapshot,
  DesktopUpdaterSnapshot,
  WebGpuBrowserStatus,
  WgpuTagElement,
} from "./types";
import {

  RELEASE_NOTES_PARTITION,
  SESSION_PARTITIONS,
} from "./types";

export function ReleaseStatusSection({
  busyAction,
  nativeUpdater,
  updateLoading,
  updateStatus,
  onApplyUpdate,
  onCheckForUpdates,
  onDetach,
  onRefresh,
}: {
  busyAction: string | null;
  nativeUpdater: DesktopUpdaterSnapshot | null;
  updateLoading: boolean;
  updateStatus: AppReleaseStatus | null | undefined;
  onApplyUpdate: () => void;
  onCheckForUpdates: () => void;
  onDetach: () => void;
  onRefresh: () => void;
}) {
  const appReleaseTone = updateStatus?.updateAvailable ? "warning" : "good";
  const autoUpdateDisabled =
    nativeUpdater != null && !nativeUpdater.canAutoUpdate;
  const nativeReleaseTone = nativeUpdater?.updateReady
    ? "good"
    : nativeUpdater?.updateAvailable
      ? "warning"
      : "neutral";

  return (
    <Card className="bg-bg-accent">
      <CardHeader>
        <div className="mb-2 flex flex-wrap items-center gap-2">
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
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-sm">Release Status</CardTitle>
            <CardDescription>
              Compare backend release metadata with the native Electrobun updater
              state.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busyAction === "refresh" || updateLoading}
              onClick={onRefresh}
            >
              Refresh
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busyAction === "detach-release"}
              onClick={onDetach}
            >
              Open Detached Release Center
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="shadow-none">
            <CardContent className="p-3">
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
          </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardContent className="p-3">
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
                label="App bundle"
                value={nativeUpdater?.appBundlePath ?? "Unknown"}
              />
              <DefinitionRow
                label="Last status"
                value={nativeUpdater?.lastStatus?.message ?? "Idle"}
              />
              <DefinitionRow
                label="Status time"
                value={formatTimestamp(nativeUpdater?.lastStatus?.timestamp)}
              />
              {autoUpdateDisabled && nativeUpdater?.autoUpdateDisabledReason ? (
                <div className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  {nativeUpdater.autoUpdateDisabledReason}
                </div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={busyAction === "check-updates" || autoUpdateDisabled}
                  onClick={onCheckForUpdates}
                >
                  Check / Download Update
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    busyAction === "apply-update" ||
                    autoUpdateDisabled ||
                    !nativeUpdater?.updateReady
                  }
                  onClick={onApplyUpdate}
                >
                  Apply Downloaded Update
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

export function ReleaseNotesSection({
  busyAction,
  nativeUpdater,
  releaseNotesUrl,
  releaseNotesWindow,
  onOpenWindow,
  onReleaseNotesUrlChange,
  onResetUrl,
}: {
  busyAction: string | null;
  nativeUpdater: DesktopUpdaterSnapshot | null;
  releaseNotesUrl: string;
  releaseNotesWindow: DesktopReleaseNotesWindowInfo | null;
  onOpenWindow: () => void;
  onReleaseNotesUrlChange: (value: string) => void;
  onResetUrl: () => void;
}) {
  const { appUrl } = useBranding();
  const defaultReleaseNotesUrl = `${appUrl}/releases/`;

  return (
    <Card className="bg-bg-accent">
      <CardHeader>
        <CardTitle className="text-sm">
          Release Notes BrowserView
        </CardTitle>
        <CardDescription>
          Opens release notes in a dedicated sandboxed BrowserView on its own
          persistent session.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <Input
          value={releaseNotesUrl}
          onChange={(event) => onReleaseNotesUrlChange(event.target.value)}
          placeholder={defaultReleaseNotesUrl}
          className="font-mono text-xs"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={busyAction === "open-release-notes"}
            onClick={onOpenWindow}
          >
            Open BrowserView Window
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busyAction === "reset-release-url"}
            onClick={onResetUrl}
          >
            Reset URL
          </Button>
        </div>

        {releaseNotesWindow ? (
          <Card className="shadow-none">
            <CardContent className="p-3 text-xs text-txt">
              <DefinitionRow
                label="Window ID"
                value={releaseNotesWindow.windowId}
              />
              <DefinitionRow
                label="BrowserView ID"
                value={releaseNotesWindow.webviewId}
              />
              <DefinitionRow label="URL" value={releaseNotesWindow.url} />
            </CardContent>
          </Card>
        ) : (
<<<<<<< Updated upstream
          <div className="rounded-xl border border-border bg-bg p-3 text-xs text-muted">
            Using updater URL:{" "}
            {nativeUpdater?.baseUrl ?? defaultReleaseNotesUrl}
          </div>
=======
          <Card className="shadow-none">
            <CardContent className="p-3 text-xs text-muted">
              Using updater URL:{" "}
              {nativeUpdater?.baseUrl ?? DEFAULT_RELEASE_NOTES_URL}
            </CardContent>
          </Card>
>>>>>>> Stashed changes
        )}
      </CardContent>
    </Card>
  );
}

export function BuildRuntimeSection({
  buildInfo,
  busyAction,
  dockVisible,
  nativeUpdater,
  onToggleDock,
}: {
  buildInfo: DesktopBuildInfo | null;
  busyAction: string | null;
  dockVisible: boolean;
  nativeUpdater: DesktopUpdaterSnapshot | null;
  onToggleDock: () => void;
}) {
  const { appUrl } = useBranding();
  const defaultReleaseNotesUrl = `${appUrl}/releases/`;

  return (
    <Card className="bg-bg-accent">
      <CardHeader>
        <CardTitle className="text-sm">
          BuildConfig and Shell Runtime
        </CardTitle>
        <CardDescription>
          Native runtime metadata sourced directly from Electrobun BuildConfig
          and shell APIs.
        </CardDescription>
      </CardHeader>

<<<<<<< Updated upstream
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
          value={nativeUpdater?.baseUrl ?? defaultReleaseNotesUrl}
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
              busyAction === "toggle-dock" || buildInfo?.platform !== "darwin"
            }
            onClick={onToggleDock}
          >
            {dockVisible ? "Hide Dock Icon" : "Show Dock Icon"}
          </Button>
        </div>
      </div>
    </section>
=======
      <CardContent>
        <Card className="shadow-none">
          <CardContent className="p-3">
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
                  busyAction === "toggle-dock" || buildInfo?.platform !== "darwin"
                }
                onClick={onToggleDock}
              >
                {dockVisible ? "Hide Dock Icon" : "Show Dock Icon"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
>>>>>>> Stashed changes
  );
}

export function SessionControlsSection({
  busyAction,
  sessionSnapshots,
  onClearCookies,
  onClearSession,
}: {
  busyAction: string | null;
  sessionSnapshots: Record<string, DesktopSessionSnapshot | undefined>;
  onClearCookies: (partition: string) => void;
  onClearSession: (partition: string) => void;
}) {
  return (
    <Card className="bg-bg-accent">
      <CardHeader>
        <CardTitle className="text-sm">
          Session and Cookie Controls
        </CardTitle>
        <CardDescription>
          Explicit Session APIs for inspecting and clearing renderer storage.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {SESSION_PARTITIONS.map(({ label, partition }) => {
          const snapshot = sessionSnapshots[partition];
          return (
            <Card
              key={partition}
              className="shadow-none"
            >
              <CardContent className="p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold text-txt">{label}</div>
                  <div className="mt-1 text-[11px] text-muted">
                    {partitionDescription(partition)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyAction === `clear-cookies:${partition}`}
                    onClick={() => onClearCookies(partition)}
                  >
                    Clear Cookies
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyAction === `clear-session:${partition}`}
                    onClick={() => onClearSession(partition)}
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
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function WgpuSurfaceSection({
  webGpuStatus,
  wgpuHidden,
  wgpuPassthrough,
  wgpuReady,
  wgpuRef,
  wgpuTagAvailable,
  wgpuTransparent,
  onRunTest,
  onToggleHidden,
  onTogglePassthrough,
  onToggleTransparent,
}: {
  webGpuStatus: WebGpuBrowserStatus | null;
  wgpuHidden: boolean;
  wgpuPassthrough: boolean;
  wgpuReady: boolean;
  wgpuRef: { current: WgpuTagElement | null };
  wgpuTagAvailable: boolean;
  wgpuTransparent: boolean;
  onRunTest: () => void;
  onToggleHidden: () => void;
  onTogglePassthrough: () => void;
  onToggleTransparent: () => void;
}) {
  return (
    <Card className="bg-bg-accent">
      <CardHeader>
        <CardTitle className="text-sm">Browser WGPU Surface</CardTitle>
        <CardDescription>
          Inline <code>&lt;electrobun-wgpu&gt;</code> preview plus browser
          WebGPU compatibility status from the active desktop renderer.
        </CardDescription>
      </CardHeader>

      <CardContent>
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

<<<<<<< Updated upstream
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={!wgpuTagAvailable} onClick={onRunTest}>
              Run Test
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!wgpuTagAvailable}
              onClick={onToggleTransparent}
            >
              {wgpuTransparent ? "Opaque" : "Transparent"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!wgpuTagAvailable}
              onClick={onTogglePassthrough}
            >
              {wgpuPassthrough ? "Passthrough Off" : "Passthrough On"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!wgpuTagAvailable}
              onClick={onToggleHidden}
            >
              {wgpuHidden ? "Show Surface" : "Hide Surface"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-bg p-3">
          <div className="mb-3 text-xs font-semibold text-txt">
            Browser WebGPU Status
          </div>
          <p className="mb-3 text-xs text-muted">
            This reports whether the desktop webview is expected to expose
            WebGPU for the WGPU preview above. It is not overall app health:
            companion and avatar already fall back to WebGL when WebGPU is
            missing.
          </p>
          <DefinitionRow
            label="Inline surface ready"
            value={String(wgpuReady)}
          />
          <DefinitionRow
            label="Renderer support"
            value={webGpuStatus?.available ? "Available" : "Not available"}
          />
          <DefinitionRow label="Renderer type" value={webGpuStatus?.renderer} />
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
=======
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={!wgpuTagAvailable} onClick={onRunTest}>
                Run Test
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!wgpuTagAvailable}
                onClick={onToggleTransparent}
>>>>>>> Stashed changes
              >
                {wgpuTransparent ? "Opaque" : "Transparent"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!wgpuTagAvailable}
                onClick={onTogglePassthrough}
              >
                {wgpuPassthrough ? "Passthrough Off" : "Passthrough On"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!wgpuTagAvailable}
                onClick={onToggleHidden}
              >
                {wgpuHidden ? "Show Surface" : "Hide Surface"}
              </Button>
            </div>
          </div>

          <Card className="shadow-none">
            <CardContent className="p-3">
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
              <DefinitionRow label="Renderer type" value={webGpuStatus?.renderer} />
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
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
import { useBranding } from "../../config/branding";
