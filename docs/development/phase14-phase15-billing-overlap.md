# Phase 14 / Phase 15 billing overlap: refund records (handoff, 2026-10-19)

**Status: integration blocker, needs a decision before either branch merges.** Found by Claude while checking the
recovery CI failure. No branch was changed to resolve it.

## Recovery CI failure (run 39153095799)

The failure `BillingError: IDEMPOTENCY_KEY_REQUIRED` in `scripts/staging/logical-recovery-rehearsal.ts` was on
Codex's branch `codex/taxguard-phase15-billing-write-retries` (9831c81, keyed invoice lines and credit requests),
not on the Phase 14 branch. Codex fixed it on that branch in 5f4276a by passing a stable synthetic key
(`'recovery-line-1'`) to `addLine`. CI run 39175986644 passed. On the Phase 14 branch `addLine` does not yet
require a key, so the rehearsal passes unchanged. Mandatory billing idempotency validation was not touched.

## The overlap

Both workstreams added a durable, idempotent refund record for the same defect (keyless refunds could be
recorded twice):

| | Phase 14 (PR #22) | Phase 15 (`codex/taxguard-phase15-billing-write-retries`) |
|---|---|---|
| Proposal | `20261018010000_taxguard_billing_refund_records` | `20261019020000_taxguard_refund_idempotency` |
| Table | `taxguard_invoice_refunds` (no `result` column; immutability trigger) | `taxguard_invoice_refunds` (with `result` jsonb, FK to the payment) |
| Keyed function | `taxguard_bill_refund_keyed(...)`; the 6-argument `taxguard_bill_refund` is revoked from `service_role` | 7-argument `taxguard_bill_refund(..., p_key)`; the 6-argument form is kept and fails closed |

Both use `CREATE TABLE IF NOT EXISTS`, so whichever runs first defines the table and the other is skipped
silently.

## Executable evidence

A temporary probe was run (not committed). It used a disposable PostgreSQL database composed with the Phase 14
migration plan, recorded a synthetic payment, then applied Codex's `20261019020000` exactly as published:

- applying Codex's proposal: **succeeds without error**;
- refund through Codex's `taxguard_bill_refund(..., p_key)`: **fails** with
  `column "result" of relation "taxguard_invoice_refunds" does not exist`;
- refund through Phase 14's `taxguard_bill_refund_keyed`: succeeds;
- resulting columns: `id, tenant_id, client_id, invoice_id, payment_id, amount, reason, recorded_by,
  idempotency_key, created_at`.

So after both land, every refund recorded through the Phase 15 path would fail. A trial merge of the two
branches also conflicts textually in `billingStore.ts`, `billing.routes.ts`, `billingApiService.ts`, the
migration order and manifests, `composition.db.test.ts`, `migration-release-candidate.ts` and traceability.

## Options (decision for the owner, with Codex)

1. **Recommended: one canonical refund mechanism, Phase 15's.** Billing idempotency is Codex's Phase 15 package:
   keyed lines, credits, adjustments, invoices and refunds. When reconciling, drop Phase 14's `20261018010000`
   and move the Phase 14 refund caller, UI and tests to the 7-argument signature.
   - Keep from Phase 14: the immutability trigger and the keyboard/focus UI.
   - Carry over: the Phase 14 regressions (retries, identical separate refunds, concurrency, caps, cross-tenant
     refusal, form preservation), which become acceptance tests of the canonical function.
   - The open question is which branch merges first. If PR #22 merges first, Phase 15 must reconcile against it
     and vice versa; the probe above is the regression to keep.
2. Keep Phase 14's design and adapt Phase 15 to it (rename or extend the table). This duplicates Codex's package
   and is not recommended.

Until decided, neither proposal may be applied to a hosted database (both are review only), and the two
branches must not both be merged as they are.

## Owner decision and Phase 14 preparation (2026-10-19)

The owner chose the Phase 15 refund-idempotency design as the canonical target, subject to independent review
and full compatibility testing. Neither refund migration is to be integrated until the unified implementation
is independently validated.

**Retained Phase 14 regressions, now implementation-neutral.** `src/tests-db/refundContract.ts` holds the
Phase 14 refund regressions as a contract: retries and replay, identical separate refunds, key reuse, short
keys, concurrent submissions of one operation, the payment cap under concurrent distinct operations, tenant,
client and role refusal, audit evidence, table and function privileges, and the unkeyed path. Each
implementation supplies an adapter (function name, error codes, result shape). `billingRefunds.db.test.ts` runs
it with the Phase 14 adapter (5 passing). The unified Phase 15 implementation should run it with its own
adapter. The UI regressions (suite 02 refund flow, suite 16 refund keyboard and focus) do not depend on the
database contract and stay as they are.

**Gap analysis against the published Phase 15 SQL.** A temporary probe (not committed) ran the contract on a
disposable PostgreSQL database composed from this branch. The Phase 14 refund objects were removed and Codex's
`20261019020000` applied exactly as published. The Phase 15 adapter used `BILLING_IDEMPOTENCY_CONFLICT` for key
reuse and the kept, fail-closed 6-argument function. Outcome: retries, replay, concurrency, the cap, isolation,
privileges, grants and the fail-closed unkeyed path all **pass**. Two Phase 14 safeguards are **missing** and
should be carried into the canonical design:

1. **Owner-level immutability of refund records.** Phase 14 has a `BEFORE UPDATE OR DELETE` trigger raising
   `BILLING_REFUND_IMMUTABLE`. Under Phase 15, `UPDATE taxguard_invoice_refunds ...` succeeds for the table
   owner. (`service_role` has no table privileges in either design.)
2. **The refund reason in the audit entry.** Phase 14's `BILLING_PAYMENT_REFUNDED` metadata includes the
   reason. Phase 15's carries the refund id and before/after amounts, and keeps the reason only in the refund
   record. Under Phase 15 the reason therefore survives only as long as that row, which is not immutable (gap 1).

Phase 15 is stronger than Phase 14 in several ways that the canonical design should keep:
- a key matches only with the same reason and actor;
- a foreign key ties the refund to its payment;
- the stored result is replayed;
- the audit carries before and after amounts;
- the 6-argument signature is kept and fails closed.

**Caller compatibility.** No application code reads Phase 14's `refundId` or `replayed` result fields. The
Phase 14 refund form already sends a stable per-operation key (`newBillingKey()`, reused on retry, renewed for a
new refund). The only Phase 14 caller change is `BillingStore.refund`: call
`taxguard_bill_refund(..., p_key)` instead of `taxguard_bill_refund_keyed(...)`, with the same arguments. Phase
15 already contains that change. The browser should also map `BILLING_IDEMPOTENCY_CONFLICT` to the existing
"already used for a different refund" message. That change is deliberately not made on this branch now, because
its database does not have the 7-argument function.

**Mixed-schema guard (for Codex's unified migration).** Both proposals use `CREATE TABLE IF NOT EXISTS`, which
is how the incompatible table was skipped silently. The unified migration should fail explicitly when
`taxguard_invoice_refunds` exists without the expected columns, rather than skipping the definition.

## Confirmed requirements for the canonical refund migration (for Codex, 2026-10-19)

Each requirement below is executable through `src/tests-db/refundContract.ts`. Run it with a Phase 15 adapter
whose `ownerImmutable` and `auditCarriesReason` flags are `true`.

1. **Refund-record immutability.** Rows in `taxguard_invoice_refunds` can never be updated or deleted, by any
   role including the table owner. Enforce it with a `BEFORE UPDATE OR DELETE` trigger raising
   `BILLING_REFUND_IMMUTABLE` (as in Phase 14). `service_role` keeps no `UPDATE`, `DELETE` or `TRUNCATE`
   privilege. Corrections are new compensating records, never edits.
2. **Audit reason preservation.** Every `BILLING_PAYMENT_REFUNDED` audit entry carries the refund `reason`
   alongside the refund id and the before/after amounts already in Phase 15. The reason must survive in the
   append-oriented audit trail and not only in the refund row.
3. **Incompatible-schema refusal.** The migration must not use a bare `CREATE TABLE IF NOT EXISTS` that silently
   accepts an existing table of a different shape. When `taxguard_invoice_refunds` already exists it must verify
   the expected columns, types and constraints (including `result` and the payment foreign key). If anything
   differs it must stop with an explicit error naming the mismatch, before any function is replaced. The probe
   above is the regression: composed after Phase 14's `20261018010000`, the migration must fail loudly, never
   apply and leave refunds broken.
4. **Kept Phase 15 strengths:** a key matches only the same reason and actor; foreign key to the payment; stored
   result replay; before/after audit amounts; the 6-argument signature kept and failing closed.
5. **Caller change on reconciliation:** `BillingStore.refund` calls the 7-argument `taxguard_bill_refund`, and
   the browser maps `BILLING_IDEMPOTENCY_CONFLICT` to the existing key-reuse message. Phase 14 makes these
   changes only after the canonical migration is published and validated.

## Other Phase 15 changes Phase 14 will need to absorb

`addLine` and `requestCredit` become keyed on Phase 15. On reconciliation, the Phase 14 billing workspace (line
and credit forms) and the E2E suites that add lines or request credits through the store or UI will need stable
keys. The `api()` E2E helper already sends an `Idempotency-Key` header on every request.
