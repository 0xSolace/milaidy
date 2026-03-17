// Re-export the full upstream server API.
export * from "@elizaos/autonomous/api/server";

// Override the wallet export rejection function with the hardened version
// that adds rate limiting, audit logging, and a forced confirmation delay.
import { resolveWalletExportRejection as upstreamResolveWalletExportRejection } from "@elizaos/autonomous/api/server";
import { createHardenedExportGuard } from "./wallet-export-guard";

const _hardenedGuard = createHardenedExportGuard(
  upstreamResolveWalletExportRejection,
);

/**
 * Hardened wallet export rejection function.
 *
 * Wraps the upstream token validation with per-IP rate limiting (1 per 10 min),
 * audit logging (IP + UA), and a 10s confirmation delay via single-use nonces.
 */
export function resolveWalletExportRejection(
  ...args: Parameters<typeof upstreamResolveWalletExportRejection>
): ReturnType<typeof upstreamResolveWalletExportRejection> {
  return _hardenedGuard(...args);
}
