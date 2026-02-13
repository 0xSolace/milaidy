import type http from "node:http";

/**
 * Test helper utilities shared across unit tests.
 */

const OPTIONAL_IMPORT_ERROR_MARKERS = [
  "Cannot find module",
  "Cannot find package",
  "ERR_MODULE_NOT_FOUND",
  "MODULE_NOT_FOUND",
  "Dynamic require of",
  "native addon module",
  "Failed to resolve entry",
  "tfjs_binding",
  "NAPI_MODULE_NOT_FOUND",
  "spec not found",
];

/** Standardized test result for mocked updater checks. */
export type MockUpdateCheckResult = {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  channel: string;
  distTag: string;
  cached: boolean;
  error: string | null;
};

/** Snapshot and restore the configured environment variables around a test. */
export function createEnvSandbox(keys: readonly string[]) {
  const backup: Record<string, string | undefined> = {};

  function clear(): void {
    for (const key of keys) {
      backup[key] = process.env[key];
      delete process.env[key];
    }
  }

  function restore(): void {
    for (const key of keys) {
      if (backup[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = backup[key];
      }
    }
  }

  return { clear, restore };
}

/** Build a mock update check result with deterministic defaults. */
export function buildMockUpdateCheckResult(
  overrides: Partial<MockUpdateCheckResult> = {},
): MockUpdateCheckResult {
  return {
    updateAvailable: false,
    currentVersion: "2.0.0",
    latestVersion: "2.0.0",
    channel: "stable",
    distTag: "latest",
    cached: false,
    error: null,
    ...overrides,
  };
}

/** Small utility to wait for asynchronous side-effects in tests. */
export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type MockResponsePayload<T> = {
  res: http.ServerResponse;
  getStatus: () => number;
  getJson: () => T;
};

type ModelRegistrationCapture = {
  calls: Array<{
    modelType: string;
    provider: string;
    priority: number;
    handler: unknown;
  }>;
  getLargeHandler: () => unknown | null;
  runtime: {
    registerModel: (
      modelType: string,
      handler: unknown,
      provider: string,
      priority?: number,
    ) => void;
  };
};

/** Create a lightweight mocked HTTP response used by handler tests. */
export function createMockHttpResponse<T = unknown>(): MockResponsePayload<T> {
  let statusCode = 200;
  let payload = "";

  const res = {
    set statusCode(value: number) {
      statusCode = value;
    },
    get statusCode() {
      return statusCode;
    },
    setHeader: () => undefined,
    end: (chunk?: string | Buffer) => {
      payload = chunk ? chunk.toString() : "";
    },
  } as unknown as http.ServerResponse;

  return {
    res,
    getStatus: () => statusCode,
    getJson: () => (payload ? (JSON.parse(payload) as T) : (null as T)),
  };
}

/** Return true when optional plugin imports are intentionally unavailable in this env. */
export function isOptionalImportError(
  error: unknown,
  extraMarkers: readonly string[] = [],
): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return OPTIONAL_IMPORT_ERROR_MARKERS.concat(extraMarkers).some((marker) =>
    message.includes(marker),
  );
}

/** Safely import optional plugin modules while allowing hard failures to bubble. */
export async function tryOptionalDynamicImport<T>(
  moduleName: string,
  markers?: readonly string[],
): Promise<T | null> {
  try {
    return (await import(moduleName)) as T;
  } catch (error) {
    if (isOptionalImportError(error, markers)) return null;
    throw error;
  }
}

/** Shared helper to capture handlers registered by runtime schema handlers. */
export function createModelRegistrationContext(): ModelRegistrationCapture {
  const calls: ModelRegistrationCapture["calls"] = [];

  const runtime = {
    registerModel: (
      modelType: string,
      handler: unknown,
      provider: string,
      priority?: number,
    ) => {
      calls.push({
        modelType,
        handler,
        provider,
        priority: priority ?? 0,
      });
    },
  };

  const getLargeHandler = (): unknown => {
    const entry = calls.find(
      (value) => value.modelType === "TEXT_LARGE" && value.provider === "pi-ai",
    );
    return entry ? entry.handler : null;
  };

  return { calls, getLargeHandler: () => getLargeHandler(), runtime };
}
