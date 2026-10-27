# Phase 14 invoice-document completeness


> Integrated 2026-10-27 on `integration/taxguard-phase15` from Codex's uncommitted work in the Phase 14 continuation
> worktree; the code and tests are unchanged from that work and were validated there.
Development branch: `claude/taxguard-phase14-full-platform-development`; baseline `545115a`.
Workspace: `D:\TaxGuard\Development\123-codex-phase14-continuation`, a separate worktree. The original
Phase 15 workspace, its three untracked paths and all Codex/Copilot branches were preserved.

## Reproduced defects

`npm.cmd test -- src/tests/invoiceDocument.test.ts` on the old renderer with new regressions first reported
7 passed / 3 failed. Adding the independent sparse-identifier case reported 7 passed / 4 failed:

- 499 and 500 lines were complete; 501 and 1,001 both rendered only 500 lines.
- An invalid three-decimal amount in line 501 was silently ignored instead of refusing the document.
- Sparse identifier 1001 rendered as 100; the test also covers the PostgreSQL integer maximum 2147483647.

These are measured document failures, separate from Phase 15's ledger aggregation defect. SQL already
projects all invoice lines in line-number order. Accounting totals were complete; the PDF detail was not.

## Minimum correction

`invoiceDocument.ts` now iterates the complete projected collection. Existing PDF pagination handles all
lines, so no larger arbitrary detail cap was substituted. The identifier column grows to the database's
integer width, taking space from the description column to retain the existing 86-character table width.
Every projected line still passes the original exact-decimal validation. Authorization, issued-state gate,
SQL projections, accounting arithmetic, money format, response API and PDF delimiter escaping are unchanged.

`invoiceDocument.test.ts` covers 499/500/501/1001 items, sparse identifiers, tail validation, PDF contents,
pagination and cross-reference offsets. `invoiceDocumentCompleteness.db.test.ts` bulk-seeds only synthetic
fixture rows on disposable loopback PostgreSQL, recomputes with the existing helper, and submits/approves
through independent manager actors. The real client projection is then rendered and reconciled:

| Lines at 1.01 each | SQL subtotal/total/balance | Projected and rendered lines |
| --- | --- | --- |
| 499 | 503.99 | 499 |
| 500 | 505.00 | 500 |
| 501 | 506.01 | 501 |
| 1001 | 1011.01 | 1001 |

All four database fixtures passed in the full database suite. Planted private override reasons and staff
identities are absent. Expected totals use integer BigInt cents in tests; production arithmetic was not changed.

## Validation commands and actual results

| Exact command | Result |
| --- | --- |
| `npm.cmd ci --cache D:\TaxGuard\Development\123-codex-phase15\.phase15-npm-cache --prefer-offline --no-audit --no-fund` | 244 locked packages installed; lockfile unchanged |
| `npm.cmd test -- src/tests/invoiceDocument.test.ts` before correction | 7 passed / 4 failed after all regressions added |
| `npm.cmd test -- src/tests/invoiceDocument.test.ts src/tests/billingHttp.test.ts src/tests/billingClientProjection.test.ts` | 27 passed / 3 files |
| `npm.cmd run test:db -- src/tests-db/invoiceDocumentCompleteness.db.test.ts` initial fixture | 1 passed / 3 failed: too-short synthetic keys for counts 499/500/501; corrected to `pdf-invoice-${count}`, validation retained |
| `npm.cmd test` | 5764 passed / 351 files |
| `npm.cmd run test:db` | 89 passed / 23 files, including all four new reconciliation fixtures |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/02-practice-documents-billing.e2e.test.ts src/tests-e2e/17-billing-rework-credits.e2e.test.ts src/tests-e2e/18-client-confidentiality-sweep.e2e.test.ts` | 14 passed / 2 failed: C9 sweep depends on the earlier messaging suite's fixtures, omitted by this selection; no assertions changed |
| `npm.cmd run test:e2e` | Full default/provider profiles in progress; results required before commit |
| `npm.cmd run staging:recovery:local` | PASS: 148 tables / 7194 synthetic rows; schema/isolation, restart persistence, billing projection and security-audit immutability passed |
| `npm.cmd run staging:migration:release-candidate` | PASS: 74 canonical/review entries, 49 replay-safe proposals; matching fingerprint `da87ad251c5c96ba40b612d2438e46254ee948d0158c997cfab158ba027f006b`; no external access |
| `npm.cmd run security:secrets` | PASS, zero findings |
| `node scripts/verify-local-traceability.mjs` | PASS, 230 requirements / 61 agents / 18 stages, release unauthorized |
| `npm.cmd test -- src/tests/traceabilityEvidenceIntegrity.test.ts src/tests/stageCapabilities.test.ts src/tests/aiCommissioningMatrix.test.ts` | 38 passed / 3 files after matrix evidence refresh |
| `git diff --check` | Passed |

## Recovery regression routing

Run [39153095799](https://github.com/OphireumTechnology/taxguard/actions/runs/39153095799) failed on
Codex PR 31's `9831c81`, not the authorized Phase 14 baseline. The fixture correction was already committed
as `5f4276a1c67553598d996b3869f8cd7a72264879` in that separate PR: the add-line call includes stable synthetic
key `recovery-line-1`. Recovery validation and replacement [CI 39175986644](https://github.com/OphireumTechnology/taxguard/actions/runs/39175986644)
passed. No redundant fix or mandatory-validation removal was made on Phase 14. When integrating the keyed
Phase 15 API, retain that correction and adapt Phase 14's additional direct callers with explicit stable keys.

## Limits and next package

This is a generated download, not invoice delivery or a receipt. Existing ASCII substitution and description
clipping remain; rendering is proportional to the authenticated invoice's persisted detail. No arbitrary new
business line limit was introduced. Very large invoice resource limits need a reviewed explicit failure or
export contract, never silent financial-detail omission. No hosted migration or financial transaction occurred.

The Phase 14/15 refund-schema conflict, consent approval, owner-level audit retention/custody and all release
gates remain open. Next bounded review: onboarding authorization while waiting for database locks, followed by
Stage 01/case continuity and A00 synthetic claim/retry integrity. See [the continuation inventory](phase14-continuation-readiness.md).
**STAGING NO-GO / PRODUCTION NO-GO.**
