/**
 * Plugins view — tag-filtered plugin management.
 *
 * Renders a unified plugin list with searchable/filterable cards and per-plugin settings.
 */

import {
  AdminDialog,
  Button,
  Dialog,
  DialogDescription,
  DialogTitle,
  Input,
  PageLayout,
  PageLayoutHeader,
  PagePanel,
  Select,
  SelectContent,
  SelectItem,
  SelectValue,
  SettingsControls,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarPanel,
  SidebarScrollRegion,
  StatusBadge,
  useLinkedSidebarSelection,
} from "@miladyai/ui";
import { ChevronRight, Package } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PluginInfo, PluginParamDef } from "../../api";
import { client } from "../../api";
import { useApp } from "../../state";
import { openExternalUrl } from "../../utils";
import { WhatsAppQrOverlay } from "../connectors/WhatsAppQrOverlay";

import {
  type PluginsViewMode,
  type StatusFilter,
  SUBGROUP_LABELS,
  SUBGROUP_NAV_ICONS,
  buildPluginListState,
  getPluginResourceLinks,
  iconImageSource,
  pluginResourceLinkLabel,
  resolveIcon,
  subgroupForPlugin,
} from "./plugin-list-utils";
export { paramsToSchema } from "./plugin-list-utils";

import {
  PluginConfigForm,
  TelegramPluginConfig,
} from "./PluginConfigForm";

import { PluginCard } from "./PluginCard";

/* ── Shared PluginListView ─────────────────────────────────────────── */

interface PluginListViewProps {
  /** Label used in search placeholder and empty state messages. */
  label: string;
  /** Optional shared content header rendered above the content pane. */
  contentHeader?: ReactNode;
  /** Optional list mode for pre-filtered views like Connectors. */
  mode?: PluginsViewMode;
  /** Whether the view is rendered in a full-screen gamified modal. */
  inModal?: boolean;
}

function PluginListView({
  label,
  contentHeader,
  mode = "all",
  inModal,
}: PluginListViewProps) {
  const {
    plugins,
    pluginStatusFilter,
    pluginSearch,
    pluginSettingsOpen,
    pluginSaving,
    pluginSaveSuccess,
    loadPlugins,
    ensurePluginsLoaded = async () => {
      await loadPlugins();
    },
    handlePluginToggle,
    handlePluginConfigSave,
    setActionNotice,
    setState,
    t,
  } = useApp();

  const [pluginConfigs, setPluginConfigs] = useState<
    Record<string, Record<string, string>>
  >({});
  const [testResults, setTestResults] = useState<
    Map<
      string,
      {
        success: boolean;
        message?: string;
        error?: string;
        durationMs: number;
        loading: boolean;
      }
    >
  >(new Map());
  const [addDirOpen, setAddDirOpen] = useState(false);
  const [addDirPath, setAddDirPath] = useState("");
  const [addDirLoading, setAddDirLoading] = useState(false);
  const [installingPlugins, setInstallingPlugins] = useState<Set<string>>(
    new Set(),
  );
  const [installProgress, setInstallProgress] = useState<
    Map<string, { phase: string; message: string }>
  >(new Map());
  const pluginDescriptionFallback = t("pluginsview.NoDescriptionAvailable", {
    defaultValue: "No description available",
  });
  const installProgressLabel = (message?: string) =>
    message ||
    t("pluginsview.Installing", {
      defaultValue: "Installing...",
    });
  const installPluginLabel = t("pluginsview.InstallPlugin", {
    defaultValue: "Install Plugin",
  });
  const installLabel = t("pluginsview.Install", {
    defaultValue: "Install",
  });
  const testingLabel = t("pluginsview.Testing", {
    defaultValue: "Testing...",
  });
  const saveSettingsLabel = t("pluginsview.SaveSettings", {
    defaultValue: "Save Settings",
  });
  const saveLabel = t("common.save", { defaultValue: "Save" });
  const savingLabel = t("apikeyconfig.saving", {
    defaultValue: "Saving...",
  });
  const savedLabel = t("pluginsview.Saved", {
    defaultValue: "Saved",
  });
  const savedWithBangLabel = t("pluginsview.SavedWithBang", {
    defaultValue: "Saved!",
  });
  const readyLabel = t("pluginsview.Ready", { defaultValue: "Ready" });
  const needsSetupLabel = t("pluginsview.NeedsSetup", {
    defaultValue: "Needs setup",
  });
  const loadFailedLabel = t("pluginsview.LoadFailed", {
    defaultValue: "Load failed",
  });
  const notInstalledLabel = t("pluginsview.NotInstalled", {
    defaultValue: "Not installed",
  });
  const expandLabel = t("pluginsview.Expand", { defaultValue: "Expand" });
  const collapseLabel = t("pluginsview.Collapse", {
    defaultValue: "Collapse",
  });
  const noConfigurationNeededLabel = t("pluginsview.NoConfigurationNeeded", {
    defaultValue: "No configuration needed.",
  });
  const connectorInstallPrompt = t("pluginsview.InstallConnectorPrompt", {
    defaultValue: "Install this connector to activate it in the runtime.",
  });
  const formatTestConnectionLabel = (result?: {
    success: boolean;
    error?: string;
    durationMs: number;
    loading: boolean;
  }) => {
    if (result?.loading) return testingLabel;
    if (result?.success) {
      return t("pluginsview.ConnectionTestPassed", {
        durationMs: result.durationMs,
        defaultValue: "OK ({{durationMs}}ms)",
      });
    }
    if (result?.error) {
      return t("pluginsview.ConnectionTestFailed", {
        error: result.error,
        defaultValue: "Failed: {{error}}",
      });
    }
    return t("pluginsview.TestConnection");
  };
  const formatDialogTestConnectionLabel = (result?: {
    success: boolean;
    error?: string;
    durationMs: number;
    loading: boolean;
  }) => {
    if (result?.loading) return testingLabel;
    if (result?.success) {
      return t("pluginsview.ConnectionTestPassedDialog", {
        durationMs: result.durationMs,
        defaultValue: "✓ OK ({{durationMs}}ms)",
      });
    }
    if (result?.error) {
      return t("pluginsview.ConnectionTestFailedDialog", {
        error: result.error,
        defaultValue: "✕ {{error}}",
      });
    }
    return t("pluginsview.TestConnection");
  };
  const formatSaveSettingsLabel = (isSaving: boolean, didSave: boolean) => {
    if (isSaving) return savingLabel;
    if (didSave) return savedLabel;
    return saveSettingsLabel;
  };
  const [togglingPlugins, setTogglingPlugins] = useState<Set<string>>(
    new Set(),
  );
  const hasPluginToggleInFlight = togglingPlugins.size > 0;
  const [pluginOrder, setPluginOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("pluginOrder");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragRef = useRef<string | null>(null);
  const isConnectorShellMode = mode === "social";
  const isSocialMode = mode === "social" || mode === "all-social";
  const isSidebarEditorShellMode = mode === "social" || mode === "all-social";
  const isConnectorLikeMode = mode === "connectors" || mode === "social";
  const resultLabel = mode === "social" ? "connectors" : label.toLowerCase();
  const effectiveStatusFilter: StatusFilter = isSidebarEditorShellMode
    ? pluginStatusFilter
    : "all";
  const effectiveSearch = isSidebarEditorShellMode ? pluginSearch : "";

  const allowCustomOrder = !isSocialMode;
  const showPluginManagementActions = !isSocialMode;

  // Load plugins on mount
  useEffect(() => {
    void ensurePluginsLoaded();
  }, [ensurePluginsLoaded]);

  // Listen for install progress events via WebSocket
  useEffect(() => {
    const unbind = client.onWsEvent(
      "install-progress",
      (data: Record<string, unknown>) => {
        const pluginName = data.pluginName as string;
        const phase = data.phase as string;
        const message = data.message as string;
        if (!pluginName) return;
        if (phase === "complete" || phase === "error") {
          setInstallProgress((prev) => {
            const next = new Map(prev);
            next.delete(pluginName);
            return next;
          });
        } else {
          setInstallProgress((prev) =>
            new Map(prev).set(pluginName, { phase, message }),
          );
        }
      },
    );
    return unbind;
  }, []);

  // Persist custom order
  useEffect(() => {
    if (pluginOrder.length > 0) {
      localStorage.setItem("pluginOrder", JSON.stringify(pluginOrder));
    }
  }, [pluginOrder]);

  const [subgroupFilter, setSubgroupFilter] = useState<string>("all");
  const showSubgroupFilters =
    mode !== "connectors" && mode !== "streaming" && mode !== "social";
  const showDesktopSubgroupSidebar = showSubgroupFilters;
  const {
    categoryPlugins: _categoryPlugins,
    enabledCount: _enabledCount,
    nonDbPlugins,
    sorted,
    subgroupTags,
    visiblePlugins,
  } = useMemo(
    () =>
      buildPluginListState({
        allowCustomOrder,
        effectiveSearch,
        effectiveStatusFilter,
        isConnectorLikeMode,
        mode,
        pluginOrder,
        plugins,
        showSubgroupFilters,
        subgroupFilter,
      }),
    [
      allowCustomOrder,
      effectiveSearch,
      effectiveStatusFilter,
      isConnectorLikeMode,
      mode,
      pluginOrder,
      plugins,
      showSubgroupFilters,
      subgroupFilter,
    ],
  );

  useEffect(() => {
    if (!showSubgroupFilters) return;
    if (subgroupFilter === "all") return;
    if (!subgroupTags.some((tag) => tag.id === subgroupFilter)) {
      setSubgroupFilter("all");
    }
  }, [showSubgroupFilters, subgroupFilter, subgroupTags]);

  const renderSubgroupFilterButton = useCallback(
    (
      tag: { id: string; label: string; count: number },
      options?: { sidebar?: boolean },
    ) => {
      const isActive = subgroupFilter === tag.id;
      if (options?.sidebar) {
        const Icon = SUBGROUP_NAV_ICONS[tag.id] ?? Package;
        return (
          <SidebarContent.Item
            key={tag.id}
            as="button"
            onClick={() => setSubgroupFilter(tag.id)}
            aria-current={isActive ? "page" : undefined}
            active={isActive}
            className="items-center"
          >
            <SidebarContent.ItemIcon active={isActive}>
              <Icon className="h-4 w-4" />
            </SidebarContent.ItemIcon>
            <SidebarContent.ItemBody>
              <SidebarContent.ItemTitle className="whitespace-nowrap break-normal [overflow-wrap:normal]">
                {tag.label}
              </SidebarContent.ItemTitle>
              <SidebarContent.ItemDescription>
                {t("pluginsview.AvailableCount", {
                  count: tag.count,
                  defaultValue: "{{count}} available",
                })}
              </SidebarContent.ItemDescription>
            </SidebarContent.ItemBody>
            <PagePanel.Meta
              compact
              tone={isActive ? "accent" : "default"}
              className="text-[10px] font-bold tracking-[0.16em]"
            >
              {tag.count}
            </PagePanel.Meta>
          </SidebarContent.Item>
        );
      }

      return (
        <Button
          key={tag.id}
          variant={isActive ? "default" : "outline"}
          size="sm"
          className={`h-7 px-3 text-[11px] font-bold tracking-wide rounded-lg transition-all ${
            isActive
              ? "border-accent/55 bg-accent/16 text-txt-strong shadow-sm"
              : "bg-card/40 backdrop-blur-sm border-border/40 text-muted hover:text-txt shadow-sm hover:border-accent/30"
          }`}
          onClick={() => setSubgroupFilter(tag.id)}
        >
          {tag.label}
          <span
            className={`ml-1.5 rounded border px-1.5 py-0.5 text-[9px] font-mono leading-none ${
              isActive
                ? "border-accent/30 bg-accent/12 text-txt-strong"
                : "border-border/50 bg-bg-accent/80 text-muted-strong"
            }`}
          >
            {tag.count}
          </span>
        </Button>
      );
    },
    [subgroupFilter, t],
  );

  const toggleSettings = (pluginId: string) => {
    const next = new Set<string>();
    if (!pluginSettingsOpen.has(pluginId)) next.add(pluginId);
    setState("pluginSettingsOpen", next);
  };

  const handleParamChange = (
    pluginId: string,
    paramKey: string,
    value: string,
  ) => {
    setPluginConfigs((prev) => ({
      ...prev,
      [pluginId]: { ...prev[pluginId], [paramKey]: value },
    }));
  };

  const handleConfigSave = async (pluginId: string) => {
    if (pluginId === "__ui-showcase__") return;
    const config = pluginConfigs[pluginId] ?? {};
    await handlePluginConfigSave(pluginId, config);
    setPluginConfigs((prev) => {
      const next = { ...prev };
      delete next[pluginId];
      return next;
    });
  };

  const handleConfigReset = (pluginId: string) => {
    setPluginConfigs((prev) => {
      const next = { ...prev };
      delete next[pluginId];
      return next;
    });
  };

  const handleTestConnection = async (pluginId: string) => {
    setTestResults((prev) => {
      const next = new Map(prev);
      next.set(pluginId, { success: false, loading: true, durationMs: 0 });
      return next;
    });
    try {
      const result = await client.testPluginConnection(pluginId);
      setTestResults((prev) => {
        const next = new Map(prev);
        next.set(pluginId, { ...result, loading: false });
        return next;
      });
    } catch (err) {
      setTestResults((prev) => {
        const next = new Map(prev);
        next.set(pluginId, {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          loading: false,
          durationMs: 0,
        });
        return next;
      });
    }
  };

  const handleInstallPlugin = async (pluginId: string, npmName: string) => {
    setInstallingPlugins((prev) => new Set(prev).add(pluginId));
    try {
      await client.installRegistryPlugin(npmName);
      await loadPlugins();
      setActionNotice(
        t("pluginsview.PluginInstalledRestartRequired", {
          plugin: npmName,
          defaultValue: "{{plugin}} installed. Restart required to activate.",
        }),
        "success",
      );
    } catch (err) {
      setActionNotice(
        t("pluginsview.PluginInstallFailed", {
          plugin: npmName,
          message: err instanceof Error ? err.message : "unknown error",
          defaultValue: "Failed to install {{plugin}}: {{message}}",
        }),
        "error",
        3800,
      );
      // Still try to refresh in case install succeeded but restart failed
      try {
        await loadPlugins();
      } catch {
        /* ignore */
      }
    } finally {
      setInstallingPlugins((prev) => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  };

  const handleTogglePlugin = useCallback(
    async (pluginId: string, enabled: boolean) => {
      let shouldStart = false;
      setTogglingPlugins((prev) => {
        if (prev.has(pluginId) || prev.size > 0) return prev;
        shouldStart = true;
        return new Set(prev).add(pluginId);
      });
      if (!shouldStart) return;

      try {
        await handlePluginToggle(pluginId, enabled);
      } finally {
        setTogglingPlugins((prev) => {
          const next = new Set(prev);
          next.delete(pluginId);
          return next;
        });
      }
    },
    [handlePluginToggle],
  );

  const handleOpenPluginExternalUrl = useCallback(
    async (url: string) => {
      try {
        await openExternalUrl(url);
      } catch (err) {
        setActionNotice(
          err instanceof Error ? err.message : "Failed to open external link.",
          "error",
          4200,
        );
      }
    },
    [setActionNotice],
  );

  const handleAddFromDirectory = async () => {
    const trimmed = addDirPath.trim();
    if (!trimmed) return;
    setAddDirLoading(true);
    try {
      await client.installRegistryPlugin(trimmed);
      await loadPlugins();
      setAddDirPath("");
      setAddDirOpen(false);
      setActionNotice(`Plugin installed from ${trimmed}`, "success");
    } catch (err) {
      setActionNotice(
        `Failed to add plugin: ${err instanceof Error ? err.message : "unknown error"}`,
        "error",
        3800,
      );
    }
    setAddDirLoading(false);
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent, pluginId: string) => {
      dragRef.current = pluginId;
      setDraggingId(pluginId);
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", pluginId);
    },
    [],
  );

  const handleDragOver = useCallback((e: React.DragEvent, pluginId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragRef.current && dragRef.current !== pluginId) {
      setDragOverId(pluginId);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const srcId = dragRef.current;
      if (!srcId || srcId === targetId) {
        dragRef.current = null;
        setDraggingId(null);
        setDragOverId(null);
        return;
      }
      // Materialize current sorted order, then splice
      if (!allowCustomOrder) return;
      setPluginOrder(() => {
        // Build full order: items in custom order first, then any new ones
        const allIds = nonDbPlugins.map((p: PluginInfo) => p.id);
        let ids: string[];
        if (pluginOrder.length > 0) {
          const known = new Set(pluginOrder);
          ids = [...pluginOrder, ...allIds.filter((id) => !known.has(id))];
        } else {
          ids = sorted.map((p: PluginInfo) => p.id);
          // Pad with any nonDbPlugins not currently in sorted (due to filters)
          const inSorted = new Set(ids);
          for (const id of allIds) {
            if (!inSorted.has(id)) ids.push(id);
          }
        }
        const fromIdx = ids.indexOf(srcId);
        const toIdx = ids.indexOf(targetId);
        if (fromIdx === -1 || toIdx === -1) return ids;
        ids.splice(fromIdx, 1);
        ids.splice(toIdx, 0, srcId);
        return ids;
      });
      dragRef.current = null;
      setDraggingId(null);
      setDragOverId(null);
    },
    [allowCustomOrder, nonDbPlugins, pluginOrder, sorted],
  );

  const handleDragEnd = useCallback(() => {
    dragRef.current = null;
    setDraggingId(null);
    setDragOverId(null);
  }, []);

  const handleResetOrder = useCallback(() => {
    setPluginOrder([]);
    localStorage.removeItem("pluginOrder");
  }, []);

  const renderResolvedIcon = useCallback(
    (
      plugin: PluginInfo,
      options?: {
        className?: string;
        emojiClassName?: string;
      },
    ) => {
      const icon = resolveIcon(plugin);
      if (!icon) {
        return <span className={options?.emojiClassName ?? "text-sm"}>🧩</span>;
      }
      if (typeof icon === "string") {
        const imageSrc = iconImageSource(icon);
        return imageSrc ? (
          <img
            src={imageSrc}
            alt=""
            className={
              options?.className ?? "w-5 h-5 rounded-sm object-contain"
            }
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <span className={options?.emojiClassName ?? "text-sm"}>{icon}</span>
        );
      }
      const IconComponent = icon;
      return <IconComponent className={options?.className ?? "w-5 h-5"} />;
    },
    [],
  );

  /** Render a grid of plugin cards. */
  const renderPluginGrid = (plugins: PluginInfo[]) => (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 m-0 p-0 list-none">
      {plugins.map((p: PluginInfo) => (
        <PluginCard
          key={p.id}
          plugin={p}
          allowCustomOrder={allowCustomOrder}
          pluginSettingsOpen={pluginSettingsOpen}
          togglingPlugins={togglingPlugins}
          hasPluginToggleInFlight={hasPluginToggleInFlight}
          installingPlugins={installingPlugins}
          installProgress={installProgress}
          draggingId={draggingId}
          dragOverId={dragOverId}
          pluginDescriptionFallback={pluginDescriptionFallback}
          onToggle={handleTogglePlugin}
          onToggleSettings={toggleSettings}
          onInstall={handleInstallPlugin}
          onOpenExternalUrl={handleOpenPluginExternalUrl}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onDragEnd={handleDragEnd}
          installProgressLabel={installProgressLabel}
          installLabel={installLabel}
          loadFailedLabel={loadFailedLabel}
          notInstalledLabel={notInstalledLabel}
        />
      ))}
    </ul>
  );

  // Resolve the plugin whose settings dialog is currently open.
  // Exclude ai-provider plugins — those are configured in Settings.
  const settingsDialogPlugin =
    Array.from(pluginSettingsOpen)
      .map((id) => nonDbPlugins.find((plugin) => plugin.id === id) ?? null)
      .find((plugin) => (plugin?.parameters?.length ?? 0) > 0) ?? null;
  const [gameSelectedId, setGameSelectedId] = useState<string | null>(null);
  const [gameMobileDetail, setGameMobileDetail] = useState(false);
  const gameNarrow =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(max-width: 600px)").matches
      : false;
  const readDesktopConnectorLayout = () =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(min-width: 1024px)").matches
      : false;
  const initialDesktopConnectorLayout = readDesktopConnectorLayout();
  const [connectorExpandedIds, setConnectorExpandedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [connectorSelectedId, setConnectorSelectedId] = useState<string | null>(
    () =>
      isSidebarEditorShellMode && initialDesktopConnectorLayout
        ? (visiblePlugins[0]?.id ?? null)
        : null,
  );
  const [desktopConnectorLayout, setDesktopConnectorLayout] = useState(
    initialDesktopConnectorLayout,
  );
  const {
    contentContainerRef: connectorContentRef,
    queueContentAlignment: queueConnectorContentAlignment,
    registerContentItem: registerConnectorContentItem,
    registerRailItem: registerConnectorRailItem,
    registerSidebarItem: registerConnectorSidebarItem,
    registerSidebarViewport: registerConnectorSidebarViewport,
    scrollContentToItem: scrollConnectorIntoView,
  } = useLinkedSidebarSelection<string>({
    contentTopOffset: 0,
    enabled: isSidebarEditorShellMode,
    selectedId: connectorSelectedId,
    topAlignedId: visiblePlugins[0]?.id ?? null,
  });

  // Auto-select first visible plugin in game modal
  const gameVisiblePlugins = visiblePlugins.filter(
    (p: PluginInfo) => p.id !== "__ui-showcase__",
  );
  const effectiveGameSelected = gameVisiblePlugins.find(
    (p: PluginInfo) => p.id === gameSelectedId,
  )
    ? gameSelectedId
    : (gameVisiblePlugins[0]?.id ?? null);
  const selectedPlugin =
    gameVisiblePlugins.find(
      (p: PluginInfo) => p.id === effectiveGameSelected,
    ) ?? null;
  const selectedPluginLinks = selectedPlugin
    ? getPluginResourceLinks(selectedPlugin)
    : [];

  useEffect(() => {
    if (!isConnectorShellMode) return;
    if (pluginStatusFilter !== "disabled") return;
    setState("pluginStatusFilter", "all");
  }, [isConnectorShellMode, pluginStatusFilter, setState]);

  useEffect(() => {
    if (!isSidebarEditorShellMode) return;
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;

    const media = window.matchMedia("(min-width: 1024px)");
    const syncLayout = () => {
      setDesktopConnectorLayout(media.matches);
    };

    syncLayout();
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", syncLayout);
      return () => media.removeEventListener("change", syncLayout);
    }

    media.addListener(syncLayout);
    return () => media.removeListener(syncLayout);
  }, [isSidebarEditorShellMode]);

  useEffect(() => {
    if (!isSidebarEditorShellMode) return;
    if (visiblePlugins.length === 0) {
      setConnectorSelectedId(null);
      setConnectorExpandedIds(new Set());
      return;
    }

    setConnectorSelectedId((prev) => {
      if (visiblePlugins.some((plugin) => plugin.id === prev)) {
        return prev;
      }
      return desktopConnectorLayout ? (visiblePlugins[0]?.id ?? null) : null;
    });
    setConnectorExpandedIds((prev) => {
      const next = new Set(
        [...prev].filter((id) =>
          visiblePlugins.some((plugin) => plugin.id === id),
        ),
      );
      if (next.size === prev.size) return prev;
      return next;
    });
  }, [desktopConnectorLayout, isSidebarEditorShellMode, visiblePlugins]);

  const handleConnectorSelect = useCallback(
    (pluginId: string) => {
      setConnectorSelectedId(pluginId);
      if (desktopConnectorLayout) {
        setConnectorExpandedIds(new Set([pluginId]));
        queueConnectorContentAlignment(pluginId);
      } else {
        scrollConnectorIntoView(pluginId);
      }
    },
    [
      desktopConnectorLayout,
      queueConnectorContentAlignment,
      scrollConnectorIntoView,
    ],
  );

  const handleConnectorExpandedChange = useCallback(
    (pluginId: string, nextExpanded: boolean) => {
      setConnectorSelectedId(pluginId);
      if (desktopConnectorLayout) {
        setConnectorExpandedIds((prev) => {
          if (nextExpanded) {
            if (prev.size === 1 && prev.has(pluginId)) return prev;
            return new Set([pluginId]);
          }
          if (!prev.has(pluginId)) return prev;
          return new Set();
        });
        if (nextExpanded) {
          queueConnectorContentAlignment(pluginId);
        }
        return;
      }

      setConnectorExpandedIds((prev) => {
        const isExpanded = prev.has(pluginId);
        if (isExpanded === nextExpanded) return prev;
        const next = new Set(prev);
        if (nextExpanded) next.add(pluginId);
        else next.delete(pluginId);
        return next;
      });
      if (nextExpanded) {
        scrollConnectorIntoView(pluginId);
      }
    },
    [
      desktopConnectorLayout,
      queueConnectorContentAlignment,
      scrollConnectorIntoView,
    ],
  );

  const handleConnectorSectionToggle = useCallback(
    (pluginId: string) => {
      handleConnectorExpandedChange(
        pluginId,
        !connectorExpandedIds.has(pluginId),
      );
    },
    [connectorExpandedIds, handleConnectorExpandedChange],
  );

  if (isSidebarEditorShellMode) {
    const shellEmptyTitle =
      mode === "social" ? "No connectors available" : "No plugins available";
    const shellEmptyDescription =
      mode === "social"
        ? "This workspace will list connector integrations as they become available."
        : "This workspace will list plugins here as they become available.";
    const sidebarSearchLabel =
      mode === "social" ? "Search connectors" : "Search plugins";
    const filterSelectLabel =
      subgroupTags.find((tag) => tag.id === subgroupFilter)?.label ?? "All";
    const hasActivePluginFilters =
      pluginSearch.trim().length > 0 || subgroupFilter !== "all";
    const desktopSidebar = desktopConnectorLayout ? (
      <Sidebar
        ref={registerConnectorSidebarViewport}
        testId="connectors-settings-sidebar"
        collapsible
        contentIdentity={mode === "social" ? "connectors" : "plugins"}
        header={
          <SidebarHeader
            search={{
              value: pluginSearch,
              onChange: (event) => setState("pluginSearch", event.target.value),
              onClear: () => setState("pluginSearch", ""),
              placeholder: sidebarSearchLabel,
              "aria-label": sidebarSearchLabel,
            }}
          />
        }
        collapsedRailItems={visiblePlugins.map((plugin) => {
          const isSelected = connectorSelectedId === plugin.id;
          return (
            <SidebarContent.RailItem
              key={plugin.id}
              ref={registerConnectorRailItem(plugin.id)}
              aria-label={plugin.name}
              title={plugin.name}
              active={isSelected}
              indicatorTone={plugin.enabled ? "accent" : undefined}
              onClick={() => handleConnectorSelect(plugin.id)}
            >
              <SidebarContent.RailMedia>
                {renderResolvedIcon(plugin)}
              </SidebarContent.RailMedia>
            </SidebarContent.RailItem>
          );
        })}
      >
        <SidebarScrollRegion>
          <SidebarPanel>
            <div className="mb-3">
              <Select
                value={subgroupFilter}
                onValueChange={(value) => setSubgroupFilter(value)}
              >
                <SettingsControls.SelectTrigger
                  aria-label={
                    mode === "social"
                      ? "Filter connector category"
                      : "Filter plugin category"
                  }
                  variant="filter"
                  className="w-full"
                >
                  <SelectValue>{filterSelectLabel}</SelectValue>
                </SettingsControls.SelectTrigger>
                <SelectContent>
                  {subgroupTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.label} ({tag.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {visiblePlugins.length === 0 ? (
              <SidebarContent.EmptyState className="px-4 py-6">
                {hasActivePluginFilters
                  ? `No ${resultLabel} match the current filters.`
                  : `No ${resultLabel} available.`}
              </SidebarContent.EmptyState>
            ) : (
              visiblePlugins.map((plugin) => {
                const isSelected = connectorSelectedId === plugin.id;
                const isExpanded = connectorExpandedIds.has(plugin.id);
                const isToggleBusy = togglingPlugins.has(plugin.id);
                const toggleDisabled =
                  isToggleBusy || (hasPluginToggleInFlight && !isToggleBusy);

                return (
                  <SidebarContent.Item
                    key={plugin.id}
                    as="div"
                    active={isSelected}
                    className="gap-2 scroll-mt-3"
                    ref={registerConnectorSidebarItem(plugin.id)}
                  >
                    <SidebarContent.ItemButton
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => handleConnectorSelect(plugin.id)}
                      aria-current={isSelected ? "page" : undefined}
                    >
                      <SidebarContent.ItemIcon active={isSelected}>
                        {renderResolvedIcon(plugin, {
                          className:
                            "h-4 w-4 shrink-0 rounded-sm object-contain",
                          emojiClassName: "text-sm",
                        })}
                      </SidebarContent.ItemIcon>
                      <SidebarContent.ItemBody>
                        <span className="block overflow-hidden text-[13px] leading-6 text-muted [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
                          <span className="mr-2 inline font-semibold text-txt">
                            {plugin.name}
                          </span>
                          <span className="inline whitespace-normal break-words [overflow-wrap:anywhere]">
                            {plugin.description || pluginDescriptionFallback}
                          </span>
                        </span>
                      </SidebarContent.ItemBody>
                    </SidebarContent.ItemButton>
                    <div className="flex shrink-0 flex-col items-end gap-2 self-stretch">
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-auto min-w-[3.5rem] rounded-full border px-2.5 py-1 text-[10px] font-bold tracking-[0.16em] transition-colors ${
                          plugin.enabled
                            ? "border-accent bg-accent text-accent-fg"
                            : "border-border bg-transparent text-muted hover:border-accent/40 hover:text-txt"
                        } ${
                          toggleDisabled
                            ? "cursor-not-allowed opacity-60"
                            : "cursor-pointer"
                        }`}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleTogglePlugin(plugin.id, !plugin.enabled);
                        }}
                        disabled={toggleDisabled}
                      >
                        {isToggleBusy
                          ? "..."
                          : plugin.enabled
                            ? t("common.on")
                            : t("common.off")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full text-muted hover:text-txt"
                        aria-label={`${isExpanded ? collapseLabel : expandLabel} ${plugin.name} in sidebar`}
                        onClick={(event) => {
                          event.stopPropagation();
                          handleConnectorSectionToggle(plugin.id);
                        }}
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            isExpanded ? "rotate-90" : ""
                          }`}
                        />
                      </Button>
                    </div>
                  </SidebarContent.Item>
                );
              })
            )}
          </SidebarPanel>
        </SidebarScrollRegion>
      </Sidebar>
    ) : null;

    const connectorContent = (
      <div className="w-full">
        {hasPluginToggleInFlight && (
          <PagePanel.Notice tone="accent" className="mb-4 text-[11px]">
            {t("pluginsview.ApplyingPluginChan")}
          </PagePanel.Notice>
        )}

        {visiblePlugins.length === 0 ? (
          <PagePanel.Empty
            variant="surface"
            className="min-h-[18rem] rounded-[1.6rem] px-5 py-10"
            description={
              hasActivePluginFilters
                ? `Try a different search or category filter for ${resultLabel}.`
                : shellEmptyDescription
            }
            title={
              hasActivePluginFilters
                ? `No ${resultLabel} match your filters`
                : shellEmptyTitle
            }
          />
        ) : (
          <div data-testid="connectors-settings-content" className="space-y-6">
            {(() => {
              // Group plugins by subgroup for visual categorization
              const groups: Array<{
                id: string;
                label: string;
                plugins: typeof visiblePlugins;
              }> = [];
              const groupMap = new Map<string, typeof visiblePlugins>();
              const groupOrder: string[] = [];
              for (const plugin of visiblePlugins) {
                const sg = subgroupForPlugin(plugin);
                if (!groupMap.has(sg)) {
                  groupMap.set(sg, []);
                  groupOrder.push(sg);
                }
                groupMap.get(sg)!.push(plugin);
              }
              for (const sg of groupOrder) {
                groups.push({
                  id: sg,
                  label: SUBGROUP_LABELS[sg] ?? sg,
                  plugins: groupMap.get(sg)!,
                });
              }
              return groups.map((group) => (
                <div
                  key={group.id}
                  className="relative rounded-xl border border-border/30 pt-5 pb-2 px-2"
                >
                  <span className="absolute -top-2.5 left-3 bg-bg px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    {group.label}
                  </span>
                  <div className="space-y-4">
                    {group.plugins.map((plugin) => {
              const hasParams =
                (plugin.parameters?.length ?? 0) > 0 &&
                plugin.id !== "__ui-showcase__";
              const isExpanded = connectorExpandedIds.has(plugin.id);
              const isSelected = connectorSelectedId === plugin.id;
              const requiredParams = hasParams
                ? plugin.parameters.filter((param) => param.required)
                : [];
              const requiredSetCount = requiredParams.filter(
                (param) => param.isSet,
              ).length;
              const setCount = hasParams
                ? plugin.parameters.filter((param) => param.isSet).length
                : 0;
              const totalCount = hasParams ? plugin.parameters.length : 0;
              const allParamsSet =
                !hasParams ||
                (requiredParams.length > 0
                  ? requiredSetCount === requiredParams.length
                  : setCount === totalCount);
              const isToggleBusy = togglingPlugins.has(plugin.id);
              const toggleDisabled =
                isToggleBusy || (hasPluginToggleInFlight && !isToggleBusy);
              const isSaving = pluginSaving.has(plugin.id);
              const saveSuccess = pluginSaveSuccess.has(plugin.id);
              const testResult = testResults.get(plugin.id);
              const pluginLinks = getPluginResourceLinks(plugin);
              const connectorHeaderMedia = (
                <span
                  className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border p-2.5 ${
                    isSelected
                      ? "border-accent/30 bg-accent/18 text-txt-strong"
                      : "border-border/50 bg-bg-accent/80 text-muted"
                  }`}
                >
                  {renderResolvedIcon(plugin, {
                    className: "h-4 w-4 shrink-0 rounded-sm object-contain",
                    emojiClassName: "text-base",
                  })}
                </span>
              );
              const connectorHeaderHeading = (
                <span
                  data-testid={`connector-header-${plugin.id}`}
                  className="flex min-w-0 flex-wrap items-center gap-2"
                >
                  <StatusBadge
                    label={allParamsSet ? readyLabel : needsSetupLabel}
                    tone={allParamsSet ? "success" : "warning"}
                  />
                  <span className="whitespace-normal break-words [overflow-wrap:anywhere] text-sm font-semibold leading-snug text-txt">
                    {plugin.name}
                  </span>
                  {plugin.version ? (
                    <PagePanel.Meta compact tone="strong" className="font-mono">
                      v{plugin.version}
                    </PagePanel.Meta>
                  ) : null}
                  {hasParams ? (
                    <span className="text-[11px] font-medium text-muted">
                      {setCount}/{totalCount} {t("pluginsview.configured")}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-muted">
                      {noConfigurationNeededLabel}
                    </span>
                  )}
                </span>
              );
              const connectorHeaderDescription = (
                <>
                  <p className="text-sm text-muted">
                    {plugin.description || pluginDescriptionFallback}
                  </p>
                  {plugin.enabled && !plugin.isActive && (
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <StatusBadge
                        label={
                          plugin.loadError ? loadFailedLabel : notInstalledLabel
                        }
                        tone={plugin.loadError ? "danger" : "warning"}
                      />
                    </span>
                  )}
                </>
              );
              const connectorHeaderActions = (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`flex h-auto min-w-[6.5rem] items-center justify-center gap-1 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      isExpanded
                        ? "border-border/50 bg-bg/25 text-txt"
                        : "border-border/50 text-muted hover:border-accent/40 hover:text-txt"
                    }`}
                    onClick={() => handleConnectorSectionToggle(plugin.id)}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? collapseLabel : expandLabel} ${plugin.name}`}
                  >
                    <span>{isExpanded ? collapseLabel : expandLabel}</span>
                    <ChevronRight
                      className={`h-4 w-4 transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className={`h-auto min-w-[3.75rem] rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] transition-colors ${
                      plugin.enabled
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-transparent text-muted hover:border-accent/40 hover:text-txt"
                    } ${
                      toggleDisabled
                        ? "cursor-not-allowed opacity-60"
                        : "cursor-pointer"
                    }`}
                    onClick={() =>
                      void handleTogglePlugin(plugin.id, !plugin.enabled)
                    }
                    disabled={toggleDisabled}
                  >
                    {isToggleBusy
                      ? "..."
                      : plugin.enabled
                        ? t("common.on")
                        : t("common.off")}
                  </Button>
                </>
              );

              return (
                <div
                  key={plugin.id}
                  data-testid={`connector-section-${plugin.id}`}
                >
                  <PagePanel.CollapsibleSection
                    ref={registerConnectorContentItem(plugin.id)}
                    variant="section"
                    data-testid={`connector-card-${plugin.id}`}
                    expanded={isExpanded}
                    expandOnCollapsedSurfaceClick
                    className={`transition-all ${
                      isSelected
                        ? "border-border/45 shadow-[0_18px_40px_rgba(3,5,10,0.16)]"
                        : "border-border/50"
                    }`}
                    onExpandedChange={(nextExpanded) =>
                      handleConnectorExpandedChange(plugin.id, nextExpanded)
                    }
                    media={connectorHeaderMedia}
                    heading={connectorHeaderHeading}
                    headingClassName="text-inherit"
                    description={connectorHeaderDescription}
                    descriptionClassName="space-y-0 text-sm leading-relaxed text-muted"
                    actions={connectorHeaderActions}
                  >
                    {pluginLinks.length > 0 && (
                      <div className="mb-4 flex flex-wrap gap-2">
                        {pluginLinks.map((link) => (
                          <Button
                            key={`${plugin.id}:${link.key}`}
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-xl border-border/40 bg-card/40 px-3 text-[11px] font-semibold text-muted transition-all hover:border-accent hover:bg-accent/5 hover:text-txt"
                            onClick={() => {
                              void handleOpenPluginExternalUrl(link.url);
                            }}
                            title={`${pluginResourceLinkLabel(t, link.key)}: ${link.url}`}
                          >
                            {pluginResourceLinkLabel(t, link.key)}
                          </Button>
                        ))}
                      </div>
                    )}

                    {plugin.enabled &&
                      !plugin.isActive &&
                      plugin.npmName &&
                      !plugin.loadError && (
                        <PagePanel.Notice
                          tone="warning"
                          className="mb-4"
                          actions={
                            <Button
                              variant="default"
                              size="sm"
                              className="h-8 rounded-xl px-4 text-[11px] font-bold"
                              disabled={installingPlugins.has(plugin.id)}
                              onClick={() =>
                                handleInstallPlugin(
                                  plugin.id,
                                  plugin.npmName ?? "",
                                )
                              }
                            >
                              {installingPlugins.has(plugin.id)
                                ? installProgressLabel(
                                    installProgress.get(plugin.npmName ?? "")
                                      ?.message,
                                  )
                                : installPluginLabel}
                            </Button>
                          }
                        >
                          {connectorInstallPrompt}
                        </PagePanel.Notice>
                      )}

                    {hasParams ? (
                      <div className="space-y-4">
                        {plugin.id === "telegram" ? (
                          <TelegramPluginConfig
                            plugin={plugin}
                            pluginConfigs={pluginConfigs}
                            onParamChange={handleParamChange}
                          />
                        ) : (
                          <PluginConfigForm
                            plugin={plugin}
                            pluginConfigs={pluginConfigs}
                            onParamChange={handleParamChange}
                          />
                        )}
                        {plugin.id === "whatsapp" && (
                          <WhatsAppQrOverlay accountId="default" />
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-muted">
                        {noConfigurationNeededLabel}
                      </div>
                    )}

                    {plugin.validationErrors &&
                      plugin.validationErrors.length > 0 && (
                        <PagePanel.Notice
                          tone="danger"
                          className="mt-3 text-xs"
                        >
                          {plugin.validationErrors.map((error) => (
                            <div
                              key={`${plugin.id}:${error.field}:${error.message}`}
                            >
                              <span className="font-medium text-warn">
                                {error.field}
                              </span>
                              : {error.message}
                            </div>
                          ))}
                        </PagePanel.Notice>
                      )}

                    {plugin.validationWarnings &&
                      plugin.validationWarnings.length > 0 && (
                        <PagePanel.Notice
                          tone="default"
                          className="mt-3 text-xs"
                        >
                          {plugin.validationWarnings.map((warning) => (
                            <div
                              key={`${plugin.id}:${warning.field}:${warning.message}`}
                            >
                              {warning.message}
                            </div>
                          ))}
                        </PagePanel.Notice>
                      )}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {plugin.isActive && (
                        <Button
                          variant={
                            testResult?.success
                              ? "default"
                              : testResult?.error
                                ? "destructive"
                                : "outline"
                          }
                          size="sm"
                          className={`h-8 rounded-xl px-4 text-[11px] font-bold transition-all ${
                            testResult?.loading
                              ? "cursor-wait opacity-70"
                              : testResult?.success
                                ? "border-ok bg-ok text-ok-fg hover:bg-ok/90"
                                : testResult?.error
                                  ? "border-danger bg-danger text-danger-fg hover:bg-danger/90"
                                  : "border-border/40 bg-card/40 hover:border-accent/40"
                          }`}
                          disabled={testResult?.loading}
                          onClick={() => void handleTestConnection(plugin.id)}
                        >
                          {formatTestConnectionLabel(testResult)}
                        </Button>
                      )}
                      {hasParams && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-xl px-4 text-[11px] font-semibold text-muted hover:text-txt"
                            onClick={() => handleConfigReset(plugin.id)}
                          >
                            {t("pluginsview.Reset")}
                          </Button>
                          <Button
                            variant={saveSuccess ? "default" : "secondary"}
                            size="sm"
                            className={`h-8 rounded-xl px-4 text-[11px] font-bold transition-all ${
                              saveSuccess
                                ? "bg-ok text-ok-fg hover:bg-ok/90"
                                : "bg-accent text-accent-fg hover:bg-accent/90"
                            }`}
                            onClick={() => void handleConfigSave(plugin.id)}
                            disabled={isSaving}
                          >
                            {formatSaveSettingsLabel(isSaving, saveSuccess)}
                          </Button>
                        </>
                      )}
                    </div>
                  </PagePanel.CollapsibleSection>
                </div>
              );
            })}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </div>
    );

    if (desktopConnectorLayout && desktopSidebar) {
      return (
        <PageLayout
          sidebar={desktopSidebar}
          contentHeader={contentHeader}
          contentRef={connectorContentRef}
          contentInnerClassName="w-full min-h-0"
        >
          <div className="flex min-h-0 flex-1 flex-col">{connectorContent}</div>
        </PageLayout>
      );
    }

    return (
      <main
        ref={connectorContentRef}
        className="chat-native-scrollbar relative flex flex-1 min-w-0 flex-col overflow-x-hidden overflow-y-auto bg-transparent px-4 pb-4 pt-2 sm:px-6 sm:pb-6 sm:pt-3 lg:px-7 lg:pb-7 lg:pt-4"
      >
        {contentHeader ? (
          <PageLayoutHeader>{contentHeader}</PageLayoutHeader>
        ) : null}
        {connectorContent}
      </main>
    );
  }

  if (inModal) {
    const sectionTitle = mode === "connectors" ? "Connectors" : label;
    return (
      <div className="plugins-game-modal plugins-game-modal--inline">
        <div
          className={`plugins-game-list-panel${
            gameNarrow && gameMobileDetail ? " is-hidden" : ""
          }`}
        >
          <div className="plugins-game-list-head">
            <div className="plugins-game-section-title">{sectionTitle}</div>
          </div>
          <div
            className="plugins-game-list-scroll"
            role="listbox"
            aria-label={`${sectionTitle} list`}
          >
            {gameVisiblePlugins.length === 0 ? (
              <div className="plugins-game-list-empty">
                {t("pluginsview.NoResultsFound", {
                  label: resultLabel,
                  defaultValue: "No {{label}} found",
                })}
              </div>
            ) : (
              gameVisiblePlugins.map((p: PluginInfo) => (
                <Button
                  variant="ghost"
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={effectiveGameSelected === p.id}
                  className={`plugins-game-card${
                    effectiveGameSelected === p.id ? " is-selected" : ""
                  }${!p.enabled ? " is-disabled" : ""} h-auto`}
                  onClick={() => {
                    setGameSelectedId(p.id);
                    if (gameNarrow) setGameMobileDetail(true);
                  }}
                >
                  <div className="plugins-game-card-icon-shell">
                    <span className="plugins-game-card-icon">
                      {(() => {
                        const icon = resolveIcon(p);
                        if (!icon) return "🧩";
                        if (typeof icon === "string") {
                          const imageSrc = iconImageSource(icon);
                          return imageSrc ? (
                            <img
                              src={imageSrc}
                              alt=""
                              className="plugins-game-card-icon"
                              style={{ objectFit: "contain" }}
                            />
                          ) : (
                            icon
                          );
                        }
                        const IconComponent = icon;
                        return <IconComponent className="w-5 h-5" />;
                      })()}
                    </span>
                  </div>
                  <div className="plugins-game-card-body">
                    <div className="plugins-game-card-name">{p.name}</div>
                    <div className="plugins-game-card-meta">
                      <span
                        className={`plugins-game-badge ${
                          p.enabled ? "is-on" : "is-off"
                        }`}
                      >
                        {p.enabled ? t("common.on") : t("common.off")}
                      </span>
                    </div>
                  </div>
                </Button>
              ))
            )}
          </div>
        </div>
        <div
          className={`plugins-game-detail-panel${
            gameNarrow && !gameMobileDetail ? " is-hidden" : ""
          }`}
        >
          {selectedPlugin ? (
            <>
              <div className="plugins-game-detail-head">
                {gameNarrow && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className="plugins-game-back-btn"
                    onClick={() => setGameMobileDetail(false)}
                  >
                    {t("pluginsview.Back")}
                  </Button>
                )}
                <div className="plugins-game-detail-title-row">
                  <div className="plugins-game-detail-icon-shell">
                    <span className="plugins-game-detail-icon">
                      {(() => {
                        const icon = resolveIcon(selectedPlugin);
                        if (!icon) return "🧩";
                        if (typeof icon === "string") {
                          const imageSrc = iconImageSource(icon);
                          return imageSrc ? (
                            <img
                              src={imageSrc}
                              alt=""
                              className="plugins-game-detail-icon"
                            />
                          ) : (
                            icon
                          );
                        }
                        const IconComponent = icon;
                        return <IconComponent className="w-6 h-6" />;
                      })()}
                    </span>
                  </div>
                  <div className="plugins-game-detail-main">
                    <div className="plugins-game-detail-name">
                      {selectedPlugin.name}
                    </div>
                    {selectedPlugin.version && (
                      <span className="plugins-game-version">
                        v{selectedPlugin.version}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    className={`plugins-game-toggle ${
                      selectedPlugin.enabled ? "is-on" : "is-off"
                    }`}
                    onClick={() =>
                      void handleTogglePlugin(
                        selectedPlugin.id,
                        !selectedPlugin.enabled,
                      )
                    }
                    disabled={togglingPlugins.has(selectedPlugin.id)}
                  >
                    {selectedPlugin.enabled ? t("common.on") : t("common.off")}
                  </Button>
                </div>
              </div>
              <div className="plugins-game-detail-description">
                {selectedPlugin.description}
              </div>
              {(selectedPlugin.tags?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                  {selectedPlugin.tags?.map((tag) => (
                    <span
                      key={`${selectedPlugin.id}:${tag}`}
                      className="text-[10px] px-1.5 py-px border border-border bg-black/10 text-muted lowercase tracking-wide whitespace-nowrap"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {selectedPluginLinks.length > 0 && (
                <div className="plugins-game-detail-links flex flex-wrap gap-2 px-3 pb-3">
                  {selectedPluginLinks.map((link) => (
                    <Button
                      variant="outline"
                      size="sm"
                      key={`${selectedPlugin.id}:${link.key}`}
                      type="button"
                      className="plugins-game-link-btn border border-border bg-transparent px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent hover:text-txt"
                      onClick={() => {
                        void handleOpenPluginExternalUrl(link.url);
                      }}
                    >
                      {pluginResourceLinkLabel(t, link.key)}
                    </Button>
                  ))}
                </div>
              )}
              {selectedPlugin.parameters &&
                selectedPlugin.parameters.length > 0 && (
                  <div className="plugins-game-detail-config">
                    {selectedPlugin.parameters.map((param: PluginParamDef) => (
                      <div key={param.key} id={`field-${param.key}`}>
                        <label
                          htmlFor={`input-${param.key}`}
                          className="text-[11px] tracking-wider text-muted block mb-1"
                        >
                          {param.key}
                        </label>
                        <Input
                          id={`input-${param.key}`}
                          type={param.sensitive ? "password" : "text"}
                          className="w-full px-2 py-1 text-[12px]"
                          placeholder={param.description}
                          value={
                            pluginConfigs[selectedPlugin.id]?.[param.key] ??
                            param.currentValue ??
                            ""
                          }
                          onChange={(e) =>
                            handleParamChange(
                              selectedPlugin.id,
                              param.key,
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
              <div className="plugins-game-detail-actions">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="plugins-game-action-btn"
                  onClick={() => void handleTestConnection(selectedPlugin.id)}
                >
                  {t("pluginsview.TestConnection")}
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  type="button"
                  className={`plugins-game-action-btn plugins-game-save-btn${
                    pluginSaveSuccess.has(selectedPlugin.id) ? " is-saved" : ""
                  }`}
                  onClick={() => void handleConfigSave(selectedPlugin.id)}
                  disabled={pluginSaving.has(selectedPlugin.id)}
                >
                  {pluginSaving.has(selectedPlugin.id)
                    ? savingLabel
                    : pluginSaveSuccess.has(selectedPlugin.id)
                      ? savedWithBangLabel
                      : saveLabel}
                </Button>
              </div>
            </>
          ) : (
            <div className="plugins-game-detail-empty">
              <span className="plugins-game-detail-empty-icon">🧩</span>
              <span className="plugins-game-detail-empty-text">
                {t("pluginsview.SelectA")}{" "}
                {isConnectorLikeMode ? "connector" : "plugin"}{" "}
                {t("pluginsview.toC")}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const selectedSubgroupTag =
    subgroupTags.find((tag) => tag.id === subgroupFilter) ?? subgroupTags[0];
  const pluginSectionTitle =
    selectedSubgroupTag?.id === "all"
      ? t("pluginsview.PluginCatalog", { defaultValue: "Plugin Catalog" })
      : (selectedSubgroupTag?.label ??
        t("pluginsview.PluginCatalog", { defaultValue: "Plugin Catalog" }));

  return (
    <PagePanel.Frame data-testid="plugins-view-page">
      <PagePanel
        as="div"
        variant="shell"
        className="settings-shell plugins-game-modal plugins-game-modal--inline flex-col lg:flex-row"
        data-testid="plugins-shell"
      >
        {showDesktopSubgroupSidebar && (
          <Sidebar
            className="hidden lg:flex"
            testId="plugins-subgroup-sidebar"
            aria-label={t("pluginsview.PluginTypes", {
              defaultValue: "Plugin types",
            })}
          >
            <SidebarScrollRegion className="pt-4">
              <SidebarPanel>
                {subgroupTags.map((tag) =>
                  renderSubgroupFilterButton(tag, { sidebar: true }),
                )}
              </SidebarPanel>
            </SidebarScrollRegion>
          </Sidebar>
        )}

        <PagePanel.ContentArea>
          <div className="mx-auto max-w-[76rem] px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
            <PagePanel variant="section">
              <PagePanel.Header
                eyebrow={t("nav.advanced")}
                heading={pluginSectionTitle}
                className="border-border/35"
                actions={
                  <PagePanel.Meta className="border-border/45 px-2.5 py-1 font-bold tracking-[0.16em] text-muted">
                    {t("pluginsview.VisibleCount", {
                      defaultValue: "{{count}} shown",
                      count: visiblePlugins.length,
                    })}
                  </PagePanel.Meta>
                }
              />

              <div className="bg-bg/18 px-4 py-4 sm:px-5">
                {(allowCustomOrder && pluginOrder.length > 0) ||
                showPluginManagementActions ? (
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    {allowCustomOrder && pluginOrder.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-full px-4 text-[11px] font-bold tracking-[0.12em]"
                        onClick={handleResetOrder}
                        title={t("pluginsview.ResetToDefaultSor")}
                      >
                        {t("pluginsview.ResetOrder")}
                      </Button>
                    )}
                    {showPluginManagementActions && (
                      <Button
                        variant="default"
                        size="sm"
                        className="h-9 rounded-full px-4 text-[11px] font-bold tracking-[0.12em]"
                        onClick={() => setAddDirOpen(true)}
                      >
                        {t("pluginsview.AddPlugin")}
                      </Button>
                    )}
                  </div>
                ) : null}

                {hasPluginToggleInFlight && (
                  <PagePanel.Notice tone="accent" className="mb-4 text-[11px]">
                    {t("pluginsview.ApplyingPluginChan")}
                  </PagePanel.Notice>
                )}

                {showSubgroupFilters && (
                  <div
                    className="mb-5 flex items-center gap-2 flex-wrap lg:hidden"
                    data-testid="plugins-subgroup-chips"
                  >
                    {subgroupTags.map((tag) => renderSubgroupFilterButton(tag))}
                  </div>
                )}

                <div className="overflow-y-auto">
                  {sorted.length === 0 ? (
                    <PagePanel.Empty
                      variant="surface"
                      className="min-h-[18rem] rounded-[1.6rem] px-5 py-10"
                      description={t("pluginsview.NoneAvailableDesc", {
                        defaultValue: "No {{label}} are available right now.",
                        label: resultLabel,
                      })}
                      title={t("pluginsview.NoneAvailableTitle", {
                        defaultValue: "No {{label}} available",
                        label: label.toLowerCase(),
                      })}
                    />
                  ) : visiblePlugins.length === 0 ? (
                    <PagePanel.Empty
                      variant="surface"
                      className="min-h-[16rem] rounded-[1.6rem] px-5 py-10"
                      description={
                        showSubgroupFilters
                          ? t("pluginsview.NoPluginsMatchCategory", {
                              defaultValue:
                                "No plugins match the selected category.",
                            })
                          : t("pluginsview.NoPluginsMatchFilters", {
                              defaultValue: "No {{label}} match your filters.",
                              label: resultLabel,
                            })
                      }
                      title={t("pluginsview.NothingToShow", {
                        defaultValue: "Nothing to show",
                      })}
                    />
                  ) : (
                    renderPluginGrid(visiblePlugins)
                  )}
                </div>
              </div>
            </PagePanel>
          </div>
        </PagePanel.ContentArea>
        {settingsDialogPlugin &&
          (() => {
            const p = settingsDialogPlugin;
            const isShowcase = p.id === "__ui-showcase__";
            const isSaving = pluginSaving.has(p.id);
            const saveSuccess = pluginSaveSuccess.has(p.id);
            const categoryLabel = isShowcase
              ? "showcase"
              : p.category === "ai-provider"
                ? "ai provider"
                : p.category;
            return (
              <Dialog
                open
                onOpenChange={(v) => {
                  if (!v) toggleSettings(p.id);
                }}
              >
                <AdminDialog.Content className="max-h-[85vh] max-w-2xl">
                  <AdminDialog.Header className="flex flex-row items-center gap-3">
                    <DialogTitle className="font-bold text-base flex items-center gap-2 flex-1 min-w-0 tracking-wide text-txt">
                      {(() => {
                        const icon = resolveIcon(p);
                        if (!icon) return null;
                        if (typeof icon === "string") {
                          const imageSrc = iconImageSource(icon);
                          return imageSrc ? (
                            <img
                              src={imageSrc}
                              alt=""
                              className="w-6 h-6 rounded-md object-contain"
                              onError={(e) => {
                                (
                                  e.currentTarget as HTMLImageElement
                                ).style.display = "none";
                              }}
                            />
                          ) : (
                            <span className="text-base">{icon}</span>
                          );
                        }
                        const IconComponent = icon;
                        return <IconComponent className="w-6 h-6 text-txt" />;
                      })()}
                      {p.name}
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                      {t("pluginsview.PluginDialogDescription", {
                        plugin: p.name,
                        defaultValue:
                          "Review plugin metadata, adjust settings, and save changes for {{plugin}}.",
                      })}
                    </DialogDescription>
                    <AdminDialog.MetaBadge>
                      {categoryLabel}
                    </AdminDialog.MetaBadge>
                    {p.version && (
                      <AdminDialog.MonoMeta>v{p.version}</AdminDialog.MonoMeta>
                    )}
                    {isShowcase && (
                      <span className="text-[10px] font-bold tracking-widest px-2.5 py-[2px] border border-accent/30 text-txt bg-accent/10 rounded-full">
                        {t("pluginsview.DEMO")}
                      </span>
                    )}
                  </AdminDialog.Header>
                  <AdminDialog.BodyScroll>
                    <div className="px-5 pt-4 pb-1 flex items-center gap-3 flex-wrap text-xs text-muted">
                      {p.description && (
                        <span className="text-[12px] text-muted leading-relaxed">
                          {p.description}
                        </span>
                      )}
                      {(p.tags?.length ?? 0) > 0 && (
                        <span className="flex items-center gap-1.5 flex-wrap">
                          {p.tags?.map((tag) => (
                            <span
                              key={`${p.id}:${tag}:settings`}
                              className="whitespace-nowrap border border-border/40 bg-bg-accent/80 px-1.5 py-px text-[10px] lowercase tracking-wide text-muted-strong"
                            >
                              {tag}
                            </span>
                          ))}
                        </span>
                      )}
                    </div>
                    {(p.npmName ||
                      (p.pluginDeps && p.pluginDeps.length > 0)) && (
                      <div className="px-5 pb-2 flex items-center gap-3 flex-wrap">
                        {p.npmName && (
                          <span className="font-mono text-[10px] text-muted opacity-50">
                            {p.npmName}
                          </span>
                        )}
                        {p.pluginDeps && p.pluginDeps.length > 0 && (
                          <span className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] text-muted opacity-60">
                              {t("pluginsview.dependsOn")}
                            </span>
                            {p.pluginDeps.map((dep: string) => (
                              <span
                                key={dep}
                                className="text-[10px] px-1.5 py-px border border-border bg-accent-subtle text-muted rounded-sm"
                              >
                                {dep}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="px-5 py-3">
                      {p.id === "telegram" ? (
                        <TelegramPluginConfig
                          plugin={p}
                          pluginConfigs={pluginConfigs}
                          onParamChange={handleParamChange}
                        />
                      ) : (
                        <PluginConfigForm
                          plugin={p}
                          pluginConfigs={pluginConfigs}
                          onParamChange={handleParamChange}
                        />
                      )}
                      {p.id === "whatsapp" && (
                        <WhatsAppQrOverlay accountId="default" />
                      )}
                    </div>
                  </AdminDialog.BodyScroll>
                  {!isShowcase && (
                    <AdminDialog.Footer className="flex justify-end gap-3">
                      {p.enabled &&
                        !p.isActive &&
                        p.npmName &&
                        !p.loadError && (
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 px-4 text-[11px] font-bold tracking-wide shadow-sm"
                            disabled={installingPlugins.has(p.id)}
                            onClick={() =>
                              handleInstallPlugin(p.id, p.npmName ?? "")
                            }
                          >
                            {installingPlugins.has(p.id)
                              ? installProgressLabel(
                                  installProgress.get(p.npmName ?? "")?.message,
                                )
                              : installPluginLabel}
                          </Button>
                        )}
                      {p.loadError && (
                        <span
                          className="px-3 py-1.5 text-[11px] text-danger font-bold tracking-wide"
                          title={p.loadError}
                        >
                          {t("pluginsview.PackageBrokenMis")}
                        </span>
                      )}
                      {p.isActive && (
                        <Button
                          variant={
                            testResults.get(p.id)?.success
                              ? "default"
                              : testResults.get(p.id)?.error
                                ? "destructive"
                                : "outline"
                          }
                          size="sm"
                          className={`h-8 px-4 text-[11px] font-bold tracking-wide transition-all ${
                            testResults.get(p.id)?.loading
                              ? "opacity-70 cursor-wait"
                              : testResults.get(p.id)?.success
                                ? "bg-ok text-ok-fg border-ok hover:bg-ok/90"
                                : testResults.get(p.id)?.error
                                  ? "bg-danger text-danger-fg border-danger hover:bg-danger/90"
                                  : "border-border/40 bg-card/40 backdrop-blur-md shadow-sm hover:border-accent/40"
                          }`}
                          disabled={testResults.get(p.id)?.loading}
                          onClick={() => handleTestConnection(p.id)}
                        >
                          {formatDialogTestConnectionLabel(
                            testResults.get(p.id),
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-4 text-[12px] font-bold text-muted hover:text-txt transition-all"
                        onClick={() => handleConfigReset(p.id)}
                      >
                        {t("pluginsview.Reset")}
                      </Button>
                      <Button
                        variant={saveSuccess ? "default" : "secondary"}
                        size="sm"
                        className={`h-8 px-5 text-[12px] font-bold tracking-wide transition-all ${
                          saveSuccess
                            ? "bg-ok text-ok-fg hover:bg-ok/90"
                            : "bg-accent text-accent-fg hover:bg-accent/90 shadow-lg shadow-accent/20"
                        }`}
                        onClick={() => handleConfigSave(p.id)}
                        disabled={isSaving}
                      >
                        {isSaving
                          ? savingLabel
                          : saveSuccess
                            ? t("pluginsview.SavedWithCheck", {
                                defaultValue: "✓ Saved",
                              })
                            : saveSettingsLabel}
                      </Button>
                    </AdminDialog.Footer>
                  )}
                </AdminDialog.Content>
              </Dialog>
            );
          })()}
      </PagePanel>
      <Dialog
        open={addDirOpen}
        onOpenChange={(v) => {
          if (!v) {
            setAddDirOpen(false);
            setAddDirPath("");
          }
        }}
      >
        <AdminDialog.Content className="max-w-md">
          <AdminDialog.Header className="mb-0">
            <DialogTitle className="font-bold text-base tracking-wide text-txt">
              {t("pluginsview.AddPlugin1")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted">
              {t("pluginsview.AddPluginDescription", {
                defaultValue:
                  "Enter a local directory path that contains a plugin package and Milady will register it.",
              })}
            </DialogDescription>
          </AdminDialog.Header>

          <div className="px-6 py-5">
            <p className="text-sm font-medium tracking-wide text-muted mb-4">
              {t("pluginsview.EnterThePathToA")}
            </p>

            <AdminDialog.Input
              type="text"
              placeholder={t("pluginsview.PathToPluginOrP")}
              aria-label={t("pluginsview.PathToPluginOrP")}
              value={addDirPath}
              onChange={(e) => setAddDirPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddFromDirectory();
              }}
            />
          </div>

          <AdminDialog.Footer className="mt-0 flex justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-4 text-[12px] font-bold text-muted hover:text-txt transition-all"
              onClick={() => {
                setAddDirOpen(false);
                setAddDirPath("");
              }}
            >
              {t("pluginsview.Cancel")}
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-8 px-6 text-[12px] font-bold tracking-wide shadow-sm"
              onClick={handleAddFromDirectory}
              disabled={addDirLoading || !addDirPath.trim()}
            >
              {addDirLoading ? "Adding..." : "Add"}
            </Button>
          </AdminDialog.Footer>
        </AdminDialog.Content>
      </Dialog>
    </PagePanel.Frame>
  );
}

/* ── Exported views ────────────────────────────────────────────────── */

/** Unified plugins view — tag-filtered plugin list. */
export function PluginsView({
  contentHeader,
  mode = "all",
  inModal,
}: {
  contentHeader?: ReactNode;
  mode?: PluginsViewMode;
  inModal?: boolean;
}) {
  const label =
    mode === "social"
      ? "Connectors"
      : mode === "connectors"
        ? "Connectors"
        : mode === "streaming"
          ? "Streaming"
          : mode === "all-social"
            ? "Plugins"
            : "Plugins";
  return (
    <PluginListView
      contentHeader={contentHeader}
      label={label}
      mode={mode}
      inModal={inModal}
    />
  );
}
