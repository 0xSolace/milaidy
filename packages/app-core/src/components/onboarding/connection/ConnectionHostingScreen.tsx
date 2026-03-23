import { appNameInterpolationVars, useBranding } from "../../../config";
import type { ConnectionEvent } from "../../../onboarding/connection-flow";
import { useApp } from "../../../state";

export function ConnectionHostingScreen({
  showHostingLocalCard,
  dispatch,
}: {
  showHostingLocalCard: boolean;
  dispatch: (event: ConnectionEvent) => void;
}) {
  const branding = useBranding();
  const { t, handleOnboardingBack } = useApp();

  return (
    <>
      <div className="text-xs tracking-[0.3em] uppercase text-[rgba(240,238,250,0.62)] font-semibold text-center mb-0" style={{ textShadow: '0 2px 10px rgba(3,5,10,0.55)' }}>
        {t("onboarding.hostingTitle")}
      </div>
      <div className="onboarding-divider">
        <div className="w-1.5 h-1.5 bg-[rgba(240,185,11,0.4)] rotate-45 shrink-0" />
      </div>
      <div className="text-xl font-light leading-[1.4] text-[rgba(240,238,250,0.95)] text-center mb-[18px]" style={{ textShadow: '0 2px 10px rgba(3,5,10,0.55)' }}>
        {t("onboarding.hostingQuestion", appNameInterpolationVars(branding))}
      </div>
      <div className="flex flex-col gap-1.5 mb-4">
        {showHostingLocalCard && (
          <button
            type="button"
            className="onboarding-provider-card onboarding-provider-card--recommended"
            onClick={() => dispatch({ type: "selectLocalHosting" })}
          >
            <div style={{ flex: 1 }}>
              <div className="text-xs text-[rgba(240,238,250,0.88)] leading-[1.3]" style={{ textShadow: '0 1px 8px rgba(3,5,10,0.6)' }}>
                {t("onboarding.hostingLocal")}
              </div>
              <div className="onboarding-provider-desc">
                {t("onboarding.hostingLocalDesc")}
              </div>
            </div>
            <span className="onboarding-provider-badge">
              {t("onboarding.recommended") ?? "Recommended"}
            </span>
          </button>
        )}
        <button
          type="button"
          className="onboarding-provider-card"
          onClick={() => dispatch({ type: "selectRemoteHosting" })}
        >
          <div style={{ flex: 1 }}>
            <div className="text-xs text-[rgba(240,238,250,0.88)] leading-[1.3]" style={{ textShadow: '0 1px 8px rgba(3,5,10,0.6)' }}>
              {t("onboarding.hostingRemote")}
            </div>
            <div className="onboarding-provider-desc">
              {t("onboarding.hostingRemoteDesc")}
            </div>
          </div>
        </button>
        <button
          type="button"
          className="onboarding-provider-card"
          onClick={() => dispatch({ type: "selectElizaCloudHosting" })}
        >
          <div style={{ flex: 1 }}>
            <div className="text-xs text-[rgba(240,238,250,0.88)] leading-[1.3]" style={{ textShadow: '0 1px 8px rgba(3,5,10,0.6)' }}>{t("header.Cloud")}</div>
            <div className="onboarding-provider-desc">
              {t("onboarding.hostingElizaCloudDesc")}
            </div>
          </div>
        </button>
      </div>
      <div className="flex justify-between items-center gap-6 mt-[18px] pt-3.5 border-t border-white/[0.08]">
        <button
          className="onboarding-back-link"
          onClick={handleOnboardingBack}
          type="button"
        >
          {t("onboarding.back")}
        </button>
        <span />
      </div>
    </>
  );
}
