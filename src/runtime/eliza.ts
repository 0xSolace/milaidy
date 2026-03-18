import { type AgentRuntime, AutonomyService, logger } from "@elizaos/core";

export * from "@elizaos/autonomous/runtime/eliza";

import {
  applyCloudConfigToEnv as upstreamApplyCloudConfigToEnv,
  bootElizaRuntime as upstreamBootElizaRuntime,
  buildCharacterFromConfig as upstreamBuildCharacterFromConfig,
  collectPluginNames as upstreamCollectPluginNames,
  startEliza as upstreamStartEliza,
} from "@elizaos/autonomous/runtime/eliza";
import { ensureRuntimeSqlCompatibility } from "../utils/sql-compat";

const BRAND_ENV_ALIASES = [
  ["MILADY_USE_PI_AI", "ELIZA_USE_PI_AI"],
  ["MILADY_CLOUD_TTS_DISABLED", "ELIZA_CLOUD_TTS_DISABLED"],
  ["MILADY_CLOUD_MEDIA_DISABLED", "ELIZA_CLOUD_MEDIA_DISABLED"],
  ["MILADY_CLOUD_EMBEDDINGS_DISABLED", "ELIZA_CLOUD_EMBEDDINGS_DISABLED"],
  ["MILADY_CLOUD_RPC_DISABLED", "ELIZA_CLOUD_RPC_DISABLED"],
] as const;

const miladyMirroredEnvKeys = new Set<string>();
const elizaMirroredEnvKeys = new Set<string>();

function syncMiladyEnvToEliza(): void {
  for (const [miladyKey, elizaKey] of BRAND_ENV_ALIASES) {
    const value = process.env[miladyKey];
    if (typeof value === "string") {
      process.env[elizaKey] = value;
      elizaMirroredEnvKeys.add(elizaKey);
    } else if (elizaMirroredEnvKeys.has(elizaKey)) {
      delete process.env[elizaKey];
      elizaMirroredEnvKeys.delete(elizaKey);
    }
  }
}

function syncElizaEnvToMilady(): void {
  for (const [miladyKey, elizaKey] of BRAND_ENV_ALIASES) {
    const value = process.env[elizaKey];
    if (typeof value === "string") {
      process.env[miladyKey] = value;
      miladyMirroredEnvKeys.add(miladyKey);
    } else if (miladyMirroredEnvKeys.has(miladyKey)) {
      delete process.env[miladyKey];
      miladyMirroredEnvKeys.delete(miladyKey);
    }
  }
}

export function collectPluginNames(
  ...args: Parameters<typeof upstreamCollectPluginNames>
): ReturnType<typeof upstreamCollectPluginNames> {
  syncMiladyEnvToEliza();
  const result = upstreamCollectPluginNames(...args);
  syncElizaEnvToMilady();
  return result;
}

export function applyCloudConfigToEnv(
  ...args: Parameters<typeof upstreamApplyCloudConfigToEnv>
): ReturnType<typeof upstreamApplyCloudConfigToEnv> {
  syncMiladyEnvToEliza();
  const result = upstreamApplyCloudConfigToEnv(...args);
  syncElizaEnvToMilady();
  return result;
}

export function buildCharacterFromConfig(
  ...args: Parameters<typeof upstreamBuildCharacterFromConfig>
): ReturnType<typeof upstreamBuildCharacterFromConfig> {
  syncMiladyEnvToEliza();
  const result = upstreamBuildCharacterFromConfig(...args);
  syncElizaEnvToMilady();
  return result;
}

async function repairRuntimeAfterBoot(
  runtime: AgentRuntime,
): Promise<AgentRuntime> {
  await ensureRuntimeSqlCompatibility(runtime);

  if (!runtime.getService("AUTONOMY")) {
    try {
      await AutonomyService.start(runtime);
      logger.info(
        "[milady] AutonomyService started after SQL compatibility repair",
      );
    } catch (error) {
      logger.warn(
        `[milady] AutonomyService restart after SQL compatibility repair failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return runtime;
}

export async function bootElizaRuntime(
  ...args: Parameters<typeof upstreamBootElizaRuntime>
): Promise<Awaited<ReturnType<typeof upstreamBootElizaRuntime>>> {
  syncMiladyEnvToEliza();

  try {
    const runtime = await upstreamBootElizaRuntime(...args);
    return runtime ? await repairRuntimeAfterBoot(runtime) : runtime;
  } finally {
    syncElizaEnvToMilady();
  }
}

export async function startEliza(
  ...args: Parameters<typeof upstreamStartEliza>
): Promise<Awaited<ReturnType<typeof upstreamStartEliza>>> {
  syncMiladyEnvToEliza();

  try {
    const runtime = await upstreamStartEliza(...args);
    return runtime ? await repairRuntimeAfterBoot(runtime) : runtime;
  } finally {
    syncElizaEnvToMilady();
  }
}
