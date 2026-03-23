# 2026-03-23 Repository Cleanup Plan

## Baseline

- `knip`
  - 212 unused files
  - 61 unused dependencies
  - 149 unused exported types
  - 2 duplicate exports
- `madge`
  - `packages/agent/src/index.ts`: 0 cycles
  - `packages/app-core/src/index.ts`: 0 cycles
  - `packages/ui/src/index.ts`: 0 cycles
- `scripts/type-audit.mjs --json`
  - 2,498 type definitions
  - 2,315 exact or subset/superset structural overlaps
- Re-export and boundary scan
  - 110 pure re-export files
  - 72 cross-package re-export bridge files
  - 212 package-boundary violations before manifest fixes

## Phase 1

- [x] Run `knip`, `madge`, and the existing collision/type audits.
- [x] Capture the cleanup backlog in a tracked plan.
- [ ] Replace the old collision script with an AST-based audit that reports:
  - class name collisions
  - exported function name collisions
  - local interface collisions
  - exported interface collisions
  - local type alias collisions
  - exported type alias collisions
  - pure re-export files
  - package-boundary violations

## Phase 2

- [ ] Consolidate exact duplicate `agent` and `shared` contract sources:
  - `packages/agent/src/contracts/apps.ts`
  - `packages/agent/src/contracts/permissions.ts`
  - `packages/agent/src/contracts/wallet.ts`
  - `packages/agent/src/utils/spoken-text.ts`
- [ ] Re-run lint, build, typecheck, unit tests, and e2e.

## Phase 3

- [ ] Fix package hierarchy drift.
- [ ] Start with manifest-level correctness:
  - `packages/app-core/package.json` currently imports `@miladyai/agent` throughout source but does not declare it.
- [ ] Re-run the new audit and verify the hierarchy violation count drops sharply.
- [ ] Re-run lint, build, typecheck, unit tests, and e2e.

## Phase 4

- [ ] Reduce one-line cross-package re-export bridges where they do not provide necessary public API compatibility.
- [ ] Keep intentionally public compatibility shims only when they are part of a stable package surface.
- [ ] Re-run lint, build, typecheck, unit tests, and e2e.

## Phase 5

- [ ] Work through `knip` findings in descending confidence:
  - duplicate exports
  - unused exported types
  - unused files outside vendored or generated trees
  - unused dependencies with package-level validation before removal
- [ ] Re-run lint, build, typecheck, unit tests, and e2e.

## Phase 6

- [ ] Consolidate duplicated interfaces and type aliases, prioritizing exact structural matches first.
- [ ] Highest-confidence families to unify first:
  - permissions contracts
  - wallet contracts
  - app manager contracts
  - config schema and message config types
  - benchmark and trajectory transport types
- [ ] Re-run lint, build, typecheck, unit tests, and e2e.

## Phase 7

- [ ] Review remaining same-name different-shape collisions and decide whether to:
  - rename for clarity
  - move to package-local names
  - keep intentionally separate
- [ ] Final verification:
  - `bun run check`
  - `bun run build`
  - `bun run typecheck`
  - `bun run test`
  - `bun run test:e2e`
