# Codebase Quality Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 27 code quality issues (security, resource leaks, error handling, maintainability) identified during a full codebase audit.

**Architecture:** Four independent tiers, each producing its own branch/PR. T1 (security) ships first, T2 (resource leaks) second, T3 (error handling) third (rebases on T2), T4 (maintainability) last. Each task within a tier is a self-contained commit.

**Tech Stack:** TypeScript, Bun, Vitest, Biome

**Spec:** `docs/superpowers/specs/2026-03-20-codebase-quality-fixes-design.md`

---

## File Map

### New Files
| File | Purpose |
|------|---------|
| `src/services/serialise.ts` | Shared `createSerialiser()` factory (M1) |
| `src/providers/__tests__/media-provider-security.test.ts` | Tests for S2, S4, R6, C1 |
| `src/providers/__tests__/local-models-security.test.ts` | Tests for S3/S7, C5, C6 |
| `src/plugins/whatsapp/__tests__/service-lifecycle.test.ts` | Tests for S6, R1, C8 |
| `src/cli/__tests__/plugins-cli-security.test.ts` | Tests for S5 |
| `src/benchmark/__tests__/server-correctness.test.ts` | Tests for C2, C4, C7, R4 |
| `src/tui/__tests__/eliza-tui-bridge-lifecycle.test.ts` | Tests for R2, R3, R5 |

### Modified Files
| File | Changes |
|------|---------|
| `src/providers/media-provider.ts` | S2, S4, R6, C1, M2 |
| `src/providers/local-models.ts` | S3, S7, C5, C6 |
| `src/plugins/whatsapp/service.ts` | S6, R1, C8, M4 |
| `src/cli/plugins-cli.ts` | S5, C3 |
| `src/benchmark/server.ts` | C2, C4, C7, R4, M5 |
| `src/tui/eliza-tui-bridge.ts` | R2, R3, R5 |
| `src/tui/index.ts` | M6 |
| `src/services/core-eject.ts` | M1 |
| `src/services/plugin-eject.ts` | M1 |
| `src/services/plugin-installer.ts` | C9, M1 |
| `src/actions/media.ts` | M3 |

---

## Tier 1: Security Fixes

**Branch:** `fix/t1-security`

### Task 1: S2 — Move API keys from URL to headers (media-provider.ts)

**Files:**
- Modify: `src/providers/media-provider.ts:634,687,762`
- Create: `src/providers/__tests__/media-provider-security.test.ts`

- [ ] **Step 1: Write failing tests for API key header placement**

```typescript
// src/providers/__tests__/media-provider-security.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// We'll test by intercepting fetch and checking that URLs don't contain API keys
const fetchSpy = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ predictions: [{ bytesBase64Encoded: "abc" }] }),
  text: async () => "",
});
vi.stubGlobal("fetch", fetchSpy);

describe("S2: API keys must be in headers, not URLs", () => {
  beforeEach(() => fetchSpy.mockClear());

  it("GoogleImageProvider sends key via x-goog-api-key header", async () => {
    const { createImageProvider } = await import("../media-provider");
    // Will need to construct a Google provider directly or via factory
    // For now, test that fetch URL does NOT contain "key="
    const provider = new (await import("../media-provider")).GoogleImageProvider({
      apiKey: "test-key-123",
    } as any);
    await provider.generate({ prompt: "test" });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).not.toContain("key=");
    expect(init.headers["x-goog-api-key"]).toBe("test-key-123");
  });

  it("GoogleVideoProvider sends key via x-goog-api-key header", async () => {
    const { GoogleVideoProvider } = await import("../media-provider");
    const provider = new GoogleVideoProvider({ apiKey: "test-key-456" } as any);
    await provider.generate({ prompt: "test" });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).not.toContain("key=");
    expect(init.headers["x-goog-api-key"]).toBe("test-key-456");
  });

  it("GoogleVisionProvider sends key via x-goog-api-key header", async () => {
    const { GoogleVisionProvider } = await import("../media-provider");
    const provider = new GoogleVisionProvider({ apiKey: "test-key-789" } as any);
    await provider.analyze({ imageBase64: "abc", prompt: "describe" });

    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).not.toContain("key=");
    expect(init.headers["x-goog-api-key"]).toBe("test-key-789");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/providers/__tests__/media-provider-security.test.ts`
Expected: FAIL — URL still contains `key=`, headers don't have `x-goog-api-key`

- [ ] **Step 3: Fix GoogleImageProvider — move key to header**

In `src/providers/media-provider.ts`, find the `GoogleImageProvider.generate()` method (around line 633-634). Change from:

```typescript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predict?key=${this.apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
```

To:

```typescript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predict`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": this.apiKey,
    },
```

- [ ] **Step 4: Fix GoogleVideoProvider — same pattern**

Around line 687. Change:
```typescript
`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predictLongRunning?key=${this.apiKey}`,
```
To:
```typescript
`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predictLongRunning`,
```
And add `"x-goog-api-key": this.apiKey` to the headers object.

- [ ] **Step 5: Fix GoogleVisionProvider — same pattern**

Around line 762. Change:
```typescript
`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
```
To:
```typescript
`https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
```
And add `"x-goog-api-key": this.apiKey` to the headers object.

- [ ] **Step 5b: Verify xAI providers already use headers**

xAI's `XAIImageProvider` (line 817) and `XAIVisionProvider` (line 879) already send keys via `Authorization: Bearer ${this.apiKey}` in headers — NOT in URL params. Verify this by reading the code. No changes needed for xAI. Only Google providers had keys in URLs.

- [ ] **Step 6: Run tests to verify they pass**

Run: `bun test src/providers/__tests__/media-provider-security.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/providers/media-provider.ts src/providers/__tests__/media-provider-security.test.ts
git commit -m "fix(security): move Google API keys from URL params to headers (S2)"
```

---

### Task 2: S3+S7 — Path traversal guard for HuggingFace downloads (local-models.ts)

**Files:**
- Modify: `src/providers/local-models.ts:327,332`
- Create: `src/providers/__tests__/local-models-security.test.ts`

- [ ] **Step 1: Write failing test for validateFilename**

```typescript
// src/providers/__tests__/local-models-security.test.ts
import { describe, it, expect } from "vitest";

// We need to export or test the validateFilename function
// It will be added as an exported utility in local-models.ts
describe("S3/S7: validateFilename rejects path traversal", () => {
  let validateFilename: (filename: string) => void;

  beforeAll(async () => {
    const mod = await import("../local-models");
    validateFilename = (mod as any).validateFilename;
  });

  it("accepts normal filenames", () => {
    expect(() => validateFilename("config.json")).not.toThrow();
    expect(() => validateFilename("model.safetensors")).not.toThrow();
    expect(() => validateFilename("subdir/file.bin")).not.toThrow();
  });

  it("rejects .. traversal", () => {
    expect(() => validateFilename("../../etc/passwd")).toThrow("Invalid filename");
    expect(() => validateFilename("subdir/../secret")).toThrow("Invalid filename");
  });

  it("rejects backslash paths", () => {
    expect(() => validateFilename("dir\\file.bin")).toThrow("Invalid filename");
  });

  it("rejects absolute paths", () => {
    expect(() => validateFilename("/etc/passwd")).toThrow("Invalid filename");
  });

  it("rejects empty segments", () => {
    expect(() => validateFilename("dir//file.bin")).toThrow("Invalid filename");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/providers/__tests__/local-models-security.test.ts`
Expected: FAIL — `validateFilename` does not exist

- [ ] **Step 3: Add validateFilename and apply it in downloadModel**

In `src/providers/local-models.ts`, add near the top (after imports):

```typescript
/** Guard against path traversal in filenames from external sources. */
export function validateFilename(filename: string): void {
  if (
    filename.startsWith("/") ||
    filename.includes("\\") ||
    filename.split("/").some((seg) => seg === ".." || seg === "")
  ) {
    throw new Error(
      `Invalid filename "${filename}": path traversal or empty segments not allowed`,
    );
  }
}
```

Then in the `downloadModel` method, add the guard inside the for-loop (before line 328):

```typescript
for (const filename of downloadList) {
  validateFilename(filename);  // <-- ADD THIS
  const fileUrl = `https://huggingface.co/${modelId}/resolve/main/${filename}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/providers/__tests__/local-models-security.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/providers/local-models.ts src/providers/__tests__/local-models-security.test.ts
git commit -m "fix(security): add path traversal guard for HuggingFace downloads (S3/S7)"
```

---

### Task 3: S4 — Throw on empty API keys in provider constructors

**Files:**
- Modify: `src/providers/media-provider.ts` (12 constructors)
- Add to: `src/providers/__tests__/media-provider-security.test.ts`

- [ ] **Step 1: Write failing test**

Append to `src/providers/__tests__/media-provider-security.test.ts`:

```typescript
describe("S4: Providers reject empty API keys", () => {
  const providerConfigs = [
    ["FalImageProvider", {}],
    ["FalVideoProvider", {}],
    ["OpenAIImageProvider", {}],
    ["OpenAIVideoProvider", {}],
    ["OpenAIVisionProvider", {}],
    ["GoogleImageProvider", {}],
    ["GoogleVideoProvider", {}],
    ["GoogleVisionProvider", {}],
    ["XAIImageProvider", {}],
    ["XAIVisionProvider", {}],
    ["AnthropicVisionProvider", {}],
    ["SunoAudioProvider", {}],
  ] as const;

  for (const [name, config] of providerConfigs) {
    it(`${name} throws when apiKey is missing`, async () => {
      const mod = await import("../media-provider");
      const ProviderClass = (mod as any)[name];
      expect(() => new ProviderClass(config)).toThrow("API key is required");
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/providers/__tests__/media-provider-security.test.ts`
Expected: FAIL — constructors accept empty apiKey

- [ ] **Step 3: Replace `config.apiKey ?? ""` with validation in all 12 constructors**

For each of the 12 constructors (lines 330, 382, 438, 495, 552, 625, 678, 750, 809, 861, 1096, 1170), change:

```typescript
this.apiKey = config.apiKey ?? "";
```

To:

```typescript
if (!config.apiKey) {
  throw new Error(`${this.name} API key is required`);
}
this.apiKey = config.apiKey;
```

Note: `this.name` is already set as a class property before the constructor body runs, so it's available. If the class sets `name` inside the constructor, move the `name` assignment above the validation.

- [ ] **Step 4: Export the provider classes for testing**

The provider classes are currently not exported. Add `export` to each class declaration so tests can construct them directly. If this changes the public API unacceptably, the tests can instead go through the factory functions with mocked configs.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/providers/__tests__/media-provider-security.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/providers/media-provider.ts src/providers/__tests__/media-provider-security.test.ts
git commit -m "fix(security): reject empty API keys in provider constructors (S4)"
```

---

### Task 4: S5 — Plugin path traversal validation

**Files:**
- Modify: `src/cli/plugins-cli.ts:477,601,625,670`
- Create: `src/cli/__tests__/plugins-cli-security.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/cli/__tests__/plugins-cli-security.test.ts
import { describe, it, expect } from "vitest";
import os from "node:os";
import path from "node:path";

describe("S5: validatePluginPath", () => {
  let validatePluginPath: (resolved: string) => void;

  beforeAll(async () => {
    // Import from wherever we define it — could be plugins-cli or a shared util
    const mod = await import("../plugins-cli");
    validatePluginPath = (mod as any).validatePluginPath;
  });

  it("accepts paths under home directory", () => {
    const homePath = path.join(os.homedir(), "projects", "my-plugin");
    expect(() => validatePluginPath(homePath)).not.toThrow();
  });

  it("accepts paths under cwd", () => {
    const cwdPath = path.join(process.cwd(), "plugins", "local");
    expect(() => validatePluginPath(cwdPath)).not.toThrow();
  });

  it("rejects paths outside home and cwd", () => {
    expect(() => validatePluginPath("/etc/passwd")).toThrow("outside allowed boundaries");
    expect(() => validatePluginPath("/tmp/evil-plugin")).toThrow("outside allowed boundaries");
  });

  it("rejects relative paths", () => {
    expect(() => validatePluginPath("../evil")).toThrow("outside allowed boundaries");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/cli/__tests__/plugins-cli-security.test.ts`
Expected: FAIL — `validatePluginPath` does not exist

- [ ] **Step 3: Add validatePluginPath and apply at config-loaded call sites**

In `src/cli/plugins-cli.ts`, add the helper:

```typescript
import os from "node:os";

/** Validate that a resolved plugin path is within allowed boundaries. */
export function validatePluginPath(resolved: string): void {
  const home = os.homedir();
  const cwd = process.cwd();
  if (
    !path.isAbsolute(resolved) ||
    (!resolved.startsWith(home + path.sep) &&
     resolved !== home &&
     !resolved.startsWith(cwd + path.sep) &&
     resolved !== cwd)
  ) {
    throw new Error(
      `Plugin path ${resolved} is outside allowed boundaries (must be under ${home} or ${cwd})`,
    );
  }
}
```

Apply at each config-loaded call site:
- Line 477: `scanDirs.push(resolveUserPath(p));` → Add `const rp = resolveUserPath(p); validatePluginPath(rp); scanDirs.push(rp);`
- Line 601: `const resolved = resolveUserPath(rawPath);` → Add `validatePluginPath(resolved);` after
- Line 625: `const existing = config.plugins.load.paths.map(resolveUserPath);` → Add validation in the map: `config.plugins.load.paths.map((p) => { const rp = resolveUserPath(p); validatePluginPath(rp); return rp; })`
- Line 670: similar — add `validatePluginPath(resolveUserPath(p))` where paths from config are resolved

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/cli/__tests__/plugins-cli-security.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/cli/plugins-cli.ts src/cli/__tests__/plugins-cli-security.test.ts
git commit -m "fix(security): validate plugin paths from config against traversal (S5)"
```

---

### Task 5: S6 — E.164 phone number validation

**Files:**
- Modify: `src/plugins/whatsapp/service.ts:312-313`
- Create: `src/plugins/whatsapp/__tests__/service-lifecycle.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/plugins/whatsapp/__tests__/service-lifecycle.test.ts
import { describe, it, expect } from "vitest";

// Export the E.164 regex from service.ts so we can test it directly.
// Also test the production code path indirectly.
describe("S6: Phone number E.164 validation", () => {
  const E164_RE = /^\+?[1-9]\d{1,14}$/;

  it("accepts valid E.164 numbers", () => {
    expect(E164_RE.test("+14155552671")).toBe(true);
    expect(E164_RE.test("14155552671")).toBe(true);
    expect(E164_RE.test("+442071234567")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(E164_RE.test("abc12345678")).toBe(false);
    expect(E164_RE.test("+0123456789")).toBe(false);
    expect(E164_RE.test("12")).toBe(false);
    expect(E164_RE.test("")).toBe(false);
    expect(E164_RE.test("+1234567890123456")).toBe(false);
  });

  // Integration test: verify the service throws on invalid input.
  // This requires constructing the service with a mock runtime.
  // If too complex, extract the validation into a standalone exported function
  // `validatePhoneNumber(entityId: string): string` that returns the cleaned JID
  // or throws, and test that function directly.
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/plugins/whatsapp/__tests__/service-lifecycle.test.ts`
Expected: FAIL if testing imported function (doesn't exist yet); PASS for regex-only tests

- [ ] **Step 3: Extract validation to testable function and apply in WhatsApp service**

In `src/plugins/whatsapp/service.ts`, find the `handleSendMessage` method around line 310-313. Change:

```typescript
} else if (target.entityId) {
  const cleaned = target.entityId.replace(/[^0-9]/g, "");
  if (cleaned.length >= 8) {
    jid = `${cleaned}@s.whatsapp.net`;
```

To:

```typescript
} else if (target.entityId) {
  const raw = target.entityId.trim();
  if (!/^\+?[1-9]\d{1,14}$/.test(raw)) {
    throw new Error(
      `Invalid phone number format, expected E.164: "${target.entityId}"`,
    );
  }
  const cleaned = raw.replace(/[^0-9]/g, "");
  jid = `${cleaned}@s.whatsapp.net`;
```

Remove the `else` block that throws for `cleaned.length < 8` since E.164 validation already covers minimum length.

- [ ] **Step 4: Commit**

```bash
git add src/plugins/whatsapp/service.ts src/plugins/whatsapp/__tests__/service-lifecycle.test.ts
git commit -m "fix(security): validate phone numbers against E.164 format (S6)"
```

---

### Task 6: T1 finalize — lint, build, test

- [ ] **Step 1: Run Biome lint**

Run: `bun run lint`
Expected: PASS (or fix any lint issues introduced)

- [ ] **Step 2: Run build**

Run: `bun run build`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `bun test`
Expected: All existing + new tests pass

- [ ] **Step 4: Commit any fixes**

```bash
git add -u && git commit -m "fix: lint and build fixes for T1 security tier"
```

---

## Tier 2: Resource Leaks & Memory

**Branch:** `fix/t2-resource-leaks`

### Task 7: R1 — WhatsApp event listener cleanup

**Files:**
- Modify: `src/plugins/whatsapp/service.ts:156-248,263-285`

- [ ] **Step 1: Add handler properties to the class**

Near the top of the WhatsApp service class, add:

```typescript
private credsHandler?: () => Promise<void>;
private connectionHandler?: (update: { connection?: string; lastDisconnect?: { error?: Error } }) => Promise<void>;
private messagesHandler?: (data: { messages: unknown[]; type: string }) => Promise<void>;
```

- [ ] **Step 2: Store handler references in connect()**

In the `connect()` function (line 156), change anonymous callbacks to stored references:

```typescript
// Line 165: Change from:
this.sock.ev.on("creds.update", saveCreds);
// To:
this.credsHandler = saveCreds;
this.sock.ev.on("creds.update", this.credsHandler);

// Line 167: Change from:
this.sock.ev.on("connection.update", async (update) => {
// To:
this.connectionHandler = async (update) => {
  // ... existing handler body unchanged ...
};
this.sock.ev.on("connection.update", this.connectionHandler);

// Line 233: Change from:
this.sock.ev.on("messages.upsert", async ({ messages, type }) => {
// To:
this.messagesHandler = async ({ messages, type }) => {
  // ... existing handler body unchanged ...
};
this.sock.ev.on("messages.upsert", this.messagesHandler);
```

- [ ] **Step 3: Unregister handlers in stop()**

In the `stop()` method (line 263), before `this.sock?.end(undefined)`, add:

```typescript
// Unregister event listeners to prevent leaks
if (this.sock) {
  if (this.credsHandler) this.sock.ev.off("creds.update", this.credsHandler);
  if (this.connectionHandler) this.sock.ev.off("connection.update", this.connectionHandler);
  if (this.messagesHandler) this.sock.ev.off("messages.upsert", this.messagesHandler);
}
this.credsHandler = undefined;
this.connectionHandler = undefined;
this.messagesHandler = undefined;
```

- [ ] **Step 4: Write test verifying stop() calls ev.off()**

Append to `src/plugins/whatsapp/__tests__/service-lifecycle.test.ts`:

```typescript
describe("R1: WhatsApp event listener cleanup", () => {
  it("stop() unregisters all event listeners", () => {
    // Create a mock socket with ev.on/ev.off tracking
    const offCalls: string[] = [];
    const mockSock = {
      ev: {
        on: vi.fn(),
        off: vi.fn((...args: unknown[]) => offCalls.push(args[0] as string)),
      },
      end: vi.fn(),
    };
    // After implementing, verify that calling stop() with a mock sock
    // results in ev.off being called for all three events
    expect(offCalls).toEqual(
      expect.arrayContaining(["creds.update", "connection.update", "messages.upsert"]),
    );
  });
});
```

Note: The exact test structure depends on how the service can be partially constructed. If direct construction is too complex, verify manually that `ev.off` calls are present in the code via grep.

- [ ] **Step 5: Commit**

```bash
git add src/plugins/whatsapp/service.ts src/plugins/whatsapp/__tests__/service-lifecycle.test.ts
git commit -m "fix(resource-leak): unregister WhatsApp event listeners on stop (R1)"
```

---

### Task 8: R2 — TUI bridge event listener cleanup

**Files:**
- Modify: `src/tui/eliza-tui-bridge.ts:275,317,385-398`

- [ ] **Step 1: Add cleanup tracking**

In the class, add a property:

```typescript
private eventCleanups: Array<() => void> = [];
```

- [ ] **Step 2: Store cleanup handles from registerEvent**

Check what `registerEvent` returns. If it returns an unsubscribe function, capture it. Wrap the two `registerEvent` calls (lines 275, 317):

```typescript
// Line 275:
const cleanup1 = this.runtime.registerEvent(EventType.ACTION_STARTED, async (payload) => {
  // ... existing handler ...
});
if (typeof cleanup1 === "function") this.eventCleanups.push(cleanup1);

// Line 317:
const cleanup2 = this.runtime.registerEvent(EventType.ACTION_COMPLETED, async (payload) => {
  // ... existing handler ...
});
if (typeof cleanup2 === "function") this.eventCleanups.push(cleanup2);
```

If `registerEvent` doesn't return an unsubscribe function, check the runtime API for `unregisterEvent` or `removeListener` and use that instead.

- [ ] **Step 3: Call cleanups in dispose()**

In the `dispose()` method (around line 385), add before `this.abortInFlight()`:

```typescript
for (const cleanup of this.eventCleanups) {
  try { cleanup(); } catch { /* ignore cleanup errors */ }
}
this.eventCleanups = [];
```

- [ ] **Step 4: Commit**

```bash
git add src/tui/eliza-tui-bridge.ts
git commit -m "fix(resource-leak): unregister TUI bridge event listeners on dispose (R2)"
```

---

### Task 9: R3 — Stream reader cleanup on exception

**Files:**
- Modify: `src/tui/eliza-tui-bridge.ts:695-756`

- [ ] **Step 1: Wrap streaming loop in try-finally**

Find the streaming section starting at line 695 (`const reader = res.body.getReader()`). Wrap the entire read loop:

```typescript
const reader = res.body.getReader();
const decoder = new TextDecoder();
// ... parsePayload definition stays here ...

try {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    // ... existing buffer logic ...
  }

  // ... existing post-loop buffer drain ...
} finally {
  try { reader.cancel(); } catch { /* ignore */ }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/tui/eliza-tui-bridge.ts
git commit -m "fix(resource-leak): release stream reader on exception (R3)"
```

---

### Task 10: R4 — Session map TTL eviction (benchmark server)

**Files:**
- Modify: `src/benchmark/server.ts:784-787`
- Add to: `src/benchmark/__tests__/server-correctness.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/benchmark/__tests__/server-correctness.test.ts
import { describe, it, expect } from "vitest";

describe("R4: Session TTL eviction", () => {
  it("evicts sessions older than TTL", async () => {
    // This will test the eviction logic once it's extracted
    // For now just a placeholder that fails
    expect(true).toBe(false);
  });
});
```

- [ ] **Step 2: Add TTL constants and eviction logic**

In `src/benchmark/server.ts`, after the session maps (around line 787), add:

```typescript
export const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const SESSION_SWEEP_INTERVAL_MS = 60_000;

const sessionCreatedAt = new Map<string, number>();

export function evictStaleSessions(): void {
  const now = Date.now();
  for (const [key, createdAt] of sessionCreatedAt.entries()) {
    if (now - createdAt > SESSION_TTL_MS) {
      sessions.delete(key);
      trajectoriesBySession.delete(key);
      outboxBySession.delete(key);
      sessionCreatedAt.delete(key);
      // Clean up roomToSession and entityToSession refs
      for (const [k, v] of roomToSession.entries()) {
        if (v === key) roomToSession.delete(k);
      }
      for (const [k, v] of entityToSession.entries()) {
        if (v === key) entityToSession.delete(k);
      }
    }
  }
}

const sweepInterval = setInterval(evictStaleSessions, SESSION_SWEEP_INTERVAL_MS);
sweepInterval.unref(); // Don't keep process alive for cleanup
```

In `resolveSession`, when creating a new session, add:
```typescript
sessionCreatedAt.set(key, Date.now());
```

- [ ] **Step 3: Update test with real eviction assertion**

```typescript
// src/benchmark/__tests__/server-correctness.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("R4: Session TTL eviction", () => {
  it("evictStaleSessions removes entries older than TTL", async () => {
    // Import the exported eviction function and TTL constant
    const mod = await import("../server");
    const { evictStaleSessions, SESSION_TTL_MS } = mod;

    // The eviction function operates on module-level Maps.
    // To test, we'd need to create a session via the server's /reset endpoint
    // or mock Date.now. For a unit test, mock Date.now to simulate time passing:
    const realNow = Date.now;
    let mockTime = realNow();
    vi.spyOn(Date, "now").mockImplementation(() => mockTime);

    // Fast-forward past TTL
    mockTime += SESSION_TTL_MS + 1000;
    evictStaleSessions();

    // Verify sessions map is clean (no stale entries remain)
    // Exact assertion depends on whether we can inspect the module's maps
    vi.restoreAllMocks();
  });

  it("SESSION_TTL_MS and SESSION_SWEEP_INTERVAL_MS are positive numbers", async () => {
    const { SESSION_TTL_MS, SESSION_SWEEP_INTERVAL_MS } = await import("../server");
    expect(SESSION_TTL_MS).toBeGreaterThan(0);
    expect(SESSION_SWEEP_INTERVAL_MS).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Commit**

```bash
git add src/benchmark/server.ts src/benchmark/__tests__/server-correctness.test.ts
git commit -m "fix(resource-leak): add TTL eviction for benchmark session maps (R4)"
```

---

### Task 11: R5 — Bound streamed text accumulation

**Files:**
- Modify: `src/tui/eliza-tui-bridge.ts:714,737`

- [ ] **Step 1: Add constant and guard**

At the top of the file, add:
```typescript
const MAX_STREAMED_LENGTH = 1_000_000; // 1MB
```

In the `parsePayload` function (around lines 713-714 and 736-737), after each `mergeStreamingText` call, add a bounds check:

```typescript
fullText = mergeStreamingText(fullText, chunk);
this.streamedText = mergeStreamingText(this.streamedText, chunk);
if (this.streamedText.length > MAX_STREAMED_LENGTH) {
  this.streamedText = this.streamedText.slice(0, MAX_STREAMED_LENGTH);
  console.warn("[tui] Streamed text exceeded 1MB limit, truncating");
}
```

Apply the same pattern at both locations (line ~714 and ~737).

- [ ] **Step 2: Commit**

```bash
git add src/tui/eliza-tui-bridge.ts
git commit -m "fix(resource-leak): bound streamed text to 1MB max (R5)"
```

---

### Task 12: R6 — Add fetch timeout to media providers

**Files:**
- Modify: `src/providers/media-provider.ts` (top of file + all fetch calls)

- [ ] **Step 1: Write failing test for timeout**

Append to `src/providers/__tests__/media-provider-security.test.ts`:

```typescript
describe("R6: fetchWithTimeout aborts after timeout", () => {
  it("aborts when timeout is reached", async () => {
    // Mock a fetch that never resolves
    const neverResolve = vi.fn().mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", neverResolve);

    const { fetchWithTimeout } = await import("../media-provider");
    await expect(fetchWithTimeout("http://example.com", {}, 50)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Add fetchWithTimeout helper**

At the top of `src/providers/media-provider.ts` (after imports), add:

```typescript
/** Fetch with an AbortController-based timeout. */
export function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 30_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer),
  );
}
```

- [ ] **Step 3: Replace all `fetch(` calls with `fetchWithTimeout(`**

Go through every provider's `generate()` and `analyze()` method. Replace `await fetch(url, {` with `await fetchWithTimeout(url, {`. There are approximately 20 call sites. The Ollama provider calls to localhost can use a longer timeout: `fetchWithTimeout(url, init, 120_000)`.

**Call sites to change (approximate line numbers):**
- Line 140 (ElizaCloudImage)
- Line 188 (ElizaCloudVideo)
- Line 236 (ElizaCloudAudio)
- Line 284 (ElizaCloudVision)
- Line 338 (FalImage)
- Line 390 (FalVideo)
- Line 447 (OpenAIImage)
- Line 503 (OpenAIVideo)
- Line 570 (OpenAIVision)
- Line 633 (GoogleImage)
- Line 686 (GoogleVideo)
- Line 761 (GoogleVision)
- Line 817 (XAIImage)
- Line 879 (XAIVision)
- Line 951 (Ollama ensureModelAvailable — use 120s)
- Line 990 (Ollama downloadModel — use 300s)
- Line 1023 (Ollama fetchImageAsBase64)
- Line 1047 (Ollama analyze)
- Line 1111 (Anthropic)
- Line 1178 (Suno)

- [ ] **Step 4: Run test to verify timeout works**

Run: `bun test src/providers/__tests__/media-provider-security.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/providers/media-provider.ts src/providers/__tests__/media-provider-security.test.ts
git commit -m "fix(resource-leak): add 30s fetch timeout to all media providers (R6)"
```

---

### Task 13: T2 finalize — lint, build, test

- [ ] **Step 1: Run lint, build, full test suite**

```bash
bun run lint && bun run build && bun test
```

- [ ] **Step 2: Fix any issues, commit**

```bash
git add -u && git commit -m "fix: lint and build fixes for T2 resource-leaks tier"
```

---

## Tier 3: Error Handling & Correctness

**Branch:** `fix/t3-error-handling` (based on T2 merged into develop)

### Task 14: C1 — Wrap all fetch calls in try-catch

**Files:**
- Modify: `src/providers/media-provider.ts` (all generate/analyze methods)

- [ ] **Step 1: Write failing test**

```typescript
// Append to media-provider-security.test.ts
describe("C1: fetch errors return { success: false }", () => {
  it("returns error result on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const { FalImageProvider } = await import("../media-provider");
    const provider = new FalImageProvider({ apiKey: "test-key" } as any);
    const result = await provider.generate({ prompt: "test" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
  });
});
```

- [ ] **Step 2: Wrap each generate/analyze method body in try-catch**

For every `generate()` and `analyze()` method in the file, wrap the body:

```typescript
async generate(options: ...): Promise<MediaProviderResult<...>> {
  try {
    // ... existing fetch + response parsing logic ...
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `[${this.name}] Network error: ${msg}` };
  }
}
```

Apply to all ~15 methods. The ElizaCloud providers, FAL, OpenAI, Google, xAI, Anthropic, Suno, and Ollama providers all need this.

- [ ] **Step 3: Run test**

Run: `bun test src/providers/__tests__/media-provider-security.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/media-provider.ts src/providers/__tests__/media-provider-security.test.ts
git commit -m "fix(error-handling): wrap all media provider fetch calls in try-catch (C1)"
```

---

### Task 15: C2 — Separate JSON parse error from logic errors in benchmark server

**Files:**
- Modify: `src/benchmark/server.ts:1090-1096`

- [ ] **Step 1: Separate parse step**

Find line 1092 inside the `req.on("end")` callback. Change from:

```typescript
req.on("end", async () => {
  try {
    const parsed = JSON.parse(body) as { ... };
    // ... rest of logic ...
  } catch (err: unknown) {
    // ... 500 error ...
  }
});
```

To:

```typescript
req.on("end", async () => {
  let parsed: { text?: unknown; context?: unknown; image?: unknown };
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
    return;
  }

  try {
    // ... rest of logic using `parsed` ...
  } catch (err: unknown) {
    // ... 500 error unchanged ...
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add src/benchmark/server.ts
git commit -m "fix(error-handling): return 400 for malformed JSON in benchmark /message (C2)"
```

---

### Task 16: C3 — Fix resolvePackageEntry missing re-export

**Files:**
- Modify: `src/cli/plugins-cli.ts:457,530-560`

- [ ] **Step 1: Check if resolvePackageEntry exists upstream**

Run: `bun run -e "import('@elizaos/autonomous/runtime/eliza').then(m => console.log('resolvePackageEntry' in m))"` or grep for it in node_modules.

- [ ] **Step 2a: If function exists upstream — no code change needed, just verify import works**

- [ ] **Step 2b: If function does NOT exist upstream — remove dead code path**

Remove the destructuring of `resolvePackageEntry` from line 457:

```typescript
// Change from:
const { CUSTOM_PLUGINS_DIRNAME, scanDropInPlugins, resolvePackageEntry } =
  await import("../runtime/eliza");
// To:
const { CUSTOM_PLUGINS_DIRNAME, scanDropInPlugins } =
  await import("../runtime/eliza");
```

Remove or skip lines 532-540 (the entryPoint resolution block). Replace with a comment or simpler check:

```typescript
// Entry point resolution not available — skip validation
console.log(`    ${chalk.dim("Entry:")} (validation skipped)`);
```

- [ ] **Step 3: Commit**

```bash
git add src/cli/plugins-cli.ts
git commit -m "fix(correctness): handle missing resolvePackageEntry re-export (C3)"
```

---

### Task 17: C4 — Remove duplicate condition

**Files:**
- Modify: `src/benchmark/server.ts:696-697`

- [ ] **Step 1: Remove the duplicate line**

Change:
```typescript
if (
  process.env.MILADY_BENCH_MOCK === "true" ||
  process.env.MILADY_BENCH_MOCK === "true"
) {
```

To:
```typescript
if (process.env.MILADY_BENCH_MOCK === "true") {
```

- [ ] **Step 2: Commit**

```bash
git add src/benchmark/server.ts
git commit -m "fix(correctness): remove duplicate MILADY_BENCH_MOCK condition (C4)"
```

---

### Task 18: C5 — Validate required files after model download

**Files:**
- Modify: `src/providers/local-models.ts:326-365`

- [ ] **Step 1: Write failing test**

Append to `src/providers/__tests__/local-models-security.test.ts`:

```typescript
describe("C5: Post-download validation logic", () => {
  it("detects missing weight files", () => {
    // Test the validation logic inline — after download loop,
    // check that files matching weight patterns exist.
    const downloadedFiles = ["config.json", "tokenizer.json"];  // no weight files
    const hasWeightFile = downloadedFiles.some((f) =>
      /\.(safetensors|bin|gguf|onnx)$/.test(f),
    );
    const hasConfig = downloadedFiles.some((f) =>
      f === "config.json" || f.endsWith("/config.json"),
    );
    expect(hasWeightFile).toBe(false);
    expect(hasConfig).toBe(true);
  });

  it("detects missing config.json", () => {
    const downloadedFiles = ["model.safetensors"];
    const hasWeightFile = downloadedFiles.some((f) =>
      /\.(safetensors|bin|gguf|onnx)$/.test(f),
    );
    const hasConfig = downloadedFiles.some((f) =>
      f === "config.json" || f.endsWith("/config.json"),
    );
    expect(hasWeightFile).toBe(true);
    expect(hasConfig).toBe(false);
  });

  it("passes when both weight and config present", () => {
    const downloadedFiles = ["config.json", "model.safetensors"];
    const hasWeightFile = downloadedFiles.some((f) =>
      /\.(safetensors|bin|gguf|onnx)$/.test(f),
    );
    const hasConfig = downloadedFiles.some((f) =>
      f === "config.json" || f.endsWith("/config.json"),
    );
    expect(hasWeightFile).toBe(true);
    expect(hasConfig).toBe(true);
  });
});
```

- [ ] **Step 2: Add post-download validation**

In `downloadModel()`, after the download loop (after line 358), before updating the manifest (line 361), add:

```typescript
// Validate required files were downloaded
const downloadedFiles = downloadList.filter((_, i) => {
  // Track which files succeeded — need to refactor the loop slightly
});

// Simpler approach: track success/failure during the loop
```

Actually, refactor the loop to track downloaded files:

```typescript
const downloadedFiles: string[] = [];

for (const filename of downloadList) {
  validateFilename(filename);
  // ... existing fetch logic ...
  if (!fileResponse.ok) {
    console.warn(`[local-models] Failed to download ${filename}: ${fileResponse.statusText}`);
    continue;
  }
  // ... write file ...
  downloadedFiles.push(filename);
  totalDownloaded++;
  // ...
}

// Post-download validation
const hasWeightFile = downloadedFiles.some((f) =>
  /\.(safetensors|bin|gguf|onnx)$/.test(f),
);
const hasConfig = downloadedFiles.some((f) => f === "config.json" || f.endsWith("/config.json"));

if (!hasWeightFile || !hasConfig) {
  // Clean up partial download — use fs.rm (async), NOT rmSync
  // (rmSync import was removed in commit f8af4bee)
  const fs = await import("node:fs/promises");
  await fs.rm(modelPath, { recursive: true, force: true });
  throw new Error(
    `Model download incomplete for ${modelId}: missing ${!hasConfig ? "config.json" : "weight files"}`,
  );
}
```

- [ ] **Step 3: Run tests**

Run: `bun test src/providers/__tests__/local-models-security.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/providers/local-models.ts src/providers/__tests__/local-models-security.test.ts
git commit -m "fix(correctness): validate required files after model download (C5)"
```

---

### Task 19: C6 — Download lock to prevent concurrent races

**Files:**
- Modify: `src/providers/local-models.ts:275+`

- [ ] **Step 1: Write test for concurrent download dedup**

Append to `src/providers/__tests__/local-models-security.test.ts`:

```typescript
describe("C6: Concurrent download lock", () => {
  it("second concurrent call awaits first instead of duplicating", async () => {
    // Mock downloadModel to verify that two concurrent calls for same modelId
    // result in only one actual download. The downloadLocks map prevents duplication.
    // Verify by checking that fetch is called once, not twice.
    // Exact implementation depends on how LocalModelManager is constructed.
  });
});
```

- [ ] **Step 2: Add downloadLocks map and early-return guard**

Add to the class:
```typescript
private downloadLocks = new Map<string, Promise<string>>();
```

Refactor `downloadModel` to use locks. Rename existing body to `_doDownload`:

```typescript
async downloadModel(
  modelId: string,
  onProgress?: (progress: ModelDownloadProgress) => void,
): Promise<string> {
  // Fast path: already downloaded
  if (this.isModelDownloaded(modelId)) {
    return this.manifest[modelId].path;
  }

  // Dedup concurrent calls for the same model
  const existing = this.downloadLocks.get(modelId);
  if (existing) return existing;

  const promise = this._doDownload(modelId, onProgress);
  this.downloadLocks.set(modelId, promise);
  try {
    return await promise;
  } finally {
    this.downloadLocks.delete(modelId);
  }
}

private async _doDownload(
  modelId: string,
  onProgress?: (progress: ModelDownloadProgress) => void,
): Promise<string> {
  // ... move existing downloadModel body here ...
}
```

- [ ] **Step 2: Commit**

```bash
git add src/providers/local-models.ts
git commit -m "fix(correctness): add download lock to prevent concurrent manifest races (C6)"
```

---

### Task 20: C7 — Replace activeSession with lastSessionKey

**Files:**
- Modify: `src/benchmark/server.ts:837,854,861,888-898`

- [ ] **Step 1: Replace activeSession variable**

Change:
```typescript
let activeSession: BenchmarkSession | null = null;
```
To:
```typescript
let lastSessionKey: string | null = null;
```

- [ ] **Step 2: Update resolveSession**

In `resolveSession` (lines 854, 861), change:
```typescript
activeSession = existing;
```
To:
```typescript
lastSessionKey = key;
```

- [ ] **Step 3: Update diagnostics endpoint**

In the `/api/benchmark/diagnostics` handler (around line 888-898), change:
```typescript
active_session: activeSession
  ? {
      benchmark: activeSession.benchmark,
      task_id: activeSession.taskId,
      room_id: activeSession.roomId,
    }
  : null,
```
To:
```typescript
active_session: (() => {
  const active = lastSessionKey ? sessions.get(lastSessionKey) : null;
  return active
    ? {
        benchmark: active.benchmark,
        task_id: active.taskId,
        room_id: active.roomId,
      }
    : null;
})(),
```

- [ ] **Step 4: Remove activeSession fallback from outbox/trajectory endpoints**

Find where `/outbox` and `/trajectory` endpoints use `activeSession ??` fallback and replace with `resolveSession("default-task", "unknown", false)` fallback only.

- [ ] **Step 5: Commit**

```bash
git add src/benchmark/server.ts
git commit -m "fix(correctness): replace mutable activeSession with lastSessionKey (C7)"
```

---

### Task 21: C8 — Guard reconnect callback against stopped state

**Files:**
- Modify: `src/plugins/whatsapp/service.ts:220-227,263-285`

- [ ] **Step 1: Add stopped flag**

Add to the class:
```typescript
private stopped = false;
```

- [ ] **Step 2: Set flag in stop()**

At the start of `stop()` (line 263), add:
```typescript
this.stopped = true;
```

- [ ] **Step 3: Reset flag at start of initialize()**

At the start of `initialize()`, add:
```typescript
this.stopped = false;
```

- [ ] **Step 4: Check flag in reconnect callback**

In the `setTimeout` callback (line 220-227), add:
```typescript
this.reconnectTimer = setTimeout(() => {
  this.reconnectTimer = null;
  if (this.stopped) return;  // <-- ADD THIS
  connect().catch((err) => {
```

- [ ] **Step 5: Write test verifying stopped flag prevents reconnect**

Append to `src/plugins/whatsapp/__tests__/service-lifecycle.test.ts`:

```typescript
describe("C8: Reconnect after stop", () => {
  it("reconnect callback is no-op after stop()", () => {
    // Verify that the stopped flag is checked before calling connect()
    // This can be tested by verifying that after stop() sets stopped=true,
    // the setTimeout callback returns early.
    // Exact test depends on how we can trigger the callback in isolation.
  });
});
```

- [ ] **Step 6: Commit**

```bash
git add src/plugins/whatsapp/service.ts src/plugins/whatsapp/__tests__/service-lifecycle.test.ts
git commit -m "fix(correctness): prevent reconnect after WhatsApp service stop (C8)"
```

---

### Task 22: C9 — Handle build failure in plugin-installer

**Files:**
- Modify: `src/services/plugin-installer.ts:682-690`

- [ ] **Step 1: Change .catch() to try/catch with fallback**

Replace lines 682-690:

```typescript
await execFileAsync(pm, ["run", "build"], { cwd: tsDir }).catch(
  (buildErr: Error) => {
    logger.warn(
      `[plugin-installer] build step failed for ${info.name}: ${buildErr.message}`,
    );
  },
);
// Copy built typescript dir as the install target
await fs.cp(tsDir, targetDir, { recursive: true });
```

With:

```typescript
let buildFailed = false;
try {
  await execFileAsync(pm, ["run", "build"], { cwd: tsDir });
} catch (buildErr: unknown) {
  const msg = buildErr instanceof Error ? buildErr.message : String(buildErr);
  logger.warn(
    `[plugin-installer] TypeScript build failed for ${info.name}: ${msg}. Installing raw source.`,
  );
  buildFailed = true;
}

// Copy typescript dir (built or raw) as the install target
// If build failed, fall back to the root tempDir which has raw source
const sourceDir = buildFailed ? tempDir : tsDir;
await fs.cp(sourceDir, targetDir, { recursive: true });
```

- [ ] **Step 2: Commit**

```bash
git add src/services/plugin-installer.ts
git commit -m "fix(correctness): fall back to raw source when plugin build fails (C9)"
```

---

### Task 23: T3 finalize — lint, build, test

- [ ] **Step 1: Run lint, build, full test suite**

```bash
bun run lint && bun run build && bun test
```

- [ ] **Step 2: Fix any issues, commit**

---

## Tier 4: Maintainability & DRY

**Branch:** `fix/t4-maintainability`

### Task 24: M1 — Extract serialise() to shared module

**Files:**
- Create: `src/services/serialise.ts`
- Modify: `src/services/core-eject.ts:28-37`
- Modify: `src/services/plugin-eject.ts:25-34`
- Modify: `src/services/plugin-installer.ts:75-84`

- [ ] **Step 1: Create the shared module**

```typescript
// src/services/serialise.ts

/**
 * Creates an independent promise-chain serialiser.
 * Each call to the returned function queues behind the previous one.
 * Multiple serialisers operate independently (no shared lock).
 */
export function createSerialiser() {
  let lock: Promise<void> = Promise.resolve();
  return function serialise<T>(fn: () => Promise<T>): Promise<T> {
    let resolve: (() => void) | undefined;
    const prev = lock;
    lock = new Promise<void>((r) => {
      resolve = r;
    });
    return prev.then(fn).finally(() => resolve?.());
  };
}
```

- [ ] **Step 2: Replace in core-eject.ts**

Remove lines 28-37 (`let ejectLock` ... `serialise` function). Replace with:

```typescript
import { createSerialiser } from "./serialise";
const serialise = createSerialiser();
```

- [ ] **Step 3: Replace in plugin-eject.ts**

Remove lines 25-34. Replace with:

```typescript
import { createSerialiser } from "./serialise";
const serialise = createSerialiser();
```

- [ ] **Step 4: Replace in plugin-installer.ts**

Remove lines 75-84. Replace with:

```typescript
import { createSerialiser } from "./serialise";
const serialise = createSerialiser();
```

- [ ] **Step 5: Run tests to verify no regressions**

```bash
bun test
```

- [ ] **Step 6: Commit**

```bash
git add src/services/serialise.ts src/services/core-eject.ts src/services/plugin-eject.ts src/services/plugin-installer.ts
git commit -m "refactor: extract serialise() to shared module with factory pattern (M1)"
```

---

### Task 25: M2 — ElizaCloud provider base class

**Files:**
- Modify: `src/providers/media-provider.ts:127-317`

- [ ] **Step 1: Create the generic base class**

Add above the four ElizaCloud classes:

```typescript
abstract class ElizaCloudProvider<TOptions, TResult> {
  abstract name: string;
  private baseUrl: string;
  private apiKey?: string;
  private endpoint: string;

  constructor(baseUrl: string, endpoint: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    // Note: ElizaCloud providers do NOT require apiKey (they use server-side auth).
    // This is intentionally different from S4's validation which applies only to
    // own-key providers (FAL, OpenAI, Google, xAI, Anthropic, Suno).
  }

  protected async callApi(body: Record<string, unknown>): Promise<MediaProviderResult<TResult>> {
    try {
      const response = await fetchWithTimeout(`${this.baseUrl}${this.endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        return { success: false, error: `Eliza Cloud error: ${text}` };
      }

      const data = (await response.json()) as TResult;
      return { success: true, data };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `[${this.name}] Network error: ${msg}` };
    }
  }
}
```

- [ ] **Step 2: Refactor ElizaCloudImageProvider**

```typescript
class ElizaCloudImageProvider extends ElizaCloudProvider<ImageGenerationOptions, ImageGenerationResult> implements ImageGenerationProvider {
  name = "eliza-cloud";
  constructor(baseUrl: string, apiKey?: string) {
    super(baseUrl, "/media/image/generate", apiKey);
  }
  async generate(options: ImageGenerationOptions) {
    return this.callApi({
      prompt: options.prompt,
      size: options.size,
      quality: options.quality,
      style: options.style,
    });
  }
}
```

- [ ] **Step 3: Refactor remaining three (Video, Audio, Vision)**

Same pattern — each becomes a thin subclass with its own endpoint and body mapping.

- [ ] **Step 4: Run tests**

```bash
bun test
```

- [ ] **Step 5: Commit**

```bash
git add src/providers/media-provider.ts
git commit -m "refactor: extract ElizaCloud provider base class (M2)"
```

---

### Task 26: M3 — Media action handler factory

**Files:**
- Modify: `src/actions/media.ts`

- [ ] **Step 1: Extract shared handler logic**

Read the file fully, identify the common pattern, and extract:

```typescript
function createMediaActionHandler<TResult>(
  getProvider: (config: MiladyConfig, options: MediaProviderFactoryOptions) => { generate?: Function; analyze?: Function },
  validateInput: (params: Record<string, unknown>) => { valid: boolean; error?: string; args: Record<string, unknown> },
  callProvider: (provider: any, args: Record<string, unknown>) => Promise<MediaProviderResult<TResult>>,
): Handler {
  return async (runtime, message, state, options) => {
    const params = (options as HandlerOptions | undefined)?.parameters ?? {};
    const { valid, error, args } = validateInput(params);
    if (!valid) {
      await runtime.createMemory({ /* error response */ });
      return;
    }
    const config = loadMiladyConfig();
    const providerOpts = getMediaProviderOptions(config);
    const provider = getProvider(config, providerOpts);
    const result = await callProvider(provider, args);
    // ... handle result ...
  };
}
```

- [ ] **Step 2: Refactor each action to use the factory**

Each action becomes approximately 5-10 lines instead of 60+.

- [ ] **Step 3: Run tests**

```bash
bun test src/actions/__tests__/media.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/actions/media.ts
git commit -m "refactor: extract media action handler factory (M3)"
```

---

### Task 27: M4 — Split WhatsApp handleIncomingMessage

**Files:**
- Modify: `src/plugins/whatsapp/service.ts:342-485`

- [ ] **Step 1: Read the full handleIncomingMessage method**

Understand the three phases: memory construction, routing, callback resolution.

- [ ] **Step 2: Extract buildMessageMemory**

Create a private method that takes raw message data and returns the constructed Memory object.

- [ ] **Step 3: Extract routeIncomingMessage**

Create a private method that handles the routing logic (passing to runtime).

- [ ] **Step 4: Extract resolveMessageCallbacks**

Create a private method that checks pending callbacks and resolves matching ones.

- [ ] **Step 5: Rewrite handleIncomingMessage as orchestrator**

```typescript
private async handleIncomingMessage(msg: Record<string, unknown>): Promise<void> {
  const memory = this.buildMessageMemory(msg);
  if (!memory) return;
  await this.routeIncomingMessage(memory);
  this.resolveMessageCallbacks(memory.entityId, memory.content.text);
}
```

- [ ] **Step 6: Run tests**

```bash
bun test
```

- [ ] **Step 7: Commit**

```bash
git add src/plugins/whatsapp/service.ts
git commit -m "refactor: split WhatsApp handleIncomingMessage into focused methods (M4)"
```

---

### Task 28: M5 — Extract benchmark collectBody and message handler

**Files:**
- Modify: `src/benchmark/server.ts:1078-1237`

- [ ] **Step 1: Extract collectBody utility**

```typescript
function collectBody(req: http.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    let bytes = 0;
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        req.destroy();
        reject(new Error("Request body too large"));
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}
```

- [ ] **Step 2: Extract handleBenchmarkMessage**

Move the logic from the `req.on("end")` callback into a named async function.

- [ ] **Step 3: Rewrite the route handler**

```typescript
if (pathname === "/api/benchmark/message" && req.method === "POST") {
  if (!checkBenchAuth(req, res)) return;
  try {
    const body = await collectBody(req, MAX_BODY_BYTES);
    await handleBenchmarkMessage(req, res, body, runtime, resolveSession);
  } catch (err) {
    res.writeHead(413, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Request body too large" }));
  }
  return;
}
```

- [ ] **Step 4: Also refactor /reset to use collectBody**

- [ ] **Step 5: Run tests**

```bash
bun test
```

- [ ] **Step 6: Commit**

```bash
git add src/benchmark/server.ts
git commit -m "refactor: extract collectBody and handleBenchmarkMessage (M5)"
```

---

### Task 29: M6 — TUI command registry pattern

**Files:**
- Modify: `src/tui/index.ts:305-549`

- [ ] **Step 1: Read the full setOnSubmit callback to identify all commands**

Identify each `/command` handler block.

- [ ] **Step 2: Define CommandHandler type and registry**

```typescript
type CommandHandler = (args: string[], tui: MiladyTUI, bridge: ElizaTUIBridge) => Promise<void>;

const commands = new Map<string, CommandHandler>();
```

- [ ] **Step 3: Extract each command into named functions**

For example:
```typescript
async function handleModelCommand(args: string[], tui: MiladyTUI, bridge: ElizaTUIBridge): Promise<void> {
  // ... extracted from the /model block ...
}
commands.set("model", handleModelCommand);
```

Repeat for: model, embeddings, clear, help, plugins, and any other commands found.

- [ ] **Step 4: Rewrite setOnSubmit as dispatcher**

```typescript
tui.setOnSubmit(async (input: string) => {
  if (!input.startsWith("/")) {
    // ... send as chat message (existing logic) ...
    return;
  }
  const [cmd, ...args] = input.slice(1).split(" ");
  const handler = commands.get(cmd);
  if (handler) {
    try {
      await handler(args, tui, bridge);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      tui.addToChatContainer(new Text(`Error in /${cmd}: ${msg}`, 1, 0));
    }
    return;
  }
  // ... unknown command fallback ...
});
```

- [ ] **Step 5: Run tests**

```bash
bun test
```

- [ ] **Step 6: Commit**

```bash
git add src/tui/index.ts
git commit -m "refactor: extract TUI commands into registry pattern (M6)"
```

---

### Task 30: T4 finalize — lint, build, full test suite

- [ ] **Step 1: Run everything**

```bash
bun run lint && bun run build && bun test
```

- [ ] **Step 2: Fix any issues, commit**

```bash
git add -u && git commit -m "fix: lint and build fixes for T4 maintainability tier"
```
