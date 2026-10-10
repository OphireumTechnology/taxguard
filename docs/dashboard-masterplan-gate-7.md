# TaxGuard Gate 7 ? Practice Manager Dashboard

Date: 2026-10-08. Development branch: feature/dashboard-masterplan.

## A. Gate 7 implementation

Implemented an authenticated Practice Manager operational command center with Dashboard, Workload, Deadlines, Team Capacity, SLA & Escalations, Workflow and Reports modules. It includes seven KPI cards, an 18-stage distribution, case filtering, verified recorded due dates, staff workload, recorded deadline escalations, workload concentration and controlled integration gaps. It is a read-only release; production operational reads fail closed while the available workflow/task/deadline providers remain volatile.

## B. Masterplan coverage

Inspected both dashboard-masterplan.png and architecture-workflow.png. Reused navy/gold shared branding and navigation, compact command cards, light operational surfaces, dense case/team/deadline tables, distribution bars and a right rail for workload concentration and human controls. Responsive layouts, contained table scrolling, native labelled inputs, keyboard-accessible controls and focus states are implemented. No reference image is embedded in the UI. No authenticated interactive browser session was available for screenshot parity or tablet/mobile visual QA.

## C. Reused and created components

Reused DashboardApplicationShell, dashboardAccess, theme tokens, canonical staff routing, AppContext authentication, the centralized API adapter, existing authoritative case paths/database transaction interface, PracticeTaskService, DeadlineEscalationService and existing persisted stage names. Added PracticeManagerDashboard, its scoped CSS/model/loading hook, a minimum-information projection contract and a manager-specific server capability boundary. The existing analytics service is preserved but deliberately not used: it infers stages from client profiles and contains fixed values unsuitable for these KPIs.

## D. Gate 7 files changed

Modified existing files:

- src/App.tsx
- src/config/canonicalRouting.ts
- src/context/AppContext.tsx
- src/components/layout/dashboardAccess.ts
- src/types/index.ts
- src/services/api.ts
- src/server/auth.ts
- src/server/supabase-db.ts
- src/server/routes/practice-operations.routes.ts

Added:

- src/components/workspace/PracticeManagerDashboard.tsx
- src/components/workspace/practiceManagerModel.ts
- src/components/workspace/practiceManagerDashboard.css
- src/hooks/usePracticeManagerDashboardData.ts
- src/types/practiceManagerDashboard.ts
- src/server/practiceManagerAccess.ts
- src/server/practiceManagerProjection.ts
- src/tests/practiceManagerAuthority.test.ts
- src/tests/practiceManagerHttp.test.ts
- src/tests/practiceManagerReadStates.test.tsx
- docs/dashboard-masterplan-gate-7.md

20 Gate 7 files in total. Existing Gates 2?6 edits remain in the working tree and are not counted as Gate 7 changes.

## E. APIs/data integrations

GET /api/operations/manager-dashboard uses the verified active Practice Manager session and its authorized client grants. It supports an explicit taxYear filter or all existing authorized years, constrained to canonical supported years 2022?2200. Trusted tenant and configured production tenant must agree; query/header tenant overrides are rejected. Responses use Cache-Control: no-store.

The scoped projection reads canonical tenant/client/engagement/year cases in the existing transaction interface. Every case must match its stored tenant, client, engagement and year and have a valid Stage 01?18 value. It does not infer cases or stages from taxpayer profiles. Tasks must match tenant/client/engagement/year and any supplied case identity. Deadlines require explicit tenant/client/year and a uniquely matching authorized case; ambiguous engagements are excluded rather than assigned arbitrarily. No fixed regulatory deadline is introduced.

Existing task and deadline services are queried without truncating aggregates. The source providers are in memory; production returns 503 DURABLE_OPERATIONS_PROVIDER_REQUIRED rather than showing volatile/local/example records as PostgreSQL authority. Supabase durable sessions reuse the existing staff-assignment reader to attach server-verified client grants for the new role.

## F. KPI derivation

- Active Cases: canonical cases with an existing recognized non-archived status. Unknown status is not counted as verified active; filing alone does not end the full lifecycle.
- Due This Week: distinct active cases with a verified outstanding deadline in the current UTC Monday?Sunday week.
- Overdue: distinct active cases with an outstanding verified due date before the current UTC calendar day. Date-only deadlines due today are not overdue.
- Waiting on Client: active cases with an exact-scope WAITING_ON_CLIENT task; no inference from Collect stage.
- Ready for Review: exact-scope READY_FOR_REVIEW tasks or canonical IN_REVIEW case state.
- SLA Risk / Escalations: stored positive escalation levels on outstanding deadline records. The UI labels these recorded deadline escalations, not verified SLA violations.
- Team Capacity / Workload: active case volume, with capacity explicitly unavailable.

Repeated deadlines do not duplicate case KPI counts. Completed/cancelled task deadlines and met/waived deadline escalations do not create outstanding work.

## G. Workload/capacity

Visible staff must be referenced by an authorized canonical case, have an active effective case assignment matching their preparer/reviewer responsibility, and have an active matching professional membership within the tenant. Revoked, future, inactive, unrelated and cross-tenant staff are suppressed, including stale case owner fields. Staff rows expose identifiers and roles rather than names, email or credentials.

Per-staff assigned, due, overdue and review workload derives from distinct visible active cases. A case may be assigned to both a preparer and reviewer; staff totals therefore overlap and are not a headcount capacity calculation. Available hours, utilization percentages, targets and FTE capacity are not fabricated.

## H. Deadlines/SLA

Verified deadline rows display client/year, source category/authority, due date, recorded status/escalation level and registration age where available. The deadline contract lacks responsible owner and required-action evidence; those fields show Not recorded. Reads do not evaluate or mutate escalation levels or create events. SLA policy/violation evidence is unavailable. Manual/estimated source authority remains visible and is not represented as a regulatory mandate.

Workload concentration ranks nonzero active stage counts and includes reconciliation-stage, verified review-ready and filing-stage workload. This identifies accumulation, not a proven delay or SLA failure. Case aging uses only recorded last-update age; stage dwell time and excessive-wait thresholds are unavailable.

## I. Stage 01?18 integration

The existing engine remains controlling: Onboard, Collect, Validate, Record, Reconcile, Review, Report, Plan, Prepare Taxes, Approve, Sign, File, Government Feedback, Resolve, Monitor, Archive, Renew, Repeat. Reference stage labels differ from persisted implementation; the dashboard preserves existing numbering and names rather than introducing a replacement engine. Distribution counts and case filters use canonical activeStage. No manager control transitions a case.

## J. AI/human boundaries

No operational AI provider or fabricated agent execution is connected. The UI says so. Workload concentration is a deterministic count projection, not claimed AI analysis. Future AI suggestions must remain advisory. Reassignment/escalation mutations are not released, and existing professional review, maker-checker, signature and filing gates remain controlling.

## K. Security/isolation

The practice_manager role has a dedicated staff shell and cannot render accountant/reviewer/admin/bookkeeper workspaces. Server authentication in both durable and development session paths permits only the exact manager read API and exact session lifecycle APIs for this role. Tax approval, signature, filing, accounting posting, administration/security and legacy operational mutation APIs remain denied. The new role is not added to broad legacy staff-client access or preparer/reviewer authority.

The projection additionally requires active canonical manager membership. Backend grants control case discovery; browser filters are not authorization. Tenant/client/year/engagement matching occurs before aggregation. Only active effective staff assignments appear. Payloads omit taxpayer names, SSNs, tax figures, private documents, storage URLs, client communication bodies, freeform task/deadline details and unrelated staff information. The hook aborts stale reads and suppresses old data on session/identity/year changes. Existing RLS, authentication, private storage, audit controls and other roles' behavior are preserved.

## L. Tests added

72 new tests across three files cover dedicated-shell authorization, real HTTP authentication, unauthorized/disabled roles, canonical manager membership, trusted tenant mismatch, revoked grants, client/year/engagement isolation, invalid workflow stages, workload aggregation, active effective staff visibility, deadline deduplication/week boundaries, SLA/escalation filtering, unknown capacity, all eighteen stages, mutation denial, AI unavailability, PII omission and empty/loading/error states. Production provider refusal is tested with an isolated verified-session fixture. No tests access production data.

## M?Q. Validation

- Full configured test suite: 113 files / 1,715 tests passed.
- Type checking: passed (tsc --noEmit).
- Configured lint: passed (repository lint is tsc --noEmit).
- Production frontend/server build: passed (Vite + esbuild).
- Existing warnings remain: mixed static/dynamic calendar import; main bundle exceeds the configured 850 kB warning threshold (about 1,413.74 kB).
- git diff --check: passed.

## R. Git status

Fetched origin before development. main versus origin/main and origin/main versus HEAD were both 0 / 0; upstream did not advance. Branch remains feature/dashboard-masterplan. Working tree contains prior approved Gate 2?6 changes plus Gate 7 modifications/additions. No commit, push, merge, rebase, reset, clean or deployment occurred. The reference folder and _hardening_backup_20261002-021908/ remain untracked. The backup was not accessed or modified. No production data, migrations, credentials or secrets changed.

## S. Backend/integration gaps

- Durable PostgreSQL workflow and operational read adapters are required before production dashboard data is released.
- Actual manager membership/client grants must be provisioned through authorized backend administration; no production grants or users were created.
- Reassignment/escalation mutations require scoped durable operations and audit evidence; current UI is controlled read-only.
- Capacity hours, utilization targets, SLA policy/violation evidence, escalation owner/action and stage dwell time are unavailable in these contracts.
- Completion/throughput trends require authoritative historical transition integration; archived counts are not fabricated as completion events.
- Client request-specific backlog and excessive waiting time need exact-scope request/history integration; only verified waiting tasks are projected here.
- Ambiguous client/year-only deadlines spanning multiple engagements are omitted until explicit case/engagement linkage exists.
- No operational AI provider is integrated or claimed.
- Browser visual QA remains unperformed; responsive CSS and render-state coverage are validated without claiming screenshot parity.

## T. Gate 8 remaining work ? Client Service / Operations

Not started. Pending explicit authorization: authorized client requests, messages, appointments, response queues, follow-up, recorded SLA escalations, communication templates and client operations. Reuse the shared shell, existing communication/request/appointment services and server authorization. Preserve all current role boundaries and production-provider safeguards.
