/**
 * Brand-env aliasing — reads the alias table from the boot config.
 *
 * The host app passes its brand-specific alias table via AppBootConfig.envAliases.
 * These functions apply it bidirectionally.
 *
 * @deprecated Import syncBrandEnvToEliza/syncElizaEnvToBrand from boot-config
 * and pass the alias table explicitly. These wrappers exist for backward compat.
 */
import {
  getBootConfig,
  syncBrandEnvToEliza,
  syncElizaEnvToBrand,
} from "./boot-config";

/** @deprecated Use getBootConfig().envAliases instead. */
export function getBrandEnvAliases(): readonly (readonly [string, string])[] {
  return getBootConfig().envAliases ?? [];
}

/** Sync brand env vars → Eliza equivalents using the boot config alias table. */
export function syncMiladyEnvToEliza(): void {
  const aliases = getBootConfig().envAliases;
  if (aliases) {
    syncBrandEnvToEliza(aliases);
  }
}

/** Sync Eliza env vars → brand equivalents using the boot config alias table. */
export function syncElizaEnvToMilady(): void {
  const aliases = getBootConfig().envAliases;
  if (aliases) {
    syncElizaEnvToBrand(aliases);
  }
}
