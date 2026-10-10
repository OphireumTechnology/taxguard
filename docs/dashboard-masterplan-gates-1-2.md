# Dashboard masterplan: Gates 1 and 2

## Verified baseline and design authority

Development branch: `feature/dashboard-masterplan`. Fetched `origin/main`, local
`main`, and the feature branch started at `8e4735f`. The only initial untracked
paths were the protected backup and the user-supplied design references. No
backup contents were read or modified. No commit, push, merge, deployment, or
production-data operation is part of this gate.

All four PNGs in `design-reference/` were opened and visually inspected:

- `accountant-dashboard.png`: compact navy header/sidebar, blue navigation,
  dense staff queue and case workspace, white document panels, gold accents.
- `architecture-workflow.png`: shared role-aware navigation over case,
  workflow, domain-service and authoritative database layers; ten experiences.
- `client-dashboard.png`: navy/gold identity, blue active navigation, light
  workspace, client-specific toolbar, journey and compact bordered cards.
- `dashboard-masterplan.png`: shared experience/case layers, permission
  boundaries and workflow authority; aggregation for executive reporting.

The architecture images differ in some workflow labels/order. They are visual
references, not permission or stage-transition definitions. Existing live
workflow authority and server gates remain unchanged.

## Component map and implementation scope

| Gate | Existing authority/components | Implementation direction |
| --- | --- | --- |
| 2 | `theme/tokens.ts`, `PortalLayout`, live client/staff headers and sidebars | Add scoped dashboard tokens and one `DashboardApplicationShell`; preserve existing module slots and callback behavior |
| 3 | `AuthenticatedClientDashboard`, `portal/dashboard/*`, client search/notifications, `clientPortalService`, live workflow router | Align client modules, light cards, hierarchy and seven-step journey with client reference; use scoped live data |
| 4 | `AccountantWorkspace`, `AccountantBookkeepingSection`, accountant review components and server routes | Refine preparer queue, KPI pipeline and case/AI preparation layout |
| 5 | `ReviewerWorkspace`, bookkeeping services/routes | Replace existing hardcoded reviewer queue/approval behavior with authoritative service flows; preserve independent approval gates |
| 6 | Practice operations services/routes and practice-console endpoints | Distinguish practice-management and client-service capabilities from existing backend grants |
| 7 | `PracticeAdminWorkspace`, engagement/payment services and routes | Billing/admin experiences, server-authorized navigation and data scope |
| 8 | Security routes, audit/monitoring services | Compliance and aggregate executive experiences; no unnecessary client detail |
| 9 | Live workflow authority, case-authority repository/routes | Unified case module workspace and visual representation of existing stages |
| 10–12 | Existing regression/security suites, Vite build, TypeScript | Responsive/a11y refinement, service integration, full regression/security validation |

## Gate 2 implementation

One live shell now owns branding, header, toolbar, navigation region, responsive
drawer, skip link, support/profile dialogs and session boundary. The four
existing live workspaces provide their existing module navigation as slots;
client search, notifications, profile routing and tax-year selection remain
connected to their original callbacks. Standalone onboarding/validation also
use the shared shell. The outer portal layout avoids duplicate dashboard chrome.

Staff shell search searches existing authorized navigation, not taxpayer data.
Client search retains its existing client-scoped adapter. No new data fetching,
frontend mock data, local permission grants or provider credentials were added.

The ten experience labels are presentation metadata only. Existing live routing
resolves staff into accountant, reviewer and admin workspaces. Unsupported
roles stay denied; new role grants require authoritative backend support in
later gates. No role switch is offered because the current live session has a
single role and no server-issued set of switchable roles.

Dashboard tokens come from `DASHBOARD_THEME`. The shell provides light workspace
and panel styles alongside navy/gold identity, blue controls and green/amber/red/
purple state colors. Existing module themes remain intact for this gate;
client/card redesign is reserved for Gate 3 and subsequent role gates.

## Security and review limitations

The shell adds a presentation guard for authenticated active sessions and the
existing canonical workspace resolver. It does not replace backend RBAC/RLS,
tenant/client/tax-year isolation, storage controls, audit logging or human
approval controls. No backend security, workflow, AI or database code changed.

Audit findings for later gates: reviewer queue and return approval contain
hardcoded/local state; some provider status entries are static; live routing
does not yet distinguish all requested experiences. These are pre-existing,
not expanded by the shell extraction.

Validation includes the existing regression suite plus role-boundary and
server-rendered shell tests, type checking, configured lint (`tsc --noEmit`),
production build and `git diff --check`. Authenticated browser interaction and
pixel-level visual QA require a test session and remain a review limitation.

Stop after Gate 2. Gate 3 requires explicit user instruction.

## Final Gate 2 validation results

- `npm.cmd test`: 99 test files passed, 1,455 tests passed.
- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed (configured as TypeScript checking).
- `npm.cmd run build`: passed for both Vite frontend and bundled server.
- `git diff --check`: passed.

PowerShell blocks `npm.ps1`; validation used `npm.cmd` without changing execution
policy. The build emits nonblocking warnings for the calendar's mixed
static/dynamic imports and the large application chunk. No deployment occurred.

New files: this implementation map, `DashboardApplicationShell.tsx`,
`dashboardAccess.ts`, `dashboardShell.css`, `dashboardShellAccess.test.ts`, and
`dashboardApplicationShell.test.tsx`. Modified files: `PortalLayout.tsx`,
`AuthenticatedClientDashboard.tsx`, `AccountantWorkspace.tsx`,
`ReviewerWorkspace.tsx`, `PracticeAdminWorkspace.tsx`,
`LiveClientWorkflowRouter.tsx`, and `theme/tokens.ts`.

Gate 3 remains: client welcome/current status, return overview, compact action
and summary cards, personalized checklist, state requirements, records, updates,
appointments/messages and client journey layout, each bound to existing scoped
services. Existing client modules were preserved, not redesigned in Gate 2.
