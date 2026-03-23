/**
 * HTML injection — inject API base URL into served HTML pages.
 *
 * Extracted from `server.ts` for maintainability.  Re-exported from
 * `server.ts` so existing imports remain valid.
 */
import { injectApiBaseIntoHtml as upstreamInjectApiBaseIntoHtml } from "@elizaos/agent/api/server";

export function injectApiBaseIntoHtml(
  ...args: Parameters<typeof upstreamInjectApiBaseIntoHtml>
): ReturnType<typeof upstreamInjectApiBaseIntoHtml> {
  return upstreamInjectApiBaseIntoHtml(...args);
}
