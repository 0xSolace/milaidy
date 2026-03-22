import { describe, expect, it } from "vitest";
import {
  deriveUiShellModeForTab,
  getTabForShellView,
  shouldStartAtCharacterSelectOnLaunch,
} from "./shell-routing";
import { COMPANION_ENABLED } from "../navigation";

describe("shouldStartAtCharacterSelectOnLaunch", () => {
  const baseParams = {
    onboardingNeedsOptions: false,
    onboardingMode: "basic" as const,
    navPath: "/",
    urlTab: null,
  };

  it("always returns false (character-select auto-redirect is disabled)", () => {
    expect(shouldStartAtCharacterSelectOnLaunch(baseParams)).toBe(false);
  });

  it("returns false even when onboarding does not need options", () => {
    expect(
      shouldStartAtCharacterSelectOnLaunch({
        ...baseParams,
        onboardingNeedsOptions: false,
      }),
    ).toBe(false);
  });

  it("returns false when onboardingMode is elizacloudonly", () => {
    expect(
      shouldStartAtCharacterSelectOnLaunch({
        ...baseParams,
        onboardingMode: "elizacloudonly",
      }),
    ).toBe(false);
  });

  it("returns false when onboardingNeedsOptions is true", () => {
    expect(
      shouldStartAtCharacterSelectOnLaunch({
        ...baseParams,
        onboardingNeedsOptions: true,
      }),
    ).toBe(false);
  });

  it("returns false regardless of navPath", () => {
    expect(
      shouldStartAtCharacterSelectOnLaunch({
        ...baseParams,
        navPath: "/companion",
      }),
    ).toBe(false);
  });

  it("returns false regardless of urlTab", () => {
    expect(
      shouldStartAtCharacterSelectOnLaunch({
        ...baseParams,
        urlTab: "chat",
      }),
    ).toBe(false);
  });
});

describe("deriveUiShellModeForTab", () => {
  it("returns companion for the companion tab", () => {
    expect(deriveUiShellModeForTab("companion")).toBe("companion");
  });

  it("returns native for the chat tab", () => {
    expect(deriveUiShellModeForTab("chat")).toBe("native");
  });

  it("returns native for all non-companion tabs", () => {
    for (const tab of ["chat", "plugins", "knowledge", "wallets", "stream"] as const) {
      expect(deriveUiShellModeForTab(tab)).toBe("native");
    }
  });
});

describe("initial tab default produces companion mode (regression)", () => {
  // Regression: tab previously defaulted to "chat", which rendered the
  // native/base UI on first paint. An async effect later switched to
  // "companion", causing a visible flash. The initial tab must be
  // "companion" when COMPANION_ENABLED so deriveUiShellModeForTab returns
  // "companion" on the very first render.
  it("COMPANION_ENABLED initial tab yields companion shell mode", () => {
    const initialTab = COMPANION_ENABLED ? "companion" : "chat";
    const mode = deriveUiShellModeForTab(initialTab);
    if (COMPANION_ENABLED) {
      expect(mode).toBe("companion");
    } else {
      expect(mode).toBe("native");
    }
  });

  it("companion tab must map to companion mode, not native", () => {
    // If this ever breaks, the app will flash the base chat UI on startup.
    expect(deriveUiShellModeForTab("companion")).not.toBe("native");
  });
});

describe("getTabForShellView", () => {
  it("returns companion for companion view", () => {
    expect(getTabForShellView("companion", "chat")).toBe("companion");
  });

  it("returns character for character view (not character-select)", () => {
    const result = getTabForShellView("character", "chat");
    expect(result).toBe("character");
    expect(result).not.toBe("character-select");
  });

  it("returns the lastNativeTab for desktop view", () => {
    expect(getTabForShellView("desktop", "chat")).toBe("chat");
    expect(getTabForShellView("desktop", "plugins")).toBe("plugins");
    expect(getTabForShellView("desktop", "wallets")).toBe("wallets");
  });

  it("uses whatever lastNativeTab is passed for desktop view", () => {
    expect(getTabForShellView("desktop", "knowledge")).toBe("knowledge");
  });

  it("falls back to chat if lastNativeTab is character-select", () => {
    expect(getTabForShellView("desktop", "character-select")).toBe("chat");
  });

  it("falls back to chat if lastNativeTab is companion", () => {
    expect(getTabForShellView("desktop", "companion")).toBe("chat");
  });
});
