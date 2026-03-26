import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getStartupTraceConfig,
  recordStartupPhase,
  resetStartupTraceForTests,
  resolveDefaultStartupTraceFiles,
  resolveStartupTraceBootstrapFile,
  shouldUseDefaultStartupTraceFallback,
} from "../startup-trace";

function createTraceEnv(rootDir: string, sessionId: string): NodeJS.ProcessEnv {
  return {
    MILADY_STARTUP_SESSION_ID: sessionId,
    MILADY_STARTUP_STATE_FILE: path.join(rootDir, `${sessionId}.state.json`),
    MILADY_STARTUP_EVENTS_FILE: path.join(rootDir, `${sessionId}.events.jsonl`),
  };
}

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

describe("startup trace", () => {
  let tempDir: string;

  beforeEach(() => {
    resetStartupTraceForTests();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "milady-startup-trace-"));
  });

  afterEach(() => {
    resetStartupTraceForTests();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("atomically writes the latest state and appends JSONL events", () => {
    const env = createTraceEnv(tempDir, "session-a");

    const snapshot = recordStartupPhase(
      "main_start",
      {
        pid: 123,
        exec_path: "/Applications/Milady-canary.app/Contents/MacOS/launcher",
      },
      env,
    );

    expect(snapshot?.phase).toBe("main_start");
    const state = readJson(env.MILADY_STARTUP_STATE_FILE!);
    expect(state.session_id).toBe("session-a");
    expect(state.phase).toBe("main_start");
    expect(state.pid).toBe(123);
    expect(state.bundle_path).toBe("/Applications/Milady-canary.app");

    const events = fs
      .readFileSync(env.MILADY_STARTUP_EVENTS_FILE!, "utf8")
      .trim()
      .split("\n");
    expect(events).toHaveLength(1);
    expect(JSON.parse(events[0]).phase).toBe("main_start");

    const tempFiles = fs
      .readdirSync(tempDir)
      .filter((entry) => entry.includes(".tmp-"));
    expect(tempFiles).toHaveLength(0);
  });

  it("keeps state isolated per startup session", () => {
    const envA = createTraceEnv(tempDir, "session-a");
    const envB = createTraceEnv(tempDir, "session-b");

    recordStartupPhase("main_start", { pid: 111 }, envA);
    recordStartupPhase("main_start", { pid: 222 }, envB);
    recordStartupPhase("window_ready", { pid: 111 }, envA);

    expect(readJson(envA.MILADY_STARTUP_STATE_FILE!).phase).toBe("window_ready");
    expect(readJson(envA.MILADY_STARTUP_STATE_FILE!).pid).toBe(111);
    expect(readJson(envB.MILADY_STARTUP_STATE_FILE!).phase).toBe("main_start");
    expect(readJson(envB.MILADY_STARTUP_STATE_FILE!).pid).toBe(222);
  });

  it("overwrites the latest state when startup reaches fatal", () => {
    const env = createTraceEnv(tempDir, "session-fatal");

    recordStartupPhase("runtime_ready", { pid: 321, child_pid: 654, port: 31337 }, env);
    recordStartupPhase(
      "fatal",
      {
        pid: 321,
        child_pid: 654,
        port: 31337,
        error: "Child process exited unexpectedly with code 9",
        exit_code: 9,
      },
      env,
    );

    const state = readJson(env.MILADY_STARTUP_STATE_FILE!);
    expect(state.phase).toBe("fatal");
    expect(state.error).toBe("Child process exited unexpectedly with code 9");
    expect(state.exit_code).toBe(9);

    const events = fs
      .readFileSync(env.MILADY_STARTUP_EVENTS_FILE!, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    expect(events.map((event) => event.phase)).toEqual([
      "runtime_ready",
      "fatal",
    ]);
  });

  it("falls back to the session bootstrap file when wrapper env is stripped", () => {
    const homeDir = fs.mkdtempSync(path.join(tempDir, "home-"));
    const env = {
      HOME: homeDir,
    } as NodeJS.ProcessEnv;
    const bootstrapFile = resolveStartupTraceBootstrapFile(env, "darwin");
    const sessionId = "session-bootstrap";
    const stateFile = path.join(tempDir, `${sessionId}.state.json`);
    const eventsFile = path.join(tempDir, `${sessionId}.events.jsonl`);

    fs.mkdirSync(path.dirname(bootstrapFile), { recursive: true });
    fs.writeFileSync(
      bootstrapFile,
      `${JSON.stringify(
        {
          session_id: sessionId,
          state_file: stateFile,
          events_file: eventsFile,
          expires_at: new Date(Date.now() + 60_000).toISOString(),
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const config = getStartupTraceConfig(env);
    expect(config.enabled).toBe(true);
    expect(config.sessionId).toBe(sessionId);
    expect(config.stateFile).toBe(stateFile);
    expect(config.eventsFile).toBe(eventsFile);

    const snapshot = recordStartupPhase("main_start", { pid: 777 }, env);
    expect(snapshot?.session_id).toBe(sessionId);
    expect(readJson(stateFile).pid).toBe(777);
  });

  it("derives packaged fallback trace files under the Milady config directory", () => {
    const env = {
      HOME: path.join(tempDir, "fallback-home"),
    } as NodeJS.ProcessEnv;

    const files = resolveDefaultStartupTraceFiles(env, "darwin");
    expect(files.stateFile).toBe(
      path.join(env.HOME!, ".config", "Milady", "milady-startup-state.json"),
    );
    expect(files.eventsFile).toBe(
      path.join(env.HOME!, ".config", "Milady", "milady-startup-events.jsonl"),
    );
    expect(
      shouldUseDefaultStartupTraceFallback(
        "/Applications/Milady-canary.app/Contents/MacOS/launcher",
      ),
    ).toBe(true);
  });
});
