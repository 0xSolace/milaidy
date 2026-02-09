/**
 * Subscription-based authentication for Milaidy.
 *
 * Supports:
 * - Anthropic Claude Pro/Max subscription (OAuth via claude.ai)
 * - OpenAI Codex / ChatGPT Plus/Max subscription (OAuth via auth.openai.com)
 *
 * These allow using your existing $20-200/mo subscriptions instead of
 * separate API keys. Token refresh is handled automatically.
 */

export { startAnthropicLogin, exchangeAnthropicCode, refreshAnthropicToken } from "./anthropic.js";
export { startCodexLogin, loginCodexWithCallback, exchangeCodexCode, refreshCodexToken } from "./openai-codex.js";
export {
  saveCredentials,
  loadCredentials,
  deleteCredentials,
  hasValidCredentials,
  getAccessToken,
  getSubscriptionStatus,
  applySubscriptionCredentials,
} from "./credentials.js";
export type { OAuthCredentials, SubscriptionProvider, StoredCredentials } from "./types.js";
