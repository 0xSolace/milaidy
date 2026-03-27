/**
 * Steward Native Module for Electrobun
 *
 * Integrates the Steward sidecar into the Electrobun desktop app lifecycle.
 * Manages startup, shutdown, and exposes status to the renderer via RPC.
 *
 * Follows the same pattern as `agent.ts` — spawns Steward as a child process
 * and manages its lifecycle from the Electrobun main process.
 */

import {
  createDesktopStewardSidecar,
  type StewardSidecar,
  type StewardSidecarStatus,
} from "@miladyai/app-core/services/steward-sidecar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusChangeCallback = (status: StewardSidecarStatus) => void;

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let sidecar: StewardSidecar | null = null;
let statusListeners: StatusChangeCallback[] = [];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get or create the Steward sidecar singleton.
 *
 * The sidecar is NOT started automatically — call `startSteward()` explicitly
 * during app initialization so the UI can show a loading indicator.
 */
export function getStewardSidecar(): StewardSidecar {
  if (!sidecar) {
    sidecar = createDesktopStewardSidecar({
      onStatusChange: (status) => {
        for (const listener of statusListeners) {
          try {
            listener(status);
          } catch (err) {
            console.warn("[Steward] Status listener error:", err);
          }
        }
      },
      onLog: (line, stream) => {
        // In dev, forward steward logs. In production, only errors.
        if (stream === "stderr" || process.env.NODE_ENV !== "production") {
          const prefix = stream === "stderr" ? "[Steward:err]" : "[Steward]";
          console.log(`${prefix} ${line}`);
        }
      },
    });
  }
  return sidecar;
}

/**
 * Start the Steward sidecar and wait for it to be healthy.
 * Handles first-launch wallet creation automatically.
 *
 * Returns the status after startup (running or error).
 */
export async function startSteward(): Promise<StewardSidecarStatus> {
  const steward = getStewardSidecar();
  const status = steward.getStatus();

  if (status.state === "running") {
    console.log("[Steward] Already running, skipping start");
    return status;
  }

  console.log("[Steward] Starting sidecar...");

  try {
    const result = await steward.start();
    console.log(
      `[Steward] Running on port ${result.port}, wallet: ${result.walletAddress ?? "none"}`,
    );
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Steward] Failed to start:", msg);
    return steward.getStatus();
  }
}

/**
 * Stop the Steward sidecar gracefully.
 * Called during app shutdown.
 */
export async function stopSteward(): Promise<void> {
  if (!sidecar) return;
  console.log("[Steward] Stopping sidecar...");
  await sidecar.stop();
  console.log("[Steward] Stopped");
}

/**
 * Register a callback for Steward status changes.
 * Returns an unsubscribe function.
 */
export function onStewardStatusChange(
  callback: StatusChangeCallback,
): () => void {
  statusListeners.push(callback);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== callback);
  };
}

/**
 * Get the current Steward sidecar status.
 */
export function getStewardStatus(): StewardSidecarStatus {
  if (!sidecar) {
    return {
      state: "stopped",
      port: null,
      pid: null,
      error: null,
      restartCount: 0,
      walletAddress: null,
      agentId: null,
      tenantId: null,
      startedAt: null,
    };
  }
  return sidecar.getStatus();
}

/**
 * Get the Steward API base URL (e.g. http://127.0.0.1:3200).
 * Returns null if steward isn't configured.
 */
export function getStewardApiBase(): string | null {
  if (!sidecar) return null;
  const status = sidecar.getStatus();
  if (status.state !== "running" || !status.port) return null;
  return sidecar.getApiBase();
}

/**
 * Check if the STEWARD_LOCAL environment flag is set.
 * When false, Steward sidecar should not be started.
 */
export function isStewardLocalEnabled(): boolean {
  return process.env.STEWARD_LOCAL === "true";
}
