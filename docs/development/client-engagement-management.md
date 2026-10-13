# Client and engagement management (Module 3)

**PRODUCTION STATUS: NO-GO.** Proposal 025 is **not applied**. `/api/practice` is development-only (503 unless `TAXGUARD_PRACTICE_STORE=durable` with a non-production Supabase project; absent from `createProductionApp`). Synthetic data only.

## Design decisions

- **No new client records.** Clients are created by the client identity flow (proposal 006: permanent client ID bound to an owner identity, owned by the Codex workstream). This module manages existing `taxguard_clients` rows. Staff-initiated client creation (before the client has a portal identity) needs a joint design with proposal 006 and is **blocked pending coordination**.
- **Reuses existing tables**: `taxguard_engagements`, `taxguard_tax_years`, `taxguard_staff_assignments`, `taxguard_assignment_history`, `taxguard_practice_tasks`, `taxguard_deadlines`; adds only `taxguard_engagement_notes` (append-only).
- **Fixes an assignment-schema defect**: `UNIQUE(tenant_id, client_id, role, status)` blocked a second reassignment of any role and allowed only one active preparer per client across all engagements and years. Replaced by a partial unique index on ACTIVE rows per (tenant, client, engagement, tax year, role). Assignments are engagement + tax-year scoped, which existing case reads (`SqlCaseReadPreparation`) already require.
- New foreign keys are added `NOT VALID` (existing rows not rewritten).

## Rules enforced in the database

| Area | Rule |
| --- | --- |
| Visibility | Practice managers / administrators see every tenant client; other staff only clients with a current ACTIVE assignment; other tenants never (not found) |
| Management | Engagement creation / status, tax years, team, client archive / type: practice managers only |
| Engagement lifecycle | draft → active / cancelled; active → on hold / completed / cancelled; on hold → active / cancelled; completion blocked by open tasks; hold / cancel need a reason; optimistic `version` |
| Team | Role compatibility (preparer ← accountant; reviewer ← reviewer / senior reviewer; bookkeeper ← bookkeeper; case owner ← practice manager / accountant / senior reviewer); preparer ≠ reviewer for an engagement year; reassignment closes the prior row and records history with a reason |
| Tasks | Assignee must have access to the client; dependencies must belong to the client; completion blocked by open dependencies; only assignee, creator or manager may change status; `version` |
| Deadlines | Statutory deadlines require a source citation (TaxGuard does not invent statutory dates); waivers by managers only and never for statutory deadlines |
| Archive | Requires a reason and no draft / active / on-hold engagement; archived clients accept no new work (and existing session checks deny client sign-in) |
| Idempotency | Created engagements, assignments, tasks and deadlines derive their IDs from the caller's `Idempotency-Key` |
| Audit | `PRACTICE_*` events per client; client detail returns activity across practice, case and ledger events |

## API (`/api/practice`)

`GET /clients?q=&status=&clientType=&cursor=&limit=`, `GET /clients/:id`, `POST /clients/:id/status|type|engagements|notes|tasks|deadlines`, `POST /clients/:id/engagements/:eid/status|tax-years|team`, `POST /clients/:id/team/:aid/revoke`, `POST /clients/:id/tasks/:tid/status`, `POST /clients/:id/deadlines/:did/resolve`.

## UI

Practice Manager dashboard → *Clients & Engagements*: directory search, client detail with engagements and lifecycle buttons, team assignment, tasks, notes, archive / reactivate, activity.

## Tests

`practiceManagementHttp.test.ts` (6; HTTP → router → store → proposal 025 in PGlite; mutation-checked for visibility, manager requirement and segregation of duties), `practiceClientsPanel.test.tsx` (4).

## Limitations

Staff client creation (above); authorized representative / contact records are not modelled (no schema exists; needs a privacy decision); the UI takes staff identifiers as text (no staff picker); multi-connection concurrency unverified; browser NOT VERIFIED.
