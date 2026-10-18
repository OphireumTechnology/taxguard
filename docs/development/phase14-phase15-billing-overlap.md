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

## Other Phase 15 changes Phase 14 will need to absorb

`addLine` and `requestCredit` become keyed on Phase 15. On reconciliation, the Phase 14 billing workspace (line
and credit forms) and the E2E suites that add lines or request credits through the store or UI will need stable
keys. The `api()` E2E helper already sends an `Idempotency-Key` header on every request.
