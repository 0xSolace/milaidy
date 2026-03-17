import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const elizaRoot = path.join(repoRoot, "..", "eliza");

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "milady/plugin-sdk",
        replacement: path.join(repoRoot, "src", "plugin-sdk", "index.ts"),
      },
      {
        find: "@elizaos/core",
        replacement: path.join(
          elizaRoot,
          "packages",
          "typescript",
          "src",
          "index.ts",
        ),
      },
      {
        find: /^@elizaos\/autonomous\/(.*)/,
        replacement: path.join(elizaRoot, "packages", "autonomous", "src", "$1"),
      },
      {
        find: "@elizaos/autonomous",
        replacement: path.join(
          elizaRoot,
          "packages",
          "autonomous",
          "src",
          "index.ts",
        ),
      },
      {
        find: /^@elizaos\/app-core\/(.*)/,
        replacement: path.join(elizaRoot, "packages", "app-core", "src", "$1"),
      },
      {
        find: "@elizaos/app-core",
        replacement: path.join(
          elizaRoot,
          "packages",
          "app-core",
          "src",
          "index.ts",
        ),
      },
      {
        find: "@elizaos/skills",
        replacement: path.join(repoRoot, "test", "stubs", "empty-module.mjs"),
      },
      {
        find: "@elizaos/plugin-repoprompt",
        replacement: path.join(repoRoot, "test", "stubs", "empty-module.mjs"),
      },
      {
        find: "@elizaos/plugin-agent-orchestrator",
        replacement: path.join(
          repoRoot,
          "test",
          "stubs",
          "coding-agent-module.ts",
        ),
      },
      {
        find: "@elizaos/plugin-coding-agent",
        replacement: path.join(
          repoRoot,
          "test",
          "stubs",
          "coding-agent-module.ts",
        ),
      },
      {
        find: "@elizaos/plugin-pdf",
        replacement: path.join(repoRoot, "test", "stubs", "empty-module.mjs"),
      },
      {
        find: "@elizaos/plugin-form",
        replacement: path.join(repoRoot, "test", "stubs", "empty-module.mjs"),
      },
      {
        find: "@elizaos/plugin-pi-ai",
        replacement: path.join(repoRoot, "test", "stubs", "pi-ai-module.ts"),
      },
      {
        find: "@elizaos/plugin-openai",
        replacement: path.join(repoRoot, "test", "stubs", "plugin-stub.mjs"),
      },
      {
        find: "@elizaos/plugin-ollama",
        replacement: path.join(repoRoot, "test", "stubs", "plugin-stub.mjs"),
      },
      {
        find: "@elizaos/plugin-local-embedding",
        replacement: path.join(repoRoot, "test", "stubs", "plugin-stub.mjs"),
      },
      {
        find: "@elizaos/plugin-sql",
        replacement: path.join(repoRoot, "test", "stubs", "plugin-stub.mjs"),
      },
      {
        find: "@elizaos/plugin-discord",
        replacement: path.join(repoRoot, "test", "stubs", "plugin-stub.mjs"),
      },
      {
        find: "electron",
        replacement: path.join(repoRoot, "test", "stubs", "electron-module.ts"),
      },
    ],
  },
  test: {
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: "forks",
    maxWorkers: 1,
    sequence: {
      concurrent: false,
      shuffle: false,
    },
    include: ["test/**/*.e2e.test.ts"],
    setupFiles: ["test/setup.ts"],
    exclude: ["dist/**", "**/node_modules/**", "test/capacitor-plugins.e2e.test.ts"],
    server: {
      deps: {
        inline: [
          "@elizaos/core",
          "@elizaos/autonomous",
          /^@elizaos\/plugin-/,
          "zod",
        ],
      },
    },
  },
});
