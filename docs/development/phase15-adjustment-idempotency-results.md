# Phase 15 tax-adjustment idempotency

Branch: `codex/taxguard-phase15-adjustment-idempotency`, based on invoice correction `c05e152` (draft PR 28).

## Measured defect and correction

`npm.cmd run test:db -- src/tests-db/adjustmentIdempotency.db.test.ts` before correction: **0 passed, 2 failed**. A retry with amount changed from -10.01 to -20.02 silently returned the original adjustment. Eight simultaneous identical callers encountered `B2T_STORE_UNAVAILABLE` from a unique-constraint race.

The additive, unapplied proposal `20261019010000_taxguard_adjustment_idempotency.sql` preserves the RPC signature and result. It serializes a JSON-framed tenant/client/key through a transaction advisory lock, reauthorizes after waiting, and compares preparer, tax year, return family, category, exact integer cents, adjustment type, normalized description and evidence ID. Changed material payloads return `B2T_IDEMPOTENCY_CONFLICT`/409. Identical retries return the same adjustment ID without another creation event, even after independent approval. Existing records are compared directly; no speculative historical hashes or data backfill are introduced.

The existing money bounds, required verified evidence, scoped unique constraint and independent reviewer remain authoritative. Invalid null fields fail explicitly rather than becoming an opaque database error. PostgreSQL contention maps to `B2T_BUSY`/409 without internal SQL details. No automatic retries or accounting/tax policy changes.

## Validation

| Exact command | Measured result |
| --- | --- |
| `npm.cmd run test:db -- src/tests-db/adjustmentIdempotency.db.test.ts` after correction | 8 passed: changed amount, eight identical callers/one adjustment/one audit, all material fields and preparer binding, conflicting concurrency, tenant/client scope, rollback/recovery, maker-checker/approved retry lifecycle, revoked access/service-only grants |
| `npm.cmd test` | 5788 passed, 349 files |
| `npm.cmd run test:db` | 81 passed, 20 files |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/03-ledger-b2t-cases.e2e.test.ts` | 4 passed |
| `npm.cmd run staging:migration:release-candidate` | PASS; 73 canonical/review entries; 48 replay-safe proposals; matching fingerprint `f0644a5e18a68fcb608ab2244a1d6eed356c9cfbb097164105e04f6b49d97bd5`; no external database access |
| `npm.cmd run security:secrets` | PASS, zero findings |
| `node scripts/verify-local-traceability.mjs` | PASS, 230 requirements, release unauthorized |
| `git diff --check` | Passed |

Migration artifacts were regenerated with the same three offline commands documented in the invoice package. Historical SQL and existing untracked paths remain preserved. Prerequisite draft PR 28 has green CI (run 39148349733); it remains unmerged.

## Remaining scope

The financial write/audit review documents unresolved refund, line and credit-request retry identity, reconciliation and other lifecycle outcomes, legacy in-memory routes, incomplete before/after audit evidence, and tamper detection. Owner-level append-only policy and external audit anchoring remain independent-review proposals. This package provides creation idempotency; it does not claim stable replay responses for every financial write or full audit immutability.

No hosted migrations, deployments, real financial transactions or merges. Staging/production remain **NO-GO**.
