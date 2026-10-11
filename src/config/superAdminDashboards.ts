/**
 * Super administrator dashboard directory. Shared by the console (client) and the audit
 * endpoint (server). Statuses are factual descriptions of what exists in this codebase.
 *
 * mode:
 * - 'console'     the super administrator's own console (real data for the super administrator)
 * - 'live'        the role's real dashboard component, rendered for its real role; for the
 *                 super administrator it is rendered in inspection mode (layout only, no data)
 * - 'admin_live'  the administrator dashboard; the super administrator is authorized and sees real data
 * - 'restricted'  exists, but rendering it for a non-owner would require taxpayer data access
 * - 'not_built'   no dashboard implementation exists yet
 */
export type DashboardMode = 'console' | 'live' | 'admin_live' | 'restricted' | 'not_built';

export interface DashboardDirectoryEntry {
  id: string;
  label: string;
  mode: DashboardMode;
  /** Role(s) whose real sessions use this dashboard. */
  roles: string[];
  status: string;
}

export const SUPER_ADMIN_CONSOLE_PATH = '/staff/super-admin';

export const DASHBOARD_DIRECTORY: readonly DashboardDirectoryEntry[] = [
  { id: 'super_admin', label: 'Super Administrator', mode: 'console', roles: ['super_admin'], status: 'Console: system overview, staff and roles, audit and security events, provider readiness, AI governance, dashboard directory.' },
  { id: 'client', label: 'Client / Taxpayer', mode: 'restricted', roles: ['client'], status: 'Implemented (live client workflow router). Not rendered for administrators: it loads one taxpayer\'s own records and requires that client\'s session.' },
  { id: 'accountant', label: 'Accountant / Tax Preparer', mode: 'live', roles: ['accountant'], status: 'Implemented. Work queue, pipeline, deadlines, case tabs. AI preparation, e-file and signature are honestly unavailable.' },
  { id: 'reviewer', label: 'Reviewer', mode: 'live', roles: ['reviewer', 'senior_reviewer'], status: 'Implemented. Review queue and case evidence. Approve / return needs durable decision storage in production.' },
  { id: 'bookkeeper', label: 'Bookkeeper', mode: 'live', roles: ['bookkeeper'], status: 'Implemented, read-only. Posting, reconciliation changes and period close are not released for this role.' },
  { id: 'practice_manager', label: 'Practice Manager', mode: 'live', roles: ['practice_manager'], status: 'Implemented, read-only. Reassignment, escalation, SLA and capacity data are unavailable.' },
  { id: 'client_service', label: 'Client Service / Operations', mode: 'live', roles: ['operations'], status: 'Implemented, read-only. Messaging, request resolution and appointment mutations are not released.' },
  { id: 'billing', label: 'Billing / Finance', mode: 'not_built', roles: [], status: 'Not implemented. No billing role or dashboard exists; payments remain blocked by integration (E04) and the role model by decision H06.' },
  { id: 'administrator', label: 'Administrator', mode: 'admin_live', roles: ['admin'], status: 'Implemented (Practice Administration Console). The super administrator is authorized and sees real administrative data.' },
  { id: 'security_compliance', label: 'Security / Compliance', mode: 'not_built', roles: [], status: 'No dedicated dashboard. Audit logs, security events and the AI emergency stop are available in the Super Administrator and Administrator consoles. Role model pending H06.' },
  { id: 'executive', label: 'Executive / Owner', mode: 'not_built', roles: [], status: 'Not implemented. No executive role, metrics contract or dashboard exists (H06).' },
];

export const DASHBOARD_IDS: readonly string[] = DASHBOARD_DIRECTORY.map(entry => entry.id);

export function findDashboard(id: string | null | undefined): DashboardDirectoryEntry | undefined {
  return DASHBOARD_DIRECTORY.find(entry => entry.id === id);
}
