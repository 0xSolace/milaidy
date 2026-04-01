import type http from "node:http";
import { logger, stringToUuid, type UUID } from "@elizaos/core";
import type { ElizaConfig } from "../config/config.js";
import { configFileExists, loadElizaConfig } from "../config/config.js";
import {
  normalizePersistedOnboardingConnection,
  normalizeOnboardingProviderId,
} from "../contracts/onboarding.js";
import {
  applyOnboardingConnectionConfig,
  reconcilePersistedOnboardingConnection,
} from "./provider-switch-config.js";
import { resolveDefaultAgentWorkspaceDir } from "../providers/workspace.js";
import type { ReadJsonBodyOptions } from "./http-helpers.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingRouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  method: string;
  pathname: string;
  url: URL;
  state: OnboardingServerState;
  json: (res: http.ServerResponse, data: unknown, status?: number) => void;
  error: (res: http.ServerResponse, message: string, status?: number) => void;
  readJsonBody: <T extends object>(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    options?: ReadJsonBodyOptions,
  ) => Promise<T | null>;
  // Server.ts helpers
  isCloudProvisionedContainer: () => boolean;
  hasPersistedOnboardingState: (config: ElizaConfig) => boolean;
  ensureWalletKeysInEnvAndConfig: (config: ElizaConfig) => boolean;
  getWalletAddresses: () => {
    evmAddress?: string;
    solanaAddress?: string;
  };
  pickRandomNames: (count: number) => string[];
  getStylePresets: (lang: string) => unknown[];
  getProviderOptions: () => unknown[];
  getCloudProviderOptions: () => unknown[];
  getModelOptions: () => unknown;
  getInventoryProviderOptions: () => unknown[];
  resolveConfiguredCharacterLanguage: (
    config: ElizaConfig,
    req: http.IncomingMessage,
  ) => string;
  normalizeCharacterLanguage: (lang: string | undefined) => string;
  readUiLanguageHeader: (req: http.IncomingMessage) => string | null;
  applyOnboardingVoicePreset: (
    config: ElizaConfig,
    body: Record<string, unknown>,
    language: string,
  ) => void;
  saveElizaConfig: (config: ElizaConfig) => void;
  loadPiAiPluginModule: () => Promise<{
    listPiAiModelOptions: () => Promise<{
      models: Array<{
        id: string;
        name: string;
        provider: string;
        isDefault: boolean;
      }>;
      defaultModelSpec?: string;
    }>;
  }>;
}

export interface OnboardingServerState {
  config: ElizaConfig;
  runtime: { agentId: string; character: { name: string }; updateAgent: (...args: unknown[]) => Promise<unknown> } | null;
  agentName: string;
  adminEntityId: UUID | null;
  chatUserId: UUID | null;
  chatConnectionReady: unknown;
  chatConnectionPromise: Promise<void> | null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function handleOnboardingRoutes(
  ctx: OnboardingRouteContext,
): Promise<boolean> {
  const { req, res, method, pathname, state, json, error, readJsonBody } = ctx;

  // ── GET /api/onboarding/status ──────────────────────────────────────
  if (method === "GET" && pathname === "/api/onboarding/status") {
    if (ctx.isCloudProvisionedContainer()) {
      json(res, { complete: true });
      return true;
    }

    let config = state.config;
    let complete =
      configFileExists() && ctx.hasPersistedOnboardingState(config);

    if (!complete && configFileExists()) {
      try {
        config = loadElizaConfig();
        complete = ctx.hasPersistedOnboardingState(config);
        if (complete) {
          state.config = config;
        }
      } catch (err) {
        logger.warn(
          `[eliza-api] Failed to refresh config for onboarding status: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    json(res, { complete });
    return true;
  }

  // ── GET /api/wallet/keys (onboarding only) ─────────────────────────
  if (method === "GET" && pathname === "/api/wallet/keys") {
    if (ctx.hasPersistedOnboardingState(state.config)) {
      json(
        res,
        { error: "Wallet keys are only available during onboarding" },
        403,
      );
      return true;
    }

    logger.warn(
      `[eliza-api] Wallet keys requested during onboarding (ip=${req.socket?.remoteAddress ?? "unknown"})`,
    );

    ctx.ensureWalletKeysInEnvAndConfig(state.config);
    try {
      ctx.saveElizaConfig(state.config);
    } catch {
      // Non-fatal
    }

    const evmPrivateKey = process.env.EVM_PRIVATE_KEY ?? "";
    const solanaPrivateKey = process.env.SOLANA_PRIVATE_KEY ?? "";
    const addresses = ctx.getWalletAddresses();

    const maskKey = (key: string): string => {
      if (!key || key.length <= 4) return key ? "****" : "";
      return "****" + key.slice(-4);
    };

    json(res, {
      evmPrivateKey: maskKey(evmPrivateKey),
      evmAddress: addresses.evmAddress ?? "",
      solanaPrivateKey: maskKey(solanaPrivateKey),
      solanaAddress: addresses.solanaAddress ?? "",
    });
    return true;
  }

  // ── GET /api/onboarding/options ─────────────────────────────────────
  if (method === "GET" && pathname === "/api/onboarding/options") {
    let piAiModels: Array<{
      id: string;
      name: string;
      provider: string;
      isDefault: boolean;
    }> = [];
    let piAiDefaultModel: string | null = null;

    try {
      const piAi = await (await ctx.loadPiAiPluginModule()).listPiAiModelOptions();
      piAiModels = piAi.models;
      piAiDefaultModel = piAi.defaultModelSpec ?? null;
    } catch (err) {
      logger.warn(
        `[api] Failed to load pi-ai model options: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    json(res, {
      names: ctx.pickRandomNames(5),
      styles: ctx.getStylePresets(
        ctx.resolveConfiguredCharacterLanguage(state.config, req),
      ),
      providers: ctx.getProviderOptions(),
      cloudProviders: ctx.getCloudProviderOptions(),
      models: ctx.getModelOptions(),
      piAiModels,
      piAiDefaultModel,
      inventoryProviders: ctx.getInventoryProviderOptions(),
      sharedStyleRules: "Keep responses brief. Be helpful and concise.",
      githubOAuthAvailable: Boolean(process.env.GITHUB_OAUTH_CLIENT_ID?.trim()),
    });
    return true;
  }

  // ── POST /api/onboarding ────────────────────────────────────────────
  if (method === "POST" && pathname === "/api/onboarding") {
    // This route is very large; we delegate back to server.ts for now
    // since it touches extensive server state. Return false to fall through.
    return false;
  }

  return false;
}
