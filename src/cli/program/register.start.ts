import crypto from "node:crypto";
import type { Command } from "commander";
import { formatDocsLink } from "../../terminal/links";
import { theme } from "../../terminal/theme";
import { runCommandWithRuntime } from "../cli-utils";

const defaultRuntime = { error: console.error, exit: process.exit };

/**
 * Ensure a connection key exists for remote access.
 * Uses existing MILADY_API_TOKEN/ELIZA_API_TOKEN if set, otherwise generates one.
 */
function ensureConnectionKey(): string {
  const existing =
    process.env.MILADY_API_TOKEN?.trim() ||
    process.env.ELIZA_API_TOKEN?.trim();
  if (existing) return existing;

  const generated = crypto.randomBytes(16).toString("hex");
  process.env.MILADY_API_TOKEN = generated;
  process.env.ELIZA_API_TOKEN = generated;
  return generated;
}

async function startAction() {
  const connectionKey = ensureConnectionKey();

  await runCommandWithRuntime(defaultRuntime, async () => {
    const { startEliza } = await import("../../runtime/eliza");
    // Use serverOnly mode: starts API server, no interactive chat loop
    await startEliza({
      serverOnly: true,
      onEmbeddingProgress: (phase, detail) => {
        if (phase === "downloading") {
          console.log(`[milady] Embedding: ${detail ?? "downloading..."}`);
        } else if (phase === "ready") {
          console.log(`[milady] Embedding model ready`);
        }
      },
    });

    const port = process.env.MILADY_PORT || process.env.ELIZA_PORT || "2138";
    console.log("");
    console.log("╭──────────────────────────────────────────╮");
    console.log("│  Milady is running.                      │");
    console.log("│                                          │");
    console.log(`│  Connect at: http://localhost:${port.padEnd(13)}│`);
    console.log(`│  Connection key: ${connectionKey.slice(0, 20).padEnd(22)}│`);
    console.log("╰──────────────────────────────────────────╯");
    console.log("");
  });
}

export function registerStartCommand(program: Command) {
  const startCmd = program
    .command("start")
    .description("Start the elizaOS agent runtime")
    .option(
      "--connection-key <key>",
      "Set a specific connection key for remote access (auto-generated if not provided)",
    )
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/getting-started", "docs.eliza.ai/getting-started")}\n`,
    )
    .action(async (opts: { connectionKey?: string }) => {
      if (opts.connectionKey) {
        process.env.MILADY_API_TOKEN = opts.connectionKey;
        process.env.ELIZA_API_TOKEN = opts.connectionKey;
      }
      await startAction();
    });

  program
    .command("run")
    .description("Alias for start")
    .option(
      "--connection-key <key>",
      "Set a specific connection key for remote access",
    )
    .action(async (opts: { connectionKey?: string }) => {
      if (opts.connectionKey) {
        process.env.MILADY_API_TOKEN = opts.connectionKey;
        process.env.ELIZA_API_TOKEN = opts.connectionKey;
      }
      await startAction();
    });
}
