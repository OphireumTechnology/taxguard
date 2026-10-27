# Phase 15 invoice creation idempotency

Branch: `codex/taxguard-phase15-financial-idempotency`, based on `19d710c`.
Scope: invoice creation retry identity/concurrency and explicit billing contention errors.
Broader write/audit inventory: [financial write review](phase15-financial-write-review.md).

## Correction

An additive, unapplied SQL proposal replaces the existing invoice-creation RPC without changing its signature or result shape. A transaction-scoped advisory lock serializes a tenant/key before checking the durable unique index. Full comparison includes actor, client, engagement and due date. Authorization runs before and after waiting. Identical retries return the same invoice ID with `created: false`; conflicting payloads return `BILLING_IDEMPOTENCY_CONFLICT`/409. Invoice and audit creation remain atomic. New identifiers use JSON-framed tenant/key input; existing identifiers remain readable/replayable.

The billing store maps PostgreSQL lock-unavailable, serialization-failure and deadlock SQLSTATEs to `BILLING_BUSY`/409, without internal SQL detail. It does not automatically retry financial writes or conceal arbitrary database failures.

## Measured validation

All databases were disposable, bound to loopback, and contained synthetic fixtures.

| Exact command | Result |
| --- | --- |
| `npm.cmd run test:db -- src/tests-db/invoiceIdempotency.db.test.ts` before SQL correction | 0 passed, 2 failed: changed-date replay accepted; concurrent identical caller received generic unavailable |
| Same command after correction and expanded fixtures | 7 passed: changed-date conflict, eight identical callers/one invoice/one audit, conflicting concurrency, client/actor/engagement binding and tenant independence, rollback/recovery, revoked authorization and service-only grants, lock-timeout recovery and complete scoped creation audit |
| `npm.cmd run test:db` | 72 passed, 19 files (before the seventh targeted case was added; that case separately passed) |
| `npm.cmd test` initial | 5783 passed, 2 failed: stale traceability evidence after the E2E fixture edit; hashes refreshed; final rerun recorded below |
| `npm.cmd test` final | 5785 passed, 348 files |
| `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/02-practice-documents-billing.e2e.test.ts` initial | 3 passed, 3 failed; document fixture read options before asynchronous engagement loading; billing cases passed |
| Same E2E command after waiting for the engagement option | 6 passed, 1 file |
| `npm.cmd run typecheck` | Passed, including the final rerun after expanding the PostgreSQL fixture |
| `npm.cmd run build` | Passed, Vite client and esbuild server |
| `npm.cmd run staging:migration:release-candidate` | PASS: 72 canonical and 72 review entries; 47 replay-safe proposals; matching schema fingerprint `7bded0eb363795c309d6147616382ab18ace050a786370da559c2c4a8d6a3a7d`; zero external database access |
| `npm.cmd run security:secrets` | PASS, zero findings |
| `node scripts/verify-local-traceability.mjs` | PASS, 230 requirements, no release authorization |
| `git diff --check` | Passed |

Migration artifacts regenerated using `node scripts/staging/migration-manifest.mjs --write`, `node scripts/staging/migration-review-bundle.mjs --write`, and `node scripts/migrations/build-migration-manifest.mjs`. Historical proposal files were preserved. The separate owner-level append-only proposal remains outside executable authority.

## Limits and next package

No invoice amounts, accounting rules or maker-checker decisions changed. This package does not make refund, invoice-line, credit-request or tax-adjustment creation idempotent; those gaps are explicitly inventoried. No live processor was called. Financial audit tamper detection remains a design proposal for independent review, not an implemented guarantee. The browser fixture correction only waits for existing asynchronous data; it changes no product authorization or document policy.

Next independent package: reproduce and correct tax-adjustment payload binding and concurrent creation. Then address key-carrying refunds/credits and line writes, preserving accounting and authorization invariants.

Staging and production remain **NO-GO**. No PR was merged, no hosted migration applied, and no deployment performed.
