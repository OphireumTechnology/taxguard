# Phase 15 financial report request validation

Branch: `codex/taxguard-phase15-report-input-validation`, based on precision commit `93de71e` (draft PR #26), which includes reporting integration PR #25. Development only; staging and production remain NO-GO.

## Measured defect

Fifteen authenticated HTTP regression cases failed before correction. Ten returned HTTP 200 for malformed selections: garbage/empty/repeated/object years defaulted to 2025, years 1999/2101 were accepted, and malformed/empty/repeated/object or overlong cutoff values could be discarded. Five produced HTTP 503 for invalid fractional/infinite years or invalid calendar dates instead of a client input error.

Examples measured on the local durable HTTP fixture:

| Request selection | Original response |
| --- | --- |
| `taxYear=garbage` | 200, report labeled 2025 |
| `taxYear=2025&taxYear=2026` | 200, report labeled 2025 |
| `taxYear=1999` / `taxYear=2101` | 200, unsupported year retained |
| `taxYear=2025.5` / `taxYear=Infinity` | 503 |
| `asOf=2025-02-30` / `asOf=2025-13-01` | 503 |
| `asOf=2025-12-31T00:00:00Z` | 200, supplied cutoff discarded |

## Correction

The ledger dispatch validates an explicit year as an integer from 2000 through 2100, matching the ledger schema's existing supported range. Query strings must contain four digits; body values can be integer numbers or those year strings. Missing year still defaults to 2025 for compatibility. Empty, fractional, infinite, repeated, boolean, object and out-of-range values fail with HTTP 400 `LEDGER_INPUT_INVALID`, before persistence.

Trial balance and financial statements accept an omitted cutoff or one real calendar date in exact `YYYY-MM-DD` format. UTC round-trip validation rejects normalized impossible dates, non-leap February 29, month 13 and year zero. No new relation between a valid cutoff and the report year is imposed; existing cutoff semantics remain unchanged. Memory and durable dispatch both reject malformed selections. Valid leap-day and year-boundary inputs remain accepted.

Scope parsing now runs within the route's existing coded error handler. This prevents validation exceptions from escaping the async Express route. Tenant/client authorization still runs through the same middleware and RPC checks. No SQL, tax policy, security controls, idempotency behavior or financial transactions changed.

## Validation

- `npm.cmd test -- src/tests/durableLedgerHttp.test.ts`: before correction, 15 failed and 7 passed; recorded actual HTTP responses above.
- `npm.cmd test -- src/tests/durableLedgerHttp.test.ts src/tests/ledgerMemoryWorkflows.test.ts src/tests/ledgerIntegrityAndPeriodClose.test.ts`: 70 passed before adding three further cutoff cases.
- `node scripts/staging/migration-manifest.mjs` and `node scripts/staging/migration-review-bundle.mjs`: unchanged artifacts verified, 71 review-only entries; no external application authority.
- `node scripts/verify-local-traceability.mjs`: PASS, 230 requirements, release authorization false.
- `npm.cmd run security:secrets`: PASS at the checkpoint, 1,465 text files, 108 binary skips, zero findings.
- `git diff --check`: passed.

- `npm.cmd run test:db -- src/tests-db/phase15Reporting.db.test.ts src/tests-db/phase15Precision.db.test.ts src/tests-db/composition.db.test.ts`: 14 passed across 3 files (52.52 seconds). No SQL changed in this package; canonical composition, privilege replay, reporting and precision were rechecked.
- `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/03-ledger-b2t-cases.e2e.test.ts`: 4 passed in installed Edge with synthetic users and loopback PostgreSQL (22.10 seconds).
- `npm.cmd run typecheck` and `npm.cmd run build`: no TypeScript errors; production client/server build passed.

- `npm.cmd test`: 5,781 passed across 347 files, zero failures (251.62 seconds).
- Complete staged diff reviewed; `git diff --cached --check`: passed.

## Review and remaining work

Only dispatch, HTTP regression fixtures, their two traceability hashes and this evidence document belong to this package. Invalid requests have a stable coded error and no partial report; valid defaults and existing semantics are preserved. Valid cutoff/year alignment is deliberately not redefined here. Direct SQL/service RPC input contracts and other financial APIs are separate review targets. Both additive reporting proposals still require separate owner approval/application and server sequencing. All three original untracked paths and Claude PR #22 remain untouched.
