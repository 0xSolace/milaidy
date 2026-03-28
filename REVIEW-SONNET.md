# Code Review: feat/steward-wallet-integration
**Reviewer:** Claude Sonnet 4.5  
**Date:** 2026-03-28  
**Branch:** `feat/steward-wallet-integration` vs `origin/develop`  
**Stats:** 77 files, ~10,800 additions, ~400 deletions, 23 commits

---

## 1. Executive Summary

This PR integrates the Steward vault as milady's primary wallet provider, adding policy-enforced signing, a BSC trade routing path through Steward, a real-time approval queue with webhook support, auto-provisioning of Steward agents on first launch, a redesigned Settings wallet section, and a full transaction history UI. The scope is large (10k+ lines) and the design direction is sound.

The implementation is generally clean and well-structured, with good separation of concerns, consistent error handling patterns, and solid security defaults (restrictive file permissions, path traversal guards, `encodeURIComponent` throughout). However, there are **six P1 bugs** that will cause incorrect behavior or silent failures in production, most clustered in the bridge/server glue layer rather than in any one big mistake. These are fixable without rework; the architecture itself is solid.

**Recommendation: Merge with fixes** (P1 issues must be addressed before merge; P2 items can follow immediately after in a cleanup PR).

---

## 2. Critical Issues (P0 / P1)

---

### 🔴 P1-1 — Dead code kills persisted-credentials fallback in `getStewardBridgeStatus`
**File:** `packages/app-core/src/api/steward-bridge.ts` — around line 40

**Problem:**
```typescript
// New code
if (!baseUrl || !client) {
  const persisted = resolveEffectiveStewardConfig(env);
  if (!persisted) {
    return { configured: false, ... };
  }
  // persisted exists — falls through... but to WHAT?
}

// Pre-existing code immediately below — IDENTICAL condition
if (!baseUrl || !client) {        // still true if we fell through
  return { configured: false, ... };  // always hits this
}
```

The intent was to re-initialise `baseUrl`/`client` from persisted credentials when env vars are absent, but the code never does that — `baseUrl` and `client` are derived before these blocks and never reassigned. So even when persisted credentials exist, the second guard always fires and returns `configured: false`. The entire fallback-to-disk feature is silently broken.

**Fix:**
```typescript
// Derive baseUrl and client; allow persisted creds to fill gaps
let baseUrl = normalizeEnvValue(env.STEWARD_API_URL);
let client = createStewardClient(options);

if (!baseUrl || !client) {
  const persisted = resolveEffectiveStewardConfig(env);
  if (persisted?.apiUrl) {
    baseUrl = persisted.apiUrl;
    client = createStewardClient({ ...options, env: { ...env, STEWARD_API_URL: persisted.apiUrl, STEWARD_API_KEY: persisted.apiKey, STEWARD_AGENT_TOKEN: persisted.agentToken } });
  }
}

if (!baseUrl || !client) {
  return { configured: false, available: false, connected: false, baseUrl, agentId, evmAddress, error: null };
}
```

---

### 🔴 P1-2 — `apiKeyHash` receives raw key; sends plain API key where hash is expected
**File:** `packages/app-core/src/services/steward-sidecar/wallet-setup.ts` ~line 94-101  
**Also:** `packages/app-core/src/api/steward-bridge.ts` ~line 756

**Problem:**
```typescript
const tenantApiKey = generateApiKey();  // raw 64-char hex string
// ...
body: JSON.stringify({
  id: DEFAULT_TENANT_ID,
  name: DEFAULT_TENANT_NAME,
  apiKeyHash: tenantApiKey,   // ← raw key sent as the "hash" field
})
```
If the Steward API stores `apiKeyHash` as a hash for later verification (the field name implies it), authentication via `X-Steward-Key: tenantApiKey` will always fail because steward would hash the provided key and compare it to `tenantApiKey` (not its hash). This would silently break all subsequent tenant-scoped requests after first-launch setup.

Additionally in `steward-bridge.ts`:
```typescript
"X-Api-Key": normalizeEnvValue(env.STEWARD_MASTER_PASSWORD) ?? "",  // master pw as API key!
body: JSON.stringify({ apiKeyHash: apiKey }),  // raw key as hash
```
The master encryption password is being repurposed as an API authentication key. These are conceptually different secrets.

**Fix:** Clarify with the Steward API contract — if `apiKeyHash` truly expects a SHA-256/bcrypt hash, compute it before sending. If the field is misnamed and stores the raw key, rename locally to remove confusion. Separate the master password from the tenant API key concepts.

---

### 🔴 P1-3 — Webhook receiver has no authentication (exposed in cloud/non-loopback deployments)
**File:** `packages/app-core/src/api/server.ts` — POST `/api/wallet/steward-webhook`

**Problem:**
```typescript
if (method === "POST" && url.pathname === "/api/wallet/steward-webhook") {
  // Webhook endpoint — No auth required (steward is trusted on loopback)
  const body = await readCompatJsonBody(req, res);
  // ... pushes events to in-memory buffer
```

The comment assumes loopback-only binding. In cloud mode or when the server binds to `0.0.0.0` (common in Docker), this endpoint is reachable by anyone who can reach the server. An attacker can inject arbitrary webhook events (e.g., fake `tx.confirmed` events for transactions that never executed), misleading the user's approval queue and transaction history UI.

Note the read-side is protected (`ensureCompatApiAuthorized`) but the write side is not.

**Fix:** Add a shared secret between Steward and the receiver. Options:
- Use the existing `ensureCompatApiAuthorized` check (simplest — if steward webhook registration includes the API token in the URL/header)
- Generate a random webhook secret at registration time (`registerStewardWebhook`) and validate via `X-Steward-Webhook-Secret` header on receipt
- At minimum, bind-host-check: reject if request source IP is not loopback

---

### 🔴 P1-4 — Pagination anti-pattern: query params ignored, always fetches 200 records
**File:** `packages/app-core/src/api/server.ts` — `/api/wallet/steward-tx-records` handler  
**Also:** `packages/app-core/src/components/steward/TransactionHistory.tsx` ~line 89

**Problem:**
```typescript
const limit = parseInt(url.searchParams.get("limit") || "50", 10);
const offset = parseInt(url.searchParams.get("offset") || "0", 10);
const history = await getStewardHistory(agentId, {
  limit: 200,   // ← hardcoded! ignores client limit
  offset: 0,    // ← hardcoded! ignores client offset
});
const filtered = status ? history.filter(...) : history;
const paginated = filtered.slice(offset, offset + limit);  // in-memory pagination
sendJsonResponse(res, 200, { records: paginated, total: filtered.length, ... });
```

- Client-supplied `limit` and `offset` are silently ignored for the upstream fetch
- Status filtering happens in Node, not in Steward (bypasses server-side indexed queries)
- `total` reports filtered count from the in-memory 200-record window, not the true total
- If the agent has >200 transactions, older records are silently invisible — no indication to the user
- `TransactionHistory.tsx` also hardcodes `limit: 200, offset: 0` and does client-side chain filtering

**Fix:** Forward `limit`, `offset`, and `status` to `getStewardHistory` verbatim. Move chain filtering to the client (it's not a query param steward supports anyway — just document that clearly).

---

### 🔴 P1-5 — Toast notification for new approvals never fires (ref update order bug)
**File:** `packages/app-core/src/components/steward/ApprovalQueue.tsx` ~line 64

**Problem:**
```typescript
// Notify parent of count changes
if (pending.length !== prevCountRef.current) {
  prevCountRef.current = pending.length;   // ← ref updated HERE
  onPendingCountChange?.(pending.length);
}

// Toast when new items arrive — will NEVER be true
if (pending.length > prevCountRef.current && prevCountRef.current > 0) {
  // prevCountRef.current === pending.length by this point — always false
  setActionNotice(`... new approvals pending`, "info", 3000);
}
```
The ref is updated synchronously before the second condition is evaluated. The "new approvals" toast is dead code.

**Fix:** Swap the order — check the toast condition before updating the ref:
```typescript
const prev = prevCountRef.current;
if (pending.length !== prev) {
  if (pending.length > prev && prev > 0) {
    const newCount = pending.length - prev;
    setActionNotice(`${newCount} new approval${newCount > 1 ? "s" : ""} pending`, "info", 3000);
  }
  prevCountRef.current = pending.length;
  onPendingCountChange?.(pending.length);
}
```

---

### 🔴 P1-6 — `ensureStewardAgent` singleton flag is not concurrency-safe
**File:** `packages/app-core/src/api/steward-bridge.ts` ~line 653

**Problem:**
```typescript
let stewardAgentEnsured = false;  // module-level flag

export async function ensureStewardAgent(...) {
  if (stewardAgentEnsured) return null;
  // async work happens here — multiple concurrent calls can all pass the check
  // before any one of them finishes and sets stewardAgentEnsured = true
```

Under concurrent requests (e.g., parallel `/api/wallet/steward-status` calls on startup), multiple provisioning attempts will run in parallel, each trying to `POST /agents` and create tenants. This could leave the Steward instance in an inconsistent state, or at minimum produce noisy warning logs.

**Fix:** Gate with a promise, not a boolean:
```typescript
let ensurePromise: Promise<EnsureStewardAgentResult | null> | null = null;

export async function ensureStewardAgent(options = {}): Promise<EnsureStewardAgentResult | null> {
  if (ensurePromise) return ensurePromise;
  ensurePromise = _ensureStewardAgentImpl(options);
  return ensurePromise;
}
```

---

## 3. Important Issues (P2)

---

### 🟡 P2-1 — 18 `as unknown as` casts masking an SDK type gap
**Files:** `steward-bridge.ts`, `wallet-routes.ts`, `PolicyControlsView.tsx`, `StewardSidecar.ts`

The `@stwd/sdk` `AgentIdentity` type only declares `walletAddress: string`, but the live API returns an extended `walletAddresses: { evm, solana }` shape. The gap is worked around with `as unknown as { walletAddresses?: ... }` in 8+ places. This is brittle — if the API shape changes, TypeScript won't catch it.

**Fix:** Define a module-level augmentation type once and use it everywhere:
```typescript
// In a local types file
export interface ExtendedAgentIdentity {
  id: string;
  walletAddress?: string;
  walletAddresses?: { evm?: string; solana?: string };
  name?: string;
}
```
Then cast once at the `client.getAgent()` call site. Consider also filing an issue/PR against `@stwd/sdk` to add the extended type.

---

### 🟡 P2-2 — `STEWARD_MASTER_PASSWORD` conflated with API auth key
**File:** `packages/app-core/src/api/steward-bridge.ts` ~line 751

```typescript
"X-Api-Key": normalizeEnvValue(env.STEWARD_MASTER_PASSWORD) ?? "",
```
The master password (vault encryption secret) is being used as an HTTP authentication key. If `STEWARD_MASTER_PASSWORD` is not set (common when `steward-sidecar.ts` manages setup), this sends an empty auth header, meaning the tenant creation call fails silently (falls into the "already exists" non-fatal path). In cloud mode, this leaves the tenant creation endpoint effectively unauthenticated.

**Fix:** Use `STEWARD_ADMIN_API_KEY` or a dedicated admin credential. If the Steward API's tenant creation endpoint genuinely requires the master password as auth, document this clearly and ensure the env var is always set before `ensureStewardAgent` runs.

---

### 🟡 P2-3 — Steward status re-fetched on every Settings panel mount
**File:** `packages/app-core/src/components/SettingsView.tsx` ~line 862

```typescript
useEffect(() => {
  client.getStewardStatus().then((status) => { ... });
}, []);  // runs every mount
```
Settings is opened and closed frequently. Every open triggers an HTTP call to `/api/wallet/steward-status`. With no caching/shared state, this means N Status checks for N Settings opens per session.

**Fix:** Lift steward status into `AppContext` (it's already there as a state slice for other panels) or use a simple module-level cache with a 30-second TTL.

---

### 🟡 P2-4 — Steward address resolution logic duplicated across 4+ files
`InventoryView.tsx`, `SettingsView.tsx`, `steward-bridge.ts`, `wallet.ts`, and `wallet-routes.ts` all implement their own version of "steward address, then local key, then managed address" resolution. Each has slight variations (some check `walletAddresses.evm`, some fall back to `walletAddress`, some don't).

**Fix:** Extract to a shared hook `useStewardAddress()` (for React) and a utility `resolveAgentAddress(env)` (for server-side). Centralize the fallback chain.

---

### 🟡 P2-5 — `handleApprove`/`handleReject` pass stale `items.length` to count callback
**File:** `packages/app-core/src/components/steward/ApprovalQueue.tsx` ~line 103

```typescript
const handleApprove = useCallback(async (txId: string) => {
  // ...
  onPendingCountChange?.(items.length - 1);   // items.length captured at callback creation
}, [approveStewardTx, setActionNotice, onPendingCountChange, items.length]);
```
`items.length` is in the deps array (correct), but the optimistic count `items.length - 1` assumes exactly one item will be removed. If the `setItems` filter removes multiple items (shouldn't happen, but defensively) or if `items` changes between render and callback execution, the count will be wrong.

**Fix:** Use a functional update or derive the count from the filtered result:
```typescript
setItems((prev) => {
  const next = prev.filter((item) => item.transaction.id !== txId);
  onPendingCountChange?.(next.length);
  return next;
});
```

---

### 🟡 P2-6 — `getRecentWebhookEvents` `sinceIndex` is not rotation-safe
**File:** `packages/app-core/src/api/steward-bridge.ts` ~line 533

```typescript
export function getRecentWebhookEvents(eventType?, sinceIndex = 0) {
  const all = eventType ? recentWebhookEvents.filter(...) : recentWebhookEvents;
  const events = all.slice(sinceIndex);  // sinceIndex is index into the array
  return { events, nextIndex: recentWebhookEvents.length };
}
```
When `recentWebhookEvents` overflows its 200-item cap, old events are spliced from the front (`splice(0, overflow)`). The client's stored `nextIndex` then points to the wrong position. The client would either miss events (if index is too high after rotation) or receive duplicates (if the client resets to 0).

**Fix:** Use a monotonic sequence number embedded in each event instead of an array index, and search by sequence on poll. Or document that `since=0` is the safe fallback after reconnect.

---

### 🟡 P2-7 — `verifyExistingWallet` has no request timeout
**File:** `packages/app-core/src/services/steward-sidecar/wallet-setup.ts` ~line 40

```typescript
const response = await fetch(`${apiBase}/agents/${credentials.agentId}`, {
  headers: { ... },
  // No AbortSignal.timeout()
});
```
Every other Steward fetch in this PR uses `AbortSignal.timeout(15_000)`. This one doesn't. If Steward's HTTP layer starts but the database isn't ready, this fetch can hang for Node's default socket timeout (~60s+), blocking the app on every startup after first launch.

**Fix:** Add `signal: AbortSignal.timeout(15_000)`.

---

## 4. Minor Issues (P3)

---

### 🔵 P3-1 — Hardcoded English strings not going through i18n in new components
**Files:** `ApprovalQueue.tsx`, `TransactionHistory.tsx`, `StewardView.tsx`, `SettingsView.tsx`

Several labels use hardcoded English strings rather than `t(...)`:
- `"EVM Address"`, `"Solana Address"` in `CopyableAddress` (SettingsView.tsx)
- `"Pending"`, `"All Statuses"`, `"Confirmed"` etc. in `TransactionHistory.tsx` STATUS_OPTIONS
- `"Transaction approved"`, `"Transaction rejected"` in ApprovalQueue.tsx

The new `wallet-policies` section is in `en.json` (the i18n commit is there) but several component-level strings are not wired up.

**Fix:** Run through the new components and pass all user-visible strings through `t()` with `defaultValue` fallbacks. Not a blocker but inconsistent with the rest of the codebase.

---

### 🔵 P3-2 — `stewardAgentEnsured` module singleton survives test runs
**File:** `packages/app-core/src/api/steward-bridge.ts`

The exported `__resetStewardAgentEnsured()` function exists, but test files need to call it in `afterEach`/`beforeEach`. If any test exercises `ensureStewardAgent` without resetting, subsequent tests get stale state.

**Fix:** Verify test files call `__resetStewardAgentEnsured()` in cleanup. The pattern `beforeEach(() => { __resetStewardAgentEnsured(); })` should be added to the relevant test suites.

---

### 🔵 P3-3 — `transferTokenAction` calls back through the loopback API (circular)
**File:** `packages/app-core/src/actions/transfer-token.ts` ~line 253

```typescript
const stewardResult = await fetch(
  `http://127.0.0.1:${getWalletActionApiPort()}/api/wallet/steward-sign`,
  ...
);
```
The agent action calls the Milady API server (`steward-sign` endpoint), which then calls Steward. This creates a two-hop internal chain. If the API port changes or if the agent is run without the API server (e.g., in test harness), this silently fails and falls through to local signing.

This works fine in practice but is brittle. **Preferred fix:** Import and call `signViaSteward()` from `steward-bridge.ts` directly, eliminating the loopback HTTP call.

---

### 🔵 P3-4 — `isStewardLocalEnabled()` checks for `=== "true"` but STEWARD-FIRST-WALLET.md shows `STEWARD_LOCAL=1`
**File:** `apps/app/electrobun/src/native/steward.ts` ~line 298  
**Doc:** `STEWARD-FIRST-WALLET.md`

```typescript
export function isStewardLocalEnabled(): boolean {
  return process.env.STEWARD_LOCAL === "true";
}
```
The doc shows `STEWARD_LOCAL=1` as the example, but the code only accepts `"true"`. Users following the doc will find Steward doesn't start.

**Fix:** Accept both: `["true", "1"].includes(process.env.STEWARD_LOCAL?.trim() ?? "")`.

---

### 🔵 P3-5 — `EVM Address` / `Solana` labels in `CopyableAddress` are not aria-linked to the address
**File:** `packages/app-core/src/components/SettingsView.tsx`

The label and value are visually associated but `<div>` elements don't have accessible label associations. Screen readers won't announce "EVM Address" before reading the truncated hex string.

**Fix:** Use `<dt>/<dd>` pairs or add `aria-label` to the address container.

---

### 🔵 P3-6 — Dead import in `apps/app/electrobun/src/index.ts`
**File:** `apps/app/electrobun/src/index.ts`

`getStewardStatus` is imported from `./native/steward` but the only usage is via `onStewardStatusChange` callback. Direct `getStewardStatus` calls appear to be redundant with what `sendToActiveRenderer` already does.

**Fix:** Verify if `getStewardStatus` is actually used anywhere after the refactor, or remove the import.

---

### 🔵 P3-7 — Chain ID 101 used for Solana is non-standard
**File:** `packages/app-core/src/components/steward/chain-utils.ts` ~line 31  
**Also:** `TransactionHistory.tsx` CHAIN_OPTIONS

Solana doesn't have an EVM chain ID. Using `101` and `102` for Solana/Solana Devnet is a steward-internal convention, but if these values ever leak into EVM tooling (MetaMask, block explorers, ethers.js) they'll cause silent misfires. Solana chain ID `101` would be interpreted as Ethereum's EIP-1191 extended address encoding scheme by some tools.

**Fix:** Add a comment clarifying these are Steward-internal pseudo-chain IDs, not EVM-standard. Consider a different namespace (e.g., `900001`/`900002`) to avoid any overlap with real EVM chain IDs.

---

## 5. Positive Observations

1. **Path traversal guard in `resetSteward()`** is well-done — explicitly checks that the resolved data directory starts with `~/.milady/` before calling `rmSync`. This is the right defensive pattern.

2. **Credential files use `0o600` permissions** — both `saveStewardCredentials()` in `steward-credentials.ts` and `performFirstLaunchSetup()` in `wallet-setup.ts` correctly restrict credential files to owner-only.

3. **Exponential backoff for crash restarts** is cleanly implemented with capped backoff (`Math.min(INITIAL_BACKOFF_MS * 2^n, MAX_BACKOFF_MS)`). The decision to skip `ensureWalletSetup` on crash-restarts is documented and correct.

4. **`ensureCompatApiAuthorized` is applied consistently** to all new signed-action endpoints. The only exception is the webhook receiver (flagged as P1-3), but all user-facing endpoints (approve, deny, sign, policies, history) are properly gated.

5. **`encodeURIComponent` used consistently** on all path parameters in `fetch()` calls throughout the bridge layer. No path injection surface.

6. **`AbortSignal.timeout(15_000)`** is used in most fetch calls, preventing silent hangs. The one miss is flagged in P2-7.

7. **Good test coverage** — `steward-sidecar.test.ts` (131 lines), `PolicyControlsView.test.tsx` (252 lines), and `wallets-panel.test.tsx` (376 lines) are meaningful additions, not just empty stubs.

8. **Type contracts in `shared/contracts/wallet.ts`** are well-defined. `StewardTxRecord`, `StewardPendingApproval`, `StewardSignRequest/Response` are clean and will enable frontend/backend alignment.

9. **Steward-optional design** is executed well — every path that reaches Steward has a local-key fallback (`wallet-routes.ts`, `transfer-token.ts`, `wallet-trade-routes.ts`). Existing users without Steward configured will not notice a regression.

10. **`isStewardConfigured()` guard at route handlers** prevents 503/uncaught errors rather than exploding when Steward is absent. The error messages (`"Steward not configured"`) are actionable.

---

## 6. Merge Decision

**→ Merge with fixes**

The architecture is sound and the overall integration is well-executed. The P1 issues are all correctness bugs in glue code — none require redesigning the approach. Fix order recommendation:

| Priority | Fix |
|----------|-----|
| P1-1 | Fix `getStewardBridgeStatus` fallback logic (re-assign `baseUrl`/`client` from persisted creds) |
| P1-2 | Clarify `apiKeyHash` contract; separate master password from API key |
| P1-3 | Add webhook receiver authentication (shared secret or bind-host check) |
| P1-4 | Forward `limit`/`offset` params to `getStewardHistory`; remove in-memory pagination |
| P1-5 | Fix `prevCountRef` update order in `ApprovalQueue.tsx` (swap 2 lines) |
| P1-6 | Convert `stewardAgentEnsured` flag to a promise-based lock |
| P2-1 | Centralize `ExtendedAgentIdentity` type to eliminate `as unknown as` scatter |
| P2-7 | Add `AbortSignal.timeout(15_000)` to `verifyExistingWallet` |
| P3-4 | Accept `STEWARD_LOCAL=1` in addition to `STEWARD_LOCAL=true` |

P2 items (P2-2 through P2-6) and P3 items can be addressed in an immediate follow-up PR without blocking merge.
