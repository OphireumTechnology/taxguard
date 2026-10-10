# TaxGuard dashboard masterplan — Gate 4

Scope: Preparer / Accountant only. No Gate 5 implementation, commit, push, merge, deployment, migration or production-data operation.

## A. Implementation summary

Replaced the live accountant screen's sample taxpayers, hardcoded years, fabricated extraction/confidence/reconciliation results and local-only review success messages with a scoped service-backed dashboard. Preserved the Gate 2 application shell, Gate 3 client experience, operational queue exports and existing backend workflow/approval services.

## B. Masterplan sections

Implemented the navy/gold command bar, nine KPI positions, grouped navigation, authorized case search, dense work queue, tax-year filter, pipeline, recorded engagement deadlines, selected-case tabs, preparation evidence states, generated-form table and line-item inspection, client information, workpaper traceability, client history and nine-step workflow footer. Shared header supplies authentication context, profile, notifications, help and responsive drawer.

Responsive grids, bounded table/tab scrolling, focus outlines and keyboard arrow/Home/End tab navigation are included. No reference image is embedded in the application.

Unsupported tools are disabled. Unsupported execution evidence, confidence, readiness, editors and assistant capabilities have controlled states rather than simulated results. Approval and filing tabs read server gate states without creating a new approval mechanism.

## C. Existing components/services reused

DashboardApplicationShell, its responsive drawer and identity/access checks, NotificationBell/profile/help, useApp, centralized authenticated API transport with session-change rejection, assignment authorization, TaxGuardAuthorityRepository, case-authority stage/return/workpaper APIs and existing role middleware.

The old StageThreeAccountantReviewWorkspace has a selected-client prop that is not applied to its queue. It is not embedded as a supposedly isolated selected-case workspace. Its source and backend functionality remain intact. Existing bookkeeping modules remain intact; their refinement belongs to Gate 5.

## D–E. Components and changed files

Gate 4 added:

- src/components/workspace/AccountantDashboard.tsx
- src/components/workspace/accountantDashboard.css
- src/components/workspace/accountantDashboardModel.ts
- src/server/accountantDashboardProjection.ts
- src/tests/accountantDashboardMasterplan.test.tsx
- src/tests/accountantDashboardApi.test.ts
- docs/dashboard-masterplan-gate-4.md

Gate 4 modified:

- src/components/workspace/AccountantWorkspace.tsx — compatibility exports and new live entry point; sample UI removed.
- src/server/routes/accountant.routes.ts — read-only /dashboard adapter and production authority gate.
- src/services/api.ts — authenticated dashboard reader with AbortSignal.

Earlier uncommitted Gate 2/3 changes remain in the workspace; the full git status also lists those files.

## F. Data/API integrations

GET /api/accountant/dashboard reads existing application engagement/document/onboarding stores. Every engagement requires the current tenant and existing exact engagement/year assignment check. Production additionally calls the existing case authority before returning any case. Responses use Cache-Control: no-store.

The adapter supplies only document metadata and OCR confidence, excluding file URLs, extracted taxpayer fields and private notes. Onboarding context is displayed only for its recorded requested tax year. No EIN, taxpayer address, SSN, DOB or dependent identities are included.

GET case-authority scoped case, returns, workpapers and stages are reused. Frontend responses are checked against tenant, canonical client ID, engagement and tax year. Draft forms come from persisted return artifacts; preview shows their recorded line items and diagnostics, not an invented IRS PDF. Client history contains accessible engagements only.

## G. KPI derivation

Assigned Cases: accessible engagements. Due Today/Overdue: recorded engagement due date, excluding filed/completed/closed/archived engagements. Waiting on Client: awaiting_client or client_action_required. Ready for Review: review_needed. In Preparation: in_preparation. Client Approval: authoritative stage 10; unavailable when workflow coverage is incomplete.

Ready to File and Filed This Month are unavailable because this adapter has no readiness certificate or filed timestamp. Stage 12 or an updatedAt timestamp is not substituted for that evidence. KPI filters operate only on the already authorized collection.

## H. Authoritative Stage 01–18 mapping

The persisted engine differs from the architectural image. It remains unchanged:

01 Onboard; 02 Collect; 03 Validate; 04 Record; 05 Reconcile; 06 Review; 07 Report; 08 Plan; 09 Prepare Taxes; 10 Approve; 11 Sign; 12 File; 13 Government Feedback; 14 Resolve; 15 Monitor; 16 Archive; 17 Renew; 18 Repeat.

Accountant visual projection:

| Reference step | Persisted stages |
| --- | --- |
| Review client information/questionnaire | 01 |
| Verify/reconcile documents | 02–05 |
| AI prepare federal forms | 09 |
| AI prepare state forms | 09 |
| Review/edit/approve | 10 |
| Client signs/approves | 11 |
| Senior review | 06–08 |
| File IRS/state | 12 |
| Track/close | 13–18 |

Federal/state preparation share the same authoritative stage. The reference's placement of senior review does not reorder the engine. The footer highlights current mapped stages; it does not infer completion or AI execution from visual ordering. Pipeline counts cover verified accessible engagements, with missing workflow coverage disclosed.

## I. AI and human controls

OCR confidence is displayed only from a finite recorded value, with human-review language. Generated-return artifacts do not establish AI confidence or task completion. The task list explicitly reports unavailable execution evidence.

The existing AI review endpoint requires a preserved evidence ID, case revision, operation ID and server feature gate. A general scoped conversational assistant and discoverable execution telemetry are not available through the dashboard's existing read contracts. No A00–A60 agent runs are fabricated; no external AI provider is called during implementation/validation.

No approve, sign, file, certify, generate, transition or review mutation is issued by the new dashboard. Existing server maker-checker, human gates and provider controls remain authoritative.

## J–K. Security and regression coverage

37 new tests cover shell rendering/loading, role/session/tenant rejection, tenant/client/year document boundaries, recorded-status KPI derivation, all 18 workflow stages, AI confidence boundaries, metadata minimization and exact-scope server projection. HTTP tests exercise real role middleware with test authentication, production case-authority denial, cross-tenant exclusion and no-store responses. Test fixtures/providers are local; no production service is contacted.

Existing authentication, assignment, document authorization, evidence-review, case-authority, client dashboard and workflow tests are retained. Production discovery fails closed on case-authority denial/unavailability. This is code/test validation, not an independent audit of deployed Supabase RLS policies.

## L–P. Validation

- Full suite: 103 files, 1,525 tests passed.
- Type checking: passed, tsc --noEmit.
- Configured lint: passed; repository lint is also tsc --noEmit.
- Production frontend and bundled server build: passed.
- git diff --check: passed.

Existing build warnings remain: LiveCalendarModule mixed static/dynamic imports, and a main JavaScript chunk exceeding the configured 850 kB warning threshold. These do not fail the build.

## Q. Git status

Development branch: feature/dashboard-masterplan. Fetch verified origin/main; main and branch HEAD were both synchronized to the fetched baseline (0/0 divergence). Existing uncommitted gates were preserved.

Working tree contains modified/new Gate 2–4 code and documentation. design-reference/ and _hardening_backup_20261002-021908/ remain untracked. The backup was not opened or modified. No commit, push, merge or deployment occurred.

## R. Limitations / backend gaps

- Existing application-store discovery must contain the engagement before it can appear. Missing durable/application-store synchronization will yield omitted cases, not fabricated fallbacks.
- Production case-authority denial/unavailability omits the case; no client data is exposed through a fallback.
- Missing scoped assistant/evidence discovery and task-level AI telemetry; no synthetic completion/confidence.
- No verified filing-readiness or filed-month timestamp integration.
- No statutory deadline registry; only recorded engagement commitments are shown.
- Source document signed preview/editor, version comparison, revision requests and protected mutation controls are not newly integrated. The current preview inspects persisted form line items only.
- Unsupported intake/tools/reports are disabled; notifications/help remain in the shared header. No multirole grants are invented.
- No authenticated browser session was available for interactive screenshot, tablet/mobile or private-file QA. Responsive behavior is implemented in CSS and keyboard handlers; visual fidelity has not been verified through an authenticated screenshot.

## S. Remaining Gate 5

Reviewer/Senior: ready-review and risk/returned queues, quality/calculation review, exceptions, compliance and maker-checker approve/return integration. Bookkeeper: scoped transaction categorization, reconciliation, ledger, periods, financial reporting, evidence matching and adjustments. Begin only after explicit user approval.
