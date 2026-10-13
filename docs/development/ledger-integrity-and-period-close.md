# Ledger integrity, reversing entries and period close (Milestone 9 slice)

**PRODUCTION STATUS: NO-GO.** No migration, deployment or production access. Synthetic data only. Branch `claude/taxguard-dev-20261012` (isolated worktree `123-claude`).

## Defects found and fixed

| # | Defect (before) | Impact | Fix |
| --- | --- | --- | --- |
| 1 | `POST /api/bookkeeping/journal-entries/:id/approve` approved any entry by ID; the authorized client context was resolved but never compared with the entry | A reviewer authorized for client A could approve client B's adjusting entry (router is mounted in `createProductionApp`) | Every ID-addressed engine mutation takes the route's authorized `{tenantId, clientId}`; records outside it are reported as not found (404) |
| 2 | Same pattern for transaction categorize / match-document and reconciliation clear / finalize | Cross-client mutation by ID | Same scope check; clearing also requires the transaction to belong to the reconciled account |
| 3 | `POST /reconciliations/:id/clear` had no role check | Client-role users could change reconciliation state | Client roles refused (403) |
| 4 | Hard-close lock checked only the caller-supplied `periodId` | Posting into a locked quarter by naming a non-existent period | Lock is enforced by posting date against every period of the client; a named period must belong to the client and contain the date |
| 5 | Soft close had no effect | — | Soft-closed periods accept only reviewed (adjusting or reversing) entries |
| 6 | Journal lines were not checked against the chart of accounts | Lines could reference another client's or inactive accounts | Lines must reference active accounts of the same client |
| 7 | Balancing used floating-point sums with a 0.001 tolerance | Rounding drift; fractional-cent amounts accepted | Amounts validated (finite, non-negative, whole cents) and summed in integer cents; exact equality; zero lines refused |
| 8 | Approval did not check status | Posted entries could be "approved" again; approval into a hard-closed period | Only `PREPARED` entries; period lock rechecked; `postedAt` set on approval |
| 9 | A bank transaction could be categorized twice | Duplicate ledger postings | `TRANSACTION_ALREADY_POSTED`; correction is by reversal |
| 10 | Periods could be closed with unreviewed entries, moved backwards from hard to soft, and reopened by the person who closed them | Close controls ineffective | Close blocked by prepared entries in the period; transitions OPEN→SOFT/HARD, SOFT→HARD only; hard-close reopen requires a different person and a 5–500 character justification |
| 11 | Accountant UI categorize call sent no credentials or client and used a relative URL; the service read the token from only one store | Feature could not work against the authenticated API host | Service uses the shared session store and configured API endpoint; categorize passes the client scope |

## New capabilities

- **Reversing entries** (`POST /journal-entries/:id/reverse` with `postingDate`, `reason`): posted entries are never edited; a mirror entry (debits/credits swapped, linked both ways) is prepared and requires independent approval. One reversal per entry; reversals are not reversible; back-dated reversals refused; period locks apply.
- **Accounting periods** (`GET/POST /periods`, `POST /periods/:id/close`, `POST /periods/:id/reopen`): validated creation (inside the tax year, no overlap, idempotent for identical definitions); close requires reviewer roles.
- Audit records for reversal preparation and period open / close / reopen.
- **UI**: "Periods & corrections" panel in the Accountant bookkeeping ledger tab — periods with soft/hard close and justified reopen, entries awaiting review with approval, and reversal preparation. Server refusal codes map to specific guidance.

## Tests

`ledgerIntegrityAndPeriodClose.test.ts` (27): engine rules and HTTP through real local authentication with seeded client assignments (cross-client approval and reconciliation IDs → 404, client-role refusals, reversal → approval → hard close → self-reopen refused → locked posting refused, audit actions). Mutation-checked: removing the approval scope check, the date-based lock, the double-post guard or the reconciled-account check each fails a test. `ledgerControlsPanel.test.tsx` (5): service requests and refusal codes, action eligibility, rendering. All existing bookkeeping suites pass unchanged.

## Limitations

- The bookkeeping engine is **in-memory**; ledger data is not durable. A database schema and transactional persistence for the ledger are required before any production use.
- `src/server/routes/accountant.routes.ts` keeps a second, legacy journal-entry store (`db.journalEntries`, development only); it should be consolidated onto this engine.
- Rejection / correction-required review outcomes for prepared entries are not implemented.
- Browser execution of the new panel is NOT VERIFIED.
