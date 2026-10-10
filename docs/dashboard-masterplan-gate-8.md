# TaxGuard Gate 8 ? Client Service / Operations Dashboard

Date: 2026-10-08. Branch: feature/dashboard-masterplan. Gate 9 is not started.

## A. Gate 8 implementation

Implemented the authenticated Client Service / Operations workspace with eight modules: Dashboard, Client Requests, Messages, Appointments, Follow-Up, SLA & Escalations, Client Search and Reports. The dashboard includes seven truthful KPI cards, an operational request queue, selected request instructions, client-visible conversations, verified follow-up items, recorded escalation evidence, server-side case search and selected-case context.

This is a controlled read-only release. Production operational reads fail closed until durable workflow/communication providers are connected. No sending, resolution, marking read, booking, escalation or tax/accounting mutation is released for this role.

## B. Masterplan coverage

Inspected design-reference/dashboard-masterplan.png and architecture-workflow.png. Reused navy/gold TaxGuard shell and role-aware collapsible navigation; added compact light surfaces, dense operational tables, teal communication accents, warning/escalation KPI accents and a right context/control rail. Responsive CSS contains wide tables and rearranges cards for tablet/mobile widths. Native labelled inputs/buttons, visible keyboard focus and current-stage indicators are provided. The reference images are not embedded.

No authenticated interactive browser session was available for visual QA; render-state tests and responsive styles do not establish screenshot parity.

## C. Reused / created components

Reused DashboardApplicationShell, dashboardAccess, canonical staff routing, AppContext authentication, the central authenticated API adapter, existing canonical case paths/transaction interface, ClientRequestService, ClientCommunicationService, PracticeTaskService, DeadlineEscalationService and OperationalSearchService. Reused persisted Stage 01?18 labels and the recorded-age helper.

Created ClientServiceDashboard, scoped CSS/model/loading/detail/search hooks, typed projection contracts, a narrowly authorized read projection and an operations-specific server capability policy. Existing broad operational search is preserved for existing authorized roles, but operations is denied that API and uses a new scoped method on the existing search service.

## D. Gate 8 files changed

Modified:

- src/App.tsx
- src/config/canonicalRouting.ts
- src/context/AppContext.tsx
- src/components/layout/dashboardAccess.ts
- src/types/index.ts
- src/services/api.ts
- src/server/auth.ts
- src/server/supabase-db.ts
- src/server/routes/practice-operations.routes.ts
- src/server/taxguard/operations/operationalSearch.service.ts

Added:

- src/components/workspace/ClientServiceDashboard.tsx
- src/components/workspace/clientServiceModel.ts
- src/components/workspace/clientServiceDashboard.css
- src/hooks/useClientServiceDashboardData.ts
- src/types/clientServiceDashboard.ts
- src/server/clientServiceAccess.ts
- src/server/clientServiceProjection.ts
- src/tests/clientServiceAuthority.test.ts
- src/tests/clientServiceHttp.test.ts
- src/tests/clientServiceReadStates.test.tsx
- docs/dashboard-masterplan-gate-8.md

21 Gate 8 files. Prior authorized Gates 2?7 work remains in the working tree and is not counted as Gate 8 changes.

## E. APIs/data integrations

Added four exact GET endpoints under /api/operations/client-service:

- /dashboard: minimum-information authorized operational snapshot.
- /search: scoped canonical case identifier search, 2?100 characters, at most 50 matches.
- /conversation: selected case/year/thread client-visible message content.
- /request: selected case/year/request instructions.

Each endpoint requires an active verified operations session, trusted tenant, configured production tenant agreement, canonical active operations membership and server-authorized client grants. Queries support all verified years or an explicit 2022?2200 tax year. Responses use Cache-Control: no-store. Client grants reuse the existing Supabase durable staff-assignment reader; no grants or memberships are provisioned.

Canonical cases must match stored tenant/client/engagement/year and a valid Stage 01?18 value. Requests and threads must carry an exact engagement plus a canonical year-bearing case identifier (case_YYYY) or the full canonical case path. Client-wide or generic legacy case links are not inferred into a selected year. Requests additionally match assignedToClientId. Selected content rechecks source association, including changed request ownership.

Task follow-ups require tenant/client/engagement/year matching and any supplied case link. Recorded escalations require tenant/client/year/case matching and a unique case association; ambiguous links are excluded. Document status counts require exact scope metadata and a noncontradictory case identifier. No private storage links or document bodies are read by this workspace.

The current authority/request/communication/task/deadline adapters are volatile; production returns 503 DURABLE_CLIENT_SERVICE_PROVIDER_REQUIRED rather than treating local/example records as Supabase/PostgreSQL authority.

## F. Requests / messages / appointments

The request queue shows client/case identifiers, request type, stored status/priority, recorded age/due date and a control to view actual stored instructions. The request contract does not establish a staff owner, so owner is Not recorded; creator/resolver identities are not fabricated as ownership. Open, Waiting, Overdue and Resolved filters derive stored lifecycle states. Request-specific Escalated filtering is disabled: a case-level deadline escalation does not prove that a particular request was escalated.

Queue payloads omit request descriptions/responses and conversation subject/body. Explicit selection loads only authorized instructions or client-visible messages. INTERNAL_ONLY messages are excluded even though this is a staff role. Message sender roles/timestamps and source read flags are displayed; incoming client-visible isRead=false flags drive Unread Messages. Flags are shared source state, not personal read receipts. Reading does not mark read, send a message or create an audit decision. Attachments, download URLs and internal tax-review notes are not exposed.

The legacy appointment contracts lack verified tenant/case/tax-year scope for this workspace. Appointments Today is Unavailable rather than zero. The appointment module explains the controlled integration gap and never substitutes existing seed/example calendar rows. Booking/rescheduling actions remain unavailable.

## G. Follow-up / escalation / KPI derivation

- Open Requests: stored OPEN, VIEWED, RESPONDED and UNDER_REVIEW requests.
- Unread Messages: incoming client-visible messages with an explicit false source read flag.
- Appointments Today: unavailable until a scoped appointment adapter exists.
- Waiting on Client: distinct authorized cases with OPEN/VIEWED requests or explicit WAITING_ON_CLIENT operational follow-up tasks.
- Overdue Follow-ups: outstanding request/task records with due dates before the current UTC calendar day. It counts recorded items, not distinct clients; source items are shown in the workspace.
- Escalations: recorded positive-level deadline escalations excluding MET/WAIVED, scoped to a uniquely matched case.
- Resolved / Completed: stored RESOLVED/CLOSED requests plus COMPLETED operational follow-up tasks; not a tax-return completion claim.

Follow-up tasks are restricted to explicit CLIENT_FOLLOW_UP, DOCUMENT_FOLLOW_UP, QUESTIONNAIRE_FOLLOW_UP, APPOINTMENT_FOLLOW_UP and SIGNATURE_FOLLOW_UP types. Generic blocked tax calculations or bookkeeping tasks do not create client obligations. Current-user task ownership appears only when it matches the verified actor; broader staff ownership is not disclosed without a visibility contract.

Next required client action is a selected-case OPEN/VIEWED request prioritized by verified due/creation dates, linked to actual stored instructions. A RESPONDED request awaiting staff review does not create another client obligation. Stage position alone never creates a request or obligation.

SLA policy and violation evidence are unavailable. Recorded deadline levels and registration age are not claimed as SLA violations or an escalation-event audit history. Escalation owner/required-action data is absent from the contract and shown as unavailable. Reads do not run an escalation sweep or contact anyone.

## H. Stage 01?18 integration

The existing persisted engine remains controlling: Onboard, Collect, Validate, Record, Reconcile, Review, Report, Plan, Prepare Taxes, Approve, Sign, File, Government Feedback, Resolve, Monitor, Archive, Renew, Repeat. The selected case's current stage is highlighted. Reference labels differ from this existing implementation; no renumbering or replacement state machine is introduced. Client Service can observe and facilitate communication across stages, never advance them or prepare/approve/sign/file.

## I. AI/human boundaries

No operational AI execution/provider is connected or fabricated. The UI states this. Future message summaries, categorization or escalation suggestions must remain advisory. No autonomous contact, tax/accounting record mutation, workflow transition or professional decision is implemented. Existing maker-checker, human approval and filing controls remain authoritative.

## J. Security/isolation validation

The operations role now resolves to its dedicated shared shell instead of the preparer workspace. It cannot render accountant/reviewer/admin/manager/bookkeeper shells. Both durable and development authentication paths apply an exact endpoint/method capability policy: only the four read APIs and exact session lifecycle APIs are allowed. Broad legacy search, communication sends, request mutations, appointment APIs, administration/security, accounting, tax approval/signature and filing remain denied on the backend.

Canonical membership and trusted session grants control discovery before matching/aggregation. Year/engagement/case links prevent cross-year association and fail closed for ambiguous legacy data. List payloads minimize PII; explicitly selected instructions/conversations remain within authorized case scope. React renders content as text. Hooks abort stale requests and suppress old results after identity/session/year/selection changes. The secure search has no unrestricted frontend taxpayer fallback.

Existing authentication, RBAC/RLS, private storage, audit mechanisms and other roles' controls remain intact. No new mutation/audit-success record is fabricated; durable audited mutation integration remains a prerequisite to release actions.

## K. Tests added

82 new tests across three files cover real HTTP authentication, unauthorized/disabled roles, canonical operations membership, trusted tenant mismatch, revoked client grants, request visibility, tenant/client/engagement/year boundaries, generic legacy case-link rejection, message authorization/internal-note exclusion, selected-content revalidation, secure server search, appointment exclusion, follow-up derivation/ownership, escalation boundaries, all eighteen workflow stages, mutation/AI-contact denial and loading/empty/error states. Existing tests are preserved.

## L?P. Validation

- Full configured tests: 116 files / 1,797 tests passed.
- Type checking: passed, tsc --noEmit.
- Configured lint: passed (repository lint is tsc --noEmit).
- Production frontend/server build: passed, Vite + esbuild.
- Existing build warnings remain: mixed static/dynamic calendar import and main bundle above the configured 850 kB threshold (about 1,434.04 kB).
- git diff --check: passed.

## Q. Git status

Fetched origin before development; main versus origin/main and origin/main versus HEAD were both 0 / 0. Upstream did not advance. Branch remains feature/dashboard-masterplan with prior Gates 2?7 work plus Gate 8 additions/edits uncommitted. No commit, push, merge, rebase, reset, clean or deploy occurred. design-reference/ and _hardening_backup_20261002-021908/ remain untracked; the backup was not opened or modified. No production data, migrations, credentials or secrets changed.

## R. Backend/integration gaps

- Durable PostgreSQL workflow/request/communication/task/deadline read adapters are required before production data is released.
- Actual operations memberships/client assignments require authorized backend provisioning; none were created or changed.
- Scoped appointment data lacks tenant/case/year association; current appointment management is unavailable.
- Request send/respond/resolve, read receipts, appointments and escalation mutations require scoped durable operations and existing audit evidence before release.
- Request-specific escalation linkage, staff request ownership, wider follow-up owner visibility, escalation owner/action and SLA policy/violation evidence are unavailable.
- Per-user message read receipts, explicit conversation follow-up state and attachment/private preview contracts are unavailable.
- Unscoped/client-wide/generic legacy request/thread links are excluded until year-bearing association is established.
- Search supports authorized client/engagement/year identifiers only; name/contact search is not released through the unsafe broad adapter.
- Response-time/SLA/appointment reports and operational AI support remain unavailable.
- Authenticated browser/tablet/mobile visual QA remains unperformed; no screenshot parity is claimed.

## S. Gate 9 remaining work ? Billing / Finance Dashboard

Not started. Requires explicit authorization. Remaining scope: authorized engagements, invoices, payments, outstanding/past-due balances, collections, refunds, billing reports and verified payment-provider status. Reuse the shared shell and existing billing/payment services with strict financial-role, tenant/client/year boundaries; preserve all existing safeguards and require durable audited controls for mutations.
