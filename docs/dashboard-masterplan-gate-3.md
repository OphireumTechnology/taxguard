# Gate 3 — Client / Taxpayer dashboard

## A–B. Implementation and masterplan sections

The authenticated dashboard uses the Gate 2 shared shell and a new compact,
light-surface overview based on the inspected client PNG. The masterplan and
architecture PNGs were also inspected. It implements the ten primary navigation
items, welcome/context, seven-step journey, current status/one next action,
return overview, supported quick actions, five summary cards, records, filterable
document checklist, sourced state requirements, important updates, appointment
and message previews, bottom journey and verified-capability strip.

Desktop uses a center workspace and right communication rail. Tablet stacks
the rail and reduces grid columns. Mobile uses the shared drawer and stacked
cards. Navigation remains collapsible. Search/questionnaire dialogs use native
focus trapping and Escape handling; navigation and filters have accessible
labels and current/pressed states.

## C–E. Reuse, new components and changed files

Reused: `DashboardApplicationShell`, authenticated context, canonical routing,
live workflow authority, secure collection/upload workspace, document vault,
calendar, profile/security components, client search and notification dropdown.
The server-persisted collection questionnaire replaces the local-only guided
questionnaire in this live dashboard.

New Gate 3 files:

- `src/components/portal/dashboard/ClientDashboardOverview.tsx`
- `src/components/portal/dashboard/ClientDashboardNavigation.tsx`
- `src/components/portal/dashboard/ClientDashboardModule.tsx`
- `src/components/portal/dashboard/clientDashboardModel.ts`
- `src/components/portal/dashboard/clientDashboard.css`
- `src/hooks/useClientDashboardData.ts`
- `src/tests/clientDashboardMasterplan.test.tsx`
- `src/tests/clientDashboardAccessBoundary.test.tsx`
- `docs/dashboard-masterplan-gate-3.md`

Modified during Gate 3:

- `src/components/portal/AuthenticatedClientDashboard.tsx`
- `src/components/portal/dashboard/ClientSearchModal.tsx`
- `src/components/portal/dashboard/NotificationCenterDropdown.tsx`
- `src/components/collection/TaxQuestionnaireModal.tsx`
- `src/services/api.ts`
- `src/tests/authenticatedClientDashboardRestoration.test.ts`

The previous Gate 2 changes remain uncommitted. Staff dashboards were not edited
in Gate 3. Older demo-oriented components remain in the repository, but unsafe
live overview, return-milestone, message-filtering and simulated-payment
destinations are no longer used by these primary client routes.

## F. Existing data integrations

Reads use the existing authenticated API transport and GET routes for documents,
engagements, messages, appointments, invoices, questionnaire, requirements and
client requests. The session profile supplies display name and registration
date. Questionnaire facts supply filing status, dependents, income and state.

Requirements are requested only after a matching saved questionnaire is
verified. This avoids the existing endpoint's default South Carolina/questionnaire
generation path. There is no client-side checklist authority in the new overview.

Messages and request replies use existing server write endpoints, only when the
user submits them, and show success after server acknowledgement. No live data
was changed during implementation or validation. Payments are read-only invoice
status; there is no simulated settlement or fabricated receipt.

## G. Workflow mapping

The projection follows the actual repository stage authority:

| Client phase | Persisted stages |
| --- | --- |
| Getting Started | 01 Onboard |
| Documents | 02 Collect, 03 Validate |
| Review | 04 Record, 05 Reconcile, 06 Review, 07 Report, 08 Plan |
| Tax Preparation | 09 Prepare Taxes |
| Approval & Signature | 10 Approve, 11 Sign |
| Filing | 12 File, 13 Government Feedback, 14 Resolve |
| Completed | 15 Monitor, 16 Archive, 17 Renew, 18 Repeat |

The diagrams differ from this persisted naming/order. No engine was replaced or
renumbered. The final client phase includes monitoring/renewal and does not
assert IRS acceptance or return completion without a recorded engagement state.
Unknown, demo, wrong-client, or wrong-year workflow data has no active or
completed client phase. Direct navigation to unverified stages is rejected.

## H–I. Security and regression protection

Backend authorization, RBAC/RLS, storage controls, audit, human approval and AI
governance code remain unchanged. Added presentation safeguards require an
active authenticated client with matching permanent client ID and tenant.

Responses are filtered by client/tenant and, for checklist/requests, exact tax
year. Messages require sender/recipient ownership, exclude internal notes, and
permit only selected-year engagements or general account conversations.
Appointments require an explicit matching client identifier, not email alone.
Invoices are account-wide and labeled accordingly. Tax-year records contain
only actual document/engagement years from 2022 onward.

The loading hook aborts obsolete requests and hides prior-scope state
immediately on client/year changes. Shared transport rejects responses after
the session token changes. Search receives only these scoped datasets and real
record years; fake notification defaults were removed.

New tests cover client access/roles, tenant/client/year exclusion, messages and
internal notes, invoice/appointment ownership, all 18 projection stages, missing
authority, next-action priority, controlled empty/error states, sensitive-field
exclusion, navigation labels and absence of simulated payment settlement.
Existing restoration assertions are preserved and inspect extracted navigation
and shared shell source as well as the dashboard entry point.

## J–O. Final validation and Git state

- Tests: 101 test files passed; 1,488 tests passed. Gate 3 added 33 tests.
- Type checking: `npm.cmd run typecheck` passed.
- Configured lint: `npm.cmd run lint` passed (`tsc --noEmit`).
- Production build: `npm.cmd run build` passed for frontend and server.
- Diff check: `git diff --check` passed.
- Git status: `feature/dashboard-masterplan`, uncommitted Gate 2 and Gate 3
  modifications/new files. User-supplied design references and the protected
  backup remain untracked. No commit, push, merge or deployment.

Fetch completed before implementation. Local `main`, `origin/main` and HEAD
remain synchronized at the baseline. The new render-boundary test confirms
the actual dashboard does not render client identity/shell content for another
client, a staff role, a suspended session or initializing authentication.

## P. Known limitations and integration gaps

- No independent state-rules-applied service exists here. Only tax-year
  questionnaire state and server requirements with a statutory source are
  displayed; unsupported coverage/advice remains explicitly unavailable.
- Some existing questionnaire/request stores are server memory. Database
  durability remains a backend integration gap; the frontend does not substitute
  local authoritative data.
- Message data without engagement association is account-wide and labeled;
  appointment and invoice contracts have no tax-year key and are account-wide.
- Appointments without client IDs are deliberately omitted even if the existing
  server API accepts an email match. Precise appointment timezone is not present
  in this contract; the stored firm time is displayed without conversion.
- No live payment UI is exposed because the existing production processor is
  unavailable; invoice status is supported.
- Authenticated browser interaction/pixel comparison and keyboard interaction
  need an isolated test session. Validation here covers server-rendered markup,
  data boundaries, repository regressions and build, not a live taxpayer session.
- Build chunk-size and mixed calendar-import warnings remain nonblocking.

## Q. Gate 4 remaining

Accountant work queue/KPIs, workflow pipeline, deadlines, case tabs and AI
preparation/document preview layout. Continue to reuse the shared shell and
authoritative assigned-case, review and approval services. Gate 4 has not begun.

No commit, push, merge, deployment, migration or production-data operation was
performed. The protected backup directory was not entered or modified.
