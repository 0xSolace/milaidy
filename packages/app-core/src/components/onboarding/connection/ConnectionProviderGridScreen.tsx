import type { ProviderOption } from "../../../api";
import { appNameInterpolationVars, useBranding } from "../../../config";
import type {
  ConnectionEffect,
  ConnectionEvent,
} from "../../../onboarding/connection-flow";
import { CONNECTION_RECOMMENDED_PROVIDER_IDS } from "../../../onboarding/connection-flow";
import { getProviderLogo } from "../../../providers";
import { useApp } from "../../../state";

const recommendedIds = new Set<string>(CONNECTION_RECOMMENDED_PROVIDER_IDS);

export function ConnectionProviderGridScreen({
  dispatch,
  onTransitionEffect,
  sortedProviders,
  getProviderDisplay,
  getCustomLogo,
  getDetectedLabel,
}: {
  dispatch: (event: ConnectionEvent) => void;
  onTransitionEffect: (effect: ConnectionEffect) => void;
  sortedProviders: ProviderOption[];
  getProviderDisplay: (provider: ProviderOption) => {
    name: string;
    description?: string;
  };
  getCustomLogo: (id: string) =>
    | {
        logoDark?: string;
        logoLight?: string;
      }
    | undefined;
  getDetectedLabel: (providerId: string) => string | null;
}) {
  const branding = useBranding();
  const { t, onboardingRemoteConnected } = useApp();

  return (
    <>
      <div className="text-xs tracking-[0.3em] uppercase text-[rgba(240,238,250,0.62)] font-semibold text-center mb-0" style={{ textShadow: '0 2px 10px rgba(3,5,10,0.55)' }}>
        {t("onboarding.neuralLinkTitle")}
      </div>
      <div className="onboarding-divider">
        <div className="w-1.5 h-1.5 bg-[rgba(240,185,11,0.4)] rotate-45 shrink-0" />
      </div>
      {onboardingRemoteConnected && (
        <p className="onboarding-desc" style={{ marginBottom: "1rem" }}>
          {t(
            "onboarding.remoteConnectedDesc",
            appNameInterpolationVars(branding),
          )}
        </p>
      )}
      <div className="text-xl font-light leading-[1.4] text-[rgba(240,238,250,0.95)] text-center mb-[18px]" style={{ textShadow: '0 2px 10px rgba(3,5,10,0.55)' }}>
        {t("onboarding.chooseProvider")}
      </div>
      <div
        className="onboarding-provider-grid"
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}
      >
        {sortedProviders.map((p: ProviderOption) => {
          const display = getProviderDisplay(p);
          const isRecommended = recommendedIds.has(p.id);
          const detectedLabel = getDetectedLabel(p.id);
          return (
            <button
              type="button"
              key={p.id}
              className={`onboarding-provider-card${isRecommended ? " onboarding-provider-card--recommended" : ""}${detectedLabel ? " onboarding-provider-card--detected" : ""}`}
              style={{
                gridColumn: isRecommended ? "span 2" : "span 1",
                minWidth: 0,
              }}
              onClick={() =>
                dispatch({ type: "selectProvider", providerId: p.id })
              }
            >
              <img
                src={getProviderLogo(p.id, false, getCustomLogo(p.id))}
                alt={display.name}
                className="onboarding-provider-icon"
              />
              <div>
                <div className="onboarding-provider-name">{display.name}</div>
                {display.description && (
                  <div className="onboarding-provider-desc">
                    {display.description}
                  </div>
                )}
              </div>
              {detectedLabel && (
                <span className="onboarding-provider-badge onboarding-provider-badge--detected">
                  {detectedLabel}
                </span>
              )}
              {isRecommended && !detectedLabel && (
                <span className="onboarding-provider-badge">
                  {t("onboarding.recommended") ?? "Recommended"}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between items-center gap-6 mt-[18px] pt-3.5 border-t border-white/[0.08]">
        <button
          className="onboarding-back-link"
          onClick={() => {
            if (onboardingRemoteConnected) {
              onTransitionEffect("useLocalBackend");
              return;
            }
            dispatch({ type: "backRemoteOrGrid" });
          }}
          type="button"
        >
          {t("onboarding.back")}
        </button>
        <span />
      </div>
    </>
  );
}
