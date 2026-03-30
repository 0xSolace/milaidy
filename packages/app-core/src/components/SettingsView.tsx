/**
 * Settings view — two-panel layout with section navigator and active section.
 */

import type { StewardStatusResponse } from "@miladyai/shared/contracts/wallet";
import {
  Button,
  Checkbox,
  cn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PageLayout,
  PagePanel,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarPanel,
  SidebarScrollRegion,
  Spinner,
  useLinkedSidebarSelection,
} from "@miladyai/ui";
import {
  AlertTriangle,
  ChevronDown,
  Copy,
  Download,
  Shield,
  Upload,
} from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { client } from "../api";
import { useApp } from "../state";
import { CodingAgentSettingsSection } from "./CodingAgentSettingsSection";
import { ConfigPageView } from "./ConfigPageView";
import { CloudDashboard } from "./ElizaCloudDashboard";
import { MediaSettingsSection } from "./MediaSettingsSection";
import { PermissionsSection } from "./PermissionsSection";
import { PolicyControlsView } from "./PolicyControlsView";
import { ProviderSwitcher } from "./ProviderSwitcher";
import { ReleaseCenterView } from "./ReleaseCenterView";

interface SettingsSectionDef {
  id: string;
  label: string;
  description?: string;
  keywords?: string[];
}

const SETTINGS_CONTENT_CLASS =
  "[scroll-padding-top:7rem] [scrollbar-gutter:stable] scroll-smooth bg-bg/10 pb-6 pt-4 sm:pb-8 sm:pt-5 lg:pb-10 lg:pt-6";
const SETTINGS_CONTENT_WIDTH_CLASS = "w-full min-h-0";
const SETTINGS_SECTION_STACK_CLASS = "space-y-6 pb-14 sm:space-y-8 sm:pb-16";

const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: "cloud",
    label: "providerswitcher.elizaCloud",
    description: "settings.sections.cloud.desc",
    keywords: ["cloud", "billing", "credits", "auth", "subscription"],
  },
  {
    id: "ai-model",
    label: "settings.sections.aimodel.label",
    description: "settings.sections.aimodel.desc",
    keywords: [
      "model",
      "provider",
      "openai",
      "anthropic",
      "grok",
      "gemini",
      "api key",
      "inference",
      "llm",
    ],
  },
  {
    id: "coding-agents",
    label: "settings.sections.codingagents.label",
    description: "settings.sections.codingagents.desc",
    keywords: ["codex", "agent", "reasoning", "parallel", "approval"],
  },
  {
    id: "wallet-rpc",
    label: "settings.sections.walletrpc.label",
    description: "settings.sections.walletrpc.desc",
    keywords: [
      "wallet",
      "rpc",
      "chain",
      "solana",
      "ethereum",
      "base",
      "private key",
      "address",
      "network",
    ],
  },
  {
    id: "wallet-policies",
    label: "settings.sections.walletpolicies.label",
    description: "settings.sections.walletpolicies.desc",
    keywords: [
      "policy",
      "policies",
      "spending",
      "limit",
      "approved",
      "addresses",
      "rate limit",
      "time window",
      "auto approve",
      "steward",
      "safety",
      "guardrails",
    ],
  },
  {
    id: "media",
    label: "settings.sections.media.label",
    description: "settings.sections.media.desc",
    keywords: [
      "audio",
      "voice",
      "video",
      "camera",
      "microphone",
      "speech",
      "tts",
      "avatar",
    ],
  },
  {
    id: "permissions",
    label: "settings.sections.permissions.label",
    description: "settings.sections.permissions.desc",
    keywords: [
      "permissions",
      "desktop",
      "filesystem",
      "security",
      "microphone permission",
      "camera permission",
      "file access",
    ],
  },
  {
    id: "updates",
    label: "settings.sections.updates.label",
    description: "settings.sections.updates.desc",
    keywords: ["updates", "release", "version", "download"],
  },
  {
    id: "advanced",
    label: "nav.advanced",
    description: "settings.sections.advanced.desc",
    keywords: [
      "advanced",
      "export",
      "import",
      "reset",
      "debug",
      "backup",
      "restore",
      "danger zone",
    ],
  },
];

function matchesSettingsSection(
  section: SettingsSectionDef,
  query: string,
  t: (key: string) => string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    t(section.label).toLowerCase().includes(normalized) ||
    (section.description
      ? t(section.description).toLowerCase().includes(normalized)
      : false) ||
    (section.keywords ?? []).some((keyword) =>
      keyword.toLowerCase().includes(normalized),
    )
  );
}

interface SettingsSectionProps extends ComponentPropsWithoutRef<"section"> {
  title?: string;
  description?: string;
  bodyClassName?: string;
}

const SettingsSection = forwardRef<HTMLElement, SettingsSectionProps>(
  function SettingsSection(
    { title, description, bodyClassName, className, children, ...props },
    ref,
  ) {
    if (title || description) {
      return (
        <PagePanel.CollapsibleSection
          ref={ref}
          as="section"
          expanded
          variant="section"
          heading={title ?? ""}
          description={description}
          bodyClassName={bodyClassName}
          className={className}
          {...props}
        >
          {children}
        </PagePanel.CollapsibleSection>
      );
    }

    return (
      <PagePanel
        ref={ref as never}
        as="section"
        variant="section"
        data-content-align-offset={4}
        className={className}
        {...props}
      >
        <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
      </PagePanel>
    );
  },
);

/* ── Updates Section ─────────────────────────────────────────────────── */

function UpdatesSection() {
  return <ReleaseCenterView />;
}

/* ── Advanced Section ─────────────────────────────────────────────────── */

function AdvancedSection() {
  const { t } = useApp();
  const {
    handleReset,
    exportBusy,
    exportPassword,
    exportIncludeLogs,
    exportError,
    exportSuccess,
    importBusy,
    importPassword,
    importFile,
    importError,
    importSuccess,
    handleAgentExport,
    handleAgentImport,
    setState,
  } = useApp();
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const resetExportState = useCallback(() => {
    setState("exportPassword", "");
    setState("exportIncludeLogs", false);
    setState("exportError", null);
    setState("exportSuccess", null);
  }, [setState]);

  const resetImportState = useCallback(() => {
    if (importFileInputRef.current) {
      importFileInputRef.current.value = "";
    }
    setState("importPassword", "");
    setState("importFile", null);
    setState("importError", null);
    setState("importSuccess", null);
  }, [setState]);

  const openExportModal = useCallback(() => {
    resetExportState();
    setExportModalOpen(true);
  }, [resetExportState]);

  const closeExportModal = useCallback(() => {
    setExportModalOpen(false);
    resetExportState();
  }, [resetExportState]);

  const openImportModal = useCallback(() => {
    resetImportState();
    setImportModalOpen(true);
  }, [resetImportState]);

  const closeImportModal = useCallback(() => {
    setImportModalOpen(false);
    resetImportState();
  }, [resetImportState]);

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Button
            variant="outline"
            type="button"
            onClick={openExportModal}
            className="min-h-[5.5rem] h-auto rounded-[calc(var(--radius-xl)+2px)] border border-border/50 bg-card/60 p-5 text-left backdrop-blur-md transition-[transform,border-color,background-color,box-shadow] group hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_4px_20px_rgba(var(--accent-rgb),0.1)]"
            aria-haspopup="dialog"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-bg-accent p-3 shadow-sm transition-all group-hover:border-accent group-hover:bg-accent">
              <Download className="h-5 w-5 shrink-0 text-txt transition-colors group-hover:text-accent-fg" />
            </div>
            <div>
              <div className="font-medium text-sm">
                {t("settings.exportAgent")}
              </div>
              <div className="text-xs text-muted">
                {t("settings.exportAgentShort")}
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            type="button"
            onClick={openImportModal}
            className="min-h-[5.5rem] h-auto rounded-[calc(var(--radius-xl)+2px)] border border-border/50 bg-card/60 p-5 text-left backdrop-blur-md transition-[transform,border-color,background-color,box-shadow] group hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_4px_20px_rgba(var(--accent-rgb),0.1)]"
            aria-haspopup="dialog"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-bg-accent p-3 shadow-sm transition-all group-hover:border-accent group-hover:bg-accent">
              <Upload className="h-5 w-5 shrink-0 text-txt transition-colors group-hover:text-accent-fg" />
            </div>
            <div>
              <div className="font-medium text-sm">
                {t("settings.importAgent")}
              </div>
              <div className="text-xs text-muted">
                {t("settings.importAgentShort")}
              </div>
            </div>
          </Button>
        </div>
        <div className="border border-danger/30 rounded-2xl overflow-hidden bg-bg/40 backdrop-blur-sm">
          <div className="bg-danger/10 px-5 py-3 border-b border-danger/20 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <span className="font-bold text-sm text-danger tracking-wide uppercase">
              {t("settings.dangerZone")}
            </span>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">
                  {t("settings.resetAgent")}
                </div>
                <div className="text-xs text-muted">
                  {t("settings.resetAgentHint")}
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                className="rounded-xl shadow-sm whitespace-nowrap"
                onClick={() => {
                  void handleReset();
                }}
              >
                {t("settings.resetEverything")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={exportModalOpen}
        onOpenChange={(open) => {
          if (!open) closeExportModal();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.exportAgent")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="settings-export-password"
                className="text-txt-strong"
              >
                {t("settingsview.Password")}
              </Label>
              <Input
                id="settings-export-password"
                type="password"
                value={exportPassword}
                onChange={(e) => setState("exportPassword", e.target.value)}
                placeholder={t("settingsview.EnterExportPasswor")}
                className="rounded-lg bg-bg"
              />
              <Label className="flex items-center gap-2 font-normal text-muted">
                <Checkbox
                  checked={exportIncludeLogs}
                  onCheckedChange={(checked) =>
                    setState("exportIncludeLogs", !!checked)
                  }
                />

                {t("settingsview.IncludeRecentLogs")}
              </Label>
            </div>

            {exportError && (
              <div
                className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                role="alert"
                aria-live="assertive"
              >
                {exportError}
              </div>
            )}
            {exportSuccess && (
              <div
                className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok"
                role="status"
                aria-live="polite"
              >
                {exportSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[2.625rem] px-4 rounded-[calc(var(--radius-lg)+2px)]"
                onClick={closeExportModal}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="min-h-[2.625rem] px-4 rounded-[calc(var(--radius-lg)+2px)]"
                disabled={exportBusy}
                onClick={() => void handleAgentExport()}
              >
                {exportBusy && <Spinner size={16} />}
                {t("common.export")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importModalOpen}
        onOpenChange={(open) => {
          if (!open) closeImportModal();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.importAgent")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <input
              ref={importFileInputRef}
              type="file"
              className="hidden"
              accept=".eliza-agent,.agent,application/octet-stream"
              onChange={(e) =>
                setState("importFile", e.target.files?.[0] ?? null)
              }
            />

            <div className="space-y-2">
              <div className="text-sm font-medium text-txt-strong">
                {t("settingsview.BackupFile")}
              </div>
              <Button
                variant="outline"
                className="min-h-[2.625rem] px-4 rounded-[calc(var(--radius-lg)+2px)] flex w-full items-center justify-between gap-3 text-left"
                onClick={() => importFileInputRef.current?.click()}
              >
                <span className="min-w-0 flex-1 truncate text-sm text-txt">
                  {importFile?.name ?? t("settingsview.ChooseAnExportedBack")}
                </span>
                <span className="shrink-0 text-xs font-medium text-txt">
                  {importFile
                    ? t("settings.change", { defaultValue: "Change" })
                    : t("settings.browse", { defaultValue: "Browse" })}
                </span>
              </Button>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="settings-import-password"
                className="text-txt-strong"
              >
                {t("settingsview.Password")}
              </Label>
              <Input
                id="settings-import-password"
                type="password"
                value={importPassword}
                onChange={(e) => setState("importPassword", e.target.value)}
                placeholder={t("settingsview.EnterImportPasswor")}
                className="rounded-lg bg-bg"
              />
            </div>

            {importError && (
              <div
                className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
                role="alert"
                aria-live="assertive"
              >
                {importError}
              </div>
            )}
            {importSuccess && (
              <div
                className="rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok"
                role="status"
                aria-live="polite"
              >
                {importSuccess}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                className="min-h-[2.625rem] px-4 rounded-[calc(var(--radius-lg)+2px)]"
                onClick={closeImportModal}
              >
                {t("common.cancel")}
              </Button>
              <Button
                variant="default"
                size="sm"
                className="min-h-[2.625rem] px-4 rounded-[calc(var(--radius-lg)+2px)]"
                disabled={importBusy}
                onClick={() => void handleAgentImport()}
              >
                {importBusy && <Spinner size={16} />}
                {t("settings.import")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Steward Wallet Section ───────────────────────────────────────────── */

function CopyableAddress({
  label,
  address,
}: {
  label: string;
  address: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [address]);

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-bg/50 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-muted">{label}</div>
        <div className="mt-0.5 truncate font-mono text-xs text-txt">
          {address}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted hover:text-txt"
        onClick={handleCopy}
        aria-label={`Copy ${label} address`}
      >
        {copied ? (
          <span className="text-ok text-xs">✓</span>
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

function StewardWalletInfo({
  stewardStatus,
  onScrollToPolicies,
}: {
  stewardStatus: StewardStatusResponse;
  onScrollToPolicies: () => void;
}) {
  const { t } = useApp();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const evmAddress =
    stewardStatus.walletAddresses?.evm ?? stewardStatus.evmAddress ?? null;
  const solanaAddress = stewardStatus.walletAddresses?.solana ?? null;

  return (
    <div className="space-y-4">
      {/* Steward status banner */}
      <div className="flex items-center gap-3 rounded-lg border border-accent/20 bg-accent/5 p-3">
        <Shield className="h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-txt">
            {t("settings.stewardWalletManaged", {
              defaultValue: "Your agent's wallet is managed by Steward",
            })}
          </div>
          <div className="mt-0.5 text-[11px] text-muted">
            {stewardStatus.vaultHealth === "ok"
              ? t("settings.stewardVaultHealthy", {
                  defaultValue: "Vault connected and healthy",
                })
              : stewardStatus.vaultHealth === "degraded"
                ? t("settings.stewardVaultDegraded", {
                    defaultValue: "Vault connected — degraded",
                  })
                : t("settings.stewardVaultError", {
                    defaultValue: "Vault connected — error state",
                  })}
          </div>
        </div>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${
            stewardStatus.vaultHealth === "ok"
              ? "bg-ok"
              : stewardStatus.vaultHealth === "degraded"
                ? "bg-warn"
                : "bg-danger"
          }`}
        />
      </div>

      {/* Wallet addresses */}
      <div className="space-y-2">
        {evmAddress && (
          <CopyableAddress label="EVM Address" address={evmAddress} />
        )}
        {solanaAddress && (
          <CopyableAddress label="Solana Address" address={solanaAddress} />
        )}
        {!evmAddress && !solanaAddress && (
          <div className="rounded-lg border border-border/50 bg-bg/50 px-3 py-2.5 text-xs text-muted">
            {t("settings.stewardNoAddresses", {
              defaultValue:
                "No vault addresses available yet. Check steward configuration.",
            })}
          </div>
        )}
      </div>

      {/* Link to Wallet Policies */}
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-center gap-2 text-xs"
        onClick={onScrollToPolicies}
      >
        <Shield className="h-3.5 w-3.5" />
        {t("settings.viewWalletPolicies", {
          defaultValue: "View Wallet Policies",
        })}
      </Button>

      {/* RPC configuration — always visible */}
      <div className="border-t border-border/50 pt-4">
        <div className="text-xs font-semibold text-txt mb-2">
          {t("settings.rpcConfiguration", {
            defaultValue: "RPC Configuration",
          })}
        </div>
        <ConfigPageView embedded />
      </div>

      {/* Advanced: show local key import */}
      <div className="border-t border-border/50 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-xs text-muted hover:text-txt"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {t("settings.showAdvancedKeyManagement", {
            defaultValue: "Advanced key management",
          })}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? "rotate-180" : ""}`}
          />
        </Button>
        {showAdvanced && (
          <div className="mt-3 rounded-lg border border-warn/20 bg-warn/5 p-3">
            <div className="mb-2 flex items-center gap-2 text-[11px] text-warn">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("settings.advancedKeyWarning", {
                defaultValue:
                  "Local keys are not needed when Steward manages your wallet. Only use this if you know what you're doing.",
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── SettingsView ─────────────────────────────────────────────────────── */

export function SettingsView({
  inModal,
  onClose: _onClose,
  initialSection,
}: {
  inModal?: boolean;
  onClose?: () => void;
  initialSection?: string;
} = {}) {
  const { t, loadPlugins } = useApp();
  const [activeSection, setActiveSection] = useState(initialSection ?? "cloud");
  const [searchQuery, setSearchQuery] = useState("");
  const shellRef = useRef<HTMLDivElement>(null);

  /* ── Steward status ─────────────────────────────────────────────────── */
  const [stewardStatus, setStewardStatus] =
    useState<StewardStatusResponse | null>(null);
  const stewardConnected = stewardStatus?.connected === true;

  useEffect(() => {
    let cancelled = false;
    client
      .getStewardStatus()
      .then((status) => {
        if (!cancelled) setStewardStatus(status);
      })
      .catch(() => {
        /* steward not available — leave null */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /* Dynamic section definitions based on steward status */
  const effectiveSections = useMemo(() => {
    if (!stewardConnected) return SETTINGS_SECTIONS;
    return SETTINGS_SECTIONS.map((section) =>
      section.id === "wallet-rpc"
        ? {
            ...section,
            label: "settings.sections.wallet.label" as const,
            description: "settings.sections.wallet.stewardDesc" as const,
          }
        : section,
    );
  }, [stewardConnected]);

  const visibleSections = useMemo(
    () =>
      effectiveSections.filter((section) =>
        matchesSettingsSection(section, searchQuery, t),
      ),
    [effectiveSections, searchQuery, t],
  );
  const visibleSectionIds = useMemo(
    () => new Set(visibleSections.map((section) => section.id)),
    [visibleSections],
  );
  const {
    contentContainerRef,
    queueContentAlignment,
    registerContentItem,
    registerSidebarItem,
  } = useLinkedSidebarSelection<string>({
    contentTopOffset: 24,
    enabled: visibleSections.length > 0,
    selectedId: visibleSectionIds.has(activeSection) ? activeSection : null,
    topAlignedId: visibleSections[0]?.id ?? null,
  });

  useEffect(() => {
    void loadPlugins();
  }, [loadPlugins]);

  const handleSectionChange = useCallback(
    (sectionId: string) => {
      setActiveSection(sectionId);
      queueContentAlignment(sectionId);
    },
    [queueContentAlignment],
  );

  const scrollToPolicies = useCallback(() => {
    handleSectionChange("wallet-policies");
  }, [handleSectionChange]);

  useEffect(() => {
    if (visibleSections.length === 0) return;
    if (!visibleSectionIds.has(activeSection)) {
      setActiveSection(visibleSections[0].id);
    }
  }, [activeSection, visibleSectionIds, visibleSections]);

  useEffect(() => {
    if (!initialSection) return;
    handleSectionChange(initialSection);
  }, [handleSectionChange, initialSection]);

  useEffect(() => {
    const shell = shellRef.current;
    const root = contentContainerRef.current;
    if (!shell || !root) return;

    const handleScroll = () => {
      const sections = visibleSections
        .map((section) => {
          const el = shell.querySelector(`#${section.id}`);
          return { id: section.id, el };
        })
        .filter(
          (section): section is { id: string; el: HTMLElement } =>
            section.el instanceof HTMLElement,
        );

      if (sections.length === 0) return;

      if (
        root.scrollHeight - Math.ceil(root.scrollTop) <=
        root.clientHeight + 10
      ) {
        setActiveSection(sections[sections.length - 1].id);
        return;
      }

      const rootRect = root.getBoundingClientRect();
      let currentSection = sections[0].id;

      for (const { id, el } of sections) {
        const elRect = el.getBoundingClientRect();
        if (elRect.top - rootRect.top <= 150) {
          currentSection = id;
        }
      }

      setActiveSection((prev) =>
        prev !== currentSection ? currentSection : prev,
      );
    };

    root.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => root.removeEventListener("scroll", handleScroll);
  }, [contentContainerRef, visibleSections]);

  const searchLabel = t("settingsview.SearchSettings", {
    defaultValue: "Search settings",
  });
  const activeSectionDef =
    visibleSections.find((section) => section.id === activeSection) ??
    effectiveSections.find((section) => section.id === activeSection) ??
    visibleSections[0] ??
    null;

  const settingsSidebar = (
    <Sidebar
      testId="settings-sidebar"
      collapsible
      contentIdentity="settings"
      collapseButtonTestId="settings-sidebar-collapse-toggle"
      expandButtonTestId="settings-sidebar-expand-toggle"
      collapseButtonAriaLabel="Collapse settings"
      expandButtonAriaLabel="Expand settings"
      mobileTitle={t("nav.settings")}
      mobileMeta={activeSectionDef ? t(activeSectionDef.label) : undefined}
      header={
        <SidebarHeader
          search={{
            value: searchQuery,
            onChange: (event) => setSearchQuery(event.target.value),
            onClear: () => setSearchQuery(""),
            placeholder: searchLabel,
            "aria-label": searchLabel,
            autoComplete: "off",
            spellCheck: false,
          }}
        />
      }
    >
      <SidebarScrollRegion>
        <SidebarPanel>
          {visibleSections.length === 0 ? (
            <SidebarContent.EmptyState className="px-4 py-6">
              {t("settingsview.NoMatchingSettings")}
            </SidebarContent.EmptyState>
          ) : (
            <nav className="space-y-1.5" aria-label={t("nav.settings")}>
              {visibleSections.map((section) => {
                const isActive = activeSection === section.id;
                return (
                  <SidebarContent.Item
                    key={section.id}
                    as="div"
                    active={isActive}
                    className="gap-2"
                    ref={registerSidebarItem(section.id)}
                  >
                    <SidebarContent.ItemButton
                      onClick={() => handleSectionChange(section.id)}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <SidebarContent.ItemBody>
                        <SidebarContent.ItemTitle
                          className={isActive ? "font-semibold" : "font-medium"}
                        >
                          {t(section.label)}
                        </SidebarContent.ItemTitle>
                        {section.description ? (
                          <SidebarContent.ItemDescription>
                            {t(section.description)}
                          </SidebarContent.ItemDescription>
                        ) : null}
                      </SidebarContent.ItemBody>
                    </SidebarContent.ItemButton>
                  </SidebarContent.Item>
                );
              })}
            </nav>
          )}
        </SidebarPanel>
      </SidebarScrollRegion>
    </Sidebar>
  );

  const sectionsContent = (
    <>
      {visibleSectionIds.has("cloud") && (
        <SettingsSection
          id="cloud"
          className="relative overflow-hidden"
          bodyClassName="p-0"
          ref={registerContentItem("cloud")}
        >
          <CloudDashboard />
        </SettingsSection>
      )}

      {visibleSectionIds.has("ai-model") && (
        <SettingsSection
          id="ai-model"
          title={t("settings.sections.aimodel.label")}
          description={t("settings.sections.aimodel.desc")}
          ref={registerContentItem("ai-model")}
        >
          <ProviderSwitcher />
        </SettingsSection>
      )}

      {visibleSectionIds.has("coding-agents") && (
        <SettingsSection
          id="coding-agents"
          title={t("settings.sections.codingagents.label")}
          description={t("settings.codingAgentsDescription")}
          ref={registerContentItem("coding-agents")}
        >
          <CodingAgentSettingsSection />
        </SettingsSection>
      )}

      {visibleSectionIds.has("wallet-rpc") && (
        <SettingsSection
          id="wallet-rpc"
          title={
            stewardConnected
              ? t("settings.sections.wallet.label", {
                  defaultValue: "Wallet",
                })
              : t("settings.sections.walletrpc.label")
          }
          description={
            stewardConnected
              ? t("settings.sections.wallet.stewardDesc", {
                  defaultValue: "Managed by Steward vault",
                })
              : t("settings.walletRpcDescription")
          }
          ref={registerContentItem("wallet-rpc")}
        >
          {stewardConnected && stewardStatus ? (
            <StewardWalletInfo
              stewardStatus={stewardStatus}
              onScrollToPolicies={scrollToPolicies}
            />
          ) : (
            <ConfigPageView embedded />
          )}
        </SettingsSection>
      )}

      {visibleSectionIds.has("wallet-policies") && (
        <SettingsSection
          id="wallet-policies"
          title={t("settings.sections.walletpolicies.label", {
            defaultValue: "Wallet Policies",
          })}
          description={t("settings.sections.walletpolicies.desc", {
            defaultValue:
              "Spending limits, address controls, rate limits, and transaction safety rules",
          })}
          ref={registerContentItem("wallet-policies")}
        >
          <PolicyControlsView />
        </SettingsSection>
      )}

      {visibleSectionIds.has("media") && (
        <SettingsSection
          id="media"
          title={t("settings.sections.media.label")}
          description={t("settings.sections.media.desc")}
          ref={registerContentItem("media")}
        >
          <MediaSettingsSection />
        </SettingsSection>
      )}

      {visibleSectionIds.has("permissions") && (
        <SettingsSection
          id="permissions"
          title={t("settings.sections.permissions.label")}
          description={t("settings.sections.permissions.desc")}
          ref={registerContentItem("permissions")}
        >
          <PermissionsSection />
        </SettingsSection>
      )}

      {visibleSectionIds.has("updates") && (
        <SettingsSection
          id="updates"
          title={t("settings.sections.updates.label")}
          description={t("settings.sections.updates.desc")}
          ref={registerContentItem("updates")}
        >
          <UpdatesSection />
        </SettingsSection>
      )}

      {visibleSectionIds.has("advanced") && (
        <SettingsSection
          id="advanced"
          title={t("nav.advanced")}
          description={t("settings.sections.advanced.desc")}
          ref={registerContentItem("advanced")}
        >
          <AdvancedSection />
        </SettingsSection>
      )}

      {visibleSections.length === 0 && (
        <SettingsSection
          id="settings-empty"
          title={t("settingsview.NoMatchingSettings")}
          description={t("settings.noMatchingSettingsDescription")}
        >
          <Button
            variant="outline"
            className="min-h-[2.625rem] px-4 rounded-[calc(var(--radius-lg)+2px)]"
            onClick={() => setSearchQuery("")}
          >
            {t("settingsview.ClearSearch")}
          </Button>
        </SettingsSection>
      )}
    </>
  );

  return (
    <PageLayout
      className={cn("h-full", inModal && "min-h-0")}
      data-testid="settings-shell"
      sidebar={settingsSidebar}
      contentRef={contentContainerRef}
      contentClassName={SETTINGS_CONTENT_CLASS}
      contentInnerClassName={SETTINGS_CONTENT_WIDTH_CLASS}
      mobileSidebarLabel={
        activeSectionDef ? t(activeSectionDef.label) : t("nav.settings")
      }
    >
      <div ref={shellRef} className={`w-full ${SETTINGS_SECTION_STACK_CLASS}`}>
        {sectionsContent}
      </div>
    </PageLayout>
  );
}
