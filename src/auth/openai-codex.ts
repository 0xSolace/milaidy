/**
 * OpenAI Codex (ChatGPT Plus/Max subscription) OAuth flow
 *
 * Uses PKCE authorization code flow via auth.openai.com.
 * Starts a local HTTP server on port 1455 to catch the callback,
 * with fallback to manual code paste for VPS/remote environments.
 */

import crypto from "node:crypto";
import http from "node:http";
import { generatePKCE } from "./pkce.js";
import type { OAuthCredentials } from "./types.js";

const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const TOKEN_URL = "https://auth.openai.com/oauth/token";
const REDIRECT_URI = "http://localhost:1455/auth/callback";
const SCOPE = "openid profile email offline_access";
const JWT_CLAIM_PATH = "https://api.openai.com/auth";

const SUCCESS_HTML = `<!doctype html>
<html><head><title>Auth OK</title></head>
<body><p>Authentication successful. Return to your terminal/browser to continue.</p></body>
</html>`;

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1]!));
  } catch {
    return null;
  }
}

function getAccountId(accessToken: string): string | null {
  const payload = decodeJwt(accessToken);
  const auth = payload?.[JWT_CLAIM_PATH] as Record<string, unknown> | undefined;
  const accountId = auth?.chatgpt_account_id;
  return typeof accountId === "string" && accountId.length > 0 ? accountId : null;
}

function parseAuthInput(input: string): { code?: string; state?: string } {
  const value = input.trim();
  if (!value) return {};

  // Try as URL
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
    };
  } catch { /* not a URL */ }

  // Try code#state format
  if (value.includes("#")) {
    const [code, state] = value.split("#", 2);
    return { code, state };
  }

  // Try query string format
  if (value.includes("code=")) {
    const params = new URLSearchParams(value);
    return {
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
    };
  }

  return { code: value };
}

async function exchangeCode(
  code: string,
  verifier: string,
): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: CLIENT_ID,
      code,
      code_verifier: verifier,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI token exchange failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!json.access_token || !json.refresh_token) {
    throw new Error("OpenAI token response missing required fields");
  }

  const accountId = getAccountId(json.access_token);
  if (!accountId) {
    throw new Error("Failed to extract accountId from OpenAI token");
  }

  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
    accountId,
  };
}

/**
 * Start local OAuth callback server on port 1455.
 * Returns a promise that resolves with the auth code when received.
 */
function startCallbackServer(
  expectedState: string,
): Promise<{
  waitForCode: () => Promise<string | null>;
  close: () => void;
}> {
  return new Promise((resolve) => {
    let receivedCode: string | null = null;

    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "", "http://localhost");
        if (url.pathname !== "/auth/callback") {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }
        if (url.searchParams.get("state") !== expectedState) {
          res.statusCode = 400;
          res.end("State mismatch");
          return;
        }
        const code = url.searchParams.get("code");
        if (!code) {
          res.statusCode = 400;
          res.end("Missing code");
          return;
        }
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(SUCCESS_HTML);
        receivedCode = code;
      } catch {
        res.statusCode = 500;
        res.end("Internal error");
      }
    });

    server
      .listen(1455, "127.0.0.1", () => {
        resolve({
          close: () => server.close(),
          waitForCode: async () => {
            // Poll for up to 60 seconds
            for (let i = 0; i < 600; i++) {
              if (receivedCode) return receivedCode;
              await new Promise((r) => setTimeout(r, 100));
            }
            return null;
          },
        });
      })
      .on("error", () => {
        // Port unavailable (e.g., VPS) — return a no-op server
        resolve({
          close: () => { try { server.close(); } catch { /* */ } },
          waitForCode: async () => null,
        });
      });
  });
}

/**
 * Start the OpenAI Codex OAuth flow.
 * Returns the auth URL and state for verification.
 */
export async function startCodexLogin(): Promise<{
  authUrl: string;
  state: string;
  verifier: string;
}> {
  const { verifier, challenge } = await generatePKCE();
  const state = crypto.randomBytes(16).toString("hex");

  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", CLIENT_ID);
  url.searchParams.set("redirect_uri", REDIRECT_URI);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", "milaidy");

  return { authUrl: url.toString(), state, verifier };
}

/**
 * Full login flow: start callback server, wait for code, exchange for tokens.
 * For VPS/remote: pass the code manually via exchangeCodexCode().
 */
export async function loginCodexWithCallback(): Promise<{
  authUrl: string;
  state: string;
  verifier: string;
  waitForCallback: () => Promise<OAuthCredentials | null>;
  close: () => void;
}> {
  const { authUrl, state, verifier } = await startCodexLogin();
  const server = await startCallbackServer(state);

  return {
    authUrl,
    state,
    verifier,
    waitForCallback: async () => {
      const code = await server.waitForCode();
      server.close();
      if (!code) return null;
      return exchangeCode(code, verifier);
    },
    close: () => server.close(),
  };
}

/**
 * Exchange a manually-pasted code/URL for tokens.
 */
export async function exchangeCodexCode(
  input: string,
  verifier: string,
  expectedState?: string,
): Promise<OAuthCredentials> {
  const parsed = parseAuthInput(input);
  if (parsed.state && expectedState && parsed.state !== expectedState) {
    throw new Error("State mismatch");
  }
  if (!parsed.code) {
    throw new Error("Missing authorization code");
  }
  return exchangeCode(parsed.code, verifier);
}

/**
 * Refresh an expired OpenAI Codex token.
 */
export async function refreshCodexToken(
  refreshToken: string,
): Promise<OAuthCredentials> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI Codex token refresh failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!json.access_token || !json.refresh_token) {
    throw new Error("Token refresh response missing required fields");
  }

  const accountId = getAccountId(json.access_token);
  if (!accountId) {
    throw new Error("Failed to extract accountId from refreshed token");
  }

  return {
    access: json.access_token,
    refresh: json.refresh_token,
    expires: Date.now() + json.expires_in * 1000,
    accountId,
  };
}
