# Durable workflow inventory and implementation matrix (Phase 7, 2026-10-13)

Baseline `main` `edcc472`. "Durable" means PostgreSQL through service-role-only SECURITY DEFINER
proposal functions, enforced per (tenant, client) by the database, surviving a server restart. A
screen or legacy route over the in-memory store (`src/server/db.ts`) is **not** a durable workflow.
All proposals are unapplied; durable routers answer only with `TAXGUARD_PRACTICE_STORE=durable`
against a non-production project (otherwise 503) and are not mounted in `createProductionApp`.

## Matrix

| Workflow | Frontend (reachable?) | API | Service / store | Tables / proposal | Authorization & tenant isolation | Survives restart | Tests | Missing |
|---|---|---|---|---|---|---|---|---|
| **Staff assignments** | `PracticeClientsPanel` Team section (yes, manager dashboard); `AssignmentGovernanceTab` (no — not mounted) | `/api/practice/clients/:id/engagements/:e/team`, `/team/:a/revoke` | `PracticeStore` | `taxguard_staff_assignments`, history — 025 | managers only; partial unique ACTIVE index; reason required | yes | `practiceManagementHttp.test.ts`, E2E staffing via `ensureStaffed` | legacy `/api/assignments` + unmounted tab still present (in-memory) |
| **Accountant task queue** | `DurableMyWorkPanel` (yes, accountant/reviewer), `PracticeClientsPanel` Tasks | `/api/practice/my-work`, `/clients/:id/tasks` | `PracticeStore` | `taxguard_practice_tasks` — 025 | assigned staff / managers; optimistic version | yes | `practiceManagementHttp.test.ts` (no browser E2E for tasks yet) | legacy `/api/accountant/tasks*` (no UI caller) |
| **Client engagements & cases** | `PracticeClientsPanel`, case workspace (yes) | `/api/practice/...engagements`, `/api/cases` | `PracticeStore`, `CaseStore` | 025, 026 | managers create; stage gates; maker-checker | yes | E2E 02/03 | `AppContext` still loads legacy `/api/engagements` for legacy panels |
| **Client / staff messaging** (Phase 7) | client portal Messages module and overview; `StaffMessageInboxPanel` (accountant, reviewer, manager); client detail conversations (yes) | `/api/communications/*` | `CommunicationStore` | core `taxguard_communication_threads/_messages` + `taxguard_comm_reads` — **039** | `taxguard_doc_actor`: own client / assigned staff / managers; internal notes never to clients; immutable messages; idempotent IDs; audited without content | yes (restart test) | `clientMessaging.test.ts` (8), `clientMessagingUi.test.tsx` (4), `messaging.db.test.ts` (3), E2E 10 (4) | legacy `/api/messages` still serves local in-memory mode (list leak fixed); attachments via vault only; no e-mail/SMS |
| **Appointments & scheduling** | `LiveCalendarModule` (yes), booking page (yes) | `/api/appointments`, `/api/calendar/*` | in-memory `db.appointments`, slot holds | none (no appointment or calendar table in the core schema or any proposal) | legacy object checks only | **no** | `legacyRouteObjectAuthorization` | durable proposal + store + UI (Phase 8 priority) |
| **Administrator operational views** | `SuperAdminConsole` (yes) | `/api/admin/*` | in-memory users, audit logs, security events | durable staff directory / audit only for staff access (003–011) | admin role; legacy | **no** (except staff access) | `superAdminConsole.test.tsx` | durable audit-log reader, system health from recorded sources |
| **Legal / compliance coordination** | `AppContext.legalRecords` (no dedicated screen) | `/api/legal` | in-memory `db.legalRecords` | none | legacy | **no** | — | proposal + store + UI |
| **Documents & deliverables** | client vault, document review, requests (yes) | `/api/vault/*` | `DocumentVaultStore`, `DocumentRequestStore` | 027, 031 | client own uploads; staff assigned; scan quarantine | yes | E2E 02/05 | legacy `/api/documents` still loaded by `AppContext` |
| **Billing & receivables** | billing panels (yes) | `/api/billing/*` | `BillingStore` | 028 | maker-checker approval; sandbox only | yes | E2E 02 | legacy `/api/payments/*`; no live payments by design |
| **Audit activity** | per-module activity (practice, recovery history) | per router | audit rows in `taxguard_audit_log` | every proposal | per scope | yes | per suite | tenant-wide durable audit viewer for administrators |
| **Integrations** | `PortalDirectoryPage` | `/api/integrations` | in-memory | none | legacy | **no** | — | no real connectors by design |

## Changes in Phase 7

- Proposal 039 messaging (above), its API, the client portal and staff UI, and `practiceManagerAccess` entries for it.
- Legacy `/api/messages` GET listed every message of an engagement, and every message for staff,
  without the per-message access check; it now applies `canAccessMessage` to each row (clients never
  receive either internal flag). Covered in `legacyRouteObjectAuthorization.test.ts`.
- Earlier (Phase 6/7 reconciliation): no in-memory demonstration seed in durable deployments;
  unreachable demonstration portal views removed.

## Phase 8 candidates (in order)

1. Appointments and scheduling: new tables and proposal, store, `LiveCalendarModule` on the durable API.
2. Point `AppContext` legacy loads (engagements, documents, invoices) at the durable APIs and retire
   the legacy routes and the unmounted `AssignmentGovernanceTab`.
3. Durable administrator audit-log viewer; legal coordination records.
