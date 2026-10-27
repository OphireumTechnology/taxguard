# Phase 15 refund recording idempotency

> **Integration note (2026-10-27).** On `integration/taxguard-phase15` this design was not composed as written. Owner
> instruction: Phase 14's `taxguard_bill_refund_keyed` stays the one canonical refund function, and the capabilities
> below that it lacked (stored result for replay, binding of reason and manager, actor re-check after the lock, 64-bit
> lock key, composite payment foreign key, before/after audit amounts, fail-closed six-argument function) were ported
> into it. `20261019020000_taxguard_refund_idempotency.sql` now hardens that function; no second refund table or
> seven-argument function exists. A reused key is `IDEMPOTENCY_KEY_REUSED`, and the audit keeps the reason. The
> tests in `refundIdempotency.db.test.ts` run against the canonical function. The text below is Codex's original record.

Branch: `codex/taxguard-phase15-refund-idempotency`, based on `99f9623` (draft PR 29).

## Measured defect

`npm.cmd run test:db -- src/tests-db/refundIdempotency.db.test.ts` before correction: **0 passed, 2 failed**. Two HTTP requests with the same `Idempotency-Key` and 20.00 amount recorded 40.00 refunded and reduced invoice amount paid from 100.00 to 60.00. Four simultaneous identical HTTP requests returned different financial balances. These are synthetic database recordings, not real fund transfers.

## Implementation

Additive proposal `20261019020000_taxguard_refund_idempotency.sql` adds a protected receipt table with tenant/key uniqueness and a composite foreign key binding tenant/client/invoice/payment. Raw access is revoked from public, anonymous, authenticated and service roles; the service-only SECURITY DEFINER RPC is the write boundary. JSON-framed transaction advisory locks serialize the tenant/key. Exact decimal amounts, manager authorization, payment row locks and the unrefunded-payment cap remain unchanged.

The refund overload takes a required key and compares client, payment, amount, normalized reason and actor before replay. Authorization is checked before and after waiting. Receipt, payment, invoice and audit changes share one transaction. The receipt stores the original invoice response, so retries return the original successful result even after later independent refunds. Callers must refresh invoice reads for current state. Receipt storage contains the existing staff invoice projection and refund justification; it is confidential financial data, not public metadata. Retention and privileged custody remain review concerns.

The HTTP route now forwards `Idempotency-Key`; `BillingStore.refund` rejects missing/invalid keys. The legacy keyless SQL signature remains callable by the service role but authorizes and fails closed with `IDEMPOTENCY_KEY_REQUIRED`. It cannot perform an unsafe refund. This is an intentional compatibility requirement: callers must retain and reuse a request key, rather than generate a new one on every retry. There was no browser refund helper or refund UI to migrate.

Refund audit events gain a receipt ID and safe before/after paid, balance-due and refunded amounts as exact strings. They omit the free-form reason. Existing administrative read authorization and metadata redaction remain unchanged. No new owner-level append-only restriction is enabled by the canonical migration.

## Validation

| Exact command | Measured result |
| --- | --- |
| `npm.cmd run test:db -- src/tests-db/refundIdempotency.db.test.ts` before correction | 0 passed, 2 failed; duplicate partial recordings and unstable concurrent outcomes |
| Same command, initial expanded fixtures | 7 passed, 2 failed; fixture expected one legitimate 40.00 refund when two fit the cap; audit truncate assertion hit an existing foreign-key guard before the proposed trigger |
| Same command, corrected fixtures | 9 passed: HTTP replay/concurrency, full payload binding and historical result, conflicting concurrency and distinct-key caps, tenant scope, atomic audit-failure recovery, attributed/redacted audit and raw-receipt write denial, keyless refusal/revoked replay, independently proposed owner append-only refusal |
| `npm.cmd test` | 5788 passed, 349 files |
| `npm.cmd run test:db` | 90 passed, 21 files |
| `npm.cmd run typecheck` | Passed |
| `npm.cmd run build` | Passed |
| `$env:E2E_PROFILES='default'; npm.cmd run test:e2e -- src/tests-e2e/02-practice-documents-billing.e2e.test.ts` | 6 passed |
| `npm.cmd run staging:migration:release-candidate` | PASS; 74 canonical/review entries, 49 replay-safe proposals; matching fingerprint `acbc7a5b8cec12becb8320c6dc0a8467397c2abe0d9a6e999695cd7a2f19151a`; no external database access |
| `npm.cmd run security:secrets` | PASS, zero findings |
| `node scripts/verify-local-traceability.mjs` | PASS, 230 requirements, release unauthorized |

`git diff --check` passed. The separate owner-level append-only SQL proposal was loaded only in a rolled-back disposable transaction: UPDATE, DELETE and TRUNCATE CASCADE were refused with SQLSTATE 55000 / TAXGUARD_AUDIT_IMMUTABLE. The test then verified its trigger no longer existed. This validates a review proposal; it does not claim canonical financial audits are owner-immutable or externally tamper-evident.

## Remaining risk and next work

Invoice-line and credit-request creation still need request keys and audit lifecycle evidence. Other reviewed writes use state/version guards or natural identities but lack uniform stored outcomes. Receipt-table owners can modify records; privileged custody and cryptographic anchoring remain independent-review designs, not implemented assurances. The existing cap/status policy was preserved, including full-refund invoice status. No live refund provider exists or was invoked.

All historical SQL and the three original untracked paths are preserved. Draft PRs 28 and 29 have green CI and remain unmerged. Staging/production remain **NO-GO**. No hosted migrations, owner permission changes, deployments or real financial transactions occurred.
