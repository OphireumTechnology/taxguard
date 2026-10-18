# Phase 15 invoice-line and credit-request retries

Branch: `codex/taxguard-phase15-billing-write-retries`, based on `af34972` (draft PR 30).

## Measured defects and correction

Before correction, `npm.cmd run test:db -- src/tests-db/billingWriteRetries.db.test.ts` failed both cases. An identical HTTP line retry appended another line and doubled total from 100.00 to 200.00. An identical credit-request retry created another pending credit with a different ID.

Unapplied additive proposal `20261019030000_taxguard_billing_write_retries.sql` introduces protected receipts unique by tenant/operation/key and bound to client, actor and request. Transaction advisory locks serialize initial submissions and retries. Authorization is checked before and after waiting. Identical retries return the stored operation result without repeating financial or audit writes.

Keyed SECURITY DEFINER wrappers retain the original business functions as internal implementations. SQL pricing, overrides, totals, draft-only edits, credit caps and maker-checker remain unchanged. Service-role execution of the keyless implementations and receipt helpers is revoked; raw receipts are inaccessible to API/service roles. A real service-role fixture proves keyed execution succeeds without those bypass privileges. No hosted permissions were changed.

HTTP paths and success shapes remain compatible; callers must now send `Idempotency-Key`. Browser helpers forward caller keys, and the staff panel retains invoice-specific keys on uncertain failures until confirmed success. Existing direct fixtures now supply explicit keys without weakening assertions. Line creation adds an attributed receipt-linked before/after audit; credit creation retains its creation audit and adds a receipt-link event. Free-form input remains in protected receipts, outside new audit metadata.

## Exact validation

| Command | Result |
| --- | --- |
| `npm.cmd run test:db -- src/tests-db/billingWriteRetries.db.test.ts` before correction | 0 passed, 2 failed |
| Same command after correction and expansion | 8 passed: replay, six-way duplicate concurrency, conflicting payloads, credit approval/retry, scope and revoked access, audit-failure rollback/recovery, service-role execution and bypass denial |
| `npm.cmd test` | 5789 passed, 349 files |
| `npm.cmd run test:db` | 98 passed, 22 files |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/02-practice-documents-billing.e2e.test.ts` | 6 passed |
| `npm.cmd run staging:migration:release-candidate` | PASS; 75 canonical/review entries, 50 replay-safe proposals; fingerprint `9e4f2571e28f866dfca6806f41541813a5772690d01acda4e575c3a74cfd8436`; zero external database access |
| `npm.cmd run security:secrets` | PASS, zero findings |
| `node scripts/verify-local-traceability.mjs` | PASS, 230 requirements, release unauthorized |

Migration artifacts were regenerated offline. Historical SQL and original untracked paths remain preserved. Existing traceability evidence hashes were refreshed without adding the untracked review/checkpoint documents. Full suites completed successfully during the user interruption; their completion output was collected on continuation.

## Limits and review decisions

Stored responses describe the original operation, including a credit request subsequently approved; refresh invoice reads for current state. New keys permit intentional new financial records. Equal business values alone must not suppress legitimate lines, credits or refunds. Pending browser keys currently last for the panel lifetime; callers must retain keys across retries. After leaving/reloading following an uncertain response, verify recorded state before starting another action. Durable cross-device intent recovery and receipt retention require reviewed policy.

Other lifecycle writes retain their state/version guards or natural identities; uniform stored outcomes are not claimed. Bank imports without provider transaction IDs deliberately retain possible-duplicate candidates; redefining batch labels or equal-value transactions as financial identity requires an explicit contract.

Owner-level append-only restrictions, retention/legal-hold exceptions and independent signed anchoring remain review proposals in `phase15-financial-write-review.md`. No tamper-evident archive was commissioned or claimed. Draft PRs 28–30 have green CI and remain unmerged. PR 22 untouched. No hosted migration, deployment or real transaction. Staging/production remain **NO-GO**.
