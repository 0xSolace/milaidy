import { useBranding } from "@miladyai/app-core/config";
import { useApp } from "@miladyai/app-core/state";

export function WelcomeStep() {
  const branding = useBranding();
  const { setState, t } = useApp();

  const handleGetStarted = () => {
    // Default to Chen (blue-haired anime character) — character selection
    // happens after onboarding completes.
    setState("onboardingStyle", "I'm here to help you.");
    setState("onboardingName", "Chen");
    setState("selectedVrmIndex", 1);
    setState("onboardingStep", "connection");
  };

  return (
    <>
      <div className="onboarding-section-title">
        {t("onboarding.welcomeTitle", { name: branding.appName })}
      </div>
      <div className="onboarding-divider">
        <div className="onboarding-divider-diamond" />
      </div>
      <p className="onboarding-desc">{t("onboarding.welcomeDesc")}</p>
      <div className="onboarding-panel-footer">
        <span />
        <button
          className="onboarding-confirm-btn"
          onClick={handleGetStarted}
          type="button"
        >
          {t("onboarding.getStarted")}
        </button>
      </div>
    </>
  );
}
