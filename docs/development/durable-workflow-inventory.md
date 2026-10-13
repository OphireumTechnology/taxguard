# Durable workflow inventory and implementation matrix (Phase 8, 2026-10-14)

Baseline `main` `5afa970`. "Durable" means PostgreSQL through service-role-only SECURITY DEFINER
proposal functions, enforced per (tenant, client) by the database, surviving a server restart. A
screen or legacy route over the in-memory store (`src/server/db.ts`) is **not** a durable workflow.
All proposals are unapplied; durable routers answer only with `TAXGUARD_PRACTICE_STORE=durable`
against a non-production project (otherwise 503) and are not mounted in `createProductionApp`.
"Validated" below always means **local tests only** (PGlite, local PostgreSQL, loopback E2E) —
nothing is validated in an isolated staging project or commissioned for production.

Classification: **D** durable and operational in local tests · **P** partially implemented ·
**M** in-memory only · **X** demonstration-only · **U** unreachable / dead code · **B** blocked
pending external configuration · **N** not implemented.

## Matrix

| Subsystem | Class | Reachable UI | API → store → proposal | Authorization & isolation | Tests | Remaining |
|---|---|---|---|---|---|---|
| Client management & engagements | **D** | `PracticeClientsPanel` (manager) | `/api/practice` → `PracticeStore` → 025 | managers manage; assigned staff read; versions | `practiceManagementHttp`, E2E 02 | `AppContext` still loads legacy `/api/engagements` for legacy panels (**M** path) |
| Staff assignments & accountant queues | **D** | Team section, `DurableMyWorkPanel` | `/api/practice/...team`, `/my-work` → 025 | managers assign; partial unique ACTIVE index | as above, E2E `ensureStaffed` | reassignment-request review exists only in the unmounted legacy `AssignmentGovernanceTab` (**U**, kept: no durable replacement yet) |
| Client / staff messaging | **D** | portal Messages, staff inbox, client detail | `/api/communications` → 039 | own client / assigned / managers; internal notes staff-only | unit 8+4, DB 3, E2E 10 | no e-mail/SMS by design |
| Documents & document requests | **D** | vault, review, requests | `/api/vault` → 027, 031 | client own uploads; scan quarantine | E2E 02, 05 | malware scanner **B**; legacy `/api/documents` still loaded by `AppContext` |
| Billing, invoices, receivables | **D** | billing panels | `/api/billing` → 028 | maker-checker approval; sandbox only | E2E 02 | live payments **N** by design; legacy `/api/payments` (**M**) |
| Bookkeeping & general ledger | **D** | ledger workspace, bookkeeper queue | `/api/bookkeeping`, `/api/book-to-tax` → 024, 029, 030 | independent review forced | E2E 03 | — |
| Tax engine infrastructure | **D** (infrastructure) | tax-engine admin, case runs | `/api/tax-engine` → 033, 036, 038 | maker-checker rule approval, coverage gate | `taxRuleCoverage`, E2E 07 | **no real rules** (fails closed); stages 9–18 blocked |
| Authentication & MFA recovery | **D** (emulated provider) | staff sign-in, recovery panel and flow | `/api/staff-access` → 000–011, 034, 035, 037 | AAL2, 15-minute recent sign-in, independent approval | unit, DB, E2E provider 09 | real-provider validation **B** (no non-production project) |
| AI governance A00–A60 | **P** | AI control center, emergency stop | gateway, capabilities, ledgers (test-injected handlers only) | kill switches, allow-lists, human review | AI suites | no provider **B**; AI-16 material actions blocked by design; see `phase8-reviews.md` |
| Case management | **D** | case workflow | `/api/cases` → 026 | stage gates, attestations | E2E 03 | stages 9–18 blocked |
| **Appointments & scheduling** (Phase 8) | **D** | client portal Appointments + overview; staff "My appointment schedule"; manager "Appointments" calendar | `/api/scheduling` → `AppointmentStore` → **040** | own client / assigned staff / managers; DB-locked conflict checks; versions; idempotent keys; state machine | unit 8+7, DB 3 (concurrency), E2E 11 | public prospect booking (`BookConsultationPage`, `live_calendar` page) still uses legacy `LiveCalendarModule` (**M**): no unauthenticated durable booking exists; external calendar sync **N** |
| **Administration & audit logs** (Phase 8) | **D** (audit) / **M** (other admin views) | admin "Compliance Audit Log" → `AuditCenterPanel` | `/api/audit-center` (GET only) → **041** | active administrators only; allow-list redaction; 92-day range; keyset pages; 5 s timeout | unit 4, E2E 11 | `SuperAdminConsole` users / security events / health remain **M**; append-only trigger for `taxguard_audit_log` is the separate `docs/sql/taxguard-audit-append-only.proposal.sql` |
| **Legal / compliance coordination** (Phase 8) | **D** (tracking) | client detail "Legal coordination" (staff) | `/api/legal-matters` → **042** | own client / assigned staff / managers; staff-only defined status order; disclaimer at intake | unit 5, E2E 11 | client-portal screen **N** (API supports client intake); referral approval rule, retention, engagement letters, signatures **N** (not defined by the product) |
| Third-party integrations | **M** / **B** | `PortalDirectoryPage` | `/api/integrations` (in-memory) | legacy | — | no real connectors by design |

## Changes in Phase 8

- Proposals 040 (appointments), 041 (audit center), 042 (legal coordination) with stores, routers,
  practice-manager capability entries, UI and tests.
- Client portal: the Appointments module and the overview's appointment tile read the durable API;
  the legacy calendar is no longer used for authenticated clients.
- Legacy `GET /api/legal` returned every client's legal records to any staff member; it now applies
  the staff client-access check (`legacyRouteObjectAuthorization.test.ts`).
- Removed (unreachable, not referenced by any test or script, replaced by durable screens):
  `portal/views/MessagesView.tsx` (in-memory messages with a hard-coded advisor identity → durable
  `ConversationPanel` / `AppointmentsPanel`) and `portal/views/StepByStepTaxPreparationHome.tsx`
  (legacy in-memory reads → durable client dashboard stage views and overview).
- Kept although unreachable (valid capability without durable replacement): `AssignmentGovernanceTab`
  (reassignment-request review), `ClientIntakeDashboard` (intake overview).

## Phase 9 candidates

1. Retire `AppContext` legacy loads (engagements, documents, invoices, legal) in favour of the durable
   APIs, then the legacy routes they feed; durable reassignment-request review.
2. Client-portal legal-coordination screen; durable administrator users / security-event views.
3. Public consultation requests as a durable, rate-limited prospect intake (no tenant data exposure).
