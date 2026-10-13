# Durable book-to-tax workpapers (Batch 2, Module 3)

**PRODUCTION STATUS: NO-GO.** Proposal 029 is **not applied**. `/api/book-to-tax` is development-only (503 unless configured against a non-production project; absent from `createProductionApp`). **TaxGuard computes no tax** and asserts no IRS form line, rate or rule. Synthetic data only.

## Model

| Table | Purpose |
| --- | --- |
| `taxguard_b2t_categories` | Firm-defined workpaper groupings per return family (managers only; optional reference text written by the firm) |
| `taxguard_b2t_mapping_sets` / `_mappings` | Versioned account-to-category mappings per client, tax year and return family; one open and one approved version at a time; approved / submitted versions are frozen by trigger |
| `taxguard_b2t_adjustments` | Signed cent adjustments (permanent / timing / reclassification) with a professional description; optional evidence must be a VERIFIED, CLEAN vault document of the client (proposal 027) |
| `taxguard_b2t_workpapers` | Immutable snapshots (SHA-256 recorded) optionally linked to the client's case (proposal 026) |

A snapshot is computed in SQL from **posted** ledger activity in the tax year (proposal 024) and the **approved** mapping set: per category book amount (debits minus credits), approved adjustments, and book + adjustments. Reconciliation: mapped + unmapped activity = total posted activity; unmapped accounts are listed.

## Controls

Independent reviewer (reviewer roles, ≠ preparer / generator) for mapping sets, adjustments and workpapers; rejections need a note; only approved adjustments enter snapshots; a workpaper cannot be approved with unmapped activity or after a newer mapping version is approved (`WORKPAPER_STALE`); approving a newer workpaper supersedes the previous one; actors must be assigned to the client (ledger authority); audit `B2T_*`.

## UI

Accountant → Bookkeeping → *Book-to-Tax Workpapers* (the tab previously labelled "Schedule M-1 Bridge" rendered nothing; renamed to avoid implying form-level accuracy): mapping editor, submit / approve / reject, adjustments, workpaper generation and review. Shows an explicit not-enabled message where the durable store is unavailable.

## Tests

`bookToTaxHttp.test.ts` (6; real ledger postings; versioning and supersession; unmapped refusal; adjustment approval gating; evidence verification; independence for mapping sets and workpapers; immutability; client / unassigned / cross-tenant refusal; mutation-checked), `bookToTaxPanel.test.tsx` (3).

## Limitations

Category catalogs and any reference to forms must be supplied and reviewed by the firm (H07); Stage 09 remains blocked; snapshots cover posted activity only (no beginning balances or multi-year carryovers); the legacy in-memory book-to-tax endpoints remain for memory mode.
