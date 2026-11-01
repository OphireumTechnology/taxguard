# Block 100: register corrections where tests already existed, and an account-security browser journey

Status: **development checkpoint, stacked on Block 99 (`1b55859`).** One browser test and register text; no product
change.

## Purpose

Several rows of the traceability register still said a check was missing when a test for it had since been added.
Each claim below was checked against the test files before the row was changed. No row changes status: every
corrected row still waits on an unapplied proposal or a hosted environment.

## Register corrections

| Row | Stale text | Correction |
|---|---|---|
| `CONTROL-LEDGER-DURABLE` | "PGlite single-connection only (multi-connection concurrency unverified)" | Local PostgreSQL covers multi-connection behaviour in `src/tests-db/concurrency.db.test.ts` and `ledgerWriteRetries.db.test.ts`: gap-free numbering, one entry per idempotency key, one deciding reviewer, no posting after a concurrent hard close, one entry for concurrent identical retries. Both files are now listed as tests. |
| `CONTROL-STAFF-SESSIONS` | "staff-wide security page and multi-connection PostgreSQL unverified" | `concurrency.db.test.ts` races own and administrator revocations to convergence and fails closed on exhausted lock retries. The staff-wide page is the `CONTROL-STAFF-ACCOUNT-SECURITY` row. |
| `CONTROL-PROPOSAL-COMPOSITION` | "Local PGlite only; multi-connection concurrency unverified" | `composition.db.test.ts` composes every file on a real local PostgreSQL server; the concurrency suites run on that composition. |
| `CONTROL-STAFF-ACCOUNT-SECURITY` | "linked from Accountant navigation only" | The workspace header links the page for every staff role and hides it for client roles (`DashboardApplicationShell.tsx`). |
| `CONTROL-LEDGER-INTEGRITY` | "no database schema for the ledger" | This row covers the in-memory engine. The durable ledger is the `CONTROL-LEDGER-DURABLE` row; its browser journeys are listed under `CONTROL-LEDGER-WORKFLOWS`. |

## Browser journey

Suite 01 now signs in as the manager, accountant, reviewer, bookkeeper and administrator. Each one follows the
header link "Account security and sessions" to `/staff/account-security` and sees the page.

## Evidence

- **Suite 01 alone:** 15 tests passed.
- **Mutation check:** I hid the header link from bookkeepers, and the bookkeeper journey failed (1 failed, 14
  passed). The shell file was then restored.
- **Full matrix:** results are recorded in the status document.

## What this does not show

All of this evidence is local. No hosted database, provider or deployed environment was used. Independent browser
acceptance is still NOT VERIFIED.
