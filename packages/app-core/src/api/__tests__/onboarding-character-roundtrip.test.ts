/**
 * Integration test: Onboarding → Config Persistence → Character Build round-trip.
 *
 * Proves that when a user completes onboarding with a preset character (Chen),
 * ALL personality fields survive the full pipeline:
 *   1. persistCompatOnboardingDefaults() writes to config
 *   2. Config is reloaded
 *   3. buildCharacterFromConfig() produces a complete character
 *   4. The character has all preset fields populated
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STYLE_PRESETS } from "../../onboarding-presets";

let savedConfig: Record<string, unknown> = {};

vi.mock("../../config/config", () => ({
  loadElizaConfig: vi.fn(() => structuredClone(savedConfig)),
  saveElizaConfig: vi.fn((config: Record<string, unknown>) => {
    savedConfig = structuredClone(config);
  }),
}));

import { persistCompatOnboardingDefaults } from "../server";

vi.mock("@elizaos/plugin-agent-orchestrator", () => ({ default: {} }));
vi.mock("@elizaos/plugin-agent-skills", () => ({ default: {} }));
vi.mock("@elizaos/plugin-anthropic", () => ({ default: {} }));
vi.mock("@elizaos/plugin-browser", () => ({ default: {} }));
vi.mock("@elizaos/plugin-cli", () => ({ default: {} }));
vi.mock("@elizaos/plugin-coding-agent", () => ({ default: {} }));
vi.mock("@elizaos/plugin-computeruse", () => ({ default: {} }));
vi.mock("@elizaos/plugin-cron", () => ({ default: {} }));
vi.mock("@elizaos/plugin-discord", () => ({ default: {} }));
vi.mock("@elizaos/plugin-edge-tts", () => ({ default: {} }));
vi.mock("@elizaos/plugin-elevenlabs", () => ({ default: {} }));
vi.mock("@elizaos/plugin-elizacloud", () => ({ default: {} }));
vi.mock("@elizaos/plugin-experience", () => ({ default: {} }));
vi.mock("@elizaos/plugin-form", () => ({ default: {} }));
vi.mock("@elizaos/plugin-google-genai", () => ({ default: {} }));
vi.mock("@elizaos/plugin-groq", () => ({ default: {} }));
vi.mock("@elizaos/plugin-knowledge", () => ({ default: {} }));
vi.mock("@elizaos/plugin-local-embedding", () => ({ default: {} }));
vi.mock("@elizaos/plugin-ollama", () => ({ default: {} }));
vi.mock("@elizaos/plugin-openai", () => ({ default: {} }));
vi.mock("@elizaos/plugin-openrouter", () => ({ default: {} }));
vi.mock("@elizaos/plugin-pdf", () => ({ default: {} }));
vi.mock("@elizaos/plugin-personality", () => ({ default: {} }));
vi.mock("@elizaos/plugin-plugin-manager", () => ({ default: {} }));
vi.mock("@elizaos/plugin-rolodex", () => ({ default: {} }));
vi.mock("@elizaos/plugin-secrets-manager", () => ({ default: {} }));
vi.mock("@elizaos/plugin-shell", () => ({ default: {} }));
vi.mock("@elizaos/plugin-sql", () => ({ default: {} }));
vi.mock("@elizaos/plugin-telegram", () => ({ default: {} }));
vi.mock("@elizaos/plugin-trajectory-logger", () => ({ default: {} }));
vi.mock("@elizaos/plugin-trust", () => ({ default: {} }));
vi.mock("@elizaos/plugin-twitch", () => ({ default: {} }));
vi.mock("@miladyai/plugin-wechat", () => ({ default: {} }));

import { buildCharacterFromConfig } from "../../runtime/eliza";
import type { ElizaConfig } from "../../config/config";

describe("Onboarding → Character round-trip", () => {
  const chenPreset = STYLE_PRESETS.find((p) => p.name === "Chen")!;

  beforeEach(() => {
    savedConfig = {};
  });

  it("Chen preset: all personality fields survive persist → build round-trip", () => {
    const systemPrompt = chenPreset.system.replace(/\{\{name\}\}/g, "Chen");

    persistCompatOnboardingDefaults({
      name: "Chen",
      bio: chenPreset.bio,
      systemPrompt,
      style: chenPreset.style,
      adjectives: chenPreset.adjectives,
      topics: chenPreset.topics,
      postExamples: chenPreset.postExamples,
      messageExamples: chenPreset.messageExamples,
    });

    // Verify config has ALL fields
    const agents = savedConfig.agents as Record<string, unknown>;
    const list = agents.list as Record<string, unknown>[];
    const agentEntry = list[0];
    expect(agentEntry.name).toBe("Chen");
    expect(agentEntry.style).toEqual(chenPreset.style);
    expect(agentEntry.adjectives).toEqual(chenPreset.adjectives);
    expect(agentEntry.topics).toEqual(chenPreset.topics);
    expect(agentEntry.postExamples).toEqual(chenPreset.postExamples);
    expect(agentEntry.messageExamples).toEqual(chenPreset.messageExamples);

    // Build character from persisted config (simulates agent restart)
    const character = buildCharacterFromConfig(savedConfig as ElizaConfig);

    expect(character.name).toBe("Chen");
    expect(character.style).toBeTruthy();
    expect(character.style?.all?.length).toBeGreaterThan(0);
    expect(character.style?.chat?.length).toBeGreaterThan(0);
    expect(character.style?.post?.length).toBeGreaterThan(0);
    expect(character.adjectives?.length).toBe(chenPreset.adjectives.length);
    expect(character.adjectives).toContain("warm");
    expect(Array.isArray(character.topics)).toBe(true);
    expect((character.topics as string[]).length).toBe(chenPreset.topics!.length);
    expect(character.topics).toContain("emotional intelligence");
    expect(character.postExamples.length).toBeGreaterThan(0);
    expect(character.messageExamples.length).toBeGreaterThan(0);
  });

  it("name-only config: preset fallback populates all character fields", () => {
    savedConfig = {
      agents: { list: [{ id: "main", name: "Chen" }] },
    };

    const character = buildCharacterFromConfig(savedConfig as ElizaConfig);

    expect(character.name).toBe("Chen");
    expect(character.style).toBeTruthy();
    expect(character.style?.all?.length).toBeGreaterThan(0);
    expect(character.adjectives).toBeTruthy();
    expect(character.adjectives?.length).toBeGreaterThan(0);
    expect(Array.isArray(character.topics)).toBe(true);
    expect((character.topics as string[]).length).toBeGreaterThan(0);
    expect(character.postExamples.length).toBeGreaterThan(0);
    expect(character.messageExamples.length).toBeGreaterThan(0);
  });

  it("all preset characters have complete data after round-trip", () => {
    for (const preset of STYLE_PRESETS) {
      savedConfig = {};
      persistCompatOnboardingDefaults({
        name: preset.name,
        bio: preset.bio,
        systemPrompt: preset.system.replace(/\{\{name\}\}/g, preset.name),
        style: preset.style,
        adjectives: preset.adjectives,
        topics: preset.topics,
        postExamples: preset.postExamples,
        messageExamples: preset.messageExamples,
      });

      const character = buildCharacterFromConfig(savedConfig as ElizaConfig);
      expect(character.name).toBe(preset.name);
      expect(character.style?.all?.length).toBeGreaterThan(0);
      expect(character.adjectives?.length).toBeGreaterThan(0);
      expect(character.postExamples.length).toBeGreaterThan(0);
      expect(character.messageExamples.length).toBeGreaterThan(0);
    }
  });
});
