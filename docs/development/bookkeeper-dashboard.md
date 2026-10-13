# Bookkeeper dashboard on the durable ledger (Batch 2, Module 4)

**PRODUCTION STATUS: NO-GO.** Proposals 024 (amended) and 030 are **not applied**. Bookkeeper ledger work is available only when the durable ledger is selected (`TAXGUARD_LEDGER_STORE=durable`, or an injected test store); in memory mode bookkeepers keep the previous read-only views. Synthetic data only.

## Authority (defence in depth)

1. **Global capability list** (`bookkeeperAccess.ts`): without the durable store, only the two existing read endpoints. With it, an explicit list of ledger reads and the following writes: standard chart, journal entries, reversal requests, period creation, bank ingestion and categorization, reconciliation start / clear / finalize. Approvals, rejections, correction requests, period close / reopen, account status, sync and book-to-tax are never allowed.
2. **Bookkeeping router**: the client must be in the bookkeeper's `authorizedClientIds`; production pins the deployment tenant. The shared `resolveAuthorizedClientContext` staff role set is deliberately not widened.
3. **Database**: ledger authority requires a current ACTIVE assignment for the client; **every entry a bookkeeper creates (journal or bank categorization) is inserted as PREPARED** and needs an independent reviewer (proposal 024 amendment); reviewer-only actions refuse bookkeepers.

## Work queue (proposal 030, `GET /api/bookkeeping/work-queue`)

Uncategorized and possible-duplicate bank transactions, entries awaiting review, entries returned to the caller for correction (with the reviewer note), reconciliations in progress with variance, and per-period status with counts of prepared entries and uncategorized transactions.

## UI

Bookkeeper dashboard → *Ledger Workspace* (client and tax year from the existing scope selectors): work queue, period close visibility, bank categorization, balanced-entry form (submit for review), reconciliation start / finalize, trial-balance and statement summary, journal search, general ledger and audit history (shared reports panel). Shows an explicit message where the durable ledger is not enabled.

## Tests

`bookkeeperDurableHttp.test.ts` (4, real local authentication + PGlite: forced review of entries and categorizations, reviewer approval, statements, reconciliation, returned-entry queue, search, grant / assignment / memory-mode refusals; mutation-checked forced review), `bookkeeperLedgerWorkspace.test.tsx` (3, including the capability allow-list), existing Bookkeeper dashboard suites unchanged and passing.

## Limitations

The existing Bookkeeper modules (Transactions, Reconciliation, Reports…) still read the in-memory projection; transaction clearing is done from the reconciliation endpoints (the workspace shows finalize when variance is zero); accounting exception categories beyond the work queue are not modelled; browser NOT VERIFIED.
