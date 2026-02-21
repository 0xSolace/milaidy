/**
 * CloudLanding - Public cloud-only onboarding for milady.fun
 * Flow: ElizaCloud auth → get Headscale IP → connect to container → Discord setup
 * 
 * Aesthetic: terminal/log interface, Y2K Japanese web, flat retro, psyop dense
 */

import { useState } from "react";

const DISCORD_CLIENT_ID =
  import.meta.env.VITE_DISCORD_CLIENT_ID || "YOUR_DISCORD_CLIENT_ID";
const DISCORD_REDIRECT_URI =
  import.meta.env.VITE_DISCORD_REDIRECT_URI ||
  `${window.location.origin}/discord-callback`;

type CloudStep = "landing" | "auth" | "connecting" | "discord" | "ready";

interface ContainerInfo {
  agentId: string;
  headscaleIp: string;
  agentName: string;
}

export function CloudLanding() {
  const [step, setStep] = useState<CloudStep>("landing");
  const [error, setError] = useState<string>("");
  const [retryable, setRetryable] = useState<boolean>(false);
  const [container, setContainer] = useState<ContainerInfo | null>(null);

  const handleStart = async () => {
    setStep("auth");
    setError("");
    setRetryable(false);

    try {
      // Start ElizaCloud OAuth flow
      const loginResp = await fetch(
        "https://www.elizacloud.ai/api/auth/cli-session",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: crypto.randomUUID(),
          }),
        },
      );

      if (!loginResp.ok) {
        throw new Error(
          `elizacloud auth unavailable (${loginResp.status})`,
        );
      }

      const { sessionId, browserUrl } = await loginResp.json();

      // Open OAuth popup
      const popup = window.open(browserUrl, "_blank", "width=600,height=700");
      if (!popup) {
        throw new Error(
          "popup blocked — allow popups and retry",
        );
      }

      // Poll for completion
      setStep("connecting");
      let attempts = 0;
      const MAX_POLL_ATTEMPTS = 120;

      const pollInterval = setInterval(async () => {
        attempts++;

        if (attempts > MAX_POLL_ATTEMPTS) {
          clearInterval(pollInterval);
          setError("auth timeout — complete sign-in within 2 minutes");
          setRetryable(true);
          setStep("landing");
          return;
        }

        try {
          const pollResp = await fetch(
            `https://www.elizacloud.ai/api/auth/cli-session/${encodeURIComponent(sessionId)}`,
          );

          if (!pollResp.ok) {
            if (pollResp.status === 404) {
              clearInterval(pollInterval);
              setError("session expired");
              setRetryable(true);
              setStep("landing");
            }
            return;
          }

          const poll = await pollResp.json();

          if (poll.status === "authenticated" && poll.apiKey) {
            clearInterval(pollInterval);

            // Create agent container
            const createResp = await fetch(
              "https://www.elizacloud.ai/api/v1/agents",
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${poll.apiKey}`,
                },
                body: JSON.stringify({
                  agentName: "milaidy",
                  agentConfig: {
                    theme: "milady",
                    runMode: "cloud",
                  },
                }),
              },
            );

            if (!createResp.ok) {
              const errData = await createResp.json().catch(() => ({}));
              throw new Error(
                errData.message || `container creation failed (${createResp.status})`,
              );
            }

            const agent = await createResp.json();

            // Wait for Headscale IP
            let headscaleIp: string | null = null;
            let ipRetries = 0;
            const MAX_IP_RETRIES = 10;

            while (!headscaleIp && ipRetries < MAX_IP_RETRIES) {
              await new Promise((resolve) => setTimeout(resolve, 3000));

              const agentResp = await fetch(
                `https://www.elizacloud.ai/api/v1/agents/${agent.agentId}`,
                {
                  headers: { Authorization: `Bearer ${poll.apiKey}` },
                },
              );

              if (agentResp.ok) {
                const agentData = await agentResp.json();
                headscaleIp = agentData.networking?.headscaleIp;
              }

              ipRetries++;
            }

            if (!headscaleIp) {
              throw new Error(
                "container ready but network pending — refresh in 30s",
              );
            }

            setContainer({
              agentId: agent.agentId,
              headscaleIp,
              agentName: agent.agentName || "milaidy",
            });

            sessionStorage.setItem("elizacloud_api_key", poll.apiKey);
            sessionStorage.setItem("container_ip", headscaleIp);

            setStep("discord");
          } else if (poll.status === "expired") {
            clearInterval(pollInterval);
            setError("session expired");
            setRetryable(true);
            setStep("landing");
          } else if (poll.status === "error") {
            clearInterval(pollInterval);
            setError(poll.error || "auth failed");
            setRetryable(true);
            setStep("landing");
          }
        } catch (pollErr) {
          console.error("poll error:", pollErr);
        }
      }, 1000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      setError(message);
      setRetryable(true);
      setStep("landing");
    }
  };

  const handleDiscordSetup = () => {
    const scopes = ["bot", "applications.commands"].join(" ");
    const permissions = "8";
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(DISCORD_CLIENT_ID)}&redirect_uri=${encodeURIComponent(DISCORD_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&permissions=${permissions}`;
    window.location.href = discordAuthUrl;
  };

  const handleRetry = () => {
    setError("");
    setRetryable(false);
    handleStart();
  };

  // Landing
  if (step === "landing") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="max-w-[640px] w-full">
          <div className="mb-8 text-center">
            <div className="text-6xl font-bold mb-4 text-[var(--text)] tracking-tight">
              milaidy
            </div>
            <div className="font-mono text-sm text-[var(--muted)] mb-6">
              [ cloud agent runtime ]
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--card)] p-6 mb-6 rounded-none">
            <div className="space-y-4 font-mono text-sm">
              <div className="flex gap-3">
                <span className="text-[var(--accent)] flex-shrink-0">{'>>>'}</span>
                <div>
                  <div className="text-[var(--text)] font-bold mb-1">instant container</div>
                  <div className="text-[var(--muted)]">your agent, deployed in 30s</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-[var(--accent)] flex-shrink-0">{'>>>'}</span>
                <div>
                  <div className="text-[var(--text)] font-bold mb-1">discord ready</div>
                  <div className="text-[var(--muted)]">oauth flow, one click</div>
                </div>
              </div>
              <div className="flex gap-3">
                <span className="text-[var(--accent)] flex-shrink-0">{'>>>'}</span>
                <div>
                  <div className="text-[var(--text)] font-bold mb-1">isolated runtime</div>
                  <div className="text-[var(--muted)]">headscale vpn, private keys</div>
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="border border-[var(--destructive)] bg-[var(--card)] p-4 mb-6 rounded-none font-mono text-sm">
              <div className="text-[var(--destructive)] mb-2">[ ERROR ]</div>
              <div className="text-[var(--muted)]">{error}</div>
            </div>
          )}

          {retryable && error ? (
            <button
              type="button"
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-[var(--accent)] text-[var(--card)] font-mono text-sm font-bold rounded-none border border-[var(--accent)] hover:bg-transparent hover:text-[var(--accent)] transition-colors duration-[var(--duration-fast)]"
            >
              retry
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStart}
              className="w-full px-6 py-3 bg-[var(--accent)] text-[var(--card)] font-mono text-sm font-bold rounded-none border border-[var(--accent)] hover:bg-transparent hover:text-[var(--accent)] transition-colors duration-[var(--duration-fast)]"
            >
              deploy
            </button>
          )}

          <div className="text-center mt-6 font-mono text-xs text-[var(--muted)]">
            powered by elizacloud
          </div>
        </div>
      </div>
    );
  }

  // Auth in progress
  if (step === "auth") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="max-w-[480px] w-full text-center">
          <div className="font-mono text-sm text-[var(--muted)] mb-4">
            [ authenticating ]
          </div>
          <div className="text-[var(--text)] font-mono text-sm">
            check popup window
          </div>
          <div className="mt-4 text-[var(--muted)] font-mono text-xs animate-pulse">
            ···
          </div>
        </div>
      </div>
    );
  }

  // Connecting to container
  if (step === "connecting") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="max-w-[520px] w-full">
          <div className="font-mono text-sm text-[var(--muted)] mb-6 text-center">
            [ provisioning ]
          </div>

          <div className="border border-[var(--border)] bg-[var(--card)] p-6 rounded-none">
            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-none bg-[var(--ok)]" />
                <span className="text-[var(--text)]">authenticated</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-none bg-[var(--accent)] animate-pulse" />
                <span className="text-[var(--text)]">creating container</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-none border border-[var(--border)]" />
                <span className="text-[var(--muted)]">network init</span>
              </div>
            </div>
          </div>

          <div className="text-center mt-6 font-mono text-xs text-[var(--muted)]">
            eta 30s
          </div>
        </div>
      </div>
    );
  }

  // Discord setup
  if (step === "discord") {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--bg)]">
        <div className="max-w-[560px] w-full">
          <div className="mb-8 text-center">
            <div className="font-mono text-sm text-[var(--ok)] mb-2">
              [ READY ]
            </div>
            <div className="text-[var(--text)] font-mono text-sm">
              {container?.agentName}
            </div>
            <div className="text-[var(--muted)] font-mono text-xs mt-2">
              {container?.headscaleIp}
            </div>
          </div>

          <div className="border border-[var(--border)] bg-[var(--card)] p-6 mb-6 rounded-none">
            <div className="font-mono text-xs text-[var(--muted)] mb-4">
              next: discord integration
            </div>
            <button
              type="button"
              onClick={handleDiscordSetup}
              className="w-full px-6 py-3 mb-3 bg-[var(--accent)] text-[var(--card)] font-mono text-sm font-bold rounded-none border border-[var(--accent)] hover:bg-transparent hover:text-[var(--accent)] transition-colors duration-[var(--duration-fast)]"
            >
              authorize bot
            </button>
            <button
              type="button"
              onClick={() => (window.location.href = "/")}
              className="w-full px-6 py-2 bg-transparent text-[var(--muted)] font-mono text-xs rounded-none border border-[var(--border)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors duration-[var(--duration-fast)]"
            >
              skip / dashboard
            </button>
          </div>

          <div className="font-mono text-xs text-[var(--muted)] text-center">
            container id: {container?.agentId.slice(0, 8)}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
