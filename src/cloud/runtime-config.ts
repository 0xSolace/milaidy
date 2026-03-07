import type { MiladyConfig } from "../config/config";

export type EffectiveCloudRuntimeConfig = {
  configured: boolean;
  explicitlyDisabled: boolean;
  enabled: boolean;
  hasApiKey: boolean;
  apiKey?: string;
  baseUrl?: string;
  provider?: string;
  smallModel?: string;
  largeModel?: string;
};

const DEFAULT_SMALL_CLOUD_MODEL = "openai/gpt-5-mini";
const DEFAULT_LARGE_CLOUD_MODEL = "anthropic/claude-sonnet-4.5";

function readTrimmed(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const normalized = readTrimmed(value)?.toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return undefined;
}

export function resolveEffectiveCloudRuntimeConfig(
  config: MiladyConfig,
  env: NodeJS.ProcessEnv = process.env,
): EffectiveCloudRuntimeConfig {
  const cloud = config.cloud;
  const configEnabled =
    typeof cloud?.enabled === "boolean" ? cloud.enabled : undefined;
  const envEnabled = parseOptionalBoolean(env.ELIZAOS_CLOUD_ENABLED);
  const apiKey =
    readTrimmed(cloud?.apiKey) ?? readTrimmed(env.ELIZAOS_CLOUD_API_KEY);
  const baseUrl =
    readTrimmed(cloud?.baseUrl) ?? readTrimmed(env.ELIZAOS_CLOUD_BASE_URL);
  const provider = readTrimmed(cloud?.provider);
  const explicitlyDisabled = configEnabled === false || envEnabled === false;
  const enabled =
    !explicitlyDisabled &&
    (configEnabled === true || envEnabled === true || Boolean(apiKey));

  const smallModel = enabled
    ? (readTrimmed(config.models?.small) ??
      readTrimmed(env.ELIZAOS_CLOUD_SMALL_MODEL) ??
      readTrimmed(env.SMALL_MODEL) ??
      DEFAULT_SMALL_CLOUD_MODEL)
    : undefined;
  const largeModel = enabled
    ? (readTrimmed(config.models?.large) ??
      readTrimmed(env.ELIZAOS_CLOUD_LARGE_MODEL) ??
      readTrimmed(env.LARGE_MODEL) ??
      DEFAULT_LARGE_CLOUD_MODEL)
    : undefined;

  return {
    configured: Boolean(
      configEnabled !== undefined ||
        envEnabled !== undefined ||
        apiKey ||
        baseUrl ||
        provider ||
        readTrimmed(config.models?.small) ||
        readTrimmed(config.models?.large) ||
        readTrimmed(env.ELIZAOS_CLOUD_SMALL_MODEL) ||
        readTrimmed(env.ELIZAOS_CLOUD_LARGE_MODEL),
    ),
    explicitlyDisabled,
    enabled,
    hasApiKey: Boolean(apiKey),
    apiKey,
    baseUrl,
    provider,
    smallModel,
    largeModel,
  };
}
