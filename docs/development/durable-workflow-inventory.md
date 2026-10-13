# Durable workflow inventory and implementation matrix (Phase 9, 2026-10-14)

Baseline `main` `b35761b`. "Durable" means PostgreSQL through service-role-only SECURITY DEFINER
proposal functions, enforced per (tenant, client) by the database, surviving a server restart. A
screen or legacy route over the in-memory store (`src/server/db.ts`) is **not** durable. All
proposals are unapplied; durable routers answer only with `TAXGUARD_PRACTICE_STORE=durable` against
a non-production project (otherwise 503) and are not mounted in `createProductionApp`.
"Validated" always means **local tests only** (PGlite, local PostgreSQL, loopback E2E). Nothing is
validated in staging or commissioned for production.

Classification: **D** durable and operational in local tests · **P** partial · **M** in-memory only ·
**X** demonstration-only · **U** unreachable · **B** blocked on external configuration · **N** not implemented.

## Phase 9 audit of active data paths

| Workflow | Route / component (before) | Storage (before) | Durable replacement (now) | Client visibility | Audit | Tests |
|---|---|---|---|---|---|---|
| Shared app state (`AppContext`) engagements, documents, appointments, invoices, integrations, messages, legal | `refreshBackendData` (development builds only) | in-memory | **removed**: no reachable reader (verified by compiler); screens use durable APIs directly | — | — | full suite |
| Client dashboard documents | `api.clientDashboard.read('documents')` → `/api/documents` | in-memory | `/api/vault/clients/:id/documents` (027) → `vaultDocumentSummaries` | own client; no uploader identities mapped | vault audit | `clientDashboardSessionIsolation`, E2E 12 |
| Client dashboard engagements / return status | `/api/engagements` | in-memory | `/api/client-portal/clients/:id/engagements` (**044**) | own client; no DRAFT / CANCELLED engagements; no staff identities | read-only | `clientPortalReadsAndReassignment` |
| Client dashboard invoices / balance | `/api/payments/invoices` | in-memory | `/api/billing/clients/:id/invoices` (028) via the **client billing projection** | allow-listed fields only: no preparer / approver, review note, override reason, credit reasons, payment provider | billing audit | `billingHttp` (client assertions) |
| Unused `payInvoice` in shared state (charged a default 250 when the invoice was unknown) | `PricingPage` (destructured, never called) | in-memory legacy charge | **removed** | — | — | typecheck |
| Reassignment requests | unmounted `AssignmentGovernanceTab` → `/api/assignments/request-reassignment`, `/reassignment-requests` | in-memory | `/api/reassignment` (**045**), client portal "My Advisor", manager "Reassignment Requests" | client sees own requests and the review note, not reviewer identity | `REASSIGNMENT_*` (no reason text) | unit 5, E2E 12; tab removed |
| Public prospect booking | `BookConsultationPage` (live calendar + express booking with hard-coded staff), `live_calendar` page | in-memory slot holds / bookings | `/api/public/consultation-requests` (**043**) + manager "Consultation Requests", converted through appointments (040) | visitors receive a reference only | `CONSULTATION_*` (no personal data; actor `public-visitor`) | unit 6 (rate-limit mutant fails), DB 2, E2E 12 |
| Administrator user list | `SuperAdminConsole` section 3 → `/api/admin/users` | in-memory | durable staff directory (`StaffAccessManagementPanel`, 003–011, 034/035/037) via the Administrator dashboard | admins only | staff-access audit | existing staff-access suites |
| Security-event displays | `SuperAdminConsole` sections 6 / 10 → `/api/admin/security-events`, `/api/admin/audit-logs` | in-memory (lost on restart) | audit center (041) with the security view (**046**: SESSION, STAFF, AUTH, AI, KILL) | admins only; redacted | read-only | `auditCenter` (5) |
| Client legal coordination | none (staff only) | — | client portal "Legal Coordination" over 042 with the **044** projection | status, category, dates, progress steps, referenced documents; counsel only after the referral is recorded | `LEGAL_*` | unit, E2E 12 |
| Integrations | `/api/integrations` | in-memory | none (by design) — no reachable connect UI remains | — | — | — |

## Matrix (all subsystems)

| Subsystem | Class | Notes |
|---|---|---|
| Client management, engagements, assignments, task queues | **D** | 025; client-portal reads 044 |
| Reassignment requests | **D** | 045; independence of the reviewer and request limits are owner decisions |
| Messaging | **D** | 039 |
| Documents and document requests | **D** | 027, 031; malware scanner **B** |
| Billing and receivables | **D** | 028; Phase 10 database client projection, raw-table grants revoked, scoped replay, HTTP allow-list retained; live payments **N** |
| Bookkeeping and general ledger | **D** | 024, 029, 030 |
| Appointments | **D** | 040 |
| Public consultation requests | **D** | 043 |
| Administration (staff directory, MFA recovery, sessions) | **D** (emulated provider) | real-provider validation **B** |
| Audit and security events | **D** (persisted events) / **P** (producer custody) | 041, 046; Phase 10 bounded denial ingestion; pending queue volatile and monitored; legacy memory is not authoritative |
| Legal coordination | **D** (tracking) | 042, 044; referral approval rule, retention, engagement letters **N** |
| Tax engine | **D** (infrastructure) | no real rules; stages 9–18 blocked |
| AI governance | **P** | no provider **B**; AI-16 blocked |
| Stage two / three questionnaire and requests | **P** | `/api/stage-two-three` uses the database when configured, in-memory otherwise; not changed in Phase 9 |
| Integrations (QuickBooks, Xero, banks, e-signature, filing) | **B** / **N** | provider readiness reports NOT_CONFIGURED; no adapters enabled |
| `LiveCalendarModule` | **U** | no longer reachable (public pages use consultation requests); kept with its design tests because it holds the unbuilt external-calendar connection UI — deletion is an owner decision |
