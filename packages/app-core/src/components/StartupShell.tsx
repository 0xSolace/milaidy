/**
 * StartupShell — renders the correct startup UI based on the coordinator state.
 *
 * When the coordinator is in a loading phase, shows a branded loading screen.
 * When in error/pairing/onboarding phases, delegates to the existing views.
 * When ready, renders nothing (children pass through in App.tsx).
 */

import { useEffect, useState } from "react";
import { useApp } from "../state";
import type { StartupErrorState } from "../state/types";
import { OnboardingWizard } from "./OnboardingWizard";
import { PairingView } from "./PairingView";
import { StartupFailureView } from "./StartupFailureView";

function phaseToStatusKey(phase: string): string {
  switch (phase) {
    case "restoring-session":
      return "startupshell.Starting";
    case "resolving-target":
    case "polling-backend":
      return "startupshell.ConnectingBackend";
    case "starting-runtime":
      return "startupshell.InitializingAgent";
    case "hydrating":
      return "startupshell.Loading";
    default:
      return "startupshell.Starting";
  }
}

export function StartupShell() {
  const {
    startupCoordinator,
    startupError,
    retryStartup,
    t,
  } = useApp();
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

  // Splash phase — branded welcome screen with "Get Started" button
  if (phase === "splash") {
    const splashState = startupCoordinator.state as { phase: "splash"; loaded: boolean };
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#ffe600] font-body text-black overflow-hidden">
        <img
          src="/splash-bg.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full object-contain object-right-bottom"
        />
        <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center max-w-md">
          <h1 className="text-4xl font-black tracking-tight text-black drop-shadow-sm">
            MILADY
          </h1>
          <p className="text-sm text-black/60">
            {t("startupshell.SplashTagline", { defaultValue: "Your local-first AI assistant" })}
          </p>
          <button
            type="button"
            disabled={!splashState.loaded}
            onClick={() => startupCoordinator.dispatch({ type: "SPLASH_CONTINUE" })}
            className="mt-4 rounded-md bg-black px-8 py-3 text-sm font-bold uppercase tracking-wider text-[#ffe600] shadow-lg hover:bg-black/80 disabled:opacity-40 disabled:cursor-wait transition-all"
          >
            {splashState.loaded
              ? t("startupshell.GetStarted", { defaultValue: "Get Started" })
              : t("startupshell.Loading", { defaultValue: "Loading\u2026" })}
          </button>
        </div>
      </div>
    );
  }

  // Error phase — delegate to StartupFailureView
  if (phase === "error") {
    const coordState = startupCoordinator.state;
    const errState = coordState.phase === "error" ? coordState : null;
    const errorState: StartupErrorState = startupError ?? {
      reason: errState?.reason ?? "unknown",
      message:
        errState?.message ?? "An unexpected error occurred during startup.",
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

  // Loading phases — retro-styled loading screen centered in the window
  const statusText = t(phaseToStatusKey(phase));
  const showSlow = elapsedSec >= 10;

  // Progress estimate based on phase (0-100)
  const progressPct =
    phase === "restoring-session" ? 15 :
    phase === "resolving-target" ? 25 :
    phase === "polling-backend" ? 45 :
    phase === "starting-runtime" ? 70 :
    phase === "hydrating" ? 90 : 10;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#ffe600] font-body text-black overflow-hidden">
      {/* Branded splash background — see CLAUDE.md § Startup Splash */}
      <img
        src="/splash-bg.png"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-contain object-right-bottom opacity-30"
      />

      {/* Centered loading card */}
      <div className="relative z-10 flex flex-col items-center gap-5 px-8 w-full max-w-sm">
        {/* Status text */}
        <p className="text-sm font-bold uppercase tracking-widest text-black/80">
          {statusText}
        </p>

        {/* Retro progress bar */}
        <div className="w-full">
          <div className="h-6 w-full border-2 border-black/80 bg-black/10 overflow-hidden">
            <div
              className="h-full bg-black/80 transition-all duration-700 ease-out"
              style={{ width: `${progressPct}%` }}
            >
              {/* Segmented bar effect */}
              <div className="h-full w-full"
                style={{
                  backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,230,0,0.4) 8px, rgba(255,230,0,0.4) 10px)",
                }}
              />
            </div>
          </div>
        </div>

        {/* Elapsed time */}
        <p className="text-xs text-black/50 tabular-nums font-mono">
          {Math.floor(elapsedSec / 60)}:{(elapsedSec % 60).toString().padStart(2, "0")}
        </p>

        {/* Slow startup warning */}
        {showSlow && (
          <p className="text-xs text-black/60">
            {t("startupshell.TakingLonger")}
          </p>
        )}
      </div>
    </div>
  );
}
