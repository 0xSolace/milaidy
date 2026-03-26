import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const STARTUP_TRACE_PHASES = [
  "main_start",
  "window_ready",
  "autostart_requested",
  "agent_start_entered",
  "port_selected",
  "runtime_path_resolved",
  "child_spawned",
  "health_ready",
  "runtime_ready",
  "metadata_ready",
  "fatal",
] as const;

export type StartupTracePhase = (typeof STARTUP_TRACE_PHASES)[number];

export type StartupTraceState = {
  session_id: string;
  phase: StartupTracePhase;
  pid: number | null;
  child_pid: number | null;
  port: number | null;
  exec_path: string | null;
  bundle_path: string | null;
  elapsed_ms: number;
  error: string | null;
  exit_code: number | null;
  updated_at: string;
};

type StartupTraceUpdate = Partial<
  Pick<
    StartupTraceState,
    | "pid"
    | "child_pid"
    | "port"
    | "exec_path"
    | "bundle_path"
    | "error"
    | "exit_code"
  >
>;

type StartupTraceConfig = {
  enabled: boolean;
  sessionId: string | null;
  stateFile: string | null;
  eventsFile: string | null;
  mirrorStateFile: string | null;
  mirrorEventsFile: string | null;
};

type StartupTraceBootstrap = {
  session_id?: string | null;
  state_file?: string | null;
  events_file?: string | null;
  expires_at?: string | null;
};

const sessionStartMs = new Map<string, number>();
const latestStateBySession = new Map<string, StartupTraceState>();
const STARTUP_TRACE_BOOTSTRAP_FILENAME = "startup-session.json";
const DEFAULT_STARTUP_STATE_FILENAME = "milady-startup-state.json";
const DEFAULT_STARTUP_EVENTS_FILENAME = "milady-startup-events.jsonl";
const enabledTraceSessionsLogged = new Set<string>();
let disabledTraceLogged = false;

function trimEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hasOwn<T extends object>(value: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function writeJsonAtomic(filePath: string, value: StartupTraceState): void {
  ensureParentDir(filePath);
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tempPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  fs.renameSync(tempPath, filePath);
}

function appendJsonLine(filePath: string, value: StartupTraceState): void {
  ensureParentDir(filePath);
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, "utf8");
}

function writeStartupTraceDebugLine(
  message: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  try {
    const logPath = path.join(
      resolveStartupTraceControlDir(env, process.platform),
      "milady-startup.log",
    );
    ensureParentDir(logPath);
    fs.appendFileSync(
      logPath,
      `[${new Date().toISOString()}] [StartupTrace] ${message}\n`,
      "utf8",
    );
  } catch {
    // Ignore debug log write failures; trace file writes are the real contract.
  }
}

export function resolveStartupBundlePath(
  execPath: string = process.execPath,
): string | null {
  const normalizedExecPath = execPath.replaceAll("\\", "/");
  const appBundleMatch = normalizedExecPath.match(/^(.*?\.app)(?:\/|$)/);
  if (appBundleMatch) {
    return execPath.slice(0, appBundleMatch[1].length);
  }

  const execDir = path.dirname(execPath);
  if (path.basename(execDir).toLowerCase() === "bin") {
    return path.dirname(execDir);
  }

  return null;
}

function resolveStartupTraceControlDir(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const homeDir =
    trimEnv(env.HOME) ??
    trimEnv(env.USERPROFILE) ??
    os.homedir();
  if (platform === "win32") {
    const appData =
      trimEnv(env.APPDATA) ??
      path.join(homeDir, "AppData", "Roaming");
    return path.join(appData, "Milady");
  }

  return path.join(homeDir, ".config", "Milady");
}

export function resolveStartupTraceBootstrapFile(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  return path.join(
    resolveStartupTraceControlDir(env, platform),
    STARTUP_TRACE_BOOTSTRAP_FILENAME,
  );
}

export function resolveDefaultStartupTraceFiles(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): { stateFile: string; eventsFile: string } {
  const controlDir = resolveStartupTraceControlDir(env, platform);
  return {
    stateFile: path.join(controlDir, DEFAULT_STARTUP_STATE_FILENAME),
    eventsFile: path.join(controlDir, DEFAULT_STARTUP_EVENTS_FILENAME),
  };
}

export function shouldUseDefaultStartupTraceFallback(
  execPath: string = process.execPath,
): boolean {
  const normalizedExecPath = execPath.replaceAll("\\", "/").toLowerCase();
  return (
    normalizedExecPath.includes(".app/contents/") ||
    normalizedExecPath.includes("/self-extraction/") ||
    normalizedExecPath.endsWith("/launcher") ||
    normalizedExecPath.endsWith("/launcher.exe")
  );
}

function readStartupTraceBootstrap(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): StartupTraceBootstrap | null {
  const bootstrapFile = resolveStartupTraceBootstrapFile(env, platform);
  if (!fs.existsSync(bootstrapFile)) {
    return null;
  }

  try {
    const bootstrap = JSON.parse(
      fs.readFileSync(bootstrapFile, "utf8"),
    ) as StartupTraceBootstrap;
    const expiresAt = trimEnv(bootstrap.expires_at ?? undefined);
    if (expiresAt) {
      const expiresAtMs = Date.parse(expiresAt);
      if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
        return null;
      }
    }
    return bootstrap;
  } catch {
    return null;
  }
}

export function getStartupTraceConfig(
  env: NodeJS.ProcessEnv = process.env,
): StartupTraceConfig {
  const bootstrap = readStartupTraceBootstrap(env);
  const defaultTraceFiles = resolveDefaultStartupTraceFiles(env);
  const useDefaultFallback = shouldUseDefaultStartupTraceFallback();
  const sessionId =
    trimEnv(env.MILADY_STARTUP_SESSION_ID) ??
    trimEnv(bootstrap?.session_id ?? undefined) ??
    (useDefaultFallback ? `startup-${process.pid}` : null);
  const stateFile =
    trimEnv(env.MILADY_STARTUP_STATE_FILE) ??
    trimEnv(bootstrap?.state_file ?? undefined) ??
    (useDefaultFallback ? defaultTraceFiles.stateFile : null);
  const eventsFile =
    trimEnv(env.MILADY_STARTUP_EVENTS_FILE) ??
    trimEnv(bootstrap?.events_file ?? undefined) ??
    (useDefaultFallback ? defaultTraceFiles.eventsFile : null);
  return {
    enabled: Boolean(sessionId && (stateFile || eventsFile)),
    sessionId,
    stateFile,
    eventsFile,
    mirrorStateFile:
      useDefaultFallback && defaultTraceFiles.stateFile !== stateFile
        ? defaultTraceFiles.stateFile
        : null,
    mirrorEventsFile:
      useDefaultFallback && defaultTraceFiles.eventsFile !== eventsFile
        ? defaultTraceFiles.eventsFile
        : null,
  };
}

export function recordStartupPhase(
  phase: StartupTracePhase,
  update: StartupTraceUpdate = {},
  env: NodeJS.ProcessEnv = process.env,
): StartupTraceState | null {
  const config = getStartupTraceConfig(env);
  if (!config.enabled || !config.sessionId) {
    if (!disabledTraceLogged) {
      const bootstrapFile = resolveStartupTraceBootstrapFile(env);
      disabledTraceLogged = true;
      writeStartupTraceDebugLine(
        `disabled session=${config.sessionId ?? "<none>"} ` +
          `state=${config.stateFile ?? "<none>"} ` +
          `events=${config.eventsFile ?? "<none>"} ` +
          `mirrorState=${config.mirrorStateFile ?? "<none>"} ` +
          `mirrorEvents=${config.mirrorEventsFile ?? "<none>"} ` +
          `bootstrap=${bootstrapFile} exists=${fs.existsSync(bootstrapFile)} ` +
          `execPath=${process.execPath}`,
        env,
      );
    }
    return null;
  }

  if (!enabledTraceSessionsLogged.has(config.sessionId)) {
    enabledTraceSessionsLogged.add(config.sessionId);
    writeStartupTraceDebugLine(
      `enabled session=${config.sessionId} ` +
        `state=${config.stateFile ?? "<none>"} ` +
        `events=${config.eventsFile ?? "<none>"} ` +
        `mirrorState=${config.mirrorStateFile ?? "<none>"} ` +
        `mirrorEvents=${config.mirrorEventsFile ?? "<none>"} ` +
        `execPath=${process.execPath}`,
      env,
    );
  }

  const now = Date.now();
  if (!sessionStartMs.has(config.sessionId)) {
    sessionStartMs.set(config.sessionId, now);
  }
  const startedAt = sessionStartMs.get(config.sessionId) ?? now;
  const previous = latestStateBySession.get(config.sessionId);
  const execPath =
    hasOwn(update, "exec_path") && update.exec_path !== undefined
      ? update.exec_path
      : previous?.exec_path ?? process.execPath ?? null;
  const nextState: StartupTraceState = {
    session_id: config.sessionId,
    phase,
    pid:
      hasOwn(update, "pid") && update.pid !== undefined
        ? update.pid
        : previous?.pid ?? process.pid,
    child_pid:
      hasOwn(update, "child_pid") && update.child_pid !== undefined
        ? update.child_pid
        : previous?.child_pid ?? null,
    port:
      hasOwn(update, "port") && update.port !== undefined
        ? update.port
        : previous?.port ?? null,
    exec_path: execPath,
    bundle_path:
      hasOwn(update, "bundle_path") && update.bundle_path !== undefined
        ? update.bundle_path
        : previous?.bundle_path ?? resolveStartupBundlePath(execPath ?? ""),
    elapsed_ms: now - startedAt,
    error:
      hasOwn(update, "error") && update.error !== undefined
        ? update.error
        : null,
    exit_code:
      hasOwn(update, "exit_code") && update.exit_code !== undefined
        ? update.exit_code
        : null,
    updated_at: new Date(now).toISOString(),
  };

  latestStateBySession.set(config.sessionId, nextState);

  if (config.stateFile) {
    writeJsonAtomic(config.stateFile, nextState);
  }
  if (config.eventsFile) {
    appendJsonLine(config.eventsFile, nextState);
  }
  if (config.mirrorStateFile) {
    writeJsonAtomic(config.mirrorStateFile, nextState);
  }
  if (config.mirrorEventsFile) {
    appendJsonLine(config.mirrorEventsFile, nextState);
  }

  return nextState;
}

export function resetStartupTraceForTests(): void {
  sessionStartMs.clear();
  latestStateBySession.clear();
  enabledTraceSessionsLogged.clear();
  disabledTraceLogged = false;
}
