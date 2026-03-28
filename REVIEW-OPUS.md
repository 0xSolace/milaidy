# Code Review: Steward Wallet Integration

**Branch:** `feat/steward-wallet-integration` vs `origin/develop`  
**Reviewer:** Sol (Claude Opus)  
**Date:** 2026-03-28  
**Stats:** 77 files changed, ~10,800 additions, ~400 deletions

---

## 1. Summary

This PR adds comprehensive steward wallet infrastructure to milady — steward as the primary wallet provider (local keys as fallback), transaction signing through steward vault with policy enforcement, BSC trading routed through steward, approval queue + webhook receiver, auto-setup on first launch, steward-centric settings, multi-chain USD-based policies, and various UI fixes. The architecture is sound: clean separation between sidecar process management, credential persistence, bridge API, and UI components. The steward-first fallback-to-local pattern is well-implemented across wallet address resolution, transaction signing, and trading.

However, the review surfaces several security concerns (unauthenticated webhook endpoint, credential logging, `as unknown as` type laundering), some architectural issues (1043-line steward-bridge.ts, duplicated auth header construction), and a number of correctness issues (missing `useCallback` deps, inconsistent env var resolution, potential race in lazy agent setup). The UI work is clean and follows existing patterns well. The policy controls are thoughtfully designed with USD-based cross-chain values.

---

## 2. P0 / P1 Issues (Must Fix Before Merge)

### P0-1: Unauthenticated Webhook Endpoint
**File:** `packages/app-core/src/api/server.ts` (~line 2810)  
**Severity:** P0 (security)

The steward webhook endpoint (`POST /api/wallet/steward-webhook`) explicitly skips auth:
```typescript
// Webhook endpoint — steward pushes tx lifecycle events here.
// No auth required (steward is trusted on loopback), but we validate shape.
```

While the comment says "trusted on loopback," there's no actual loopback check. If the app binds to `0.0.0.0` or is behind a reverse proxy, any attacker can inject fake tx events into the ring buffer, potentially tricking the UI into showing transactions as approved/confirmed when they weren't.

**Fix:** Add at minimum a source IP check (`req.socket.remoteAddress === '127.0.0.1'`) or a shared HMAC secret between steward and milady.

### P0-2: Master Password in Credentials File
**File:** `packages/app-core/src/services/steward-sidecar/wallet-setup.ts` (line ~167)  
**Severity:** P0 (security)

The `StewardCredentials` type includes `masterPassword` and it's persisted to `credentials.json`:
```typescript
const credentials: StewardCredentials = {
  ...
  masterPassword: masterPassword || generateMasterPassword(),
};
fs.writeFileSync(credPath, JSON.stringify(credentials, null, 2), { mode: 0o600 });
```

While `mode: 0o600` is good, storing the vault master password alongside API keys in a JSON file is risky. If an attacker gets read access to `~/.milady/steward/credentials.json`, they get the vault encryption key.

**Fix:** Store the master password in a separate file or use the OS keychain (Electrobun has native access). At minimum, document this risk.

### P1-1: Missing `useCallback` Dependencies
**File:** `packages/app-core/src/state/AppContext.tsx` (~line 2108-2130)  
**Severity:** P1 (correctness)

All four new steward callbacks have empty dependency arrays but capture `client`:
```typescript
const getStewardHistory = useCallback(
  async (opts?) => client.getStewardHistory(opts),
  [],  // ← missing `client`
);
```

If `client` changes (reconnect, re-auth), these callbacks will use the stale reference.

**Fix:** Add `[client]` to each dependency array, or verify `client` is a module-level singleton that never changes.

### P1-2: Race Condition in Lazy Agent Ensure
**File:** `packages/app-core/src/api/server.ts` (~line 2615)  
**Severity:** P1 (correctness)

```typescript
if (isStewardConfigured()) {
  const agentId = resolveStewardAgentId(process.env, addresses.evmAddress);
  void ensureStewardAgent({
    agentId: agentId ?? undefined,
    agentName: characterName ?? undefined,
  }).catch(() => { /* non-fatal */ });
}
const status = await getStewardBridgeStatus({ ... });
```

`ensureStewardAgent` is fire-and-forget (`void`), but `getStewardBridgeStatus` immediately after may not see the newly created agent. On first launch, the status endpoint will return "not connected" even though setup is in progress.

**Fix:** `await` the `ensureStewardAgent` call, or add a once-flag that gates the status response with a "setting up" state.

### P1-3: Env Var Mutation as Cache
**File:** `packages/agent/src/api/wallet-routes.ts` (~line 426-432)  
**Severity:** P1 (architecture/correctness)

```typescript
process.env.STEWARD_EVM_ADDRESS = agentEvm;
process.env.STEWARD_SOLANA_ADDRESS = agentSolana;
```

Using `process.env` as a mutable cache is fragile and can cause test pollution. The `wallet.ts` `getWalletAddresses()` reads these, but there's no synchronization. If two requests hit the generate endpoint concurrently, they could write conflicting values.

**Fix:** Use a proper singleton/module-level variable instead of `process.env` for cached addresses.

### P1-4: Duplicated Auth Header Construction
**Files:** Multiple locations  
**Severity:** P1 (maintenance/security)

Auth header construction is copy-pasted in at least 4 places:
- `steward-bridge.ts` → `buildStewardHeaders()`
- `wallet-routes.ts` → inline headers object
- `wallet.ts` → `initStewardWalletCache()` inline
- `wallet.ts` → `getWalletAddressesWithSteward()` inline

Each has slightly different logic (some check `bearerToken` first, some use `X-Steward-Key` vs `X-Api-Key`). The `ensureStewardAgent` function uses `X-Api-Key` for tenant creation while `buildStewardHeaders` uses `X-Steward-Key`.

**Fix:** Centralize to a single `buildStewardHeaders()` function and import everywhere. Verify the header name inconsistency (`X-Api-Key` vs `X-Steward-Key`) is intentional.

---

## 3. P2 Issues (Should Fix)

### P2-1: steward-bridge.ts is 1043 lines
**File:** `packages/app-core/src/api/steward-bridge.ts`  
**Severity:** P2 (maintainability)

This file has grown to 1043 lines covering: status, signing, wallet addresses, balances, tokens, pending approvals, approve/deny, history, webhook, auto-setup, provisioning. It should be split into logical modules (e.g., `steward-wallet.ts`, `steward-vault.ts`, `steward-webhook.ts`, `steward-setup.ts`).

### P2-2: `as unknown as` Type Laundering
**File:** Multiple (23 occurrences in diff)  
**Severity:** P2 (type safety)

Heavy use of `as unknown as` to cast SDK types to inline shapes:
```typescript
const agent = (await client.getAgent(agentId)) as unknown as {
  walletAddress?: string;
  walletAddresses?: { evm?: string; solana?: string };
};
```

This is repeated 6+ times with the same shape. The SDK's `AgentIdentity` type appears to not include `walletAddresses`.

**Fix:** Define a `StewardAgentData` interface once and cast to it. Better yet, open a PR on `@stwd/sdk` to add the `walletAddresses` field to `AgentIdentity`.

### P2-3: Inconsistent Steward Agent ID Resolution
**File:** `packages/agent/src/api/wallet-routes.ts` vs `steward-bridge.ts`  
**Severity:** P2 (correctness)

`wallet-routes.ts` resolves agent ID from:
```typescript
process.env.STEWARD_AGENT_ID || process.env.MILADY_STEWARD_AGENT_ID || process.env.ELIZA_STEWARD_AGENT_ID
```

But `steward-bridge.ts`'s `resolveStewardAgentId()` also falls back to `evmAddress`. The `wallet-routes.ts` code doesn't use `evmAddress` as fallback, so agent ID resolution is inconsistent between the two paths.

**Fix:** Use `resolveStewardAgentId()` consistently everywhere.

### P2-4: Webhook Ring Buffer Not Bounded by Time
**File:** `packages/app-core/src/api/steward-bridge.ts` (~line 735)  
**Severity:** P2 (correctness)

The webhook event buffer stores up to 200 events with no expiry. Old events from days ago could still be returned by the poll endpoint, leading to stale UI data.

**Fix:** Add a timestamp check and evict events older than e.g., 24 hours, or use `sinceIndex` more aggressively in the client.

### P2-5: Missing Error Handling in Transfer Action Steward Path
**File:** `packages/app-core/src/actions/transfer-token.ts` (~line 250)  
**Severity:** P2 (correctness)

The steward sign request sends `value: amountRaw` but `amountRaw` is the user-facing amount (e.g., "0.1"), not a wei value. The steward `signViaSteward` function passes this to `/vault/:agentId/sign` as the `value` field. If the steward API expects wei, this will sign transactions for the wrong amount.

**Fix:** Verify whether steward's sign endpoint expects wei or human-readable amounts. If wei, convert before sending.

### P2-6: PolicyControlsView Imports Client Directly
**File:** `packages/app-core/src/components/PolicyControlsView.tsx` (line 26)  
**Severity:** P2 (architecture)

```typescript
import { client } from "../api";
```

This bypasses the React context pattern used elsewhere in the app. Other components get the client through `useApp()` hooks.

**Fix:** Use the existing `useApp()` context or the `getStewardPolicies`/`setStewardPolicies` methods already exposed through AppContext.

### P2-7: BscTradePanel Emoji in Steward Indicator
**File:** `packages/app-core/src/components/BscTradePanel.tsx` (~line 492)  
**Severity:** P2 (consistency)

```typescript
🛡️ Steward
```

The PR description says "emoji removal" is one of the goals, but this adds an emoji. Other steward indicators use the `StewardLogo` SVG component.

**Fix:** Replace the emoji with `<StewardLogo size={14} />`.

### P2-8: `_total` Unused State in TransactionHistory
**File:** `packages/app-core/src/components/steward/TransactionHistory.tsx` (~line 77)  
**Severity:** P2 (dead code)

```typescript
const [_total, setTotal] = useState(0);
```

The `_total` is never read — pagination uses `filtered.length` instead.

**Fix:** Remove `_total` / `setTotal` or use them for server-side pagination.

### P2-9: Homepage Test File Changed But Not Reviewed
**File:** `apps/homepage/src/__tests__/wallets-panel.test.tsx` (376 lines added)  
**Severity:** P2 (test coverage)

New tests added for the homepage WalletsPanel — good. But there are no tests for:
- `PolicyControlsView` saving/loading (the test file exists but is basic)
- `StewardView` component
- `ApprovalQueue` component
- Transfer action steward path
- Webhook endpoint injection

### P2-10: Credential Logging
**File:** `apps/app/electrobun/src/native/steward.ts` (~line 129)  
**Severity:** P2 (security)

```typescript
console.log(
  `[Steward] Env configured: API=${apiBase} agent=${credentials.agentId} wallet=${credentials.walletAddress}`,
);
```

While wallet addresses are public, this logs env configuration details. More concerning, `configureStewardEnvFromCredentials()` writes API keys to `process.env` which could appear in crash dumps.

**Fix:** Don't log credential-adjacent info at `log` level. Use `debug` or remove.

---

## 4. P3 Issues (Nice to Have)

### P3-1: `normalizeEnvValue` vs `normalizeEnvValueOrNull`
Both are used in steward-bridge.ts — `normalizeEnvValue` is aliased to `normalizeEnvValueOrNull` at line 57. The naming is confusing. Consider using one consistently.

### P3-2: `HOUR_TO_OPTIONS` Off-by-One UX
**File:** `PolicyControlsView.tsx`  
The "To" hours start at `1` (`01:00`) and go to `24` (`24:00`). `24:00` is technically valid but unusual in UI. Consider using `0-23` with display `00:00-23:00`.

### P3-3: `StewardLogo` SVG is 13KB Inline
**File:** `packages/app-core/src/components/steward/steward-logo.svg`  
The SVG is an extremely detailed 400x400 path (13KB). For a logo used at 12-48px sizes, this is excessive. Consider a simplified version.

### P3-4: `ethToNumber` Deprecated Alias
**File:** `packages/app-core/src/components/policy-controls/helpers.ts`  
```typescript
/** @deprecated Use parseAmount instead. */
export const ethToNumber = parseAmount;
```
New code shouldn't ship deprecated exports. Just remove it.

### P3-5: `resetSteward()` Uses `rmSync` with `force: true`
**File:** `apps/app/electrobun/src/native/steward.ts`  
While there's a safety check for path being under `~/.milady/`, `rmSync({ recursive: true, force: true })` is aggressive. The safety check is good but could be bypassed if `HOME` is manipulated.

### P3-6: Solana Chain IDs
**File:** `packages/app-core/src/components/steward/chain-utils.ts`  
Using `101` and `102` as Solana chain IDs is a convention specific to this codebase (Solana doesn't have EIP-155 chain IDs). This should be documented somewhere.

### P3-7: `stewardAgentEnsured` Module-Level Flag
**File:** `packages/app-core/src/api/steward-bridge.ts`  
A `let stewardAgentEnsured = false` flag with a `__resetStewardAgentEnsured()` test helper is fine, but if the process runs multiple agents (future), this won't work. Low risk for now.

### P3-8: Missing i18n for Policy Labels
**File:** `packages/app-core/src/components/PolicyControlsView.tsx`  
Policy control labels ("Auto-Approve", "Spending Limits", "Rate Limits", etc.) are hardcoded English strings, not using `t()`.

---

## 5. What's Done Well

1. **Steward-first, local-fallback pattern** — Elegantly implemented across `getWalletAddresses()`, `signTransactionWithOptionalSteward()`, and trade execution. Users without steward configured see zero changes.

2. **Credential persistence with 0o600 permissions** — `steward-credentials.ts` and `wallet-setup.ts` both set restrictive file permissions. The env-override-then-file precedence is well thought out.

3. **Policy controls architecture** — The `policy-controls/` module is cleanly decomposed into types, constants, helpers, and per-policy section components. USD-based cross-chain values are the right abstraction.

4. **StewardSidecar class** — Well-structured lifecycle management with exponential backoff, health check polling, AbortController cleanup, and crash recovery. The `wallet-setup.ts` skip-on-crash-restart comment is a good call.

5. **Structured steward sign response** — Mapping HTTP 200/202/403 to `approved`/`pending`/`denied` is clean and lets callers handle all three states.

6. **Error isolation** — Almost every steward interaction has try/catch with "non-fatal" fallback logging. Steward being down never breaks the core app.

7. **`resetSteward()` path traversal guard** — The check that `resolvedDataDir.startsWith(miladyBase)` before `rmSync` is good defensive coding.

8. **Test coverage for sidecar** — Unit tests for the sidecar lifecycle without spawning real processes. The mock pattern is clean.

9. **Shared type contracts** — `packages/shared/src/contracts/wallet.ts` additions provide a single source of truth for steward types used by both server and client.

10. **Clean UI patterns** — The steward components (`StewardView`, `ApprovalQueue`, `TransactionHistory`) follow the existing desktop surface panel patterns with consistent classnames and responsive design.
