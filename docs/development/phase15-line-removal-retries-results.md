# Phase 15 delayed invoice-line removal retries

Branch: `codex/taxguard-phase15-line-removal-retries`, based on `378255e` (draft PR 32).

## Reproduction and correction

Baseline `npm.cmd run test:db -- src/tests-db/billingWriteRetries.db.test.ts`: 8 passed, 1 failed. The fixture removed line 1, added a new 200.00 line reusing line number 1, then retried the first removal with its original HTTP key. The retry returned an empty invoice again with an incremented row version, deleting the replacement.

Unapplied proposal `20261019050000_taxguard_line_removal_retries.sql` extends the protected billing receipt namespace with `REMOVE_LINE`. A keyed wrapper binds invoice/line number plus existing tenant/client/actor scope, reuses transaction serialization and reauthorization, and returns the stored removal result on retry. The original draft-only business function becomes internal to the wrapper; service-role keyless execution is revoked. No line-number allocation or invoice status policy changed.

The HTTP route forwards a required key and the store calls the keyed RPC. No existing browser removal helper/UI or direct script caller required migration. A new key remains a distinct removal intent; equal-valued lines are not automatically deduplicated. The stored result is historical; current state comes from invoice reads.

One attributed removal audit includes receipt identity, line number and safe before/after subtotal/total strings. Line deletion, totals, receipt and audit are atomic. Owner custody and retention remain review proposals; no hosted permissions or owner-level audit policy were changed.

## Validation

| Command | Result |
| --- | --- |
| `npm.cmd run test:db -- src/tests-db/billingWriteRetries.db.test.ts` baseline | 8 passed, 1 failed: reused line removed on delayed retry |
| Expanded fixture first run | 11 passed, 1 failed: approval assertions were placed in the wrong test; corrected without changing product behavior |
| Same command after correction | 12 passed: delayed replay, changed line conflict, preservation after invoice approval, six-way duplicate removal, audit-failure rollback/recovery, required key and actual service-role bypass denial; prior line/credit tests retained |
| `npm.cmd test` | 5789 passed, 349 files |
| `npm.cmd run test:db` | 112 passed, 23 files |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/02-practice-documents-billing.e2e.test.ts` | 6 passed |
| `npm.cmd run staging:migration:release-candidate` | PASS; 77 canonical/review entries, 52 replay-safe proposals; matching fingerprint `054f00064ac62873572359dc06802beb1b427eac0cabd734ddfa234b07695421`; no external database access |
| `npm.cmd run security:secrets` | PASS, zero findings |
| `node scripts/verify-local-traceability.mjs` | PASS, 230 requirements, release unauthorized |

`git diff --check` and `git diff --cached --check` passed. Existing historical SQL and original untracked files remain preserved. Draft PRs 31 (after repair) and 32 have green CI and remain unmerged. PR 22 untouched. No hosted migrations, deployments, merges or real financial transactions. Staging/production remain **NO-GO**.
