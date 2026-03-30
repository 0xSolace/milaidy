/**
 * StartupShell — renders the correct startup UI based on the coordinator state.
 *
 * When the coordinator is in a loading phase, shows a branded loading screen.
 * When in error/pairing/onboarding phases, delegates to the existing views.
 * When ready, renders nothing (children pass through in App.tsx).
 */

import { useEffect, useState } from "react";
import { useBranding } from "../config/branding";
import { useApp } from "../state";
import type { StartupErrorState } from "../state/types";
import { OnboardingWizard } from "./OnboardingWizard";
import { PairingView } from "./PairingView";
import { StartupFailureView } from "./StartupFailureView";

function phaseToStatusText(
  phase: string,
): string {
  switch (phase) {
    case "booting":
    case "restoring-session":
      return "Starting\u2026";
    case "resolving-target":
    case "polling-backend":
      return "Connecting to backend\u2026";
    case "starting-runtime":
      return "Initializing agent\u2026";
    case "hydrating":
      return "Loading\u2026";
    default:
      return "Starting\u2026";
  }
}

export function StartupShell() {
  const {
    startupCoordinator,
    startupError,
    retryStartup,
  } = useApp();
  const branding = useBranding();
  const phase = startupCoordinator.phase;

  // Elapsed time counter
  const [elapsedSec, setElapsedSec] = useState(0);
  useEffect(() => {
    setElapsedSec(0);
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Error phase — delegate to StartupFailureView
  if (phase === "error") {
    const coordinatorErr = startupCoordinator as {
      reason?: string;
      message?: string;
    };
    const errorState: StartupErrorState = startupError ?? {
      reason:
        (coordinatorErr.reason as StartupErrorState["reason"]) ?? "unknown",
      message:
        coordinatorErr.message ??
        "An unexpected error occurred during startup.",
      phase: "starting-backend" as const,
    };
    return <StartupFailureView error={errorState} onRetry={retryStartup} />;
  }

  // Pairing required — delegate to PairingView
  if (phase === "pairing-required") {
    return <PairingView />;
  }

  // Onboarding required — delegate to OnboardingWizard
  if (phase === "onboarding-required") {
    return <OnboardingWizard />;
  }

  // Ready — render nothing (App.tsx will render children)
  if (phase === "ready") {
    return null;
  }

  // Loading phases — branded loading screen
  const statusText = phaseToStatusText(phase);
  const showSlow = elapsedSec >= 10;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-bg font-body text-txt">
      {/* Subtle radial gradient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.08),transparent_60%)]"
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* App name / branding */}
        <h1 className="text-2xl font-bold tracking-tight text-txt">
          {branding.appName}
        </h1>

        {/* Pulse spinner */}
        <div className="relative flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
        </div>

        {/* Status text */}
        <p className="text-sm text-muted">{statusText}</p>

        {/* Elapsed time */}
        {elapsedSec > 0 && (
          <p className="text-xs text-muted/60 tabular-nums">
            {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toString().padStart(2, "0")} elapsed
          </p>
        )}

        {/* Slow startup warning */}
        {showSlow && (
          <p className="mt-2 max-w-xs text-xs text-warning/80">
            Taking longer than expected&hellip;
          </p>
        )}
      </div>
    </div>
  );
}
