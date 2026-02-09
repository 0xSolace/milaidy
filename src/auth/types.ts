/**
 * OAuth credential types for subscription-based providers.
 */

export type OAuthCredentials = {
  refresh: string;
  access: string;
  expires: number;
  accountId?: string;
  [key: string]: unknown;
};

export type SubscriptionProvider = "anthropic-subscription" | "openai-codex";

export type StoredCredentials = {
  provider: SubscriptionProvider;
  credentials: OAuthCredentials;
  createdAt: number;
  updatedAt: number;
};
