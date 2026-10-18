# Phase 15 financial reporting integrity

Date: 2026-10-18. Development only; no hosted database, deployment or production migration was touched.

## Measured reproduction

The original `SqlLedgerStore.generalLedger()` called the bounded journal reader with a 500-entry limit, then calculated balances starting at zero. The synthetic fixture posted balanced one-dollar entries through the real ledger RPCs. Before the correction, one test failed with four reconciliation assertions:

| Posted entries | Original general ledger | Trial balance | Corrected general ledger | Displayed cash lines |
| --- | ---: | ---: | ---: | ---: |
| 499 | $499 | $499 | $499 | 499 |
| 500 | $500 | $500 | $500 | 500 |
| 501 | $500 | $501 | $501 | 500 |
| 1,001 | $500 | $1,001 | $1,001 | 500 |

Original failures were measured on PGlite, not inferred. Corrected results were measured on both PGlite and disposable PostgreSQL. An initial fixture run failed input validation because its idempotency key was too short; the key was corrected before these measurements.

## Reporting contract

Proposal 024 adds `taxguard_ledger_general_ledger`. It verifies the existing ledger actor authorization, limits all joins to the requested tenant/client, and reads only posted activity through the cutoff. One SQL statement computes complete integer-cent opening/closing balances and running sums, then selects the latest bounded detail per account. Accounts sort by account number; detail sorts by posting date, entry number and line number.

The existing store arguments and result fields remain supported. An optional fifth argument accepts `fromDate`, `toDate` and `limit` (1–500, default 500). Dates must be ordered and within the requested tax year. Default dates cover that year. Opening balance is all posted activity before the report start; closing balance includes that opening plus activity through the cutoff. Thus prior-year balances now reconcile with trial balance. Reversals contribute only after approval, at their own posting date.

Additional result fields are `openingBalance`, `totalLineCount` and `detailTruncated`. Detail is bounded in **lines per account**, whereas the former reader bounded entries across the query. Running balances include omitted activity. No bounded detail array is used to derive complete balances. The journal search reader and its existing limits are unchanged.

Measured period fixture: opening $12.34; January close $15.55; February close $16.66; approved March reversal $3.21; March close $13.45. Limits 1, 2 and 500 give the same close. An unapproved reversal has no effect. A February-start report opens at $15.55. Both debit-normal cash and credit-normal revenue reconcile. Foreign tenant/client ledgers containing $999 do not contaminate the requested ledger. Repeated lines for one account produce $1.01 then $3.03, and a one-line display retains the $3.03 running balance in repeated reads.

The new function follows the proposal's existing service-only privilege model: pinned search path, actor checks, and revocation from PUBLIC, anon and authenticated. Existing RLS and table grants remain in force.

## Validation commands

- `npm.cmd ci --no-audit --no-fund`: succeeded, 244 packages installed from the existing lockfile; no manifest or lockfile change.
- `npm.cmd test -- src/tests/phase15Reporting.test.ts`: final reporting fixtures, 3 passed on PGlite.
- `npm.cmd test -- src/tests/phase15Reporting.test.ts src/tests/durableLedgerSql.test.ts src/tests/ledgerIntegrityAndPeriodClose.test.ts`: 51 passed before adding the third reporting test.
- `npm.cmd run test:db -- src/tests-db/phase15Reporting.db.test.ts`: final reporting fixtures, 3 passed on disposable PostgreSQL.
- `npm.cmd run test:db`: final run, 30 passed across 9 files; includes security, composition and concurrency (117.41 seconds).
- `npm.cmd run typecheck`: passed after correcting two fixture account subtype names.
- `npm.cmd run build`: passed, Vite client and esbuild server output.
- `git diff --check`: passed.

The first `npm.cmd test` run had 5,292 passed and 2 failed (297 files, 221.84 seconds): both failures were stale proposal hashes in traceability evidence. Only the affected existing hash/byte-count entries were refreshed, preserving acceptance classifications and avoiding references to the pre-existing untracked documents. `npm.cmd test -- src/tests/traceabilityEvidenceIntegrity.test.ts` then passed all 12 tests; `node scripts/verify-local-traceability.mjs` passed with release authorization false and browser acceptance not verified. The final `npm.cmd test` run passed **5,294 tests across 297 files**, zero failures (207.19 seconds).

## Release considerations

This edits an unapplied SQL proposal; it does not create or apply an approved production migration. The server needs the new RPC before durable general-ledger reads can succeed. Deployment sequencing and migration approval remain separate gates. The original three untracked paths are preserved and excluded from the commit.

API consumers retain their existing fields, but consumers that assumed a zero opening or equated visible line totals with the full account balance must use the new contract. The UI currently does not render the additive truncation/opening metadata. Date/limit options are available at the store boundary; extending the HTTP/UI controls is separate work. Large-history query performance beyond these fixtures has not been benchmarked. SQL retains exact cents; the existing number-based API still has JavaScript safe-integer limits for extremely large aggregates.

## Publication and integration status

Correction commit: `c196884`. Pushed to `codex/taxguard-phase15-financial-reporting-integrity`; separate draft PR: https://github.com/OphireumTechnology/taxguard/pull/24.

Validation above applies to the authorized checkout starting at `49369c3`, not current main. A read-only fetch found main at `6e31a40283b2475f7a836ef3a9f0c96a6d2d2101`. GitHub reports the draft not mergeable; the non-mutating three-tree preview confirms a conflict in `docs/taxguard-master-traceability.json`. Main contains substantial later development. No merge, rebase, force-push or modification of main was performed. Resolving that integration conflict and validating the combined revision remain necessary before review/merge readiness; the successful local results do not certify the combined tree.

## Next backend investigation: aggregate monetary precision

After opening the draft, a fresh disposable PostgreSQL investigation used `node --import tsx --input-type=module` with the existing `startDatabase`, `pgRpc` and `SqlLedgerStore` helpers. It created one synthetic tenant/client, an active administrator, cash/revenue accounts, then posted 91 entries of $1,000,000,000,000 plus one $0.01 entry through `postEntry`. Each amount is accepted by the existing per-entry amount contract. The database was stopped in `finally`.

Measured output:

```json
{"postedEntries":92,"exactSqlCents":"9100000000000001","generalLedgerDollars":"91000000000000.00","trialBalanceDollars":"91000000000000.00","safeIntegerCents":false,"lostCents":"1"}
```

The SQL control was `SELECT sum(debit_cents-credit_cents)::text` scoped to that synthetic cash account. It retained the exact cent; both number-based reports lost it. This is a separate existing transport/conversion defect, not another display-cap failure. The next improvement should carry aggregate cents as text through JSON and use exact arithmetic or fail explicitly outside the safe range, with a documented compatibility contract for dollar-number consumers. Required follow-up fixtures should bracket the safe-integer boundary, include positive/negative balances and reversals, and compare SQL text controls with every report. No precision correction is claimed in this PR.
