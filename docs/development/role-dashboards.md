# Durable role dashboards (Phase 4)

**PRODUCTION STATUS: NO-GO.** Proposal 032 (`20261012320000_taxguard_role_dashboards.sql`) is
**not applied**. All figures come from durable records through development-only routers; the
in-memory and legacy views are unchanged where the durable store is not configured.

## Principle: no invented metrics

Every figure is a count of recorded rows or a recorded balance, returned with the definition used to
compute it (shown on hover). There is no capacity, SLA, productivity, utilization, forecast or score
anywhere, because no authoritative policy defines one; the summary says so explicitly.

## What each role sees

| Role | Panel | Source |
| --- | --- | --- |
| Accountant (preparer) | **My durable work queue** above the existing KPIs: cases where they are preparer or reviewer with the canonical stage and whose step it is (verification, attestation, or "Blocked until a verified tax engine exists" for 9-18), documents awaiting review for currently assigned clients (never their own uploads), outstanding document requests for their engagement years, ledger entries returned to them, counts with definitions | `GET /api/practice/my-work` → `taxguard_dash_my_work` |
| Reviewer | **My durable review queue** above the existing review queue: the same, plus prepared ledger entries for clients where they are the assigned reviewer and book-to-tax items awaiting their review | same |
| Practice manager | **Durable practice summary** on the Dashboard home (follows the tax-year selector): active and on-hold cases by stage, recorded deadlines due this week / overdue, open / overdue / waiting / ready tasks, document requests outstanding and overdue, documents awaiting review and scan, open and past-due invoices with the recorded balance, invoices awaiting approval, active case counts per assigned staff member | `GET /api/practice/summary` → `taxguard_dash_practice_summary` (managers only) |
| Bookkeeper | The existing Dashboard, Transactions, Reconciliation, Chart of Accounts and Reports panels now read the **durable ledger** when it is selected. Statuses are reported as recorded: a categorized transaction whose entry awaits review is `PENDING_REVIEW`; `RECONCILED` only when its reconciliation is closed. Document matching and AI proposals are not part of the durable ledger and are shown as absent (0 / none), not invented. `provider: DURABLE_LEDGER`, `truncated` when more than 500 rows | `GET /api/bookkeeping/bookkeeper-dashboard` → `projectDurableBookkeeper` |
| Client | **Your status** on the Documents page: documents still needed and overdue, awaiting review, accepted, needing replacement, open invoices and recorded balance due, unread notices — each figure omitted (not guessed) if its source is unavailable | existing vault, request, billing and notification endpoints |

Bookkeepers are refused by `my-work` (their queue is the Ledger Workspace). Unassigned staff see empty
lists. Another tenant sees nothing. The manager capability list admits `GET /api/practice/(my-work|summary)`
only while the development-only durable routers are configured. In production the bookkeeper dashboard
still answers 503 unless the durable ledger is explicitly selected after its proposal is applied.

## Tests

`roleDashboardsHttp.test.ts` (6: preparer / reviewer / unassigned / bookkeeper / foreign tenant; manager
figures equal the seeded rows; managers only; service-role grants), `bookkeeperDurableDashboard.test.ts`
(2: every transaction state end to end, assignment / grant / period refusals, memory fallback;
mutation-checked), `roleDashboardPanels.test.tsx` (3), browser `06-role-dashboards` (5: each role's
panel equals the server's figures for the same signed-in user).

## Limitations

The legacy accountant / reviewer KPIs and queues (in-memory or Codex-owned projections) are unchanged and
appear beside the durable panels. Document matching to bank transactions is not modelled on the durable
ledger. Staff case counts are not capacity. Proposal unapplied.
