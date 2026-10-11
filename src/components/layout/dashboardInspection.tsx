import React, { createContext, useContext } from 'react';
import { useApp } from '../../context/AppContext';

/**
 * Administrative dashboard inspection mode.
 *
 * A super administrator can render another role's dashboard layout to inspect it. Inspection:
 * - never changes the authenticated user's role, tenant or session;
 * - never loads that role's data: the dashboard data hooks still gate on the real role, so no
 *   case, taxpayer or ledger request is made and no record is substituted;
 * - grants no API permission: every server route keeps its own role and object checks.
 * Interactive role-specific work requires a real account with that role.
 */
const InspectionContext = createContext<string | null>(null);

export function canInspectDashboards(
  user: { role?: string; status?: string } | null | undefined,
  authState: string
): boolean {
  return authState === 'AUTHENTICATED'
    && user?.status === 'active'
    && (user.role === 'super_admin' || user.role === 'super_administrator');
}

export function DashboardInspectionProvider({ dashboard, children }: { dashboard: string; children: React.ReactNode }) {
  return <InspectionContext.Provider value={dashboard}>{children}</InspectionContext.Provider>;
}

/** True only inside the super administrator console, for a real active super administrator session. */
export function useDashboardInspection(): boolean {
  const dashboard = useContext(InspectionContext);
  const { currentUser, authLifecycleState } = useApp();
  return Boolean(dashboard) && canInspectDashboards(currentUser, authLifecycleState);
}
