/**
 * API client for the Milady backend.
 *
 * Thin fetch wrapper + WebSocket for real-time chat/events.
 * Replaces the gateway WebSocket protocol entirely.
 */

import type {
  AudioGenConfig,
  AudioGenProvider,
  CustomActionDef,
  CustomActionHandler,
  DatabaseProviderType,
  ImageConfig,
  ImageProvider,
  MediaConfig,
  MediaMode,
  ReleaseChannel,
  VideoConfig,
  VideoProvider,
  VisionConfig,
  VisionProvider,
} from "@miladyai/agent/contracts/config";
import type { DropStatus, MintResult } from "@miladyai/agent/contracts/drop";
import type {
  CloudProviderOption,
  InventoryProviderOption,
  MessageExample,
  MessageExampleContent,
  ModelOption,
  OnboardingConnection,
  OnboardingConnectorConfig as ConnectorConfig,
  OnboardingData,
  OnboardingOptions,
  OpenRouterModelOption,
  PiAiModelOption,
  ProviderOption,
  RpcProviderOption,
  StylePreset,
  SubscriptionProviderStatus,
  SubscriptionStatusResponse,
} from "@miladyai/shared/contracts/onboarding";
import type {
  AllPermissionsState,
  PermissionState,
  PermissionStatus,
  SystemPermissionDefinition,
  SystemPermissionId,
} from "@miladyai/agent/contracts/permissions";
import type { VerificationResult } from "@miladyai/agent/contracts/verification";
import type {
  BscTradeExecuteRequest,
  BscTradeExecuteResponse,
  BscTradePreflightResponse,
  BscTradeQuoteRequest,
  BscTradeQuoteResponse,
  BscTradeTxStatusResponse,
  BscTransferExecuteRequest,
  BscTransferExecuteResponse,
  EvmChainBalance,
  EvmNft,
  EvmTokenBalance,
  SolanaNft,
  SolanaTokenBalance,
  StewardApprovalActionResponse,
  StewardApprovalInfo,
  StewardHistoryResponse,
  StewardPendingResponse,
  StewardPolicyResult,
  StewardStatusResponse,
  WalletAddresses,
  WalletBalancesResponse,
  WalletConfigStatus,
  WalletConfigUpdateRequest,
  WalletNftsResponse,
  WalletRpcChain,
  WalletRpcCredentialKey,
  WalletRpcSelections,
  TradePermissionMode as WalletTradePermissionMode,
  WalletTradingProfileResponse,
  WalletTradingProfileSourceFilter,
  WalletTradingProfileWindow,
} from "@miladyai/agent/contracts/wallet";
import type {
  StewardPendingApproval,
  StewardSignRequest,
  StewardSignResponse,
  StewardTxRecord,
  StewardTxStatus,
} from "@miladyai/shared/contracts/wallet";
import {
  DEFAULT_WALLET_RPC_SELECTIONS,
  normalizeWalletRpcProviderId,
  normalizeWalletRpcSelections,
  WALLET_RPC_PROVIDER_OPTIONS,
} from "@miladyai/agent/contracts/wallet";
import {
  isMiladySettingsDebugEnabled,
  sanitizeForSettingsDebug,
  settingsDebugCloudSummary,
} from "@miladyai/shared";
import type { ConfigUiHint } from "../types";
import { stripAssistantStageDirections } from "../utils/assistant-text";
import { getElizaApiBase, getElizaApiToken } from "../utils/eliza-globals";
import { mergeStreamingText } from "../utils/streaming-text";
import { getBootConfig, setBootConfig } from "../config/boot-config";
import type {
  AgentAutomationMode,
  AgentAutomationModeResponse,
  AgentEventsResponse,
  AgentPreflightResult,
  AgentSelfStatusSnapshot,
  AgentStartupDiagnostics,
  AgentState,
  AgentStatus,
  ApiErrorKind,
  AppLaunchResult,
  AppStopResult,
  AppUiExtensionConfig,
  AppViewerAuthMessage,
  AppViewerConfig,
  ApplyProductionWalletDefaultsResponse,
  CatalogSearchResult,
  CatalogSkill,
  CatalogSkillStats,
  CatalogSkillVersion,
  CharacterData,
  ChatMessage,
  ChatTokenUsage,
  CloudBillingCheckoutRequest,
  CloudBillingCheckoutResponse,
  CloudBillingCryptoQuoteRequest,
  CloudBillingCryptoQuoteResponse,
  CloudBillingHistoryItem,
  CloudBillingPaymentMethod,
  CloudBillingSettings,
  CloudBillingSettingsUpdateRequest,
  CloudBillingSummary,
  CloudCompatAgent,
  CloudCompatAgentStatus,
  CloudCompatJob,
  CloudCompatLaunchResult,
  CloudCredits,
  CloudLoginPollResponse,
  CloudLoginResponse,
  CloudStatus,
  CodingAgentScratchWorkspace,
  CodingAgentSession,
  CodingAgentStatus,
  ColumnInfo,
  ConfigFormBlock,
  ConfigSchemaResponse,
  ConnectionStateInfo,
  ConnectionTestResult,
  ContentBlock,
  Conversation,
  ConversationChannelType,
  ConversationGreeting,
  ConversationMessage,
  ConversationMode,
  CorePluginEntry,
  CorePluginsResponse,
  CreateConversationOptions,
  CreateTriggerRequest,
  DatabaseConfigResponse,
  DatabaseStatus,
  ExtensionStatus,
  HyperscapeActionResponse,
  HyperscapeAgentGoalResponse,
  HyperscapeAvailableGoal,
  HyperscapeEmbeddedAgent,
  HyperscapeEmbeddedAgentControlAction,
  HyperscapeEmbeddedAgentMutationResponse,
  HyperscapeEmbeddedAgentsResponse,
  HyperscapeGoalState,
  HyperscapeInventoryItem,
  HyperscapeJsonValue,
  HyperscapeNearbyLocation,
  HyperscapePosition,
  HyperscapeQuickActionsResponse,
  HyperscapeQuickCommand,
  HyperscapeScriptedRole,
  ImageAttachment,
  InstalledAppInfo,
  InstalledPlugin,
  KnowledgeBulkUploadItemResult,
  KnowledgeBulkUploadResult,
  KnowledgeDocument,
  KnowledgeDocumentDetail,
  KnowledgeDocumentsResponse,
  KnowledgeFragment,
  KnowledgeFragmentsResponse,
  KnowledgeSearchResponse,
  KnowledgeSearchResult,
  KnowledgeStats,
  KnowledgeUploadResult,
  LogEntry,
  LogsFilter,
  LogsResponse,
  McpMarketplaceResult,
  McpRegistryServerDetail,
  McpServerConfig,
  McpServerStatus,
  MemoryRememberResponse,
  MemorySearchResponse,
  MemorySearchResult,
  PluginInfo,
  PluginInstallResult,
  PluginParamDef,
  QueryResult,
  QuickContextResponse,
  RawPtySession,
  RegistrationResult,
  RegistryAppInfo,
  RegistryConfig,
  RegistryPlugin,
  RegistryPluginItem,
  RegistrySearchResult,
  RegistryStatus,
  RuntimeDebugSnapshot,
  RuntimeOrderItem,
  RuntimeServiceOrderItem,
  SandboxBrowserEndpoints,
  SandboxPlatformStatus,
  SandboxScreenshotPayload,
  SandboxScreenshotRegion,
  SandboxStartResponse,
  SandboxWindowInfo,
  SecretInfo,
  SecurityAuditEntry,
  SecurityAuditEventType,
  SecurityAuditFilter,
  SecurityAuditResponse,
  SecurityAuditSeverity,
  SecurityAuditStreamEvent,
  ShareIngestItem,
  ShareIngestPayload,
  SkillInfo,
  SkillMarketplaceResult,
  SkillScanReportSummary,
  StartTrainingOptions,
  StreamEventEnvelope,
  TableInfo,
  TableRowsResponse,
  TextBlock,
  TradePermissionMode,
  TradePermissionModeResponse,
  TrainingDatasetRecord,
  TrainingEventKind,
  TrainingJobRecord,
  TrainingJobStatus,
  TrainingModelRecord,
  TrainingStatus,
  TrainingStreamEvent,
  TrainingTrajectorySummary,
  TrainingTrajectoryDetail,
  TrainingTrajectoryList,
  TrajectoryConfig,
  TrajectoryDetailResult,
  TrajectoryExportOptions,
  TrajectoryLlmCall,
  TrajectoryListOptions,
  TrajectoryListResult,
  TrajectoryProviderAccess,
  TrajectoryRecord,
  TrajectoryStats,
  TriggerHealthSnapshot,
  TriggerLastStatus,
  TriggerRunRecord,
  TriggerSummary,
  UiSpecBlock,
  UpdateStatus,
  UpdateTriggerRequest,
  VerificationMessageResponse,
  VoiceConfig,
  VoiceMode,
  VoiceProvider,
  WalletExportResult,
  WebSocketConnectionState,
  WhitelistStatus,
  WorkbenchOverview,
  WorkbenchTask,
  WorkbenchTodo,
  WsEventHandler,
} from "./client-types";
import { ApiError, mapPtySessionsToCodingAgentSessions } from "./client-types";

export type {
  AllPermissionsState,
  AudioGenConfig,
  AudioGenProvider,
  BscTradeExecuteRequest,
  BscTradeExecuteResponse,
  BscTradePreflightResponse,
  BscTradeQuoteRequest,
  BscTradeQuoteResponse,
  BscTradeTxStatusResponse,
  BscTransferExecuteRequest,
  BscTransferExecuteResponse,
  CloudProviderOption,
  ConnectorConfig,
  CustomActionDef,
  CustomActionHandler,
  DatabaseProviderType,
  DropStatus,
  EvmChainBalance,
  EvmNft,
  EvmTokenBalance,
  ImageConfig,
  ImageProvider,
  InventoryProviderOption,
  MediaConfig,
  MediaMode,
  MessageExample,
  MessageExampleContent,
  MintResult,
  ModelOption,
  OnboardingConnection,
  OnboardingData,
  OnboardingOptions,
  OpenRouterModelOption,
  PermissionState,
  PermissionStatus,
  PiAiModelOption,
  ProviderOption,
  ReleaseChannel,
  RpcProviderOption,
  SolanaNft,
  SolanaTokenBalance,
  StewardApprovalActionResponse,
  StewardApprovalInfo,
  StewardHistoryResponse,
  StewardPendingApproval,
  StewardPendingResponse,
  StewardPolicyResult,
  StewardSignRequest,
  StewardSignResponse,
  StewardStatusResponse,
  StewardTxRecord,
  StewardTxStatus,
  StylePreset,
  SubscriptionProviderStatus,
  SubscriptionStatusResponse,
  SystemPermissionDefinition as PermissionDefinition,
  SystemPermissionId,
  VerificationResult,
  VideoConfig,
  VideoProvider,
  VisionConfig,
  VisionProvider,
  WalletAddresses,
  WalletBalancesResponse,
  WalletConfigStatus,
  WalletConfigUpdateRequest,
  WalletNftsResponse,
  WalletRpcChain,
  WalletRpcCredentialKey,
  WalletRpcSelections,
  WalletTradingProfileResponse,
  WalletTradingProfileSourceFilter,
  WalletTradingProfileWindow,
};

export {
  DEFAULT_WALLET_RPC_SELECTIONS,
  normalizeWalletRpcProviderId,
  normalizeWalletRpcSelections,
  WALLET_RPC_PROVIDER_OPTIONS,
};

export * from "./client-types";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const GENERIC_NO_RESPONSE_TEXT =
  "Sorry, I couldn't generate a response right now. Please try again.";
const AGENT_TRANSFER_MIN_PASSWORD_LENGTH = 4;
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
const SESSION_STORAGE_API_BASE_KEY = "milady_api_base";

function miladyClientSettingsDebug(): boolean {
  let viteEnv: Record<string, unknown> | undefined;
  try {
    viteEnv = import.meta.env as Record<string, unknown>;
  } catch {
    viteEnv = undefined;
  }
  return isMiladySettingsDebugEnabled({
    importMetaEnv: viteEnv,
    env: typeof process !== "undefined" ? process.env : undefined,
  });
}

function logSettingsClient(
  phase: string,
  detail: Record<string, unknown>,
): void {
  if (!miladyClientSettingsDebug()) return;
  console.debug(
    `[milady][settings][client] ${phase}`,
    sanitizeForSettingsDebug(detail),
  );
}

export class MiladyClient {
  private _baseUrl: string;
  private _explicitBase: boolean;
  private _token: string | null;
  private readonly clientId: string;
  private ws: WebSocket | null = null;
  private wsHandlers = new Map<string, Set<WsEventHandler>>();
  private wsSendQueue: string[] = [];
  private readonly wsSendQueueLimit = 32;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = 500;
  private wsHasConnectedOnce = false;

  // Connection state tracking for backend crash handling
  private connectionState: WebSocketConnectionState = "disconnected";
  private reconnectAttempt = 0;
  private disconnectedAt: number | null = null;
  private connectionStateListeners = new Set<
    (state: ConnectionStateInfo) => void
  >();
  private readonly maxReconnectAttempts = 15;

  // UI language propagation — set by AppContext so the backend can
  // localise responses when needed.
  private _uiLanguage: string | null = null;

  /** Store the current UI language so it can be sent as a header on every request. */
  setUiLanguage(lang: string): void {
    this._uiLanguage = lang || null;
  }

  private static generateClientId(): string {
    const random =
      typeof globalThis.crypto?.randomUUID === "function"
        ? globalThis.crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    return `ui-${random.replace(/[^a-zA-Z0-9._-]/g, "")}`;
  }

  constructor(baseUrl?: string, token?: string) {
    this.clientId = MiladyClient.generateClientId();
    this._token = token?.trim() || null;

    const injectedBase = getElizaApiBase();
    const storedBase =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(SESSION_STORAGE_API_BASE_KEY)
        : null;
    const bootBase = getBootConfig().apiBase;

    this._explicitBase = baseUrl != null || Boolean(storedBase?.trim());

    // Priority: explicit arg > desktop injection > boot config > session storage > same origin.
    // Injected global (window.__MILADY_API_BASE__) must beat stale sessionStorage
    // from a prior cloud/remote session so the desktop always connects to the
    // correct local agent.
    this._baseUrl =
      baseUrl ?? injectedBase ?? bootBase ?? storedBase ?? "";
  }

  /**
   * Resolve the API base URL lazily.
   * In the desktop shell the main process injects the API base after the
   * page loads (once the agent runtime starts). Re-checking the boot config
   * on every call ensures we pick up the injected value even if it wasn't
   * set at construction.
   */
  private get baseUrl(): string {
    if (!this._explicitBase) {
      const bootBase = getBootConfig().apiBase ?? getElizaApiBase();
      if (bootBase && bootBase !== this._baseUrl) {
        this._baseUrl = bootBase;
      }
    }
    return this._baseUrl;
  }

  private get apiToken(): string | null {
    if (this._token) return this._token;
    const bootToken = getBootConfig().apiToken;
    if (typeof bootToken === "string" && bootToken.trim())
      return bootToken.trim();
    const injectedToken = getElizaApiToken();
    if (injectedToken) return injectedToken;
    return null;
  }

  hasToken(): boolean {
    return Boolean(this.apiToken);
  }

  /**
   * Bearer token sent on Milady REST requests (compat API). Used when the
   * Electrobun main process relays HTTP so it can match the renderer-injected
   * token in external-desktop / Vite-proxy setups.
   */
  getRestAuthToken(): string | null {
    return this.apiToken;
  }

  setToken(token: string | null): void {
    this._token = token?.trim() || null;
    // Update boot config so other consumers see the new token.
    const config = getBootConfig();
    setBootConfig({ ...config, apiToken: this._token ?? undefined });
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(baseUrl: string | null): void {
    const normalized = baseUrl?.trim().replace(/\/+$/, "") || "";
    this._explicitBase = normalized.length > 0;
    this._baseUrl = normalized;
    this.disconnectWs();
    // Update boot config so other consumers (resolveApiUrl, etc.) see the new base.
    const config = getBootConfig();
    setBootConfig({ ...config, apiBase: normalized || undefined });
    if (typeof window !== "undefined") {
      if (normalized) {
        window.sessionStorage.setItem(SESSION_STORAGE_API_BASE_KEY, normalized);
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_API_BASE_KEY);
      }
    }
  }

  /** True when we have a usable HTTP(S) API endpoint. */
  get apiAvailable(): boolean {
    if (this.baseUrl) return true;
    if (typeof window !== "undefined") {
      const proto = window.location.protocol;
      return proto === "http:" || proto === "https:";
    }
    return false;
  }

  // --- REST API ---

  private async rawRequest(
    path: string,
    init?: RequestInit,
    options?: { allowNonOk?: boolean },
  ): Promise<Response> {
    if (!this.apiAvailable) {
      throw new ApiError({
        kind: "network",
        path,
        message: "API not available (no HTTP origin)",
      });
    }
    const makeRequest = async (token: string | null): Promise<Response> => {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      let abortListener: (() => void) | undefined;
      const requestInit: RequestInit = {
        ...init,
        headers: {
          "X-Milady-Client-Id": this.clientId,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(this._uiLanguage
            ? { "X-Milady-UI-Language": this._uiLanguage }
            : {}),
          ...init?.headers,
        },
      };

      const fetchPromise = fetch(`${this.baseUrl}${path}`, requestInit);
      const pending: Promise<Response>[] = [fetchPromise];

      pending.push(
        new Promise<Response>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new ApiError({
                kind: "timeout",
                path,
                message: `Request timed out after ${DEFAULT_FETCH_TIMEOUT_MS}ms`,
              }),
            );
          }, DEFAULT_FETCH_TIMEOUT_MS);
        }),
      );

      if (init?.signal) {
        if (init.signal.aborted) {
          throw new ApiError({
            kind: "network",
            path,
            message: "Request aborted",
          });
        }

        pending.push(
          new Promise<Response>((_, reject) => {
            abortListener = () => {
              reject(
                new ApiError({
                  kind: "network",
                  path,
                  message: "Request aborted",
                }),
              );
            };
            init.signal?.addEventListener("abort", abortListener, {
              once: true,
            });
          }),
        );
      }

      try {
        return await Promise.race(pending);
      } catch (err) {
        if (err instanceof ApiError) {
          throw err;
        }
        throw new ApiError({
          kind: "network",
          path,
          message:
            err instanceof Error && err.message
              ? err.message
              : "Network request failed",
          cause: err,
        });
      } finally {
        if (timeoutId !== undefined) {
          clearTimeout(timeoutId);
        }
        if (init?.signal && abortListener) {
          init.signal.removeEventListener("abort", abortListener);
        }
      }
    };

    const token = this.apiToken;
    let res = await makeRequest(token);
    if (res.status === 401 && !token) {
      const retryToken = this.apiToken;
      if (retryToken) {
        res = await makeRequest(retryToken);
      }
    }
    if (!res.ok && !options?.allowNonOk) {
      const body = (await res
        .json()
        .catch(() => ({ error: res.statusText }))) as Record<
        string,
        string
      > | null;
      throw new ApiError({
        kind: "http",
        path,
        status: res.status,
        message: body?.error ?? `HTTP ${res.status}`,
      });
    }
    return res;
  }

  private async fetch<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await this.rawRequest(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
    return res.json() as Promise<T>;
  }

  async getStatus(): Promise<AgentStatus> {
    return this.fetch("/api/status");
  }

  async getAgentSelfStatus(): Promise<AgentSelfStatusSnapshot> {
    return this.fetch("/api/agent/self-status");
  }

  async getRuntimeSnapshot(opts?: {
    depth?: number;
    maxArrayLength?: number;
    maxObjectEntries?: number;
    maxStringLength?: number;
  }): Promise<RuntimeDebugSnapshot> {
    const params = new URLSearchParams();
    if (typeof opts?.depth === "number")
      params.set("depth", String(opts.depth));
    if (typeof opts?.maxArrayLength === "number") {
      params.set("maxArrayLength", String(opts.maxArrayLength));
    }
    if (typeof opts?.maxObjectEntries === "number") {
      params.set("maxObjectEntries", String(opts.maxObjectEntries));
    }
    if (typeof opts?.maxStringLength === "number") {
      params.set("maxStringLength", String(opts.maxStringLength));
    }
    const qs = params.toString();
    return this.fetch(`/api/runtime${qs ? `?${qs}` : ""}`);
  }

  async setAutomationMode(
    mode: "connectors-only" | "full",
  ): Promise<{ mode: string }> {
    return this.fetch("/api/permissions/automation-mode", {
      method: "PUT",
      body: JSON.stringify({ mode }),
    });
  }

  async setTradeMode(
    mode: string,
  ): Promise<{ ok: boolean; tradePermissionMode: string }> {
    return this.fetch("/api/permissions/trade-mode", {
      method: "PUT",
      body: JSON.stringify({ mode }),
    });
  }

  async playEmote(emoteId: string): Promise<{ ok: boolean }> {
    return this.fetch("/api/emote", {
      method: "POST",
      body: JSON.stringify({ emoteId }),
    });
  }

  async runTerminalCommand(command: string): Promise<{ ok: boolean }> {
    return this.fetch("/api/terminal/run", {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  }

  async getOnboardingStatus(): Promise<{ complete: boolean }> {
    return this.fetch("/api/onboarding/status");
  }

  async getWalletKeys(): Promise<{
    evmPrivateKey: string;
    evmAddress: string;
    solanaPrivateKey: string;
    solanaAddress: string;
  }> {
    return this.fetch("/api/wallet/keys");
  }

  async getWalletOsStoreStatus(): Promise<{
    backend: string;
    available: boolean;
    readEnabled: boolean;
    vaultId: string;
  }> {
    return this.fetch("/api/wallet/os-store");
  }

  async postWalletOsStoreAction(action: "migrate" | "delete"): Promise<{
    ok: boolean;
    migrated?: string[];
    failed?: string[];
    error?: string;
  }> {
    return this.fetch("/api/wallet/os-store", {
      method: "POST",
      body: JSON.stringify({ action }),
    });
  }

  async getAuthStatus(): Promise<{
    required: boolean;
    pairingEnabled: boolean;
    expiresAt: number | null;
  }> {
    // Retry with exponential backoff — the server may not be ready during boot.
    const maxRetries = 3;
    const baseBackoffMs = 1000;
    let lastErr: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.fetch("/api/auth/status");
      } catch (err: unknown) {
        const status = (err as Error & { status?: number })?.status;
        if (status === 401) {
          return { required: true, pairingEnabled: false, expiresAt: null };
        }
        if (status === 404) {
          return { required: false, pairingEnabled: false, expiresAt: null };
        }
        lastErr = err;
        // Retry on transient errors (timeout, network) — the server may not
        // be listening yet during boot. Non-transient HTTP errors (401, 404)
        // are handled above and never reach here.
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, baseBackoffMs * 2 ** attempt));
          continue;
        }
      }
    }
    throw lastErr;
  }

  async pair(code: string): Promise<{ token: string }> {
    const res = await this.fetch<{ token: string }>("/api/auth/pair", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    return res;
  }

  async getOnboardingOptions(): Promise<OnboardingOptions> {
    return this.fetch("/api/onboarding/options");
  }

  async submitOnboarding(data: OnboardingData): Promise<void> {
    await this.fetch("/api/onboarding", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async startAnthropicLogin(): Promise<{ authUrl: string }> {
    return this.fetch("/api/subscription/anthropic/start", { method: "POST" });
  }

  async exchangeAnthropicCode(code: string): Promise<{
    success: boolean;
    expiresAt?: string;
    error?: string;
  }> {
    return this.fetch("/api/subscription/anthropic/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }

  async submitAnthropicSetupToken(
    token: string,
  ): Promise<{ success: boolean }> {
    return this.fetch("/api/subscription/anthropic/setup-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  }

  async getSubscriptionStatus(): Promise<SubscriptionStatusResponse> {
    return this.fetch<SubscriptionStatusResponse>("/api/subscription/status");
  }

  async deleteSubscription(provider: string): Promise<{ success: boolean }> {
    return this.fetch(`/api/subscription/${encodeURIComponent(provider)}`, {
      method: "DELETE",
    });
  }

  async switchProvider(
    provider: string,
    apiKey?: string,
  ): Promise<{ success: boolean; provider: string; restarting: boolean }> {
    logSettingsClient("POST /api/provider/switch → start", {
      baseUrl: this.getBaseUrl(),
      provider,
      hasApiKey: Boolean(apiKey?.trim()),
      apiKey,
    });
    const result = (await this.fetch("/api/provider/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...(apiKey ? { apiKey } : {}) }),
    })) as { success: boolean; provider: string; restarting: boolean };
    logSettingsClient("POST /api/provider/switch ← ok", {
      baseUrl: this.getBaseUrl(),
      result,
    });
    return result;
  }

  async startOpenAILogin(): Promise<{
    authUrl: string;
    state: string;
    instructions: string;
  }> {
    return this.fetch("/api/subscription/openai/start", { method: "POST" });
  }

  async exchangeOpenAICode(code: string): Promise<{
    success: boolean;
    expiresAt?: string;
    accountId?: string;
    error?: string;
  }> {
    return this.fetch("/api/subscription/openai/exchange", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }

  async getSandboxPlatform(): Promise<SandboxPlatformStatus> {
    return this.fetch("/api/sandbox/platform");
  }

  async getSandboxBrowser(): Promise<SandboxBrowserEndpoints> {
    return this.fetch("/api/sandbox/browser");
  }

  async getSandboxScreenshot(
    region?: SandboxScreenshotRegion,
  ): Promise<SandboxScreenshotPayload> {
    if (!region) {
      return this.fetch("/api/sandbox/screen/screenshot", {
        method: "POST",
      });
    }

    return this.fetch("/api/sandbox/screen/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(region),
    });
  }

  async getSandboxWindows(): Promise<{
    windows: SandboxWindowInfo[];
    error?: string;
  }> {
    return this.fetch("/api/sandbox/screen/windows");
  }

  async startDocker(): Promise<SandboxStartResponse> {
    return this.fetch("/api/sandbox/docker/start", { method: "POST" });
  }

  async startAgent(): Promise<AgentStatus> {
    const res = await this.fetch<{ status: AgentStatus }>("/api/agent/start", {
      method: "POST",
    });
    return res.status;
  }

  async stopAgent(): Promise<AgentStatus> {
    const res = await this.fetch<{ status: AgentStatus }>("/api/agent/stop", {
      method: "POST",
    });
    return res.status;
  }

  async pauseAgent(): Promise<AgentStatus> {
    const res = await this.fetch<{ status: AgentStatus }>("/api/agent/pause", {
      method: "POST",
    });
    return res.status;
  }

  async resumeAgent(): Promise<AgentStatus> {
    const res = await this.fetch<{ status: AgentStatus }>("/api/agent/resume", {
      method: "POST",
    });
    return res.status;
  }

  async restartAgent(): Promise<AgentStatus> {
    const res = await this.fetch<{ status: AgentStatus }>(
      "/api/agent/restart",
      { method: "POST" },
    );
    return res.status;
  }

  /**
   * Restart the agent if possible, or wait for an in-progress restart to finish.
   * Polls status until the agent state is "running".
   */
  async restartAndWait(maxWaitMs = 30000): Promise<AgentStatus> {
    const t0 = Date.now();
    console.info("[milady][reset][client] restartAndWait: begin", {
      baseUrl: this.getBaseUrl(),
      maxWaitMs,
    });
    // Try triggering a restart; 409 means one is already in progress
    try {
      await this.restartAgent();
      console.info(
        "[milady][reset][client] restartAndWait: POST /api/agent/restart accepted",
      );
    } catch (e) {
      console.info(
        "[milady][reset][client] restartAndWait: initial restart call failed (often 409 while restarting)",
        e,
      );
    }
    // Poll until running
    const start = Date.now();
    const interval = 1000;
    let pollN = 0;
    while (Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, interval));
      pollN += 1;
      try {
        const status = await this.getStatus();
        if (status.state === "running") {
          console.info("[milady][reset][client] restartAndWait: running", {
            pollN,
            waitedMs: Date.now() - t0,
            port: status.port,
          });
          return status;
        }
        if (pollN === 1 || pollN % 5 === 0) {
          console.debug("[milady][reset][client] restartAndWait: poll", {
            pollN,
            state: status.state,
            waitedMs: Date.now() - t0,
          });
        }
      } catch (pollErr) {
        if (pollN === 1 || pollN % 5 === 0) {
          console.debug(
            "[milady][reset][client] restartAndWait: getStatus error while polling",
            { pollN, waitedMs: Date.now() - t0 },
            pollErr,
          );
        }
      }
    }
    // Return whatever we get after timeout
    const final = await this.getStatus();
    console.warn(
      "[milady][reset][client] restartAndWait: timed out — returning last status",
      {
        state: final.state,
        waitedMs: Date.now() - t0,
        maxWaitMs,
      },
    );
    return final;
  }

  async resetAgent(): Promise<void> {
    console.info("[milady][reset][client] POST /api/agent/reset", {
      baseUrl: this.getBaseUrl(),
    });
    await this.fetch("/api/agent/reset", { method: "POST" });
    console.info("[milady][reset][client] POST /api/agent/reset OK");
  }

  async getConfig(): Promise<Record<string, unknown>> {
    logSettingsClient("GET /api/config → start", {
      baseUrl: this.getBaseUrl(),
    });
    const r = (await this.fetch("/api/config")) as Record<string, unknown>;
    const cloud = r.cloud as Record<string, unknown> | undefined;
    logSettingsClient("GET /api/config ← ok", {
      baseUrl: this.getBaseUrl(),
      topKeys: Object.keys(r).sort(),
      cloud: settingsDebugCloudSummary(cloud),
    });
    return r;
  }

  async getConfigSchema(): Promise<ConfigSchemaResponse> {
    return this.fetch("/api/config/schema");
  }

  async updateConfig(
    patch: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    logSettingsClient("PUT /api/config → start", {
      baseUrl: this.getBaseUrl(),
      patch,
    });
    const out = (await this.fetch("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    })) as Record<string, unknown>;
    const cloud = out.cloud as Record<string, unknown> | undefined;
    logSettingsClient("PUT /api/config ← ok", {
      baseUrl: this.getBaseUrl(),
      topKeys: Object.keys(out).sort(),
      cloud: settingsDebugCloudSummary(cloud),
    });
    return out;
  }

  // ── Custom VRM avatar ────────────────────────────────────────────────

  async uploadCustomVrm(file: File): Promise<void> {
    const buf = await file.arrayBuffer();
    await this.fetch("/api/avatar/vrm", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: buf,
    });
  }

  /** Uses raw fetch instead of this.fetch() because HEAD returns no JSON body. */
  async hasCustomVrm(): Promise<boolean> {
    try {
      const res = await this.rawRequest(
        "/api/avatar/vrm",
        { method: "HEAD" },
        { allowNonOk: true },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Custom background image ─────────────────────────────────────────

  async uploadCustomBackground(file: File): Promise<void> {
    const buf = await file.arrayBuffer();
    await this.fetch("/api/avatar/background", {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: buf,
    });
  }

  /** Uses raw fetch instead of this.fetch() because HEAD returns no JSON body. */
  async hasCustomBackground(): Promise<boolean> {
    try {
      const res = await this.rawRequest(
        "/api/avatar/background",
        { method: "HEAD" },
        { allowNonOk: true },
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  // ── Connectors ──────────────────────────────────────────────────────

  async getConnectors(): Promise<{
    connectors: Record<string, ConnectorConfig>;
  }> {
    return this.fetch("/api/connectors");
  }

  async saveConnector(
    name: string,
    config: ConnectorConfig,
  ): Promise<{ connectors: Record<string, ConnectorConfig> }> {
    return this.fetch("/api/connectors", {
      method: "POST",
      body: JSON.stringify({ name, config }),
    });
  }

  async deleteConnector(
    name: string,
  ): Promise<{ connectors: Record<string, ConnectorConfig> }> {
    return this.fetch(`/api/connectors/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  async getTriggers(): Promise<{ triggers: TriggerSummary[] }> {
    return this.fetch("/api/triggers");
  }

  async getTrigger(id: string): Promise<{ trigger: TriggerSummary }> {
    return this.fetch(`/api/triggers/${encodeURIComponent(id)}`);
  }

  async createTrigger(
    request: CreateTriggerRequest,
  ): Promise<{ trigger: TriggerSummary }> {
    return this.fetch("/api/triggers", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async updateTrigger(
    id: string,
    request: UpdateTriggerRequest,
  ): Promise<{ trigger: TriggerSummary }> {
    return this.fetch(`/api/triggers/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(request),
    });
  }

  async deleteTrigger(id: string): Promise<{ ok: boolean }> {
    return this.fetch(`/api/triggers/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async runTriggerNow(id: string): Promise<{
    ok: boolean;
    result: {
      status: TriggerLastStatus;
      error?: string;
      taskDeleted: boolean;
    };
    trigger?: TriggerSummary;
  }> {
    return this.fetch(`/api/triggers/${encodeURIComponent(id)}/execute`, {
      method: "POST",
    });
  }

  async getTriggerRuns(id: string): Promise<{ runs: TriggerRunRecord[] }> {
    return this.fetch(`/api/triggers/${encodeURIComponent(id)}/runs`);
  }

  async getTriggerHealth(): Promise<TriggerHealthSnapshot> {
    return this.fetch("/api/triggers/health");
  }

  // Fine-tuning / training
  async getTrainingStatus(): Promise<TrainingStatus> {
    return this.fetch("/api/training/status");
  }

  async listTrainingTrajectories(opts?: {
    limit?: number;
    offset?: number;
  }): Promise<TrainingTrajectoryList> {
    const params = new URLSearchParams();
    if (typeof opts?.limit === "number")
      params.set("limit", String(opts.limit));
    if (typeof opts?.offset === "number")
      params.set("offset", String(opts.offset));
    const qs = params.toString();
    return this.fetch(`/api/training/trajectories${qs ? `?${qs}` : ""}`);
  }

  async getTrainingTrajectory(
    trajectoryId: string,
  ): Promise<{ trajectory: TrainingTrajectoryDetail }> {
    return this.fetch(
      `/api/training/trajectories/${encodeURIComponent(trajectoryId)}`,
    );
  }

  async listTrainingDatasets(): Promise<{ datasets: TrainingDatasetRecord[] }> {
    return this.fetch("/api/training/datasets");
  }

  async buildTrainingDataset(options?: {
    limit?: number;
    minLlmCallsPerTrajectory?: number;
  }): Promise<{ dataset: TrainingDatasetRecord }> {
    return this.fetch("/api/training/datasets/build", {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  }

  async listTrainingJobs(): Promise<{ jobs: TrainingJobRecord[] }> {
    return this.fetch("/api/training/jobs");
  }

  async startTrainingJob(
    options?: StartTrainingOptions,
  ): Promise<{ job: TrainingJobRecord }> {
    return this.fetch("/api/training/jobs", {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    });
  }

  async getTrainingJob(jobId: string): Promise<{ job: TrainingJobRecord }> {
    return this.fetch(`/api/training/jobs/${encodeURIComponent(jobId)}`);
  }

  async cancelTrainingJob(jobId: string): Promise<{ job: TrainingJobRecord }> {
    return this.fetch(
      `/api/training/jobs/${encodeURIComponent(jobId)}/cancel`,
      {
        method: "POST",
      },
    );
  }

  async listTrainingModels(): Promise<{ models: TrainingModelRecord[] }> {
    return this.fetch("/api/training/models");
  }

  async importTrainingModelToOllama(
    modelId: string,
    options?: {
      modelName?: string;
      baseModel?: string;
      ollamaUrl?: string;
    },
  ): Promise<{ model: TrainingModelRecord }> {
    return this.fetch(
      `/api/training/models/${encodeURIComponent(modelId)}/import-ollama`,
      {
        method: "POST",
        body: JSON.stringify(options ?? {}),
      },
    );
  }

  async activateTrainingModel(
    modelId: string,
    providerModel?: string,
  ): Promise<{
    modelId: string;
    providerModel: string;
    needsRestart: boolean;
  }> {
    return this.fetch(
      `/api/training/models/${encodeURIComponent(modelId)}/activate`,
      {
        method: "POST",
        body: JSON.stringify({ providerModel }),
      },
    );
  }

  async benchmarkTrainingModel(modelId: string): Promise<{
    status: "passed" | "failed";
    output: string;
  }> {
    return this.fetch(
      `/api/training/models/${encodeURIComponent(modelId)}/benchmark`,
      {
        method: "POST",
      },
    );
  }

  async getPlugins(): Promise<{ plugins: PluginInfo[] }> {
    return this.fetch("/api/plugins");
  }

  async fetchModels(
    provider: string,
    refresh = true,
  ): Promise<{ provider: string; models: unknown[] }> {
    const params = new URLSearchParams({ provider });
    if (refresh) params.set("refresh", "true");
    return this.fetch(`/api/models?${params.toString()}`);
  }

  async getCorePlugins(): Promise<CorePluginsResponse> {
    return this.fetch("/api/plugins/core");
  }

  async toggleCorePlugin(
    npmName: string,
    enabled: boolean,
  ): Promise<{ ok: boolean; restarting?: boolean; message?: string }> {
    return this.fetch("/api/plugins/core/toggle", {
      method: "POST",
      body: JSON.stringify({ npmName, enabled }),
    });
  }

  async updatePlugin(
    id: string,
    config: Record<string, unknown>,
  ): Promise<{ ok: boolean; restarting?: boolean }> {
    logSettingsClient(`PUT /api/plugins/${id} → start`, {
      baseUrl: this.getBaseUrl(),
      body: config,
    });
    const result = (await this.fetch(`/api/plugins/${id}`, {
      method: "PUT",
      body: JSON.stringify(config),
    })) as { ok: boolean; restarting?: boolean };
    logSettingsClient(`PUT /api/plugins/${id} ← ok`, {
      baseUrl: this.getBaseUrl(),
      result,
    });
    return result;
  }

  async getSecrets(): Promise<{ secrets: SecretInfo[] }> {
    return this.fetch("/api/secrets");
  }

  async updateSecrets(
    secrets: Record<string, string>,
  ): Promise<{ ok: boolean; updated: string[] }> {
    logSettingsClient("PUT /api/secrets → start", {
      baseUrl: this.getBaseUrl(),
      secretMeta: Object.keys(secrets)
        .sort()
        .map((key) => ({
          key,
          hasValue: Boolean(secrets[key]),
        })),
    });
    const out = (await this.fetch("/api/secrets", {
      method: "PUT",
      body: JSON.stringify({ secrets }),
    })) as { ok: boolean; updated: string[] };
    logSettingsClient("PUT /api/secrets ← ok", {
      baseUrl: this.getBaseUrl(),
      out,
    });
    return out;
  }

  async testPluginConnection(id: string): Promise<{
    success: boolean;
    pluginId: string;
    message?: string;
    error?: string;
    durationMs: number;
  }> {
    return this.fetch(`/api/plugins/${encodeURIComponent(id)}/test`, {
      method: "POST",
    });
  }

  async restart(): Promise<{ ok: boolean }> {
    return this.fetch("/api/restart", { method: "POST" });
  }

  async getSkills(): Promise<{ skills: SkillInfo[] }> {
    return this.fetch("/api/skills");
  }

  async refreshSkills(): Promise<{ ok: boolean; skills: SkillInfo[] }> {
    return this.fetch("/api/skills/refresh", { method: "POST" });
  }

  async getLogs(filter?: LogsFilter): Promise<LogsResponse> {
    const params = new URLSearchParams();
    if (filter?.source) params.set("source", filter.source);
    if (filter?.level) params.set("level", filter.level);
    if (filter?.tag) params.set("tag", filter.tag);
    if (filter?.since) params.set("since", String(filter.since));
    const qs = params.toString();
    return this.fetch(`/api/logs${qs ? `?${qs}` : ""}`);
  }

  private buildSecurityAuditParams(
    filter?: SecurityAuditFilter,
    includeStream = false,
  ): URLSearchParams {
    const params = new URLSearchParams();
    if (filter?.type) params.set("type", filter.type);
    if (filter?.severity) params.set("severity", filter.severity);
    if (filter?.since !== undefined) {
      const sinceValue =
        filter.since instanceof Date
          ? filter.since.toISOString()
          : String(filter.since);
      params.set("since", sinceValue);
    }
    if (filter?.limit !== undefined) params.set("limit", String(filter.limit));
    if (includeStream) params.set("stream", "1");
    return params;
  }

  async getSecurityAudit(
    filter?: SecurityAuditFilter,
  ): Promise<SecurityAuditResponse> {
    const qs = this.buildSecurityAuditParams(filter).toString();
    return this.fetch(`/api/security/audit${qs ? `?${qs}` : ""}`);
  }

  async streamSecurityAudit(
    onEvent: (event: SecurityAuditStreamEvent) => void,
    filter?: SecurityAuditFilter,
    signal?: AbortSignal,
  ): Promise<void> {
    if (!this.apiAvailable) {
      throw new Error("API not available (no HTTP origin)");
    }

    const token = this.apiToken;
    const qs = this.buildSecurityAuditParams(filter, true).toString();
    const res = await fetch(
      `${this.baseUrl}/api/security/audit${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal,
      },
    );

    if (!res.ok) {
      const body = (await res
        .json()
        .catch(() => ({ error: res.statusText }))) as Record<
        string,
        string
      > | null;
      const err = new Error(body?.error ?? `HTTP ${res.status}`);
      (err as Error & { status?: number }).status = res.status;
      throw err;
    }

    if (!res.body) {
      throw new Error("Streaming not supported by this browser");
    }

    const parsePayload = (payload: string) => {
      if (!payload) return;
      try {
        const parsed = JSON.parse(payload) as SecurityAuditStreamEvent;
        if (parsed.type === "snapshot" || parsed.type === "entry") {
          onEvent(parsed);
        }
      } catch {
        // Ignore malformed payloads to keep stream consumption resilient.
      }
    };

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = "";

    const findSseEventBreak = (
      chunkBuffer: string,
    ): { index: number; length: number } | null => {
      const lfBreak = chunkBuffer.indexOf("\n\n");
      const crlfBreak = chunkBuffer.indexOf("\r\n\r\n");
      if (lfBreak === -1 && crlfBreak === -1) return null;
      if (lfBreak === -1) return { index: crlfBreak, length: 4 };
      if (crlfBreak === -1) return { index: lfBreak, length: 2 };
      return lfBreak < crlfBreak
        ? { index: lfBreak, length: 2 }
        : { index: crlfBreak, length: 4 };
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      let eventBreak = findSseEventBreak(buffer);
      while (eventBreak) {
        const rawEvent = buffer.slice(0, eventBreak.index);
        buffer = buffer.slice(eventBreak.index + eventBreak.length);
        for (const line of rawEvent.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          parsePayload(line.slice(5).trim());
        }
        eventBreak = findSseEventBreak(buffer);
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        parsePayload(line.slice(5).trim());
      }
    }
  }

  async getAgentEvents(opts?: {
    afterEventId?: string;
    limit?: number;
    runId?: string;
    fromSeq?: number;
  }): Promise<AgentEventsResponse> {
    const params = new URLSearchParams();
    if (opts?.afterEventId) params.set("after", opts.afterEventId);
    if (typeof opts?.limit === "number")
      params.set("limit", String(opts.limit));
    if (opts?.runId) params.set("runId", opts.runId);
    if (typeof opts?.fromSeq === "number")
      params.set("fromSeq", String(Math.trunc(opts.fromSeq)));
    const qs = params.toString();
    return this.fetch(`/api/agent/events${qs ? `?${qs}` : ""}`);
  }

  async getExtensionStatus(): Promise<ExtensionStatus> {
    return this.fetch("/api/extension/status");
  }

  // Skill Catalog

  async getSkillCatalog(opts?: {
    page?: number;
    perPage?: number;
    sort?: string;
  }): Promise<{
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
    skills: CatalogSkill[];
  }> {
    const params = new URLSearchParams();
    if (opts?.page) params.set("page", String(opts.page));
    if (opts?.perPage) params.set("perPage", String(opts.perPage));
    if (opts?.sort) params.set("sort", opts.sort);
    const qs = params.toString();
    return this.fetch(`/api/skills/catalog${qs ? `?${qs}` : ""}`);
  }

  async searchSkillCatalog(
    query: string,
    limit = 30,
  ): Promise<{
    query: string;
    count: number;
    results: CatalogSearchResult[];
  }> {
    return this.fetch(
      `/api/skills/catalog/search?q=${encodeURIComponent(query)}&limit=${limit}`,
    );
  }

  async getSkillCatalogDetail(slug: string): Promise<{ skill: CatalogSkill }> {
    return this.fetch(`/api/skills/catalog/${encodeURIComponent(slug)}`);
  }

  async refreshSkillCatalog(): Promise<{ ok: boolean; count: number }> {
    return this.fetch("/api/skills/catalog/refresh", { method: "POST" });
  }

  async installCatalogSkill(
    slug: string,
    version?: string,
  ): Promise<{
    ok: boolean;
    slug: string;
    message: string;
    alreadyInstalled?: boolean;
  }> {
    return this.fetch("/api/skills/catalog/install", {
      method: "POST",
      body: JSON.stringify({ slug, version }),
    });
  }

  async uninstallCatalogSkill(slug: string): Promise<{
    ok: boolean;
    slug: string;
    message: string;
  }> {
    return this.fetch("/api/skills/catalog/uninstall", {
      method: "POST",
      body: JSON.stringify({ slug }),
    });
  }

  // Registry / Plugin Store

  async getRegistryPlugins(): Promise<{
    count: number;
    plugins: RegistryPlugin[];
  }> {
    return this.fetch("/api/registry/plugins");
  }

  async getRegistryPluginInfo(
    name: string,
  ): Promise<{ plugin: RegistryPlugin }> {
    return this.fetch(`/api/registry/plugins/${encodeURIComponent(name)}`);
  }

  async getInstalledPlugins(): Promise<{
    count: number;
    plugins: InstalledPlugin[];
  }> {
    return this.fetch("/api/plugins/installed");
  }

  async installRegistryPlugin(
    name: string,
    autoRestart = true,
  ): Promise<PluginInstallResult> {
    return this.fetch("/api/plugins/install", {
      method: "POST",
      body: JSON.stringify({ name, autoRestart }),
    });
  }

  async uninstallRegistryPlugin(
    name: string,
    autoRestart = true,
  ): Promise<{
    ok: boolean;
    pluginName: string;
    message: string;
    error?: string;
  }> {
    return this.fetch("/api/plugins/uninstall", {
      method: "POST",
      body: JSON.stringify({ name, autoRestart }),
    });
  }

  // Agent Export / Import

  /**
   * Export the agent as a password-encrypted .eliza-agent file.
   * Returns the raw Response so the caller can stream the binary body.
   */
  async exportAgent(password: string, includeLogs = false): Promise<Response> {
    if (password.length < AGENT_TRANSFER_MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${AGENT_TRANSFER_MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    return this.rawRequest("/api/agent/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password, includeLogs }),
    });
  }

  /** Get an estimate of the export size. */
  async getExportEstimate(): Promise<{
    estimatedBytes: number;
    memoriesCount: number;
    entitiesCount: number;
    roomsCount: number;
    worldsCount: number;
    tasksCount: number;
  }> {
    return this.fetch("/api/agent/export/estimate");
  }

  /**
   * Import an agent from a password-encrypted .eliza-agent file.
   * Encodes the password and file into a binary envelope.
   */
  async importAgent(
    password: string,
    fileBuffer: ArrayBuffer,
  ): Promise<{
    success: boolean;
    agentId: string;
    agentName: string;
    counts: Record<string, number>;
  }> {
    if (password.length < AGENT_TRANSFER_MIN_PASSWORD_LENGTH) {
      throw new Error(
        `Password must be at least ${AGENT_TRANSFER_MIN_PASSWORD_LENGTH} characters.`,
      );
    }
    const passwordBytes = new TextEncoder().encode(password);
    const envelope = new Uint8Array(
      4 + passwordBytes.length + fileBuffer.byteLength,
    );
    const view = new DataView(envelope.buffer);
    view.setUint32(0, passwordBytes.length, false);
    envelope.set(passwordBytes, 4);
    envelope.set(new Uint8Array(fileBuffer), 4 + passwordBytes.length);

    const res = await this.rawRequest("/api/agent/import", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: envelope,
    });

    const data = (await res.json()) as {
      error?: string;
      success?: boolean;
      agentId?: string;
      agentName?: string;
      counts?: Record<string, number>;
    };
    if (!data.success) {
      throw new Error(data.error ?? `Import failed (${res.status})`);
    }
    return data as {
      success: boolean;
      agentId: string;
      agentName: string;
      counts: Record<string, number>;
    };
  }

  // Character

  async getCharacter(): Promise<{
    character: CharacterData;
    agentName: string;
  }> {
    return this.fetch("/api/character");
  }

  async getRandomName(): Promise<{ name: string }> {
    return this.fetch("/api/character/random-name");
  }

  async generateCharacterField(
    field: string,
    context: {
      name?: string;
      system?: string;
      bio?: string;
      topics?: string[];
      style?: { all?: string[]; chat?: string[]; post?: string[] };
      postExamples?: string[];
    },
    mode?: "append" | "replace",
  ): Promise<{ generated: string }> {
    return this.fetch("/api/character/generate", {
      method: "POST",
      body: JSON.stringify({ field, context, mode }),
    });
  }

  async updateCharacter(
    character: CharacterData,
  ): Promise<{ ok: boolean; character: CharacterData; agentName: string }> {
    return this.fetch("/api/character", {
      method: "PUT",
      body: JSON.stringify(character),
    });
  }

  // Wallet

  async getWalletAddresses(): Promise<WalletAddresses> {
    return this.fetch("/api/wallet/addresses");
  }
  async getWalletBalances(): Promise<WalletBalancesResponse> {
    return this.fetch("/api/wallet/balances");
  }
  async getWalletNfts(): Promise<WalletNftsResponse> {
    return this.fetch("/api/wallet/nfts");
  }
  async getWalletConfig(): Promise<WalletConfigStatus> {
    return this.fetch("/api/wallet/config");
  }
  async updateWalletConfig(
    config: WalletConfigUpdateRequest,
  ): Promise<{ ok: boolean }> {
    return this.fetch("/api/wallet/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }
  async exportWalletKeys(exportToken: string): Promise<WalletExportResult> {
    return this.fetch("/api/wallet/export", {
      method: "POST",
      body: JSON.stringify({ confirm: true, exportToken }),
    });
  }

  // BSC Trading

  async getBscTradePreflight(
    tokenAddress?: string,
  ): Promise<BscTradePreflightResponse> {
    return this.fetch("/api/wallet/trade/preflight", {
      method: "POST",
      body: JSON.stringify(
        tokenAddress?.trim() ? { tokenAddress: tokenAddress.trim() } : {},
      ),
    });
  }

  async getBscTradeQuote(
    request: BscTradeQuoteRequest,
  ): Promise<BscTradeQuoteResponse> {
    return this.fetch("/api/wallet/trade/quote", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async executeBscTrade(
    request: BscTradeExecuteRequest,
  ): Promise<BscTradeExecuteResponse> {
    return this.fetch("/api/wallet/trade/execute", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async executeBscTransfer(
    request: BscTransferExecuteRequest,
  ): Promise<BscTransferExecuteResponse> {
    return this.fetch("/api/wallet/transfer/execute", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getBscTradeTxStatus(hash: string): Promise<BscTradeTxStatusResponse> {
    return this.fetch(
      `/api/wallet/trade/tx-status?hash=${encodeURIComponent(hash)}`,
    );
  }

  async getStewardStatus(): Promise<StewardStatusResponse> {
    return this.fetch("/api/wallet/steward-status");
  }

  async getStewardPolicies(): Promise<
    Array<{
      id: string;
      type: string;
      enabled: boolean;
      config: Record<string, unknown>;
    }>
  > {
    return this.fetch("/api/wallet/steward-policies");
  }

  async setStewardPolicies(
    policies: Array<{
      id: string;
      type: string;
      enabled: boolean;
      config: Record<string, unknown>;
    }>,
  ): Promise<void> {
    await this.fetch("/api/wallet/steward-policies", {
      method: "PUT",
      body: JSON.stringify({ policies }),
    });
  }

  async getStewardHistory(opts?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    records: StewardHistoryResponse;
    total: number;
    offset: number;
    limit: number;
  }> {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return this.fetch(`/api/wallet/steward-tx-records${qs ? `?${qs}` : ""}`);
  }

  async getStewardPending(): Promise<StewardPendingResponse> {
    return this.fetch("/api/wallet/steward-pending-approvals");
  }

  async approveStewardTx(txId: string): Promise<StewardApprovalActionResponse> {
    return this.fetch("/api/wallet/steward-approve-tx", {
      method: "POST",
      body: JSON.stringify({ txId }),
    });
  }

  async rejectStewardTx(
    txId: string,
    reason?: string,
  ): Promise<StewardApprovalActionResponse> {
    return this.fetch("/api/wallet/steward-deny-tx", {
      method: "POST",
      body: JSON.stringify({ txId, reason }),
    });
  }

  async signViaSteward(
    request: StewardSignRequest,
  ): Promise<StewardSignResponse> {
    return this.fetch("/api/wallet/steward-sign", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getWalletTradingProfile(
    window: WalletTradingProfileWindow = "30d",
    source: WalletTradingProfileSourceFilter = "all",
  ): Promise<WalletTradingProfileResponse> {
    const params = new URLSearchParams({
      window,
      source,
    });
    return this.fetch(`/api/wallet/trading/profile?${params.toString()}`);
  }

  async applyProductionWalletDefaults(): Promise<ApplyProductionWalletDefaultsResponse> {
    return this.fetch("/api/wallet/production-defaults", {
      method: "POST",
      body: JSON.stringify({ confirm: true }),
    });
  }

  // Software Updates
  async getUpdateStatus(force = false): Promise<UpdateStatus> {
    return this.fetch(`/api/update/status${force ? "?force=true" : ""}`);
  }
  async setUpdateChannel(
    channel: "stable" | "beta" | "nightly",
  ): Promise<{ channel: string }> {
    return this.fetch("/api/update/channel", {
      method: "PUT",
      body: JSON.stringify({ channel }),
    });
  }

  // Cloud
  async getCloudStatus(): Promise<CloudStatus> {
    return this.fetch("/api/cloud/status");
  }
  async getCloudCredits(): Promise<CloudCredits> {
    return this.fetch("/api/cloud/credits");
  }
  async getCloudBillingSummary(): Promise<CloudBillingSummary> {
    return this.fetch("/api/cloud/billing/summary");
  }
  async getCloudBillingSettings(): Promise<CloudBillingSettings> {
    return this.fetch("/api/cloud/billing/settings");
  }
  async updateCloudBillingSettings(
    request: CloudBillingSettingsUpdateRequest,
  ): Promise<CloudBillingSettings> {
    return this.fetch("/api/cloud/billing/settings", {
      method: "PUT",
      body: JSON.stringify(request),
    });
  }
  async getCloudBillingPaymentMethods(): Promise<{
    success?: boolean;
    data?: CloudBillingPaymentMethod[];
    items?: CloudBillingPaymentMethod[];
    paymentMethods?: CloudBillingPaymentMethod[];
    [key: string]: unknown;
  }> {
    return this.fetch("/api/cloud/billing/payment-methods");
  }
  async getCloudBillingHistory(): Promise<{
    success?: boolean;
    data?: CloudBillingHistoryItem[];
    items?: CloudBillingHistoryItem[];
    history?: CloudBillingHistoryItem[];
    [key: string]: unknown;
  }> {
    return this.fetch("/api/cloud/billing/history");
  }
  async createCloudBillingCheckout(
    request: CloudBillingCheckoutRequest,
  ): Promise<CloudBillingCheckoutResponse> {
    return this.fetch("/api/cloud/billing/checkout", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }
  async createCloudBillingCryptoQuote(
    request: CloudBillingCryptoQuoteRequest,
  ): Promise<CloudBillingCryptoQuoteResponse> {
    return this.fetch("/api/cloud/billing/crypto/quote", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }
  async cloudLogin(): Promise<CloudLoginResponse> {
    return this.fetch("/api/cloud/login", { method: "POST" });
  }
  async cloudLoginPoll(sessionId: string): Promise<CloudLoginPollResponse> {
    return this.fetch(
      `/api/cloud/login/status?sessionId=${encodeURIComponent(sessionId)}`,
    );
  }
  async cloudDisconnect(): Promise<{ ok: boolean }> {
    return this.fetch("/api/cloud/disconnect", { method: "POST" });
  }

  // Cloud Compat (Eliza Cloud v2 thin-client endpoints)

  /** List all cloud-hosted agents for the authenticated user. */
  async getCloudCompatAgents(): Promise<{
    success: boolean;
    data: CloudCompatAgent[];
  }> {
    return this.fetch("/api/cloud/compat/agents");
  }

  /** Create a new cloud-hosted agent. */
  async createCloudCompatAgent(opts: {
    agentName: string;
    agentConfig?: Record<string, unknown>;
    environmentVars?: Record<string, string>;
  }): Promise<{
    success: boolean;
    data: {
      agentId: string;
      agentName: string;
      jobId: string;
      status: string;
      nodeId: string | null;
      message: string;
    };
  }> {
    return this.fetch("/api/cloud/compat/agents", {
      method: "POST",
      body: JSON.stringify(opts),
    });
  }

  /** Get a specific cloud-hosted agent by ID. */
  async getCloudCompatAgent(agentId: string): Promise<{
    success: boolean;
    data: CloudCompatAgent;
  }> {
    return this.fetch(
      `/api/cloud/compat/agents/${encodeURIComponent(agentId)}`,
    );
  }

  /** Delete a cloud-hosted agent. */
  async deleteCloudCompatAgent(agentId: string): Promise<{
    success: boolean;
    data: { jobId: string; status: string; message: string };
  }> {
    return this.fetch(
      `/api/cloud/compat/agents/${encodeURIComponent(agentId)}`,
      { method: "DELETE" },
    );
  }

  /** Get status of a cloud-hosted agent. */
  async getCloudCompatAgentStatus(agentId: string): Promise<{
    success: boolean;
    data: CloudCompatAgentStatus;
  }> {
    return this.fetch(
      `/api/cloud/compat/agents/${encodeURIComponent(agentId)}/status`,
    );
  }

  /** Get logs from a cloud-hosted agent. */
  async getCloudCompatAgentLogs(
    agentId: string,
    tail = 100,
  ): Promise<{ success: boolean; data: string }> {
    return this.fetch(
      `/api/cloud/compat/agents/${encodeURIComponent(agentId)}/logs?tail=${tail}`,
    );
  }

  /** Restart a cloud-hosted agent. */
  async restartCloudCompatAgent(agentId: string): Promise<{
    success: boolean;
    data: { jobId: string; status: string; message: string };
  }> {
    return this.fetch(
      `/api/cloud/compat/agents/${encodeURIComponent(agentId)}/restart`,
      { method: "POST" },
    );
  }

  /** Suspend a cloud-hosted agent. */
  async suspendCloudCompatAgent(agentId: string): Promise<{
    success: boolean;
    data: { jobId: string; status: string; message: string };
  }> {
    return this.fetch(
      `/api/cloud/compat/agents/${encodeURIComponent(agentId)}/suspend`,
      { method: "POST" },
    );
  }

  /** Resume a cloud-hosted agent. */
  async resumeCloudCompatAgent(agentId: string): Promise<{
    success: boolean;
    data: { jobId: string; status: string; message: string };
  }> {
    return this.fetch(
      `/api/cloud/compat/agents/${encodeURIComponent(agentId)}/resume`,
      { method: "POST" },
    );
  }

  /** Launch a managed cloud agent into the Milady app. */
  async launchCloudCompatAgent(agentId: string): Promise<{
    success: boolean;
    data: CloudCompatLaunchResult;
  }> {
    return this.fetch(
      `/api/cloud/compat/agents/${encodeURIComponent(agentId)}/launch`,
      { method: "POST" },
    );
  }

  /** Get cloud availability (capacity info). */
  async getCloudCompatAvailability(): Promise<{
    success: boolean;
    data: {
      totalSlots: number;
      usedSlots: number;
      availableSlots: number;
      acceptingNewAgents: boolean;
    };
  }> {
    return this.fetch("/api/cloud/compat/availability");
  }

  /** Poll a cloud job status by job ID. */
  async getCloudCompatJobStatus(jobId: string): Promise<{
    success: boolean;
    data: CloudCompatJob;
  }> {
    return this.fetch(`/api/cloud/compat/jobs/${encodeURIComponent(jobId)}`);
  }

  // Apps & Registry
  async listApps(): Promise<RegistryAppInfo[]> {
    return this.fetch("/api/apps");
  }
  async searchApps(query: string): Promise<RegistryAppInfo[]> {
    return this.fetch(`/api/apps/search?q=${encodeURIComponent(query)}`);
  }
  async listInstalledApps(): Promise<InstalledAppInfo[]> {
    return this.fetch("/api/apps/installed");
  }
  async stopApp(name: string): Promise<AppStopResult> {
    return this.fetch("/api/apps/stop", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }
  async getAppInfo(name: string): Promise<RegistryAppInfo> {
    return this.fetch(`/api/apps/info/${encodeURIComponent(name)}`);
  }
  /** Launch an app: installs its plugin (if needed), returns viewer config for iframe. */
  async launchApp(name: string): Promise<AppLaunchResult> {
    return this.fetch("/api/apps/launch", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }
  async listRegistryPlugins(): Promise<RegistryPluginItem[]> {
    return this.fetch("/api/apps/plugins");
  }
  async searchRegistryPlugins(query: string): Promise<RegistryPluginItem[]> {
    return this.fetch(
      `/api/apps/plugins/search?q=${encodeURIComponent(query)}`,
    );
  }
  async listHyperscapeEmbeddedAgents(): Promise<HyperscapeEmbeddedAgentsResponse> {
    return this.fetch("/api/apps/hyperscape/embedded-agents");
  }
  async createHyperscapeEmbeddedAgent(input: {
    characterId: string;
    autoStart?: boolean;
    scriptedRole?: HyperscapeScriptedRole;
  }): Promise<HyperscapeEmbeddedAgentMutationResponse> {
    return this.fetch("/api/apps/hyperscape/embedded-agents", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }
  async controlHyperscapeEmbeddedAgent(
    characterId: string,
    action: HyperscapeEmbeddedAgentControlAction,
  ): Promise<HyperscapeEmbeddedAgentMutationResponse> {
    return this.fetch(
      `/api/apps/hyperscape/embedded-agents/${encodeURIComponent(characterId)}/${action}`,
      { method: "POST" },
    );
  }
  async sendHyperscapeEmbeddedAgentCommand(
    characterId: string,
    command: string,
    data?: { [key: string]: HyperscapeJsonValue },
  ): Promise<HyperscapeActionResponse> {
    return this.fetch(
      `/api/apps/hyperscape/embedded-agents/${encodeURIComponent(characterId)}/command`,
      {
        method: "POST",
        body: JSON.stringify({ command, data }),
      },
    );
  }
  async sendHyperscapeAgentMessage(
    agentId: string,
    content: string,
  ): Promise<HyperscapeActionResponse> {
    return this.fetch(
      `/api/apps/hyperscape/agents/${encodeURIComponent(agentId)}/message`,
      {
        method: "POST",
        body: JSON.stringify({ content }),
      },
    );
  }
  async getHyperscapeAgentGoal(
    agentId: string,
  ): Promise<HyperscapeAgentGoalResponse> {
    return this.fetch(
      `/api/apps/hyperscape/agents/${encodeURIComponent(agentId)}/goal`,
    );
  }
  async getHyperscapeAgentQuickActions(
    agentId: string,
  ): Promise<HyperscapeQuickActionsResponse> {
    return this.fetch(
      `/api/apps/hyperscape/agents/${encodeURIComponent(agentId)}/quick-actions`,
    );
  }

  // Skills Marketplace

  async searchSkillsMarketplace(
    query: string,
    installed: boolean,
    limit: number,
  ): Promise<{ results: SkillMarketplaceResult[] }> {
    const params = new URLSearchParams({
      q: query,
      installed: String(installed),
      limit: String(limit),
    });
    return this.fetch(`/api/skills/marketplace/search?${params}`);
  }

  async getSkillsMarketplaceConfig(): Promise<{ keySet: boolean }> {
    return this.fetch("/api/skills/marketplace/config");
  }

  async updateSkillsMarketplaceConfig(
    apiKey: string,
  ): Promise<{ keySet: boolean }> {
    return this.fetch("/api/skills/marketplace/config", {
      method: "PUT",
      body: JSON.stringify({ apiKey }),
    });
  }

  async installMarketplaceSkill(data: {
    slug?: string;
    githubUrl?: string;
    repository?: string;
    path?: string;
    name?: string;
    description?: string;
    source: string;
    autoRefresh?: boolean;
  }): Promise<void> {
    await this.fetch("/api/skills/marketplace/install", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async uninstallMarketplaceSkill(
    skillId: string,
    autoRefresh: boolean,
  ): Promise<void> {
    await this.fetch("/api/skills/marketplace/uninstall", {
      method: "POST",
      body: JSON.stringify({ id: skillId, autoRefresh }),
    });
  }

  async updateSkill(
    skillId: string,
    enabled: boolean,
  ): Promise<{ skill: SkillInfo }> {
    return this.fetch(`/api/skills/${encodeURIComponent(skillId)}`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  }

  // ── Skill CRUD & Security ────────────────────────────────────────────────

  async createSkill(
    name: string,
    description: string,
  ): Promise<{ ok: boolean; skill: SkillInfo; path: string }> {
    return this.fetch("/api/skills/create", {
      method: "POST",
      body: JSON.stringify({ name, description }),
    });
  }

  async openSkill(id: string): Promise<{ ok: boolean; path: string }> {
    return this.fetch(`/api/skills/${encodeURIComponent(id)}/open`, {
      method: "POST",
    });
  }

  async getSkillSource(
    id: string,
  ): Promise<{ ok: boolean; skillId: string; content: string; path: string }> {
    return this.fetch(`/api/skills/${encodeURIComponent(id)}/source`);
  }

  async saveSkillSource(
    id: string,
    content: string,
  ): Promise<{ ok: boolean; skillId: string; skill: SkillInfo }> {
    return this.fetch(`/api/skills/${encodeURIComponent(id)}/source`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
  }

  async deleteSkill(
    id: string,
  ): Promise<{ ok: boolean; skillId: string; source: string }> {
    return this.fetch(`/api/skills/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async getSkillScanReport(id: string): Promise<{
    ok: boolean;
    report: SkillScanReportSummary | null;
    acknowledged: boolean;
    acknowledgment: { acknowledgedAt: string; findingCount: number } | null;
  }> {
    return this.fetch(`/api/skills/${encodeURIComponent(id)}/scan`);
  }

  async acknowledgeSkill(
    id: string,
    enable: boolean,
  ): Promise<{
    ok: boolean;
    skillId: string;
    acknowledged: boolean;
    enabled: boolean;
    findingCount: number;
  }> {
    return this.fetch(`/api/skills/${encodeURIComponent(id)}/acknowledge`, {
      method: "POST",
      body: JSON.stringify({ enable }),
    });
  }

  // Workbench

  async getWorkbenchOverview(): Promise<
    WorkbenchOverview & {
      tasksAvailable?: boolean;
      triggersAvailable?: boolean;
      todosAvailable?: boolean;
    }
  > {
    return this.fetch("/api/workbench/overview");
  }

  async listWorkbenchTasks(): Promise<{ tasks: WorkbenchTask[] }> {
    return this.fetch("/api/workbench/tasks");
  }

  async getWorkbenchTask(taskId: string): Promise<{ task: WorkbenchTask }> {
    return this.fetch(`/api/workbench/tasks/${encodeURIComponent(taskId)}`);
  }

  async createWorkbenchTask(data: {
    name: string;
    description?: string;
    tags?: string[];
    isCompleted?: boolean;
  }): Promise<{ task: WorkbenchTask }> {
    return this.fetch("/api/workbench/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateWorkbenchTask(
    taskId: string,
    data: {
      name?: string;
      description?: string;
      tags?: string[];
      isCompleted?: boolean;
    },
  ): Promise<{ task: WorkbenchTask }> {
    return this.fetch(`/api/workbench/tasks/${encodeURIComponent(taskId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteWorkbenchTask(taskId: string): Promise<{ ok: boolean }> {
    return this.fetch(`/api/workbench/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    });
  }

  async listWorkbenchTodos(): Promise<{ todos: WorkbenchTodo[] }> {
    return this.fetch("/api/workbench/todos");
  }

  async getWorkbenchTodo(todoId: string): Promise<{ todo: WorkbenchTodo }> {
    return this.fetch(`/api/workbench/todos/${encodeURIComponent(todoId)}`);
  }

  async createWorkbenchTodo(data: {
    name: string;
    description?: string;
    priority?: number;
    isUrgent?: boolean;
    type?: string;
    isCompleted?: boolean;
  }): Promise<{ todo: WorkbenchTodo }> {
    return this.fetch("/api/workbench/todos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateWorkbenchTodo(
    todoId: string,
    data: {
      name?: string;
      description?: string;
      priority?: number;
      isUrgent?: boolean;
      type?: string;
      isCompleted?: boolean;
    },
  ): Promise<{ todo: WorkbenchTodo }> {
    return this.fetch(`/api/workbench/todos/${encodeURIComponent(todoId)}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async setWorkbenchTodoCompleted(
    todoId: string,
    isCompleted: boolean,
  ): Promise<void> {
    await this.fetch(
      `/api/workbench/todos/${encodeURIComponent(todoId)}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ isCompleted }),
      },
    );
  }

  async deleteWorkbenchTodo(todoId: string): Promise<{ ok: boolean }> {
    return this.fetch(`/api/workbench/todos/${encodeURIComponent(todoId)}`, {
      method: "DELETE",
    });
  }

  // Registry

  async refreshRegistry(): Promise<void> {
    await this.fetch("/api/apps/refresh", { method: "POST" });
  }

  // Knowledge

  async getKnowledgeStats(): Promise<KnowledgeStats> {
    return this.fetch("/api/knowledge/stats");
  }

  async listKnowledgeDocuments(options?: {
    limit?: number;
    offset?: number;
  }): Promise<KnowledgeDocumentsResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    const query = params.toString();
    return this.fetch(`/api/knowledge/documents${query ? `?${query}` : ""}`);
  }

  async getKnowledgeDocument(
    documentId: string,
  ): Promise<{ document: KnowledgeDocumentDetail }> {
    return this.fetch(
      `/api/knowledge/documents/${encodeURIComponent(documentId)}`,
    );
  }

  async deleteKnowledgeDocument(
    documentId: string,
  ): Promise<{ ok: boolean; deletedFragments: number }> {
    return this.fetch(
      `/api/knowledge/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
      },
    );
  }

  async uploadKnowledgeDocument(data: {
    content: string;
    filename: string;
    contentType?: string;
    metadata?: Record<string, unknown>;
  }): Promise<KnowledgeUploadResult> {
    return this.fetch("/api/knowledge/documents", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async uploadKnowledgeDocumentsBulk(data: {
    documents: Array<{
      content: string;
      filename: string;
      contentType?: string;
      metadata?: Record<string, unknown>;
    }>;
  }): Promise<KnowledgeBulkUploadResult> {
    return this.fetch("/api/knowledge/documents/bulk", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async uploadKnowledgeFromUrl(
    url: string,
    metadata?: Record<string, unknown>,
  ): Promise<KnowledgeUploadResult> {
    return this.fetch("/api/knowledge/documents/url", {
      method: "POST",
      body: JSON.stringify({ url, metadata }),
    });
  }

  async searchKnowledge(
    query: string,
    options?: { threshold?: number; limit?: number },
  ): Promise<KnowledgeSearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.threshold !== undefined)
      params.set("threshold", String(options.threshold));
    if (options?.limit !== undefined)
      params.set("limit", String(options.limit));
    return this.fetch(`/api/knowledge/search?${params}`);
  }

  async getKnowledgeFragments(
    documentId: string,
  ): Promise<KnowledgeFragmentsResponse> {
    return this.fetch(
      `/api/knowledge/fragments/${encodeURIComponent(documentId)}`,
    );
  }

  // Memory commands

  async rememberMemory(text: string): Promise<MemoryRememberResponse> {
    return this.fetch("/api/memory/remember", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  async searchMemory(
    query: string,
    options?: { limit?: number },
  ): Promise<MemorySearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined)
      params.set("limit", String(options.limit));
    return this.fetch(`/api/memory/search?${params}`);
  }

  async quickContext(
    query: string,
    options?: { limit?: number },
  ): Promise<QuickContextResponse> {
    const params = new URLSearchParams({ q: query });
    if (options?.limit !== undefined)
      params.set("limit", String(options.limit));
    return this.fetch(`/api/context/quick?${params}`);
  }

  // MCP

  async getMcpConfig(): Promise<{ servers: Record<string, McpServerConfig> }> {
    return this.fetch("/api/mcp/config");
  }

  async getMcpStatus(): Promise<{ servers: McpServerStatus[] }> {
    return this.fetch("/api/mcp/status");
  }

  async searchMcpMarketplace(
    query: string,
    limit: number,
  ): Promise<{ results: McpMarketplaceResult[] }> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.fetch(`/api/mcp/marketplace/search?${params}`);
  }

  async getMcpServerDetails(
    name: string,
  ): Promise<{ server: McpRegistryServerDetail }> {
    return this.fetch(`/api/mcp/marketplace/${encodeURIComponent(name)}`);
  }

  async addMcpServer(name: string, config: McpServerConfig): Promise<void> {
    await this.fetch("/api/mcp/servers", {
      method: "POST",
      body: JSON.stringify({ name, config }),
    });
  }

  async removeMcpServer(name: string): Promise<void> {
    await this.fetch(`/api/mcp/servers/${encodeURIComponent(name)}`, {
      method: "DELETE",
    });
  }

  // Share Ingest

  async ingestShare(
    payload: ShareIngestPayload,
  ): Promise<{ item: ShareIngestItem }> {
    return this.fetch("/api/ingest/share", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async consumeShareIngest(): Promise<{ items: ShareIngestItem[] }> {
    return this.fetch("/api/share/consume", { method: "POST" });
  }

  // WebSocket

  connectWs(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    let host: string;
    let wsProtocol: "ws:" | "wss:";
    if (this.baseUrl) {
      const parsed = new URL(this.baseUrl);
      host = parsed.host;
      wsProtocol = parsed.protocol === "https:" ? "wss:" : "ws:";
    } else {
      // In non-HTTP environments (electrobun://, file://, etc.)
      // window.location.host may be empty or a non-routable placeholder like "-".
      const loc = window.location;
      if (loc.protocol !== "http:" && loc.protocol !== "https:") return;
      host = loc.host;
      wsProtocol = loc.protocol === "https:" ? "wss:" : "ws:";
    }

    if (!host) return;

    let url = `${wsProtocol}//${host}/ws`;
    const params = new URLSearchParams({ clientId: this.clientId });
    url += `?${params.toString()}`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      const token = this.apiToken;
      if (token && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "auth", token }));
      }
      this.backoffMs = 500;
      // Reset connection state on successful connection
      this.reconnectAttempt = 0;
      this.disconnectedAt = null;
      this.connectionState = "connected";
      this.emitConnectionStateChange();

      // Notify listeners when the WS reconnects (not on the first connect)
      // so they can re-hydrate state that may have been lost during the gap.
      if (this.wsHasConnectedOnce) {
        const handlers = this.wsHandlers.get("ws-reconnected");
        if (handlers) {
          for (const handler of handlers) {
            handler({ type: "ws-reconnected" });
          }
        }
      }
      this.wsHasConnectedOnce = true;
      if (
        this.wsSendQueue.length > 0 &&
        this.ws?.readyState === WebSocket.OPEN
      ) {
        const pending = this.wsSendQueue;
        this.wsSendQueue = [];
        for (let i = 0; i < pending.length; i++) {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.wsSendQueue = pending.slice(i).concat(this.wsSendQueue);
            break;
          }
          try {
            this.ws.send(pending[i]);
          } catch {
            this.wsSendQueue = pending.slice(i).concat(this.wsSendQueue);
            break;
          }
        }
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as Record<
          string,
          unknown
        >;
        const type = data.type as string;
        const handlers = this.wsHandlers.get(type);
        if (handlers) {
          for (const handler of handlers) {
            handler(data);
          }
        }
        // Also fire "all" handlers
        const allHandlers = this.wsHandlers.get("*");
        if (allHandlers) {
          for (const handler of allHandlers) {
            handler(data);
          }
        }
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this.ws = null;
      // Track disconnection time if not already set
      if (this.disconnectedAt === null) {
        this.disconnectedAt = Date.now();
      }
      this.reconnectAttempt++;
      // Update state based on attempt count
      if (this.reconnectAttempt >= this.maxReconnectAttempts) {
        this.connectionState = "failed";
      } else {
        this.connectionState = "reconnecting";
      }
      this.emitConnectionStateChange();
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      // close handler will fire
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    // After the short backoff window is exhausted, keep probing at a
    // low frequency so the UI can recover without a full page refresh.
    if (this.reconnectAttempt >= this.maxReconnectAttempts) {
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.connectWs();
      }, 30_000);
      return;
    }
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connectWs();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 1.5, 10000);
  }

  private emitConnectionStateChange(): void {
    const state = this.getConnectionState();
    for (const listener of this.connectionStateListeners) {
      try {
        listener(state);
      } catch {
        // ignore listener errors
      }
    }
  }

  /** Get the current WebSocket connection state. */
  getConnectionState(): ConnectionStateInfo {
    return {
      state: this.connectionState,
      reconnectAttempt: this.reconnectAttempt,
      maxReconnectAttempts: this.maxReconnectAttempts,
      disconnectedAt: this.disconnectedAt,
    };
  }

  /** Subscribe to connection state changes. Returns an unsubscribe function. */
  onConnectionStateChange(
    listener: (state: ConnectionStateInfo) => void,
  ): () => void {
    this.connectionStateListeners.add(listener);
    return () => {
      this.connectionStateListeners.delete(listener);
    };
  }

  /** Reset connection state and restart reconnection attempts. */
  resetConnection(): void {
    this.reconnectAttempt = 0;
    this.disconnectedAt = null;
    this.connectionState = "disconnected";
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.backoffMs = 500;
    this.emitConnectionStateChange();
    this.connectWs();
  }

  /** Send an arbitrary JSON message over the WebSocket connection. */
  sendWsMessage(data: Record<string, unknown>): void {
    const payload = JSON.stringify(data);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
      return;
    }

    // Keep only the newest active-conversation update while disconnected.
    if (data.type === "active-conversation") {
      this.wsSendQueue = this.wsSendQueue.filter((queued) => {
        try {
          const parsed = JSON.parse(queued) as { type?: unknown };
          return parsed.type !== "active-conversation";
        } catch {
          return true;
        }
      });
    }

    if (this.wsSendQueue.length >= this.wsSendQueueLimit) {
      const droppedType = typeof data.type === "string" ? data.type : "unknown";
      console.warn("[ws] send queue full - dropping:", droppedType);
      this.wsSendQueue.shift();
    }
    this.wsSendQueue.push(payload);

    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
      this.connectWs();
    }
  }

  onWsEvent(type: string, handler: WsEventHandler): () => void {
    if (!this.wsHandlers.has(type)) {
      this.wsHandlers.set(type, new Set());
    }
    this.wsHandlers.get(type)?.add(handler);
    return () => {
      this.wsHandlers.get(type)?.delete(handler);
    };
  }

  private normalizeAssistantText(text: string): string {
    const stripped = stripAssistantStageDirections(text);
    const trimmed = stripped.trim();
    if (trimmed.length === 0) {
      if (
        text.trim().length === 0 ||
        /^\(?no response\)?$/i.test(text.trim())
      ) {
        return GENERIC_NO_RESPONSE_TEXT;
      }
      return "";
    }
    if (/^\(?no response\)?$/i.test(trimmed)) {
      return GENERIC_NO_RESPONSE_TEXT;
    }
    return trimmed;
  }

  private normalizeGreetingText(text: string): string {
    const stripped = stripAssistantStageDirections(text);
    const trimmed = stripped.trim();
    if (trimmed.length === 0 || /^\(?no response\)?$/i.test(trimmed)) {
      return "";
    }
    return trimmed;
  }

  private normalizeConversationMessage(
    message: ConversationMessage,
  ): ConversationMessage {
    if (message.role !== "assistant") return message;
    const text = this.normalizeAssistantText(message.text);
    return text === message.text ? message : { ...message, text };
  }

  private async streamChatEndpoint(
    path: string,
    text: string,
    onToken: (token: string, accumulatedText?: string) => void,
    channelType: ConversationChannelType = "DM",
    signal?: AbortSignal,
    images?: ImageAttachment[],
    conversationMode?: ConversationMode,
  ): Promise<{
    text: string;
    agentName: string;
    completed: boolean;
    usage?: ChatTokenUsage;
  }> {
    const res = await this.rawRequest(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        text,
        channelType,
        ...(images?.length ? { images } : {}),
        ...(conversationMode ? { conversationMode } : {}),
      }),
      signal,
    });

    if (!res.body) {
      throw new Error("Streaming not supported by this browser");
    }

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = "";
    let fullText = "";
    let doneText: string | null = null;
    let doneAgentName: string | null = null;
    let doneUsage: ChatTokenUsage | undefined;
    let receivedDone = false;

    const findSseEventBreak = (
      chunkBuffer: string,
    ): { index: number; length: number } | null => {
      const lfBreak = chunkBuffer.indexOf("\n\n");
      const crlfBreak = chunkBuffer.indexOf("\r\n\r\n");

      if (lfBreak === -1 && crlfBreak === -1) return null;
      if (lfBreak === -1) return { index: crlfBreak, length: 4 };
      if (crlfBreak === -1) return { index: lfBreak, length: 2 };
      return lfBreak < crlfBreak
        ? { index: lfBreak, length: 2 }
        : { index: crlfBreak, length: 4 };
    };

    const parseDataLine = (line: string): void => {
      const payload = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!payload) return;

      let parsed: {
        type?: string;
        text?: string;
        fullText?: string;
        agentName?: string;
        message?: string;
        usage?: {
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
          model?: string;
        };
      };
      try {
        parsed = JSON.parse(payload) as typeof parsed;
      } catch {
        return;
      }

      if (!parsed.type && typeof parsed.text === "string") {
        parsed.type = "token";
      }

      if (parsed.type === "token") {
        const chunk = parsed.text ?? "";
        const nextFullText =
          typeof parsed.fullText === "string"
            ? parsed.fullText
            : chunk
              ? mergeStreamingText(fullText, chunk)
              : fullText;
        if (nextFullText === fullText) return;
        fullText = nextFullText;
        onToken(chunk, fullText);
        return;
      }

      if (parsed.type === "done") {
        receivedDone = true;
        if (typeof parsed.fullText === "string") doneText = parsed.fullText;
        if (typeof parsed.agentName === "string" && parsed.agentName.trim()) {
          doneAgentName = parsed.agentName;
        }
        if (parsed.usage) {
          doneUsage = {
            promptTokens: parsed.usage.promptTokens ?? 0,
            completionTokens: parsed.usage.completionTokens ?? 0,
            totalTokens: parsed.usage.totalTokens ?? 0,
            model: parsed.usage.model,
          };
        }
        // Terminal event: stop reading immediately instead of waiting for the
        // server to close the body (some stacks leave the stream open briefly).
        void reader.cancel("milady-sse-terminal-done").catch(() => {});
        return;
      }

      if (parsed.type === "error") {
        throw new Error(parsed.message ?? "generation failed");
      }
    };

    // Contract: the API must emit `data: {"type":"done",...}` or
    // `data: {"type":"error",...}` and then end the response. If the server
    // stalls mid-stream (e.g. LLM provider timeout without error propagation),
    // the idle timeout below aborts the read so the UI doesn't hang forever.
    const SSE_IDLE_TIMEOUT_MS = 60_000;
    while (true) {
      let done = false;
      let value: Uint8Array | undefined;
      try {
        const readPromise = reader.read();
        const timeoutPromise = new Promise<never>((_, reject) => {
          const id = setTimeout(
            () => reject(new Error("SSE idle timeout — no data for 60s")),
            SSE_IDLE_TIMEOUT_MS,
          );
          // Clear timeout if the read resolves first
          void readPromise.finally(() => clearTimeout(id));
        });
        ({ done, value } = await Promise.race([readPromise, timeoutPromise]));
      } catch (streamErr) {
        console.warn("[api-client] SSE stream interrupted:", streamErr);
        void reader.cancel("milady-sse-idle-timeout").catch(() => {});
        break;
      }
      if (done || !value) break;

      buffer += decoder.decode(value, { stream: true });
      let eventBreak = findSseEventBreak(buffer);
      while (eventBreak) {
        const rawEvent = buffer.slice(0, eventBreak.index);
        buffer = buffer.slice(eventBreak.index + eventBreak.length);
        for (const line of rawEvent.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          parseDataLine(line);
        }
        eventBreak = findSseEventBreak(buffer);
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split(/\r?\n/)) {
        if (line.startsWith("data:")) parseDataLine(line);
      }
    }

    const resolvedText = this.normalizeAssistantText(doneText ?? fullText);
    return {
      text: resolvedText,
      agentName: doneAgentName ?? "Milady",
      completed: receivedDone,
      ...(doneUsage ? { usage: doneUsage } : {}),
    };
  }

  /**
   * Send a chat message via the REST endpoint (reliable — does not depend on
   * a WebSocket connection).  Returns the agent's response text.
   */
  async sendChatRest(
    text: string,
    channelType: ConversationChannelType = "DM",
    conversationMode?: ConversationMode,
  ): Promise<{ text: string; agentName: string }> {
    const response = await this.fetch<{ text: string; agentName: string }>(
      "/api/chat",
      {
        method: "POST",
        body: JSON.stringify({
          text,
          channelType,
          ...(conversationMode ? { conversationMode } : {}),
        }),
      },
    );
    return {
      ...response,
      text: this.normalizeAssistantText(response.text),
    };
  }

  async sendChatStream(
    text: string,
    onToken: (token: string, accumulatedText?: string) => void,
    channelType: ConversationChannelType = "DM",
    signal?: AbortSignal,
    conversationMode?: ConversationMode,
  ): Promise<{
    text: string;
    agentName: string;
    completed: boolean;
    usage?: ChatTokenUsage;
  }> {
    return this.streamChatEndpoint(
      "/api/chat/stream",
      text,
      onToken,
      channelType,
      signal,
      undefined,
      conversationMode,
    );
  }

  // Conversations

  async listConversations(): Promise<{ conversations: Conversation[] }> {
    return this.fetch("/api/conversations");
  }

  async createConversation(
    title?: string,
    options?: CreateConversationOptions,
  ): Promise<{ conversation: Conversation; greeting?: ConversationGreeting }> {
    const response = await this.fetch<{
      conversation: Conversation;
      greeting?: ConversationGreeting;
    }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({
        title,
        ...(options?.includeGreeting === true ||
        options?.bootstrapGreeting === true
          ? { includeGreeting: true }
          : {}),
        ...(typeof options?.lang === "string" && options.lang.trim()
          ? { lang: options.lang.trim() }
          : {}),
      }),
    });
    if (!response.greeting) {
      return response;
    }
    return {
      ...response,
      greeting: {
        ...response.greeting,
        text: this.normalizeGreetingText(response.greeting.text),
      },
    };
  }

  async getConversationMessages(
    id: string,
  ): Promise<{ messages: ConversationMessage[] }> {
    const response = await this.fetch<{ messages: ConversationMessage[] }>(
      `/api/conversations/${encodeURIComponent(id)}/messages`,
    );
    return {
      messages: response.messages.map((message) =>
        this.normalizeConversationMessage(message),
      ),
    };
  }

  async truncateConversationMessages(
    id: string,
    messageId: string,
    options?: { inclusive?: boolean },
  ): Promise<{ ok: boolean; deletedCount: number }> {
    return this.fetch(
      `/api/conversations/${encodeURIComponent(id)}/messages/truncate`,
      {
        method: "POST",
        body: JSON.stringify({
          messageId,
          inclusive: options?.inclusive === true,
        }),
      },
    );
  }

  async sendConversationMessage(
    id: string,
    text: string,
    channelType: ConversationChannelType = "DM",
    images?: ImageAttachment[],
    conversationMode?: ConversationMode,
  ): Promise<{ text: string; agentName: string; blocks?: ContentBlock[] }> {
    const response = await this.fetch<{
      text: string;
      agentName: string;
      blocks?: ContentBlock[];
    }>(`/api/conversations/${encodeURIComponent(id)}/messages`, {
      method: "POST",
      body: JSON.stringify({
        text,
        channelType,
        ...(images?.length ? { images } : {}),
        ...(conversationMode ? { conversationMode } : {}),
      }),
    });
    return {
      ...response,
      text: this.normalizeAssistantText(response.text),
    };
  }

  async sendConversationMessageStream(
    id: string,
    text: string,
    onToken: (token: string, accumulatedText?: string) => void,
    channelType: ConversationChannelType = "DM",
    signal?: AbortSignal,
    images?: ImageAttachment[],
    conversationMode?: ConversationMode,
  ): Promise<{
    text: string;
    agentName: string;
    completed: boolean;
    usage?: ChatTokenUsage;
  }> {
    return this.streamChatEndpoint(
      `/api/conversations/${encodeURIComponent(id)}/messages/stream`,
      text,
      onToken,
      channelType,
      signal,
      images,
      conversationMode,
    );
  }

  async requestGreeting(
    id: string,
    lang?: string,
  ): Promise<{
    text: string;
    agentName: string;
    generated: boolean;
    persisted?: boolean;
  }> {
    const qs = lang ? `?lang=${encodeURIComponent(lang)}` : "";
    const response = await this.fetch<{
      text: string;
      agentName: string;
      generated: boolean;
      persisted?: boolean;
    }>(`/api/conversations/${encodeURIComponent(id)}/greeting${qs}`, {
      method: "POST",
    });
    return {
      ...response,
      text: this.normalizeGreetingText(response.text),
    };
  }

  async renameConversation(
    id: string,
    title: string,
    options?: { generate?: boolean },
  ): Promise<{ conversation: Conversation }> {
    return this.fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ title, generate: options?.generate }),
    });
  }

  async deleteConversation(id: string): Promise<{ ok: boolean }> {
    return this.fetch(`/api/conversations/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  // ── Database API ──────────────────────────────────────────────────────

  async getDatabaseStatus(): Promise<DatabaseStatus> {
    return this.fetch("/api/database/status");
  }

  async getDatabaseConfig(): Promise<DatabaseConfigResponse> {
    return this.fetch("/api/database/config");
  }

  async saveDatabaseConfig(config: {
    provider?: DatabaseProviderType;
    pglite?: { dataDir?: string };
    postgres?: {
      connectionString?: string;
      host?: string;
      port?: number;
      database?: string;
      user?: string;
      password?: string;
      ssl?: boolean;
    };
  }): Promise<{ saved: boolean; needsRestart: boolean }> {
    return this.fetch("/api/database/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }

  async testDatabaseConnection(creds: {
    connectionString?: string;
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean;
  }): Promise<ConnectionTestResult> {
    return this.fetch("/api/database/test", {
      method: "POST",
      body: JSON.stringify(creds),
    });
  }

  async getDatabaseTables(): Promise<{ tables: TableInfo[] }> {
    return this.fetch("/api/database/tables");
  }

  async getDatabaseRows(
    table: string,
    opts?: {
      offset?: number;
      limit?: number;
      sort?: string;
      order?: "asc" | "desc";
      search?: string;
    },
  ): Promise<TableRowsResponse> {
    const params = new URLSearchParams();
    if (opts?.offset != null) params.set("offset", String(opts.offset));
    if (opts?.limit != null) params.set("limit", String(opts.limit));
    if (opts?.sort) params.set("sort", opts.sort);
    if (opts?.order) params.set("order", opts.order);
    if (opts?.search) params.set("search", opts.search);
    const qs = params.toString();
    return this.fetch(
      `/api/database/tables/${encodeURIComponent(table)}/rows${qs ? `?${qs}` : ""}`,
    );
  }

  async insertDatabaseRow(
    table: string,
    data: Record<string, unknown>,
  ): Promise<{ inserted: boolean; row: Record<string, unknown> | null }> {
    return this.fetch(
      `/api/database/tables/${encodeURIComponent(table)}/rows`,
      {
        method: "POST",
        body: JSON.stringify({ data }),
      },
    );
  }

  async updateDatabaseRow(
    table: string,
    where: Record<string, unknown>,
    data: Record<string, unknown>,
  ): Promise<{ updated: boolean; row: Record<string, unknown> }> {
    return this.fetch(
      `/api/database/tables/${encodeURIComponent(table)}/rows`,
      {
        method: "PUT",
        body: JSON.stringify({ where, data }),
      },
    );
  }

  async deleteDatabaseRow(
    table: string,
    where: Record<string, unknown>,
  ): Promise<{ deleted: boolean; row: Record<string, unknown> }> {
    return this.fetch(
      `/api/database/tables/${encodeURIComponent(table)}/rows`,
      {
        method: "DELETE",
        body: JSON.stringify({ where }),
      },
    );
  }

  async executeDatabaseQuery(
    sql: string,
    readOnly = true,
  ): Promise<QueryResult> {
    return this.fetch("/api/database/query", {
      method: "POST",
      body: JSON.stringify({ sql, readOnly }),
    });
  }

  // ── Trajectories ─────────────────────────────────────────────────────

  async getTrajectories(
    options?: TrajectoryListOptions,
  ): Promise<TrajectoryListResult> {
    const params = new URLSearchParams();
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.offset) params.set("offset", String(options.offset));
    if (options?.source) params.set("source", options.source);
    if (options?.status) params.set("status", options.status);
    if (options?.startDate) params.set("startDate", options.startDate);
    if (options?.endDate) params.set("endDate", options.endDate);
    if (options?.search) params.set("search", options.search);
    const query = params.toString();
    return this.fetch(`/api/trajectories${query ? `?${query}` : ""}`);
  }

  async getTrajectoryDetail(
    trajectoryId: string,
  ): Promise<TrajectoryDetailResult> {
    return this.fetch(`/api/trajectories/${encodeURIComponent(trajectoryId)}`);
  }

  async getTrajectoryStats(): Promise<TrajectoryStats> {
    return this.fetch("/api/trajectories/stats");
  }

  async getTrajectoryConfig(): Promise<TrajectoryConfig> {
    return this.fetch("/api/trajectories/config");
  }

  async updateTrajectoryConfig(
    config: Partial<TrajectoryConfig>,
  ): Promise<TrajectoryConfig> {
    return this.fetch("/api/trajectories/config", {
      method: "PUT",
      body: JSON.stringify(config),
    });
  }

  async exportTrajectories(options: TrajectoryExportOptions): Promise<Blob> {
    const res = await this.rawRequest("/api/trajectories/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options),
    });
    return res.blob();
  }

  async deleteTrajectories(
    trajectoryIds: string[],
  ): Promise<{ deleted: number }> {
    return this.fetch("/api/trajectories", {
      method: "DELETE",
      body: JSON.stringify({ trajectoryIds }),
    });
  }

  async clearAllTrajectories(): Promise<{ deleted: number }> {
    return this.fetch("/api/trajectories", {
      method: "DELETE",
      body: JSON.stringify({ clearAll: true }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  System Permissions
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Get all system permission states.
   */
  async getPermissions(): Promise<AllPermissionsState> {
    return this.fetch("/api/permissions");
  }

  /**
   * Get a single permission state.
   */
  async getPermission(id: SystemPermissionId): Promise<PermissionState> {
    return this.fetch(`/api/permissions/${id}`);
  }

  /**
   * Request a specific permission (triggers OS prompt if applicable).
   */
  async requestPermission(id: SystemPermissionId): Promise<PermissionState> {
    return this.fetch(`/api/permissions/${id}/request`, { method: "POST" });
  }

  /**
   * Open system settings for a specific permission.
   */
  async openPermissionSettings(id: SystemPermissionId): Promise<void> {
    await this.fetch(`/api/permissions/${id}/open-settings`, {
      method: "POST",
    });
  }

  /**
   * Refresh all permission states from the OS.
   */
  async refreshPermissions(): Promise<AllPermissionsState> {
    return this.fetch("/api/permissions/refresh", { method: "POST" });
  }

  /**
   * Enable or disable shell access.
   */
  async setShellEnabled(enabled: boolean): Promise<PermissionState> {
    return this.fetch("/api/permissions/shell", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    });
  }

  /**
   * Get shell enabled status.
   */
  async isShellEnabled(): Promise<boolean> {
    const result = await this.fetch<{ enabled: boolean }>(
      "/api/permissions/shell",
    );
    return result.enabled;
  }

  /**
   * Get agent automation permission mode.
   */
  async getAgentAutomationMode(): Promise<AgentAutomationModeResponse> {
    return this.fetch("/api/permissions/automation-mode");
  }

  /**
   * Set agent automation permission mode.
   */
  async setAgentAutomationMode(
    mode: AgentAutomationMode,
  ): Promise<AgentAutomationModeResponse> {
    return this.fetch("/api/permissions/automation-mode", {
      method: "PUT",
      body: JSON.stringify({ mode }),
    });
  }

  /**
   * Get wallet trade execution permission mode.
   */
  async getTradePermissionMode(): Promise<TradePermissionModeResponse> {
    return this.fetch("/api/permissions/trade-mode");
  }

  /**
   * Set wallet trade execution permission mode.
   */
  async setTradePermissionMode(
    mode: TradePermissionMode,
  ): Promise<TradePermissionModeResponse> {
    return this.fetch("/api/permissions/trade-mode", {
      method: "PUT",
      body: JSON.stringify({ mode }),
    });
  }

  disconnectWs(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.wsSendQueue = [];
    // Reset connection state on intentional disconnect
    this.reconnectAttempt = 0;
    this.disconnectedAt = null;
    this.connectionState = "disconnected";
    this.emitConnectionStateChange();
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  ERC-8004 Registry
  // ═══════════════════════════════════════════════════════════════════════

  async getRegistryStatus(): Promise<RegistryStatus> {
    return this.fetch("/api/registry/status");
  }

  async registerAgent(params?: {
    name?: string;
    endpoint?: string;
    tokenURI?: string;
  }): Promise<RegistrationResult> {
    return this.fetch("/api/registry/register", {
      method: "POST",
      body: JSON.stringify(params ?? {}),
    });
  }

  async updateRegistryTokenURI(
    tokenURI: string,
  ): Promise<{ ok: boolean; txHash: string }> {
    return this.fetch("/api/registry/update-uri", {
      method: "POST",
      body: JSON.stringify({ tokenURI }),
    });
  }

  async syncRegistryProfile(params?: {
    name?: string;
    endpoint?: string;
    tokenURI?: string;
  }): Promise<{ ok: boolean; txHash: string }> {
    return this.fetch("/api/registry/sync", {
      method: "POST",
      body: JSON.stringify(params ?? {}),
    });
  }

  async getRegistryConfig(): Promise<RegistryConfig> {
    return this.fetch("/api/registry/config");
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Drop / Mint
  // ═══════════════════════════════════════════════════════════════════════

  async getDropStatus(): Promise<DropStatus> {
    return this.fetch("/api/drop/status");
  }

  async mintAgent(params?: {
    name?: string;
    endpoint?: string;
    shiny?: boolean;
  }): Promise<MintResult> {
    return this.fetch("/api/drop/mint", {
      method: "POST",
      body: JSON.stringify(params ?? {}),
    });
  }

  async mintAgentWhitelist(params: {
    name?: string;
    endpoint?: string;
    proof: string[];
  }): Promise<MintResult> {
    return this.fetch("/api/drop/mint-whitelist", {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  Whitelist
  // ═══════════════════════════════════════════════════════════════════════

  async getWhitelistStatus(): Promise<WhitelistStatus> {
    return this.fetch("/api/whitelist/status");
  }

  async generateTwitterVerificationMessage(): Promise<VerificationMessageResponse> {
    return this.fetch("/api/whitelist/twitter/message", { method: "POST" });
  }

  async verifyTwitter(tweetUrl: string): Promise<VerificationResult> {
    return this.fetch("/api/whitelist/twitter/verify", {
      method: "POST",
      body: JSON.stringify({ tweetUrl }),
    });
  }

  // ── Custom Actions ─────────────────────────────────────────────────────

  async listCustomActions(): Promise<CustomActionDef[]> {
    const data = await this.fetch<{ actions: CustomActionDef[] }>(
      "/api/custom-actions",
    );
    return data.actions;
  }

  async createCustomAction(
    action: Omit<CustomActionDef, "id" | "createdAt" | "updatedAt">,
  ): Promise<CustomActionDef> {
    const data = await this.fetch<{ ok: boolean; action: CustomActionDef }>(
      "/api/custom-actions",
      { method: "POST", body: JSON.stringify(action) },
    );
    return data.action;
  }

  async updateCustomAction(
    id: string,
    action: Partial<CustomActionDef>,
  ): Promise<CustomActionDef> {
    const data = await this.fetch<{ ok: boolean; action: CustomActionDef }>(
      `/api/custom-actions/${encodeURIComponent(id)}`,
      { method: "PUT", body: JSON.stringify(action) },
    );
    return data.action;
  }

  async deleteCustomAction(id: string): Promise<void> {
    await this.fetch(`/api/custom-actions/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async testCustomAction(
    id: string,
    params: Record<string, string>,
  ): Promise<{
    ok: boolean;
    output: string;
    error?: string;
    durationMs: number;
  }> {
    return this.fetch(`/api/custom-actions/${encodeURIComponent(id)}/test`, {
      method: "POST",
      body: JSON.stringify({ params }),
    });
  }

  async generateCustomAction(
    prompt: string,
  ): Promise<{ ok: boolean; generated: Record<string, unknown> }> {
    return this.fetch("/api/custom-actions/generate", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  WhatsApp Pairing
  // ═══════════════════════════════════════════════════════════════════════

  async getWhatsAppStatus(accountId = "default"): Promise<{
    accountId: string;
    status: string;
    authExists: boolean;
    serviceConnected: boolean;
    servicePhone: string | null;
  }> {
    return this.fetch(
      `/api/whatsapp/status?accountId=${encodeURIComponent(accountId)}`,
    );
  }

  async startWhatsAppPairing(accountId = "default"): Promise<{
    ok: boolean;
    accountId: string;
    status: string;
    error?: string;
  }> {
    return this.fetch("/api/whatsapp/pair", {
      method: "POST",
      body: JSON.stringify({ accountId }),
    });
  }

  async stopWhatsAppPairing(accountId = "default"): Promise<{
    ok: boolean;
    accountId: string;
    status: string;
  }> {
    return this.fetch("/api/whatsapp/pair/stop", {
      method: "POST",
      body: JSON.stringify({ accountId }),
    });
  }

  async disconnectWhatsApp(accountId = "default"): Promise<{
    ok: boolean;
    accountId: string;
  }> {
    return this.fetch("/api/whatsapp/disconnect", {
      method: "POST",
      body: JSON.stringify({ accountId }),
    });
  }

  // --- Bug Report ---

  async checkBugReportInfo(): Promise<{
    nodeVersion?: string;
    platform?: string;
    submissionMode?: "remote" | "github" | "fallback";
  }> {
    return this.fetch("/api/bug-report/info");
  }

  async submitBugReport(report: {
    description: string;
    stepsToReproduce: string;
    expectedBehavior?: string;
    actualBehavior?: string;
    environment?: string;
    nodeVersion?: string;
    modelProvider?: string;
    logs?: string;
    category?: "general" | "startup-failure";
    appVersion?: string;
    releaseChannel?: string;
    startup?: {
      reason?: string;
      phase?: string;
      message?: string;
      detail?: string;
      status?: number;
      path?: string;
    };
  }): Promise<{
    accepted?: boolean;
    id?: string;
    url?: string;
    fallback?: string;
    destination?: "remote" | "github" | "fallback";
  }> {
    return this.fetch("/api/bug-report", {
      method: "POST",
      body: JSON.stringify(report),
    });
  }

  // ── Coding Agents ───────────────────────────────────────────────────

  async getCodingAgentStatus(): Promise<CodingAgentStatus | null> {
    try {
      const status = await this.fetch<CodingAgentStatus>(
        "/api/coding-agents/coordinator/status",
      );
      // If coordinator returned but tasks is empty, fall back to ptyService
      // session list so the UI shows active PTY sessions even when the
      // coordinator hasn't registered them yet.
      if (status && (!status.tasks || status.tasks.length === 0)) {
        try {
          const ptySessions =
            await this.fetch<RawPtySession[]>("/api/coding-agents");
          if (Array.isArray(ptySessions) && ptySessions.length > 0) {
            status.tasks = mapPtySessionsToCodingAgentSessions(ptySessions);
            status.taskCount = status.tasks.length;
          }
        } catch {
          // /api/coding-agents may not exist — ignore
        }
      }
      return status;
    } catch {
      return null;
    }
  }

  async stopCodingAgent(sessionId: string): Promise<boolean> {
    try {
      await this.fetch(
        `/api/coding-agents/${encodeURIComponent(sessionId)}/stop`,
        { method: "POST" },
      );
      return true;
    } catch {
      return false;
    }
  }

  async listCodingAgentScratchWorkspaces(): Promise<
    CodingAgentScratchWorkspace[]
  > {
    try {
      return await this.fetch<CodingAgentScratchWorkspace[]>(
        "/api/coding-agents/scratch",
      );
    } catch (err) {
      console.warn(
        "[api-client] Failed to list coding agent scratch workspaces:",
        err,
      );
      return [];
    }
  }

  async keepCodingAgentScratchWorkspace(sessionId: string): Promise<boolean> {
    try {
      await this.fetch(
        `/api/coding-agents/${encodeURIComponent(sessionId)}/scratch/keep`,
        { method: "POST" },
      );
      return true;
    } catch {
      return false;
    }
  }

  async deleteCodingAgentScratchWorkspace(sessionId: string): Promise<boolean> {
    try {
      // Keep POST for compatibility with plugin route handlers.
      await this.fetch(
        `/api/coding-agents/${encodeURIComponent(sessionId)}/scratch/delete`,
        { method: "POST" },
      );
      return true;
    } catch {
      return false;
    }
  }

  async promoteCodingAgentScratchWorkspace(
    sessionId: string,
    name?: string,
  ): Promise<CodingAgentScratchWorkspace | null> {
    try {
      const response = await this.fetch<{
        success: boolean;
        scratch?: CodingAgentScratchWorkspace;
      }>(
        `/api/coding-agents/${encodeURIComponent(sessionId)}/scratch/promote`,
        {
          method: "POST",
          body: JSON.stringify(name ? { name } : {}),
        },
      );
      return response.scratch ?? null;
    } catch {
      return null;
    }
  }

  // ── PTY Terminal (xterm.js bridge) ─────────────────────────────────────

  /** Subscribe to live PTY output for a session over WebSocket. */
  subscribePtyOutput(sessionId: string): void {
    this.sendWsMessage({ type: "pty-subscribe", sessionId });
  }

  /** Unsubscribe from live PTY output for a session. */
  unsubscribePtyOutput(sessionId: string): void {
    this.sendWsMessage({ type: "pty-unsubscribe", sessionId });
  }

  /** Send raw keyboard input to a PTY session. */
  sendPtyInput(sessionId: string, data: string): void {
    this.sendWsMessage({ type: "pty-input", sessionId, data });
  }

  /** Resize a PTY session's terminal dimensions. */
  resizePty(sessionId: string, cols: number, rows: number): void {
    this.sendWsMessage({ type: "pty-resize", sessionId, cols, rows });
  }

  /** Fetch buffered terminal output (raw ANSI) for xterm.js hydration. */
  async getPtyBufferedOutput(sessionId: string): Promise<string> {
    try {
      const res = await this.fetch<{ output: string }>(
        `/api/coding-agents/${encodeURIComponent(sessionId)}/buffered-output`,
      );
      return res.output ?? "";
    } catch {
      return "";
    }
  }

  // ── Stream controls ─────────────────────────────────────────────────────

  async streamGoLive(): Promise<{
    ok: boolean;
    live: boolean;
    rtmpUrl?: string;
    inputMode?: string;
    audioSource?: string;
    message?: string;
    destination?: string;
  }> {
    return this.fetch("/api/stream/live", { method: "POST" });
  }

  async streamGoOffline(): Promise<{ ok: boolean; live: boolean }> {
    return this.fetch("/api/stream/offline", { method: "POST" });
  }

  async streamStatus(): Promise<{
    ok: boolean;
    running: boolean;
    ffmpegAlive: boolean;
    uptime: number;
    frameCount: number;
    volume: number;
    muted: boolean;
    audioSource: string;
    inputMode: string | null;
    destination?: { id: string; name: string } | null;
  }> {
    return this.fetch("/api/stream/status");
  }

  async getStreamingDestinations(): Promise<{
    ok: boolean;
    destinations: Array<{ id: string; name: string }>;
  }> {
    return this.fetch("/api/streaming/destinations");
  }

  async setActiveDestination(destinationId: string): Promise<{
    ok: boolean;
    destination?: { id: string; name: string };
  }> {
    return this.fetch("/api/streaming/destination", {
      method: "POST",
      body: JSON.stringify({ destinationId }),
    });
  }

  async setStreamVolume(
    volume: number,
  ): Promise<{ ok: boolean; volume: number; muted: boolean }> {
    return this.fetch("/api/stream/volume", {
      method: "POST",
      body: JSON.stringify({ volume }),
    });
  }

  async muteStream(): Promise<{ ok: boolean; muted: boolean; volume: number }> {
    return this.fetch("/api/stream/mute", { method: "POST" });
  }

  async unmuteStream(): Promise<{
    ok: boolean;
    muted: boolean;
    volume: number;
  }> {
    return this.fetch("/api/stream/unmute", { method: "POST" });
  }

  // ── Stream voice (TTS) ───────────────────────────────────────────────

  async getStreamVoice(): Promise<{
    ok: boolean;
    enabled: boolean;
    autoSpeak: boolean;
    provider: string | null;
    configuredProvider: string | null;
    hasApiKey: boolean;
    isSpeaking: boolean;
    isAttached: boolean;
  }> {
    return this.fetch("/api/stream/voice");
  }

  async saveStreamVoice(settings: {
    enabled?: boolean;
    autoSpeak?: boolean;
    provider?: string;
  }): Promise<{
    ok: boolean;
    voice: { enabled: boolean; autoSpeak: boolean };
  }> {
    return this.fetch("/api/stream/voice", {
      method: "POST",
      body: JSON.stringify(settings),
    });
  }

  async streamVoiceSpeak(
    text: string,
  ): Promise<{ ok: boolean; speaking: boolean }> {
    return this.fetch("/api/stream/voice/speak", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  // ── Overlay layout ────────────────────────────────────────────────────

  async getOverlayLayout(
    destinationId?: string | null,
  ): Promise<{ ok: boolean; layout: unknown; destinationId?: string }> {
    const qs = destinationId
      ? `?destination=${encodeURIComponent(destinationId)}`
      : "";
    return this.fetch(`/api/stream/overlay-layout${qs}`);
  }

  async saveOverlayLayout(
    layout: unknown,
    destinationId?: string | null,
  ): Promise<{ ok: boolean; layout: unknown; destinationId?: string }> {
    const qs = destinationId
      ? `?destination=${encodeURIComponent(destinationId)}`
      : "";
    return this.fetch(`/api/stream/overlay-layout${qs}`, {
      method: "POST",
      body: JSON.stringify({ layout }),
    });
  }

  // ── Stream source picker ──────────────────────────────────────────────

  async getStreamSource(): Promise<{
    source: { type: string; url?: string };
  }> {
    return this.fetch("/api/stream/source");
  }

  async setStreamSource(
    sourceType: string,
    customUrl?: string,
  ): Promise<{ ok: boolean; source: { type: string; url?: string } }> {
    return this.fetch("/api/stream/source", {
      method: "POST",
      body: JSON.stringify({ sourceType, customUrl }),
    });
  }

  // ── Stream visual settings (theme, avatar for headless parity) ────────

  async getStreamSettings(): Promise<{
    ok: boolean;
    settings: { theme?: string; avatarIndex?: number };
  }> {
    return this.fetch("/api/stream/settings");
  }

  async saveStreamSettings(settings: {
    theme?: string;
    avatarIndex?: number;
  }): Promise<{ ok: boolean; settings: unknown }> {
    return this.fetch("/api/stream/settings", {
      method: "POST",
      body: JSON.stringify({ settings }),
    });
  }

  // ── Direct Eliza Cloud Auth (no local backend required) ─────────────

  /**
   * Initiate a direct login to Eliza Cloud without going through a local agent.
   * Used in sandbox mode when no local backend exists yet.
   */
  async cloudLoginDirect(cloudApiBase: string): Promise<{
    ok: boolean;
    browserUrl?: string;
    sessionId?: string;
    error?: string;
  }> {
    const sessionId = globalThis.crypto.randomUUID();
    try {
      const res = await fetch(`${cloudApiBase}/api/auth/cli-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        return { ok: false, error: `Login failed (${res.status})` };
      }
      return {
        ok: true,
        sessionId,
        browserUrl: `${cloudApiBase}/auth/cli-login?session=${encodeURIComponent(sessionId)}`,
      };
    } catch (err) {
      return {
        ok: false,
        error: `Failed to reach Eliza Cloud: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  /**
   * Poll a direct Eliza Cloud login session for authentication status.
   */
  async cloudLoginPollDirect(
    cloudApiBase: string,
    sessionId: string,
  ): Promise<{
    status: "pending" | "authenticated" | "expired" | "error";
    token?: string;
    userId?: string;
    error?: string;
  }> {
    try {
      const res = await fetch(
        `${cloudApiBase}/api/auth/cli-session/${encodeURIComponent(sessionId)}`,
      );
      if (!res.ok) {
        if (res.status === 404) {
          return {
            status: "expired",
            error: "Auth session expired or not found",
          };
        }
        return { status: "error", error: `Poll failed (${res.status})` };
      }
      const data = await res.json();
      // Map cli-session response shape to expected poll shape
      if (data.status === "authenticated" && data.apiKey) {
        return {
          status: "authenticated",
          token: data.apiKey,
          userId: data.userId,
        };
      }
      return { status: data.status ?? "pending" };
    } catch {
      return { status: "error", error: "Poll request failed" };
    }
  }

  // ── Eliza Cloud Sandbox Provisioning ───────────────────────────────

  /**
   * Create a sandbox agent on Eliza Cloud and provision it.
   * Returns the bridge URL when provisioning completes.
   *
   * Flow:
   *   1. POST /api/v1/milady/agents — create agent record
   *   2. POST /api/v1/milady/agents/{id}/provision — start async provisioning
   *   3. Poll GET /api/v1/jobs/{jobId} until completed
   *   4. Return bridgeUrl from job result
   */
  async provisionCloudSandbox(options: {
    cloudApiBase: string;
    authToken: string;
    name: string;
    bio?: string[];
    onProgress?: (status: string, detail?: string) => void;
  }): Promise<{ bridgeUrl: string; agentId: string }> {
    const { cloudApiBase, authToken, name, bio, onProgress } = options;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    };

    onProgress?.("creating", "Creating agent...");

    // Step 1: Create agent
    const createRes = await fetch(`${cloudApiBase}/api/v1/milady/agents`, {
      method: "POST",
      headers,
      body: JSON.stringify({ name, bio }),
    });
    if (!createRes.ok) {
      const err = await createRes.text().catch(() => "Unknown error");
      throw new Error(`Failed to create cloud agent: ${err}`);
    }
    const createData = (await createRes.json()) as { id: string };
    const agentId = createData.id;

    onProgress?.("provisioning", "Provisioning sandbox environment...");

    // Step 2: Start provisioning
    const provisionRes = await fetch(
      `${cloudApiBase}/api/v1/milady/agents/${agentId}/provision`,
      { method: "POST", headers },
    );
    if (!provisionRes.ok) {
      const err = await provisionRes.text().catch(() => "Unknown error");
      throw new Error(`Failed to start provisioning: ${err}`);
    }
    const provisionData = (await provisionRes.json()) as { jobId: string };
    const jobId = provisionData.jobId;

    // Step 3: Poll job status
    const deadline = Date.now() + 120_000; // 2 minute timeout
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2000));

      const jobRes = await fetch(`${cloudApiBase}/api/v1/jobs/${jobId}`, {
        headers,
      });
      if (!jobRes.ok) continue;

      const jobData = (await jobRes.json()) as {
        status: string;
        result?: { bridgeUrl?: string };
        error?: string;
      };

      if (jobData.status === "completed" && jobData.result?.bridgeUrl) {
        onProgress?.("ready", "Sandbox ready!");
        return { bridgeUrl: jobData.result.bridgeUrl, agentId };
      }

      if (jobData.status === "failed") {
        throw new Error(
          `Provisioning failed: ${jobData.error ?? "Unknown error"}`,
        );
      }

      onProgress?.("provisioning", `Status: ${jobData.status}...`);
    }

    throw new Error("Provisioning timed out after 2 minutes");
  }
}

// Singleton
export const client = new MiladyClient();
