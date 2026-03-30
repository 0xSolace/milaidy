// ---------------------------------------------------------------------------
// Types — extracted from client.ts so they can be imported without pulling in
// the full MiladyClient runtime.
// ---------------------------------------------------------------------------

import type { DatabaseProviderType } from "@miladyai/agent/contracts/config";
import type { MessageExampleContent } from "@miladyai/shared/contracts/onboarding";
import type { TradePermissionMode as WalletTradePermissionMode } from "@miladyai/agent/contracts/wallet";
import type { ConfigUiHint } from "../types";
import type {
  TriggerLastStatus,
  TriggerType,
  TriggerWakeMode,
} from "@miladyai/agent/triggers/types";
import type { StreamEventType } from "@miladyai/agent/api/server";
import type { TrajectoryExportFormat } from "@miladyai/agent/api/trajectory-routes";

export type {
  TriggerLastStatus,
  TriggerType,
  TriggerWakeMode,
} from "@miladyai/agent/triggers/types";

export type { StreamEventType } from "@miladyai/agent/api/server";

export type { TrajectoryExportFormat };

export interface DatabaseStatus {
  provider: DatabaseProviderType;
  connected: boolean;
  serverVersion: string | null;
  tableCount: number;
  pgliteDataDir: string | null;
  postgresHost: string | null;
}

export interface DatabaseConfigResponse {
  config: {
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
  };
  activeProvider: DatabaseProviderType;
  needsRestart: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  serverVersion: string | null;
  error: string | null;
  durationMs: number;
}

export interface TableInfo {
  name: string;
  schema: string;
  rowCount: number;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
}

export interface TableRowsResponse {
  table: string;
  rows: Record<string, unknown>[];
  columns: string[];
  total: number;
  offset: number;
  limit: number;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

export type AgentState =
  | "not_started"
  | "starting"
  | "running"
  | "stopped"
  | "restarting"
  | "error";

export interface AgentStartupDiagnostics {
  phase: string;
  attempt: number;
  lastError?: string;
  lastErrorAt?: number;
  nextRetryAt?: number;
  /** Local embedding (GGUF) warmup — from Milady status overlay */
  embeddingPhase?: "checking" | "downloading" | "loading" | "ready";
  embeddingDetail?: string;
  /** 0–100 when parseable from embedding detail */
  embeddingProgressPct?: number;
}

export interface AgentStatus {
  state: AgentState;
  agentName: string;
  model: string | undefined;
  uptime: number | undefined;
  startedAt: number | undefined;
  port?: number;
  pendingRestart?: boolean;
  pendingRestartReasons?: string[];
  startup?: AgentStartupDiagnostics;
}

export type AgentAutomationMode = "connectors-only" | "full";
export type TradePermissionMode = WalletTradePermissionMode;

export interface AgentAutomationModeResponse {
  mode: AgentAutomationMode;
  options: AgentAutomationMode[];
}

export interface TradePermissionModeResponse {
  mode: TradePermissionMode;
  options: TradePermissionMode[];
}

export interface ApplyProductionWalletDefaultsResponse {
  ok: boolean;
  profile: "pure-privy-safe";
  walletMode: "privy";
  tradePermissionMode: "user-sign-only";
  bscExecutionEnabled: false;
  clearedSecrets: string[];
}

export interface AgentSelfStatusSnapshot {
  generatedAt: string;
  state: AgentState;
  agentName: string;
  model: string | null;
  provider: string | null;
  automationMode: AgentAutomationMode;
  tradePermissionMode: TradePermissionMode;
  shellEnabled: boolean;
  wallet: {
    mode: "privy" | "hybrid";
    evmAddress: string | null;
    evmAddressShort: string | null;
    solanaAddress: string | null;
    solanaAddressShort: string | null;
    hasWallet: boolean;
    hasEvm: boolean;
    hasSolana: boolean;
    localSignerAvailable: boolean;
    managedBscRpcReady: boolean;
  };
  plugins: {
    totalActive: number;
    active: string[];
    aiProviders: string[];
    connectors: string[];
  };
  capabilities: {
    canTrade: boolean;
    canLocalTrade: boolean;
    canAutoTrade: boolean;
    canUseBrowser: boolean;
    canUseComputer: boolean;
    canRunTerminal: boolean;
    canInstallPlugins: boolean;
    canConfigurePlugins: boolean;
    canConfigureConnectors: boolean;
  };
}

// WebSocket connection state tracking
export type WebSocketConnectionState =
  | "connected"
  | "disconnected"
  | "reconnecting"
  | "failed";

export interface ConnectionStateInfo {
  state: WebSocketConnectionState;
  reconnectAttempt: number;
  maxReconnectAttempts: number;
  disconnectedAt: number | null;
}

export type ApiErrorKind = "timeout" | "network" | "http";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly path: string;

  constructor(options: {
    kind: ApiErrorKind;
    path: string;
    message: string;
    status?: number;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.path = options.path;
    this.status = options.status;
    if (options.cause !== undefined) {
      (
        this as Error & {
          cause?: unknown;
        }
      ).cause = options.cause;
    }
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export interface RuntimeOrderItem {
  index: number;
  name: string;
  className: string;
  id: string | null;
}

export interface RuntimeServiceOrderItem {
  index: number;
  serviceType: string;
  count: number;
  instances: RuntimeOrderItem[];
}

export interface RuntimeDebugSnapshot {
  runtimeAvailable: boolean;
  generatedAt: number;
  settings: {
    maxDepth: number;
    maxArrayLength: number;
    maxObjectEntries: number;
    maxStringLength: number;
  };
  meta: {
    agentId?: string;
    agentState: AgentState;
    agentName: string;
    model: string | null;
    pluginCount: number;
    actionCount: number;
    providerCount: number;
    evaluatorCount: number;
    serviceTypeCount: number;
    serviceCount: number;
  };
  order: {
    plugins: RuntimeOrderItem[];
    actions: RuntimeOrderItem[];
    providers: RuntimeOrderItem[];
    evaluators: RuntimeOrderItem[];
    services: RuntimeServiceOrderItem[];
  };
  sections: {
    runtime: unknown;
    plugins: unknown;
    actions: unknown;
    providers: unknown;
    evaluators: unknown;
    services: unknown;
  };
}

export interface TriggerSummary {
  id: string;
  taskId: string;
  displayName: string;
  instructions: string;
  triggerType: TriggerType;
  enabled: boolean;
  wakeMode: TriggerWakeMode;
  createdBy: string;
  timezone?: string;
  intervalMs?: number;
  scheduledAtIso?: string;
  cronExpression?: string;
  maxRuns?: number;
  runCount: number;
  nextRunAtMs?: number;
  lastRunAtIso?: string;
  lastStatus?: TriggerLastStatus;
  lastError?: string;
  updatedAt?: number;
  updateInterval?: number;
}

export interface TriggerRunRecord {
  triggerRunId: string;
  triggerId: string;
  taskId: string;
  startedAt: number;
  finishedAt: number;
  status: TriggerLastStatus;
  error?: string;
  latencyMs: number;
  source: "scheduler" | "manual";
}

export interface TriggerHealthSnapshot {
  triggersEnabled: boolean;
  activeTriggers: number;
  disabledTriggers: number;
  totalExecutions: number;
  totalFailures: number;
  totalSkipped: number;
  lastExecutionAt?: number;
}

export interface CreateTriggerRequest {
  displayName?: string;
  instructions?: string;
  triggerType?: TriggerType;
  wakeMode?: TriggerWakeMode;
  enabled?: boolean;
  createdBy?: string;
  timezone?: string;
  intervalMs?: number;
  scheduledAtIso?: string;
  cronExpression?: string;
  maxRuns?: number;
}

export interface UpdateTriggerRequest {
  displayName?: string;
  instructions?: string;
  triggerType?: TriggerType;
  wakeMode?: TriggerWakeMode;
  enabled?: boolean;
  timezone?: string;
  intervalMs?: number;
  scheduledAtIso?: string;
  cronExpression?: string;
  maxRuns?: number;
}

export interface SandboxPlatformStatus {
  platform: string;
  arch?: string;
  dockerInstalled?: boolean;
  dockerAvailable?: boolean;
  dockerRunning?: boolean;
  appleContainerAvailable?: boolean;
  wsl2?: boolean;
  recommended?: string;
}

export interface SandboxStartResponse {
  success: boolean;
  message: string;
  waitMs?: number;
  error?: string;
}

export interface SandboxBrowserEndpoints {
  cdpEndpoint?: string | null;
  wsEndpoint?: string | null;
  noVncEndpoint?: string | null;
}

export interface SandboxScreenshotRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SandboxScreenshotPayload {
  format: string;
  encoding: string;
  width: number | null;
  height: number | null;
  data: string;
}

export interface SandboxWindowInfo {
  id: string;
  title: string;
  app: string;
}

export interface SecretInfo {
  key: string;
  description: string;
  category: string;
  sensitive: boolean;
  required: boolean;
  isSet: boolean;
  maskedValue: string | null;
  usedBy: Array<{ pluginId: string; pluginName: string; enabled: boolean }>;
}

export interface PluginParamDef {
  key: string;
  type: string;
  description: string;
  required: boolean;
  sensitive: boolean;
  default?: string;
  /** Predefined options for dropdown selection (e.g. model names). */
  options?: string[];
  currentValue: string | null;
  isSet: boolean;
}

export interface PluginInfo {
  id: string;
  name: string;
  description: string;
  tags?: string[];
  enabled: boolean;
  configured: boolean;
  envKey: string | null;
  category:
    | "ai-provider"
    | "connector"
    | "streaming"
    | "database"
    | "app"
    | "feature";
  source: "bundled" | "store";
  parameters: PluginParamDef[];
  validationErrors: Array<{ field: string; message: string }>;
  validationWarnings: Array<{ field: string; message: string }>;
  npmName?: string;
  version?: string;
  pluginDeps?: string[];
  /** Whether this plugin is actually loaded and running in the runtime. */
  isActive?: boolean;
  /** Error message when plugin is installed but failed to load. */
  loadError?: string;
  /** Server-provided UI hints for plugin configuration fields. */
  configUiHints?: Record<string, ConfigUiHint>;
  /** Optional icon URL or emoji for the plugin card header. */
  icon?: string | null;
  homepage?: string;
  repository?: string;
  setupGuideUrl?: string;
}

export interface CorePluginEntry {
  npmName: string;
  id: string;
  name: string;
  isCore: boolean;
  loaded: boolean;
  enabled: boolean;
}

export interface CorePluginsResponse {
  core: CorePluginEntry[];
  optional: CorePluginEntry[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

// Conversations
export interface Conversation {
  id: string;
  title: string;
  roomId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationGreeting {
  text: string;
  agentName: string;
  generated: boolean;
  persisted?: boolean;
}

export interface CreateConversationOptions {
  includeGreeting?: boolean;
  bootstrapGreeting?: boolean;
  lang?: string;
}

// ── A2UI Content Blocks (Agent-to-UI) ────────────────────────────────

/** A plain text content block. */
export interface TextBlock {
  type: "text";
  text: string;
}

/** An inline config form block — renders ConfigRenderer in chat. */
export interface ConfigFormBlock {
  type: "config-form";
  pluginId: string;
  pluginName?: string;
  schema: Record<string, unknown>;
  hints?: Record<string, unknown>;
  values?: Record<string, unknown>;
}

/** A UiSpec interactive UI block extracted from agent response. */
export interface UiSpecBlock {
  type: "ui-spec";
  spec: Record<string, unknown>;
  raw?: string;
}

/** Union of all content block types. */
export type ContentBlock = TextBlock | ConfigFormBlock | UiSpecBlock;

/** An image attachment to send with a chat message. */
export interface ImageAttachment {
  /** Base64-encoded image data (no data URL prefix). */
  data: string;
  mimeType: string;
  name: string;
}

export interface ConfigSchemaResponse {
  schema: unknown;
  uiHints: Record<string, unknown>;
  version: string;
  generatedAt: string;
}

export interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: number;
  /** Structured content blocks (A2UI). When present, `text` is the fallback. */
  blocks?: ContentBlock[];
  /** Source channel when forwarded from another channel (e.g. "autonomy"). */
  source?: string;
  /** Username of the sender (e.g. viewer username, discord username). */
  from?: string;
  /** True when the SSE stream was interrupted before receiving a "done" event. */
  interrupted?: boolean;
}

export type ConversationChannelType =
  | "DM"
  | "GROUP"
  | "VOICE_DM"
  | "VOICE_GROUP"
  | "API";

export interface ChatTokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  llmCalls?: number;
  model?: string;
}

export type ConversationMode = "simple" | "power";

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  scanStatus?: "clean" | "warning" | "critical" | "blocked" | null;
}

export interface SkillScanReportSummary {
  scannedAt: string;
  status: "clean" | "warning" | "critical" | "blocked";
  summary: {
    scannedFiles: number;
    critical: number;
    warn: number;
    info: number;
  };
  findings: Array<{
    ruleId: string;
    severity: string;
    file: string;
    line: number;
    message: string;
    evidence: string;
  }>;
  manifestFindings: Array<{
    ruleId: string;
    severity: string;
    file: string;
    message: string;
  }>;
  skillPath: string;
}

// Skill Catalog types

export interface CatalogSkillStats {
  comments: number;
  downloads: number;
  installsAllTime: number;
  installsCurrent: number;
  stars: number;
  versions: number;
}

export interface CatalogSkillVersion {
  version: string;
  createdAt: number;
  changelog: string;
}

export interface CatalogSkill {
  slug: string;
  displayName: string;
  summary: string | null;
  tags: Record<string, string>;
  stats: CatalogSkillStats;
  createdAt: number;
  updatedAt: number;
  latestVersion: CatalogSkillVersion | null;
  installed?: boolean;
}

export interface CatalogSearchResult {
  slug: string;
  displayName: string;
  summary: string | null;
  score: number;
  latestVersion: string | null;
  downloads: number;
  stars: number;
  installs: number;
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
  source: string;
  tags: string[];
}

export interface LogsResponse {
  entries: LogEntry[];
  sources: string[];
  tags: string[];
}

export interface LogsFilter {
  source?: string;
  level?: string;
  tag?: string;
  since?: number;
}

export type SecurityAuditSeverity = "info" | "warn" | "error" | "critical";
export type SecurityAuditEventType =
  | "sandbox_mode_transition"
  | "secret_token_replacement_outbound"
  | "secret_sanitization_inbound"
  | "privileged_capability_invocation"
  | "policy_decision"
  | "signing_request_submitted"
  | "signing_request_rejected"
  | "signing_request_approved"
  | "plugin_fallback_attempt"
  | "security_kill_switch"
  | "sandbox_lifecycle"
  | "fetch_proxy_error";

export interface SecurityAuditEntry {
  timestamp: string;
  type: SecurityAuditEventType;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
  severity: SecurityAuditSeverity;
  traceId?: string;
}

export interface SecurityAuditFilter {
  type?: SecurityAuditEventType;
  severity?: SecurityAuditSeverity;
  since?: number | string | Date;
  limit?: number;
}

export interface SecurityAuditResponse {
  entries: SecurityAuditEntry[];
  totalBuffered: number;
  replayed: true;
}

export type SecurityAuditStreamEvent =
  | {
      type: "snapshot";
      entries: SecurityAuditEntry[];
      totalBuffered: number;
    }
  | {
      type: "entry";
      entry: SecurityAuditEntry;
    };

export interface StreamEventEnvelope {
  type: StreamEventType;
  version: 1;
  eventId: string;
  ts: number;
  runId?: string;
  seq?: number;
  stream?: string;
  sessionKey?: string;
  agentId?: string;
  roomId?: string;
  payload: object;
}

// Fine-tuning / training
export type TrainingJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface TrainingStatus {
  runningJobs: number;
  queuedJobs: number;
  completedJobs: number;
  failedJobs: number;
  modelCount: number;
  datasetCount: number;
  runtimeAvailable: boolean;
}

export interface TrainingTrajectorySummary {
  id: string;
  trajectoryId: string;
  agentId: string;
  archetype: string | null;
  createdAt: string;
  totalReward: number | null;
  aiJudgeReward: number | null;
  episodeLength: number | null;
  hasLlmCalls: boolean;
  llmCallCount: number;
}

export interface TrainingTrajectoryDetail extends TrainingTrajectorySummary {
  stepsJson: string;
  aiJudgeReasoning: string | null;
}

export interface TrainingTrajectoryList {
  available: boolean;
  reason?: string;
  total: number;
  trajectories: TrainingTrajectorySummary[];
}

export interface TrainingDatasetRecord {
  id: string;
  createdAt: string;
  jsonlPath: string;
  trajectoryDir: string;
  metadataPath: string;
  sampleCount: number;
  trajectoryCount: number;
}

export interface StartTrainingOptions {
  datasetId?: string;
  maxTrajectories?: number;
  backend?: "mlx" | "cuda" | "cpu";
  model?: string;
  iterations?: number;
  batchSize?: number;
  learningRate?: number;
}

export interface TrainingJobRecord {
  id: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  status: TrainingJobStatus;
  phase: string;
  progress: number;
  error: string | null;
  exitCode: number | null;
  signal: string | null;
  options: StartTrainingOptions;
  datasetId: string;
  pythonRoot: string;
  scriptPath: string;
  outputDir: string;
  logPath: string;
  modelPath: string | null;
  adapterPath: string | null;
  modelId: string | null;
  logs: string[];
}

export interface TrainingModelRecord {
  id: string;
  createdAt: string;
  jobId: string;
  outputDir: string;
  modelPath: string;
  adapterPath: string | null;
  sourceModel: string | null;
  backend: "mlx" | "cuda" | "cpu";
  ollamaModel: string | null;
  active: boolean;
  benchmark: {
    status: "not_run" | "passed" | "failed";
    lastRunAt: string | null;
    output: string | null;
  };
}

export type TrainingEventKind =
  | "job_started"
  | "job_progress"
  | "job_log"
  | "job_completed"
  | "job_failed"
  | "job_cancelled"
  | "dataset_built"
  | "model_activated"
  | "model_imported";

export interface TrainingStreamEvent {
  kind: TrainingEventKind;
  ts: number;
  message: string;
  jobId?: string;
  modelId?: string;
  datasetId?: string;
  progress?: number;
  phase?: string;
}

export interface AgentEventsResponse {
  events: StreamEventEnvelope[];
  latestEventId: string | null;
  totalBuffered: number;
  replayed: boolean;
}

export interface ExtensionStatus {
  relayReachable: boolean;
  relayPort: number;
  extensionPath: string | null;
}

// Registry / Plugin Store types

export interface RegistryPlugin {
  name: string;
  gitRepo: string;
  gitUrl: string;
  description: string;
  homepage: string | null;
  topics: string[];
  stars: number;
  language: string;
  npm: {
    package: string;
    v0Version: string | null;
    v1Version: string | null;
    v2Version: string | null;
  };
  git: {
    v0Branch: string | null;
    v1Branch: string | null;
    v2Branch: string | null;
  };
  supports: { v0: boolean; v1: boolean; v2: boolean };
  installed: boolean;
  installedVersion: string | null;
  loaded: boolean;
  bundled: boolean;
  compatibility?: {
    releaseAvailability: "bundled" | "post-release";
    installSurface: "runtime" | "app";
    postReleaseInstallable: boolean;
    requiresDesktopRuntime: boolean;
    requiresLocalRuntime: boolean;
    note?: string;
  };
}

export interface RegistrySearchResult {
  name: string;
  description: string;
  score: number;
  tags: string[];
  latestVersion: string | null;
  stars: number;
  supports: { v0: boolean; v1: boolean; v2: boolean };
  repository: string;
}

export interface InstalledPlugin {
  name: string;
  version: string;
  installPath: string;
  installedAt: string;
}

export interface PluginInstallResult {
  ok: boolean;
  plugin?: { name: string; version: string; installPath: string };
  requiresRestart?: boolean;
  message?: string;
  error?: string;
}

export interface WalletExportResult {
  evm: { privateKey: string; address: string | null } | null;
  solana: { privateKey: string; address: string | null } | null;
}

// Software Updates
export interface UpdateStatus {
  currentVersion: string;
  channel: ReleaseChannel;
  installMethod: string;
  updateAvailable: boolean;
  latestVersion: string | null;
  channels: Record<ReleaseChannel, string | null>;
  distTags: Record<ReleaseChannel, string>;
  lastCheckAt: string | null;
  error: string | null;
}

import type { ReleaseChannel } from "@miladyai/agent/contracts/config";

// Cloud
export interface CloudStatus {
  connected: boolean;
  enabled?: boolean;
  hasApiKey?: boolean;
  userId?: string;
  organizationId?: string;
  topUpUrl?: string;
  reason?: string;
}
export interface CloudCredits {
  connected: boolean;
  balance: number | null;
  /** True when the cloud API rejected the stored API key (same as chat 401). */
  authRejected?: boolean;
  error?: string;
  low?: boolean;
  critical?: boolean;
  topUpUrl?: string;
}
export interface CloudBillingPaymentMethod {
  id: string;
  type: string;
  label?: string;
  brand?: string;
  last4?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault?: boolean;
  walletAddress?: string;
  network?: string;
}
export interface CloudBillingHistoryItem {
  id: string;
  kind?: string;
  provider?: string;
  status: string;
  amount: number;
  currency: string;
  description?: string;
  receiptUrl?: string;
  createdAt: string;
}
export interface CloudBillingSummary {
  balance: number | null;
  currency?: string;
  low?: boolean;
  critical?: boolean;
  topUpUrl?: string;
  embeddedCheckoutEnabled?: boolean;
  hostedCheckoutEnabled?: boolean;
  cryptoEnabled?: boolean;
  paymentMethods?: CloudBillingPaymentMethod[];
  history?: CloudBillingHistoryItem[];
  [key: string]: unknown;
}
export interface CloudBillingSettings {
  success?: boolean;
  message?: string;
  error?: string;
  settings?: {
    autoTopUp?: {
      enabled?: boolean;
      amount?: number | null;
      threshold?: number | null;
      hasPaymentMethod?: boolean;
    };
    limits?: {
      minAmount?: number;
      maxAmount?: number;
      minThreshold?: number;
      maxThreshold?: number;
    };
  };
  [key: string]: unknown;
}
export interface CloudBillingSettingsUpdateRequest {
  autoTopUp?: {
    enabled?: boolean;
    amount?: number;
    threshold?: number;
  };
}
export interface CloudBillingCheckoutRequest {
  amountUsd: number;
  mode?: "embedded" | "hosted";
}
export interface CloudBillingCheckoutResponse {
  success?: boolean;
  provider?: string;
  mode?: "embedded" | "hosted";
  checkoutUrl?: string;
  url?: string;
  publishableKey?: string;
  clientSecret?: string;
  sessionId?: string;
  message?: string;
  [key: string]: unknown;
}
export interface CloudBillingCryptoQuoteRequest {
  amountUsd: number;
  currency?: string;
  network?: string;
  walletAddress?: string;
}
export interface CloudBillingCryptoQuoteResponse {
  success?: boolean;
  provider?: string;
  invoiceId?: string;
  network?: string;
  currency?: string;
  amount?: string;
  amountUsd?: number;
  payToAddress?: string;
  tokenAddress?: string;
  paymentLinkUrl?: string;
  expiresAt?: string;
  memo?: string;
  [key: string]: unknown;
}
export interface CloudLoginResponse {
  ok: boolean;
  sessionId: string;
  browserUrl: string;
  error?: string;
}
export interface CloudLoginPollResponse {
  status: "pending" | "authenticated" | "expired" | "error";
  keyPrefix?: string;
  error?: string;
}

// Cloud Compat (Eliza Cloud v2 thin-client types)
export interface CloudCompatAgent {
  agent_id: string;
  agent_name: string;
  node_id: string | null;
  container_id: string | null;
  headscale_ip: string | null;
  bridge_url: string | null;
  web_ui_url: string | null;
  status: string;
  agent_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  containerUrl: string;
  webUiUrl: string | null;
  database_status: string;
  error_message: string | null;
  last_heartbeat_at: string | null;
}
export interface CloudCompatAgentStatus {
  status: string;
  lastHeartbeat: string | null;
  bridgeUrl: string | null;
  webUiUrl: string | null;
  currentNode: string | null;
  suspendedReason: string | null;
  databaseStatus: string;
}
export interface CloudCompatJob {
  jobId: string;
  type: string;
  status: "queued" | "processing" | "completed" | "failed" | "retrying";
  data: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  id: string;
  name: string;
  state: string;
  created_on: string;
  completed_on: string | null;
}

export interface CloudCompatLaunchResult {
  agentId: string;
  agentName: string;
  appUrl: string;
  launchSessionId: string | null;
  issuedAt: string;
  connection: {
    apiBase: string;
    token: string;
  };
}

// Skills Marketplace
export interface SkillMarketplaceResult {
  id: string;
  slug?: string;
  name: string;
  description: string;
  githubUrl?: string;
  repository?: string;
  path?: string;
  tags?: string[];
  score?: number;
  source?: string;
}

// Share Ingest
export interface ShareIngestPayload {
  title?: string;
  url?: string;
  text?: string;
  files?: Array<{ name: string }>;
}

export interface ShareIngestItem {
  suggestedPrompt: string;
  files: Array<{ name: string }>;
}

// Workbench
export interface WorkbenchTask {
  id: string;
  name: string;
  description: string;
  tags: string[];
  isCompleted: boolean;
  updatedAt?: number;
}

export interface WorkbenchTodo {
  id: string;
  name: string;
  description: string;
  priority: number | null;
  isUrgent: boolean;
  isCompleted: boolean;
  type: string;
}

export interface WorkbenchOverview {
  tasks: WorkbenchTask[];
  triggers: TriggerSummary[];
  todos: WorkbenchTodo[];
  autonomy?: {
    enabled: boolean;
    thinking: boolean;
    lastEventAt?: number | null;
  };
}

// Coding Agent Sessions
export interface CodingAgentSession {
  sessionId: string;
  agentType: string;
  label: string;
  originalTask: string;
  workdir: string;
  status:
    | "active"
    | "blocked"
    | "completed"
    | "stopped"
    | "error"
    | "tool_running";
  decisionCount: number;
  autoResolvedCount: number;
  /** Description of the active tool when status is "tool_running". */
  toolDescription?: string;
  /** Latest activity text for the agent activity box. */
  lastActivity?: string;
}

export interface CodingAgentScratchWorkspace {
  sessionId: string;
  label: string;
  path: string;
  status: "pending_decision" | "kept" | "promoted";
  createdAt: number;
  terminalAt: number;
  terminalEvent: "stopped" | "task_complete" | "error";
  expiresAt?: number;
}

export interface AgentPreflightResult {
  adapter?: string;
  installed?: boolean;
  installCommand?: string;
  docsUrl?: string;
}

export interface CodingAgentStatus {
  supervisionLevel: string;
  taskCount: number;
  tasks: CodingAgentSession[];
  pendingConfirmations: number;
}

/** Raw PTY session shape returned by /api/coding-agents. */
export interface RawPtySession {
  id: string;
  name?: string;
  agentType?: string;
  workdir?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Maps raw PTY sessions from /api/coding-agents into CodingAgentSession[].
 * Extracted as a pure function so it can be unit-tested without instantiating
 * the full MiladyClient.
 */
export function mapPtySessionsToCodingAgentSessions(
  ptySessions: RawPtySession[],
): CodingAgentSession[] {
  return ptySessions.map((s) => ({
    sessionId: s.id,
    agentType: s.agentType ?? "claude",
    label: (s.metadata?.label as string) ?? s.name ?? s.agentType ?? "Agent",
    originalTask: "",
    workdir: s.workdir ?? "",
    status:
      s.status === "ready" || s.status === "busy"
        ? ("active" as const)
        : s.status === "error"
          ? ("error" as const)
          : s.status === "stopped" ||
              s.status === "done" ||
              s.status === "completed" ||
              s.status === "exited"
            ? ("stopped" as const)
            : ("active" as const),
    decisionCount: 0,
    autoResolvedCount: 0,
  }));
}

// MCP
export interface McpServerConfig {
  type: "stdio" | "streamable-http" | "sse";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

export interface McpMarketplaceResult {
  name: string;
  description?: string;
  connectionType: string;
  npmPackage?: string;
  dockerImage?: string;
}

export interface McpRegistryServerDetail {
  packages?: Array<{
    environmentVariables: Array<{
      name: string;
      default?: string;
      isRequired?: boolean;
    }>;
    packageArguments?: Array<{ default?: string }>;
  }>;
  remotes?: Array<{
    type?: string;
    url: string;
    headers: Array<{ name: string; isRequired?: boolean }>;
  }>;
}

export interface McpServerStatus {
  name: string;
  connected: boolean;
  error?: string;
}

// Voice / TTS config
export type VoiceProvider = "elevenlabs" | "simple-voice" | "edge";
export type VoiceMode = "cloud" | "own-key";

export interface VoiceConfig {
  provider?: VoiceProvider;
  mode?: VoiceMode;
  elevenlabs?: {
    apiKey?: string;
    voiceId?: string;
    modelId?: string;
    stability?: number;
    similarityBoost?: number;
    speed?: number;
  };
  edge?: {
    voice?: string;
    lang?: string;
    rate?: string;
    pitch?: string;
    volume?: string;
  };
}

// Character
export interface CharacterData {
  name?: string;
  username?: string;
  bio?: string | string[];
  system?: string;
  adjectives?: string[];
  topics?: string[];
  style?: {
    all?: string[];
    chat?: string[];
    post?: string[];
  };
  messageExamples?: Array<{
    examples: Array<{ name: string; content: MessageExampleContent }>;
  }>;
  postExamples?: string[];
}

// Registry plugin (non-app entries from the registry)
export interface RegistryPluginItem {
  name: string;
  description: string;
  stars: number;
  repository: string;
  topics: string[];
  latestVersion: string | null;
  supports: { v0: boolean; v1: boolean; v2: boolean };
  npm: {
    package: string;
    v0Version: string | null;
    v1Version: string | null;
    v2Version: string | null;
  };
}

// App types
export interface AppViewerAuthMessage {
  type: string;
  authToken?: string;
  sessionToken?: string;
  agentId?: string;
}

export interface AppViewerConfig {
  url: string;
  embedParams?: Record<string, string>;
  postMessageAuth?: boolean;
  sandbox?: string;
  authMessage?: AppViewerAuthMessage;
}

export interface AppUiExtensionConfig {
  detailPanelId: string;
}

export interface RegistryAppInfo {
  name: string;
  displayName: string;
  description: string;
  category: string;
  launchType: string;
  launchUrl: string | null;
  icon: string | null;
  capabilities: string[];
  stars: number;
  repository: string;
  latestVersion: string | null;
  supports: { v0: boolean; v1: boolean; v2: boolean };
  npm: {
    package: string;
    v0Version: string | null;
    v1Version: string | null;
    v2Version: string | null;
  };
  uiExtension?: AppUiExtensionConfig;
  viewer?: AppViewerConfig;
}
export interface InstalledAppInfo {
  name: string;
  displayName: string;
  version: string;
  installPath: string;
  installedAt: string;
  isRunning: boolean;
}
export interface AppLaunchResult {
  pluginInstalled: boolean;
  needsRestart: boolean;
  displayName: string;
  launchType: string;
  launchUrl: string | null;
  viewer: AppViewerConfig | null;
}
export interface AppStopResult {
  success: boolean;
  appName: string;
  stoppedAt: string;
  pluginUninstalled: boolean;
  needsRestart: boolean;
  stopScope: "plugin-uninstalled" | "viewer-session" | "no-op";
  message: string;
}

export type HyperscapeScriptedRole =
  | "combat"
  | "woodcutting"
  | "fishing"
  | "mining"
  | "balanced";

export type HyperscapeEmbeddedAgentControlAction =
  | "start"
  | "stop"
  | "pause"
  | "resume";

export type HyperscapeJsonValue =
  | string
  | number
  | boolean
  | null
  | HyperscapeJsonValue[]
  | { [key: string]: HyperscapeJsonValue };

export type HyperscapePosition =
  | [number, number, number]
  | {
      x: number;
      y: number;
      z: number;
    };

export interface HyperscapeEmbeddedAgent {
  agentId: string;
  characterId: string;
  accountId: string;
  name: string;
  scriptedRole: HyperscapeScriptedRole | null;
  state: string;
  entityId: string | null;
  position: HyperscapePosition | null;
  health: number | null;
  maxHealth: number | null;
  startedAt: number | null;
  lastActivity: number | null;
  error: string | null;
}

export interface HyperscapeEmbeddedAgentsResponse {
  success: boolean;
  agents: HyperscapeEmbeddedAgent[];
  count: number;
  error?: string;
}

export interface HyperscapeActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface HyperscapeEmbeddedAgentMutationResponse
  extends HyperscapeActionResponse {
  agent?: HyperscapeEmbeddedAgent | null;
}

export interface HyperscapeAvailableGoal {
  id: string;
  type: string;
  description: string;
  priority: number;
}

export interface HyperscapeGoalState {
  type?: string;
  description?: string;
  progress?: number;
  target?: number;
  progressPercent?: number;
  elapsedMs?: number;
  startedAt?: number;
  locked?: boolean;
  lockedBy?: string;
}

export interface HyperscapeAgentGoalResponse {
  success: boolean;
  goal: HyperscapeGoalState | null;
  availableGoals?: HyperscapeAvailableGoal[];
  goalsPaused?: boolean;
  message?: string;
  error?: string;
}

export interface HyperscapeQuickCommand {
  id: string;
  label: string;
  command: string;
  icon: string;
  available: boolean;
  reason?: string;
}

export interface HyperscapeNearbyLocation {
  id: string;
  name: string;
  type: string;
  distance: number;
}

export interface HyperscapeInventoryItem {
  id: string;
  name: string;
  slot: number;
  quantity: number;
  canEquip: boolean;
  canUse: boolean;
  canDrop: boolean;
}

export interface HyperscapeQuickActionsResponse {
  success: boolean;
  nearbyLocations: HyperscapeNearbyLocation[];
  availableGoals: HyperscapeAvailableGoal[];
  quickCommands: HyperscapeQuickCommand[];
  inventory: HyperscapeInventoryItem[];
  playerPosition: [number, number, number] | null;
  message?: string;
  error?: string;
}

// Trajectories
export interface TrajectoryRecord {
  id: string;
  agentId: string;
  roomId: string | null;
  entityId: string | null;
  conversationId: string | null;
  source: string;
  status: "active" | "completed" | "error";
  startTime: number;
  endTime: number | null;
  durationMs: number | null;
  llmCallCount: number;
  providerAccessCount: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TrajectoryLlmCall {
  id: string;
  trajectoryId: string;
  stepId: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  response: string;
  temperature: number;
  maxTokens: number;
  purpose: string;
  actionType: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  timestamp: number;
  createdAt: string;
}

export interface TrajectoryProviderAccess {
  id: string;
  trajectoryId: string;
  stepId: string;
  providerName: string;
  purpose: string;
  data: Record<string, unknown>;
  query?: Record<string, unknown>;
  timestamp: number;
  createdAt: string;
}

export interface TrajectoryListOptions {
  limit?: number;
  offset?: number;
  source?: string;
  status?: "active" | "completed" | "error";
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface TrajectoryListResult {
  trajectories: TrajectoryRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface TrajectoryDetailResult {
  trajectory: TrajectoryRecord;
  llmCalls: TrajectoryLlmCall[];
  providerAccesses: TrajectoryProviderAccess[];
}

export interface TrajectoryStats {
  totalTrajectories: number;
  totalLlmCalls: number;
  totalProviderAccesses: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  averageDurationMs: number;
  bySource: Record<string, number>;
  byModel: Record<string, number>;
}

export interface TrajectoryConfig {
  enabled: boolean;
}

export interface TrajectoryExportOptions {
  format: TrajectoryExportFormat;
  includePrompts?: boolean;
  trajectoryIds?: string[];
  startDate?: string;
  endDate?: string;
}

// Knowledge types
export interface KnowledgeStats {
  documentCount: number;
  fragmentCount: number;
  agentId: string;
}

export interface KnowledgeDocument {
  id: string;
  filename: string;
  contentType: string;
  fileSize: number;
  createdAt: number;
  fragmentCount: number;
  source: string;
  url?: string;
  content?: { text?: string };
}

export interface KnowledgeDocumentDetail extends KnowledgeDocument {
  content: { text?: string };
}

export interface KnowledgeDocumentsResponse {
  documents: KnowledgeDocument[];
  total: number;
  limit: number;
  offset: number;
}

export interface KnowledgeFragment {
  id: string;
  text: string;
  position?: number;
  createdAt: number;
}

export interface KnowledgeFragmentsResponse {
  documentId: string;
  fragments: KnowledgeFragment[];
  count: number;
}

export interface KnowledgeSearchResult {
  id: string;
  text: string;
  similarity: number;
  documentId?: string;
  documentTitle?: string;
  position?: number;
}

export interface KnowledgeSearchResponse {
  query: string;
  threshold: number;
  results: KnowledgeSearchResult[];
  count: number;
}

export interface KnowledgeUploadResult {
  ok: boolean;
  documentId: string;
  fragmentCount: number;
  filename?: string;
  contentType?: string;
  isYouTubeTranscript?: boolean;
  warnings?: string[];
}

export interface KnowledgeBulkUploadItemResult {
  index: number;
  ok: boolean;
  filename: string;
  documentId?: string;
  fragmentCount?: number;
  error?: string;
  warnings?: string[];
}

export interface KnowledgeBulkUploadResult {
  ok: boolean;
  total: number;
  successCount: number;
  failureCount: number;
  results: KnowledgeBulkUploadItemResult[];
}

// Memory / context command types
export interface MemorySearchResult {
  id: string;
  text: string;
  createdAt: number;
  score: number;
}

export interface MemorySearchResponse {
  query: string;
  results: MemorySearchResult[];
  count: number;
  limit: number;
}

export interface MemoryRememberResponse {
  ok: boolean;
  id: string;
  text: string;
  createdAt: number;
}

export interface QuickContextResponse {
  query: string;
  answer: string;
  memories: MemorySearchResult[];
  knowledge: KnowledgeSearchResult[];
}

// WebSocket

export type WsEventHandler = (data: Record<string, unknown>) => void;

// ---------------------------------------------------------------------------
// ERC-8004 Registry & Drop types
// ---------------------------------------------------------------------------

export interface RegistryStatus {
  registered: boolean;
  tokenId: number;
  agentName: string;
  agentEndpoint: string;
  capabilitiesHash: string;
  isActive: boolean;
  tokenURI: string;
  walletAddress: string;
  totalAgents: number;
  configured: boolean;
}

export interface RegistrationResult {
  tokenId: number;
  txHash: string;
}

export interface RegistryConfig {
  configured: boolean;
  chainId: number;
  registryAddress: string | null;
  collectionAddress: string | null;
  explorerUrl: string;
}

export interface WhitelistStatus {
  eligible: boolean;
  twitterVerified: boolean;
  ogCode: string | null;
  walletAddress: string;
}

export interface VerificationMessageResponse {
  message: string;
  walletAddress: string;
}
