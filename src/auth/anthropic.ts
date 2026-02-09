/**
 * Anthropic OAuth flow (Claude Pro/Max subscription)
 *
 * Uses PKCE authorization code flow via claude.ai OAuth.
 * Gives access to Claude models through your subscription
 * without needing a separate API key.
 */

import { generatePKCE } from "./pkce.js";
import type { OAuthCredentials } from "./types.js";

const CLIENT_ID = atob("OWQxYzI1MGEtZTYxYi00NGQ5LTg4ZWQtNTk0NGQxOTYyZjVl");
const AUTHORIZE_URL = "https://claude.ai/oauth/authorize";
const TOKEN_URL = "https://console.anthropic.com/v1/oauth/token";
const REDIRECT_URI = "https://console.anthropic.com/oauth/code/callback";
const SCOPES = "org:create_api_key user:profile user:inference";

/**
 * Start the Anthropic OAuth flow.
 * Returns an auth URL for the user to visit and a function to exchange the code.
 */
export async function startAnthropicLogin(): Promise<{
  authUrl: string;
  verifier: string;
}> {
  const { verifier, challenge } = await generatePKCE();

  const authParams = new URLSearchParams({
    code: "true",
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
  });

  return {
    authUrl: `${AUTHORIZE_URL}?${authParams.toString()}`,
    verifier,
  };
}

/**
 * Exchange an authorization code for tokens.
 * The code comes from the redirect URL in format: code#state
 */
export async function exchangeAnthropicCode(
  authCode: string,
  verifier: string,
): Promise<OAuthCredentials> {
  const splits = authCode.split("#");
  const code = splits[0];
  const state = splits[1];

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      state,
      redirect_uri: REDIRECT_URI,
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic token exchange failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    refresh: data.refresh_token,
    access: data.access_token,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000,
  };
}

/**
 * Refresh an expired Anthropic token.
 */
export async function refreshAnthropicToken(
  refreshToken: string,
): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      client_id: CLIENT_ID,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic token refresh failed: ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    refresh: data.refresh_token,
    access: data.access_token,
    expires: Date.now() + data.expires_in * 1000 - 5 * 60 * 1000,
  };
}
