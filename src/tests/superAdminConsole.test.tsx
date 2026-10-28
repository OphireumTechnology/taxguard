import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** Super administrator console and dashboard inspection mode (server-rendered; synthetic sessions). */
const session = vi.hoisted(() => ({
  user: { id: 'sa', email: 'sa@example.invalid', name: 'Super Admin', role: 'super_admin', status: 'active', tenantId: 'tenant-a' } as any,
  auth: 'AUTHENTICATED',
}));
vi.mock('../context/AppContext', () => ({
  useApp: () => ({ currentUser: session.user, authLifecycleState: session.auth, logout: vi.fn(), notifications: [] }),
}));

import { SuperAdminConsole, initialDashboardSelection } from '../components/admin/SuperAdminConsole';
import { DashboardInspectionProvider, canInspectDashboards } from '../components/layout/dashboardInspection';
import { AccountantDashboard, accountantAccess } from '../components/workspace/AccountantDashboard';
import { ReviewerDashboard } from '../components/workspace/ReviewerDashboard';
import { BookkeeperDashboard } from '../components/workspace/BookkeeperDashboard';
import { PracticeManagerDashboard } from '../components/workspace/PracticeManagerDashboard';
import { ClientServiceDashboard } from '../components/workspace/ClientServiceDashboard';
import { reviewerAccess } from '../components/workspace/reviewerDashboardModel';
import { DASHBOARD_DIRECTORY } from '../config/superAdminDashboards';

const asRole = (role: string, extra: Record<string, unknown> = {}) => { session.user = { ...session.user, role, ...extra }; };
afterEach(() => {
  asRole('super_admin', { status: 'active' });
  session.auth = 'AUTHENTICATED';
  vi.unstubAllGlobals();
});

const LIVE: Array<[string, React.ComponentType, string]> = [
  ['accountant', AccountantDashboard, 'My Work Queue'],
  ['reviewer', ReviewerDashboard, 'Review'],
  ['bookkeeper', BookkeeperDashboard, 'Bookkeeper Dashboard'],
  ['practice_manager', PracticeManagerDashboard, 'Practice Manager Dashboard'],
  ['client_service', ClientServiceDashboard, 'Client Service Dashboard'],
];

describe('console access', () => {
  it('is refused to every role other than an active super administrator', () => {
    for (const role of ['admin', 'administrator', 'accountant', 'senior_reviewer', 'client', 'operations']) {
      asRole(role);
      const html = renderToStaticMarkup(<SuperAdminConsole />);
      expect(html).toContain('role="alert"');
      expect(html).not.toContain('Select dashboard');
    }
    asRole('super_admin', { status: 'suspended' });
    expect(renderToStaticMarkup(<SuperAdminConsole />)).toContain('role="alert"');
    asRole('super_admin', { status: 'active' }); session.auth = 'INITIALIZING';
    expect(renderToStaticMarkup(<SuperAdminConsole />)).toContain('role="alert"');
  });
  it('renders the selector with the console and all ten dashboards for a super administrator', () => {
    const html = renderToStaticMarkup(<SuperAdminConsole />);
    expect(html).toContain('Super Administrator Dashboard');
    expect(html).toContain('aria-label="Select dashboard"');
    for (const d of DASHBOARD_DIRECTORY) expect(html).toContain(d.label.replace('&', '&amp;'));
    expect((html.match(/<option /g) || []).length).toBe(11);
    expect(html).toContain('(unchanged by view selection)');
    for (const section of ['System overview', 'Tenant management', 'Staff and user management', 'Roles and permissions', 'Dashboard access directory', 'Security and audit', 'Workflow oversight', 'AI Control Center', 'Integration status', 'Operational health and errors']) {
      expect(html).toContain(section);
    }
  });
});

describe('selector persistence', () => {
  it('prefers a valid ?dashboard= value, then the stored choice, then the console', () => {
    expect(initialDashboardSelection('?dashboard=reviewer', 'billing')).toBe('reviewer');
    expect(initialDashboardSelection('?dashboard=../../admin', 'billing')).toBe('billing');
    expect(initialDashboardSelection('', 'not-a-dashboard')).toBe('super_admin');
    expect(initialDashboardSelection('', null)).toBe('super_admin');
  });
  it.each([
    ['billing', 'Not implemented'],
    ['security_compliance', 'No dedicated dashboard'],
    ['executive', 'Not implemented'],
    ['client', 'requires that client'],
  ])('shows an honest status for %s instead of fabricated content', (id, text) => {
    vi.stubGlobal('window', { location: { search: `?dashboard=${id}` } });
    const html = renderToStaticMarkup(<SuperAdminConsole />);
    expect(html).toContain('data-testid="dashboard-unavailable"');
    expect(html).toContain(text);
  });
  it('labels live dashboards as inspection mode', () => {
    vi.stubGlobal('window', { location: { search: '?dashboard=accountant' } });
    const html = renderToStaticMarkup(<SuperAdminConsole />);
    expect(html).toContain('data-testid="inspection-banner"');
    expect(html).toContain('No data for this role is loaded');
  });
});

describe('inspection mode', () => {
  it.each(LIVE)('renders the real %s dashboard layout for a super administrator without loading or substituting data', (id, Component, marker) => {
    const html = renderToStaticMarkup(<DashboardInspectionProvider dashboard={id}><Component /></DashboardInspectionProvider>);
    expect(html).toContain(marker);
    expect(html).not.toMatch(/access (with tenant context )?is required/);
    expect(html).not.toContain('An authorized active session is required');
    expect(html).not.toMatch(/Loading authorized (cases|review|practice|client service)/);
  });
  it.each(LIVE)('does not open the %s dashboard to an administrator, even inside the provider', (id, Component) => {
    asRole('admin');
    const html = renderToStaticMarkup(<DashboardInspectionProvider dashboard={id}><Component /></DashboardInspectionProvider>);
    expect(html).toContain('role="alert"');
  });
  it.each(LIVE)('does not open the %s dashboard to a super administrator outside the console', (_id, Component) => {
    expect(renderToStaticMarkup(<Component />)).toContain('role="alert"');
  });
  it('the data hooks still refuse the super administrator, so no role data is requested', () => {
    expect(accountantAccess(session.user, 'AUTHENTICATED')).toBe(false);
    expect(reviewerAccess(session.user, 'AUTHENTICATED')).toBe(false);
    expect(canInspectDashboards(session.user, 'AUTHENTICATED')).toBe(true);
    expect(canInspectDashboards({ ...session.user, role: 'admin' }, 'AUTHENTICATED')).toBe(false);
  });
});
