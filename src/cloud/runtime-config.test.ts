import { afterEach, describe, expect, test } from "vitest";
import type { MiladyConfig } from "../config/config";
import { resolveEffectiveCloudRuntimeConfig } from "./runtime-config";

const ENV_KEYS = [
  "ELIZAOS_CLOUD_API_KEY",
  "ELIZAOS_CLOUD_ENABLED",
  "ELIZAOS_CLOUD_BASE_URL",
  "ELIZAOS_CLOUD_SMALL_MODEL",
  "ELIZAOS_CLOUD_LARGE_MODEL",
  "SMALL_MODEL",
  "LARGE_MODEL",
] as const;

const savedEnv = new Map<string, string | undefined>();

function clearEnv(): void {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv.get(key);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  savedEnv.clear();
});

describe("resolveEffectiveCloudRuntimeConfig", () => {
  test("treats env-only cloud api key as enabled cloud config", () => {
    for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
    clearEnv();
    process.env.ELIZAOS_CLOUD_API_KEY = "ck-env-only";

    const result = resolveEffectiveCloudRuntimeConfig({} as MiladyConfig);

    expect(result).toMatchObject({
      configured: true,
      enabled: true,
      hasApiKey: true,
      apiKey: "ck-env-only",
      smallModel: "openai/gpt-5-mini",
      largeModel: "anthropic/claude-sonnet-4.5",
    });
  });

  test("prefers config values over env fallbacks", () => {
    for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
    clearEnv();
    process.env.ELIZAOS_CLOUD_API_KEY = "ck-env";
    process.env.ELIZAOS_CLOUD_SMALL_MODEL = "openai/gpt-4.1-mini";
    process.env.ELIZAOS_CLOUD_LARGE_MODEL = "anthropic/claude-3.7-sonnet";

    const result = resolveEffectiveCloudRuntimeConfig({
      cloud: {
        enabled: true,
        apiKey: "ck-config",
        baseUrl: "https://cloud.example",
      },
      models: {
        small: "openai/gpt-5-mini",
        large: "anthropic/claude-sonnet-4.5",
      },
    } as MiladyConfig);

    expect(result).toMatchObject({
      enabled: true,
      apiKey: "ck-config",
      baseUrl: "https://cloud.example",
      smallModel: "openai/gpt-5-mini",
      largeModel: "anthropic/claude-sonnet-4.5",
    });
  });

  test("respects explicit disable even when env api key exists", () => {
    for (const key of ENV_KEYS) savedEnv.set(key, process.env[key]);
    clearEnv();
    process.env.ELIZAOS_CLOUD_API_KEY = "ck-env";

    const result = resolveEffectiveCloudRuntimeConfig({
      cloud: { enabled: false },
    } as MiladyConfig);

    expect(result).toMatchObject({
      configured: true,
      explicitlyDisabled: true,
      enabled: false,
      hasApiKey: true,
      apiKey: "ck-env",
      smallModel: undefined,
      largeModel: undefined,
    });
  });
});
