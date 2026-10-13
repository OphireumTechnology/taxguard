# Durable workflow inventory (Phase 6)

What still runs on the in-memory development store (`src/server/db.ts`) or on demonstration data,
and what already reads recorded data only. No figures are invented anywhere in the durable paths:
unavailable data is shown as unavailable.

## Change in this phase: no demonstration records in a durable deployment

`db.ts` seeded demonstration users, engagements, documents, appointments, invoices, messages,
ledgers, legal records, accountant profiles, onboarding (including a made-up EIN) and audit entries
in every non-production process. In a deployment configured with `TAXGUARD_PRACTICE_STORE=durable`
those records reached the legacy panels as if they were operational data. The seed now stops after
the public catalog content (service plans, job postings) when the durable store is configured
(`durableDemoSeed.test.ts`); the local in-memory development mode is unchanged. Both browser E2E
profiles run with the durable store and therefore without demonstration records.

## Already durable (recorded data only)

| Area | Server | Proposal |
|---|---|---|
| Practice clients, engagements, team, notes | `/api/practice` | 025 |
| Case workflow stages | `/api/cases` | 026 |
| Document vault, scanning, requests, checklists, notices | `/api/vault`, document requests | 027, 031 |
| Billing / invoices (no live payments) | `/api/billing` | 028 |
| Ledger, book-to-tax, bookkeeper work queue with independent review | `/api/bookkeeping`, `/api/book-to-tax` | 024, 029, 030 |
| Role dashboards (accountant, reviewer, bookkeeper, practice manager, client) from recorded figures | dashboard routes | 032 |
| Tax-rule sources, rule sets, pinned runs | `/api/tax-engine` | 033, 036 |
| Staff access, sessions, invitations, MFA recovery | `/api/staff-access` | 003–011, 034, 035, 037 |

## Still in-memory (lost on restart; empty in durable deployments)

Loaded by `refreshBackendData` after sign-in or by individual panels:

| Legacy route | Collections | Durable replacement |
|---|---|---|
| `/api/documents`, `/api/engagements`, `/api/engagements/journal-entries` | documents, engagements, journalEntries | vault (027) and practice engagements (025) exist; the legacy panels still call these routes |
| `/api/accountant/*` (overview, clients, tasks, notes, document requests, deliverables) | accountingTasks, clientAccountantAssignments, documentRequests, … | role dashboards (032) and document requests (031) cover the read side; task and note writes have no durable store yet |
| `/api/assignments/*` (bind, reassign, workload) | clientAccountantAssignments, reassignmentRequests | practice team assignments (025); legacy reassignment workflow not migrated |
| `/api/messages`, `/api/appointments`, calendar, consultation room | messages, appointments, calendar collections | none yet |
| `/api/payments/*` | invoices, webhooks | billing (028) for invoices; no live payment processing by design |
| `/api/integrations`, staging | accountingConnections, accountingStagingRecords | none (no real connectors) |
| `/api/legal`, `/api/intake`, onboarding, profile amendments, case authority | legal, intake, onboarding and profile collections | none yet |
| `/api/admin/*` (users, audit logs, security events, health), super admin | users, auditLogs, securityEvents, sessions | durable staff directory and audit log exist for staff access only |
| `/api/careers` | jobs, applicants | none (public content) |

## Client portal demonstration views (removed 2026-10-13)

`AmendmentView`, `AuditActivityView`, `ExpensesView`, `FinancialConnectionsView`, `OverviewView`,
`TaxWorkspaceView`, `ApprovalsView`, `DeliverablesView` and their only data source
`clientPortalService.ts` (`MOCK_*` / `INITIAL_*` demonstration records) were unreachable and were
removed during the main reconciliation; see `docs/development/main-reconciliation-20261013.md`.
The authenticated client dashboard uses the durable stage views and document vault instead.

## Next steps (not done here)

Point the legacy staff panels at the durable practice, vault and dashboard APIs and retire the
matching legacy routes; durable stores for tasks/notes, messages and appointments need new proposals.
