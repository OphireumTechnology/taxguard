# Phase 15 financial write and audit review

Development only. No hosted migrations, live payments, deployments or release approval.
Baseline: `19d710c` (draft PRs 25–27 remain unmerged). The original three untracked paths are preserved.

## Evidence classification

Measured defects in disposable PostgreSQL before the invoice correction:

- `npm.cmd run test:db -- src/tests-db/invoiceIdempotency.db.test.ts`: **0 passed, 2 failed**.
- Changed due date with the same invoice key resolved to the original invoice (`created: false`) instead of a conflict.
- Eight concurrent identical invoice requests produced `BILLING_STORE_UNAVAILABLE`; the existing unique index prevents duplicate invoices but the API did not return a stable replay to every caller.

Other gaps below are source-review findings until a dedicated fixture measures them. They must not be reported as measured financial losses.

## Durable billing inventory

Authority: proposal 028 plus client projection 047 and access overlay 058; `BillingStore` and `/api/billing`.

| Write | Existing invariant and retry behavior | Finding / next action |
| --- | --- | --- |
| Service catalog upsert | Manager authorization, tenant/code uniqueness, exact decimal prices, protected price history | Six different concurrent first prices measured succeeding without change reasons. Proposal 20261019060000 serializes natural identity before lookup, preserves manager/reason rules and produces a correct prior/new history chain. Identical accepted upserts retain existing per-request audit emission; no new event-taxonomy policy inferred |
| Invoice creation | Tenant/key unique index, actor/client authorization, atomic invoice and audit | Corrected by additive proposal 20261019000000: transaction advisory lock before lookup, compare actor/client/engagement/due date, authorize again after waiting; JSON-framed identifiers avoid ambiguous tenant/key concatenation |
| Add invoice line | Staff authorization, invoice row lock, draft-only, SQL totals and reasoned overrides | HTTP retry measured doubling 100.00 to 200.00. Proposal 20261019030000 adds protected receipts, keyed wrappers and before/after line audit; keyless implementation becomes internal |
| Remove invoice line | Draft-only row lock and exact line number | Delayed HTTP retry measured deleting a new 200.00 line reusing the removed number. Proposal 20261019050000 adds receipt-bound removal, protected service entry point and before/after audit; tests retain the replacement even after approval |
| Submit/approve/return/void | Invoice row lock, optimistic row version, maker-checker and status guards | Prevents repeated transition but retries return conflict instead of a stored success; preserve version guard |
| Manual / sandbox payment recording | Tenant/key and provider-transaction uniqueness; invoice lock; exact payload/actor/client/method/provider binding in 058; cap against balance | Existing PostgreSQL concurrency coverage; fresh and replay responses differ (`invoice` only on first success); explicit PostgreSQL contention now maps to `BILLING_BUSY`/409 |
| Sandbox provider call | Deterministic local test-card adapter; no network; production constructor refuses | Provider invoked before SQL authorization; do not reuse this flow for a live processor without reviewed authorization and outbox/reconciliation design |
| Refund recording | Manager-only, payment lock, remaining-refundable cap, atomic invoice/payment/audit changes | Repeated HTTP key measured recording 40.00 instead of 20.00. Additive proposal 20261019020000 supplies scoped durable receipts and stable stored results, payload binding and safe before/after audit evidence; 9 targeted PostgreSQL/HTTP cases pass; keyless calls fail closed |
| Credit request | Staff authorization, balance cap, distinct request row | HTTP retry measured creating a second pending credit. Proposal 20261019030000 adds keyed receipts and attributed receipt-link events; independent credit approval remains unchanged |
| Apply/reject credit | Manager, maker-checker, credit lock, invoice lock, balance cap, one decision | Retry returns already-decided; no stored retry outcome; preserve independent approver |

Tenant-wide invoice/payment keys deliberately conflict across clients within a tenant; the same key in different tenants is independent. Possession of a key never grants access.

## Ledger and book-to-tax inventory

Authority: proposals 024 and 029, `SqlLedgerStore`, `BookToTaxStore` and their dispatchers.

| Write | Source-review result |
| --- | --- |
| Create accounts / activate account | Scoped account uniqueness and actor checks; repeated activation can emit repeated audit; investigate conflicting bootstrap payloads |
| Open / close / reopen period | Scoped period checks and row locks; state guards protect posting; stable retry outcome and reason evidence need review |
| Post entry / replacement / adjusting journal | Scoped `(tenant,client,key)` uniqueness and hash, exact cents and review/period guards retained. Concurrent replay race measured and corrected by coordinated entry points in proposal 20261019040000; service-role deferred balance-trigger failure also reproduced and corrected without removing the constraint |
| Review entry | Row lock, expected version, reviewer authorization; winner only; retry conflict |
| Prepare / approve reversal | Concurrent identical callers measured receiving already-reversed errors; proposal 20261019040000 serializes replay lookup. Dedicated PostgreSQL tests cover one reversal/audit, changed intent conflicts, independent approval, integer-cent historical cutoffs, rollback and different-key guard preservation |
| Ingest bank transactions / categorize | Provider/batch/transaction identity and transaction locks; inspect differing-payload retries and audit duplication before declaring complete |
| Start / clear / finalize reconciliation | Scoped rows and locking; request identity and retry semantics need dedicated fixtures |
| Save category / open mapping set / set mapping / review set | Firm-defined taxonomy, scoped sets, immutable approved mappings and reviewer guards; no generic stored request outcome |
| Prepare tax adjustment | 029's unbound replay and concurrent unavailable errors reproduced (2/2 regression failures). Additive proposal 20261019010000 serializes tenant/client/key and compares all material fields plus preparer; 8 targeted PostgreSQL cases pass. Approval remains independent |
| Review adjustment / generate and review workpaper | Row locks and immutable/reconciled snapshot guards; stable request outcomes require further investigation |

The older `operations/engagementBilling.service.ts` is a separate in-memory implementation referenced by `practice-operations.routes.ts`, including a Stripe webhook. It must not be treated as the durable billing authority or a commissioned live-payment implementation. Inspect route-retirement mounting and idempotency-service failure behavior before changing it; no real webhook or provider calls were executed.

## Audit integrity review and independent-review proposal

Billing, ledger and book-to-tax helpers insert tenant, actor, role, action and scoped metadata in the same transaction as financial writes. This provides rollback atomicity, not complete lifecycle evidence or tamper detection. Invoice creation concurrency tests assert one committed audit event per invoice and zero audit rows after rollback.

Current audit-center reads require active tenant administrators and redact metadata through a scalar allowlist. Amounts, notes, reasons, tokens and hashes are withheld. Preserve these read restrictions. Database `event_sequence` supplies a deterministic ingestion sequence; it is not proof of transaction commit order or an externally anchored chain.

Overlay 057 refuses changes to `SECURITY_*` events and refuses whole-table truncation. It does not make `BILLING_*`, `LEDGER_*` or `B2T_*` rows append-only for the owner. The existing broader proposal is `docs/sql/taxguard-audit-append-only.proposal.sql`, outside the executable migration DAG.

Proposed independent-review design (not implemented or commissioned here):

1. Introduce a scoped financial operation receipt with durable unique operation/key, canonical request digest, actor and safe before/after integer-cent state. Store receipt, state mutation and event atomically; reauthorize retries before reading receipts. Do not persist card numbers, bearer tokens, free-form documents or credentials.
2. Serialize per-tenant financial event chaining through a locked head row. Hash a versioned canonical representation containing event identity, tenant, actor, operation receipt, prior digest and approved safe evidence. Verify continuity, content digests and missing/reordered events. An unanchored database chain cannot detect an owner rewriting the whole chain.
3. Extend append-only owner protections only after independent review of retention, legal holds, corrections, backup/restore, privileged incident procedures and role ownership. Correct financial records by attributed compensating events, never by rewriting history.
4. Independently anchor signed chain heads to separately administered storage only after owner approval. No archive, signing service, credentials or billable resources have been commissioned.
5. Test unauthorized role mutations, owner mutation refusal under the proposed policy, concurrent chaining, rollback, replay, cross-tenant reads and corruption detection in disposable PostgreSQL. These additional audit tests remain outstanding; no tamper-evident audit claim is made.

## Release gates

All SQL remains review-only. Staging and production remain NO-GO. Owner-level restrictions and independent anchoring require independent review; routine financial retry corrections can continue separately.
