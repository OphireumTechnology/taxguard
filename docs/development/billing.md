# Billing and invoicing (Batch 2, Module 2)

**PRODUCTION STATUS: NO-GO.** Proposal 028 is **not applied**. `/api/billing` is development-only (503 unless configured against a non-production project; absent from `createProductionApp`). **No real payment is processed**: card payments use a deterministic, network-free sandbox provider that refuses to construct in production and accepts only published test card numbers. Synthetic data only.

## Data

Existing tables reused: `taxguard_service_catalog`, `taxguard_invoices` (`balance_due = total - amount_paid` CHECK), `taxguard_invoice_lines`, `taxguard_invoice_payments` — exact `NUMERIC(15,2)`. New: `taxguard_invoice_counters` (gapless number per tenant and year), `taxguard_service_price_history` (append-only), `taxguard_invoice_credits`. Money crosses the API as fixed two-decimal strings (JSON numbers would lose scale or precision); inputs with more than two decimals are refused, never rounded.

## Rules (database-enforced)

| Area | Rule |
| --- | --- |
| Catalog | Managers only; price changes need a reason and are recorded in immutable history |
| Draft | Assigned staff or managers; idempotent by key; lines priced from the active catalog; a different rate requires a recorded reason; totals recomputed in SQL |
| Approval | DRAFT → PENDING_APPROVAL (preparer) → ISSUED (a **different manager**), or returned to DRAFT with a note; the invoice number `INV-YYYY-NNNNNN` is assigned only at issue; optimistic `row_version` |
| Void | Managers, reason required, only without payments |
| Payments | Clients: sandbox card only; managers: check / ACH / wire / manual; idempotency key replays; a provider transaction is recorded once (`DUPLICATE_PAYMENT`); never more than the balance |
| Refunds | Managers, reason, never more than the payment's unrefunded amount; status recomputed |
| Credits | Requested by staff, applied or rejected by a different manager; never more than the balance |
| Visibility | Clients see only their own issued invoices; staff see assigned clients; managers see all; other tenants receive not found |
| AR aging | Current, 1–30, 31–60, 61–90, 90+ days past due as of a date, for visible clients |
| Audit | `BILLING_*` events for drafts, transitions, payments, refunds, credits and price changes |

## API and UI

`GET|POST /catalog`, `GET /ar-aging`, `GET|POST /clients/:id/invoices`, `POST …/invoices/:inv/lines`, `…/lines/:n/remove`, `…/submit|approve|return|void`, `…/payments`, `…/pay-sandbox`, `…/credits`, `POST /clients/:id/credits/:cr/apply|reject`, `POST /clients/:id/payments/:p/refund`. Practice Manager → *Billing* (aging, invoices, approval, payments, credits); client dashboard → *Invoices* (issued invoices, sandbox payment; hidden where billing is disabled).

## Tests

`billingHttp.test.ts` (8, mutation-checked: approver ≠ preparer, no overpayment, client payment-method restriction), `billingPanels.test.tsx` (3), composition test extended to proposal 028.

## Limitations

No live payment provider (E04); no sales tax computation (the `tax` column stays 0 — no tax rule is invented); PAST_DUE is derived in aging rather than stored; invoice PDF rendering and email delivery absent; firm revenue is not posted to a ledger (the durable ledger is per client).
