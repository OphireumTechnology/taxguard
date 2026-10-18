# Phase 15 reporting integration

Base: main `6e31a40283b2475f7a836ef3a9f0c96a6d2d2101`. Branch: `codex/taxguard-phase15-financial-reporting-integrated`. This branch ports the reporting correction from PR #24 onto current main without merging a PR or rewriting either branch.

## Implementation

- Historical proposal 024 is byte-preserved. New additive proposal `20261018000000_taxguard_financial_reporting.sql` adds the authorized report RPC with explicit dependency on 024. Only service_role can execute it; existing actor/assignment checks and tenant/client joins remain in force.
- Complete SQL opening/closing balances and running sums precede the per-account detail limit. Ordering is posting date, entry number and line number. Optional store filters select the reporting period/cutoff and detail limit; prior posted activity supplies the opening balance.
- Existing API fields and arguments remain; opening balance, complete line count and truncation metadata are additive. Detail is bounded to 1–500 lines per account. Reversal effects begin at their approved posting dates.
- Narrow PGlite ledger fixtures include the overlay. Canonical execution DAG, offline manifest, review-only packet and catalog audit include the new file. Replay validation includes October 18 overlays so older privilege resets are followed by the new service-role grant.
- Only affected traceability hashes were refreshed; acceptance classifications and NO-GO gates remain unchanged. The three original untracked paths are preserved and excluded from commits.

## Measured reproduction and reconciliation

The shared fixture executes the original bounded reader plus original report calculation against real PostgreSQL and PGlite, then compares the complete report to the trial balance. This measures the legacy defect without editing or reverting historical SQL.

| Posted one-dollar entries | Legacy balance | Complete balance / trial balance | Displayed cash lines |
| --- | ---: | ---: | ---: |
| 499 | $499 | $499 | 499 |
| 500 | $500 | $500 | 500 |
| 501 | $500 | $501 | 500 |
| 1,001 | $500 | $1,001 | 500 |

Additional shared fixtures cover multiple accounts and periods, opening/closing balances, approved/unapproved reversals, historical cutoffs, populated foreign tenant/client ledgers, unknown actors, invalid filters, and deterministic repeated account lines. Measured opening $12.34; January $15.55; February $16.66; March $13.45 after an approved $3.21 reversal. Limits 1/2/500 preserve March's close.

## Validation

- `npm.cmd test -- src/tests/phase15Reporting.test.ts src/tests/durableLedgerSql.test.ts src/tests/durableLedgerHttp.test.ts`: 29 passed.
- `npm.cmd run test:db -- src/tests-db/phase15Reporting.db.test.ts`: 3 passed. The first attempt stopped before tests with `STAGING_MIGRATION_MANIFEST_STALE`; offline regeneration corrected it.
- `node scripts/staging/migration-manifest.mjs --write`, `node scripts/staging/migration-review-bundle.mjs --write`, `node scripts/migrations/build-migration-manifest.mjs`: succeeded; 70 executable review entries, 71 audit entries including the separate non-executable audit draft.
- `npm.cmd run test:db -- src/tests-db/composition.db.test.ts`: 6 passed, including full schema/privilege replay fingerprint stability.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run build`: passed, client and server outputs.
- `npm.cmd run security:secrets`: PASS, 1,459 text files scanned, 108 binary files skipped, zero findings at that checkpoint.
- `node scripts/verify-local-traceability.mjs`: PASS, 230 requirements; browser acceptance NOT VERIFIED, release authorization false.
- `git diff --check`: passed.

- `npm.cmd test`: 5,718 passed across 346 files, zero failures (350.04 seconds).
- `npm.cmd run test:db`: 61 passed across 17 files, zero failures (333.97 seconds).
- `npm.cmd run staging:migration:release-candidate`: PASS; 70 canonical/review entries, 45 replay-safe proposals; fingerprint `93e148fb2700a898eb9e140168f7caed2a2baa334e54c958de8cc495f85f418e`. RLS and pinned search paths passed in both disposable databases; 13 pre-existing NOT VALID constraints were reported, not certified.
- `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/03-ledger-b2t-cases.e2e.test.ts`: 4 passed in installed Edge with synthetic users and loopback PostgreSQL (25.07 seconds). Provider-profile browser acceptance is not claimed by this targeted run.

## Remaining gates

Staging and production remain NO-GO. No hosted database or customer/provider system was accessed. No deployment, hosted migration, PR merge, credential change or policy change is authorized by these local results. The additive SQL needs separate migration review/application and server sequencing. UI display of opening/truncation metadata and HTTP date/limit controls remain separate work. Large-history performance beyond these fixtures is unbenchmarked. The existing number-based monetary transport can lose cents at extreme aggregate sizes; that independently reproduced issue is the next work package.
