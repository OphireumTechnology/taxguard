import { resolveAuthoritativeStaffWorkspace } from '../../config/canonicalRouting';

export type DashboardWorkspace = 'client' | 'accountant' | 'reviewer' | 'admin' | 'bookkeeper' | 'practice_manager' | 'operations';

// Presentation labels are not grants. Live session and server RBAC remain authoritative.
export const DASHBOARD_EXPERIENCES = {
  client: 'Client / Taxpayer',
  accountant: 'Preparer / Accountant',
  reviewer: 'Reviewer / Senior',
  bookkeeper: 'Bookkeeper',
  practice_manager: 'Practice Manager',
  operations: 'Client Service / Operations',
  billing: 'Billing / Finance',
  admin: 'Administrator',
  compliance: 'Security / Compliance',
  executive: 'Executive / Owner',
} as const;

export function canRenderDashboardShell(
  user: { role: string; clientId?: string; status: string } | null,
  authState: string,
  workspace: DashboardWorkspace,
): boolean {
  if (!user || authState !== 'AUTHENTICATED' || user.status !== 'active') return false;
  if (workspace === 'client') return user.role === 'client' && Boolean(user.clientId?.trim());
  const route = resolveAuthoritativeStaffWorkspace(user.role);
  return route === `${workspace === 'reviewer' ? 'reviewer' : workspace}_workspace`
    || (workspace === 'admin' && route === 'admin_dashboard');
}
