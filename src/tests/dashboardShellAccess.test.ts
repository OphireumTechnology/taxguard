import { describe, expect, it } from 'vitest';
import { canRenderDashboardShell, DASHBOARD_EXPERIENCES } from '../components/layout/dashboardAccess';

const user = (role: string, status = 'active', clientId = 'client-a') => ({ role, status, clientId });

describe('shared dashboard shell session boundary', () => {
  it('requires an authenticated active session', () => {
    expect(canRenderDashboardShell(null, 'AUTHENTICATED', 'client')).toBe(false);
    for (const state of ['INITIALIZING', 'UNAUTHENTICATED', 'ERROR']) {
      expect(canRenderDashboardShell(user('client'), state, 'client')).toBe(false);
    }
    for (const status of ['suspended', 'disabled', 'pending']) {
      expect(canRenderDashboardShell(user('accountant', status), 'AUTHENTICATED', 'accountant')).toBe(false);
    }
  });

  it('requires the permanent client identity and denies client/staff crossover', () => {
    expect(canRenderDashboardShell(user('client'), 'AUTHENTICATED', 'client')).toBe(true);
    expect(canRenderDashboardShell(user('client', 'active', ' '), 'AUTHENTICATED', 'client')).toBe(false);
    for (const workspace of ['accountant', 'reviewer', 'admin'] as const) {
      expect(canRenderDashboardShell(user('client'), 'AUTHENTICATED', workspace)).toBe(false);
    }
    expect(canRenderDashboardShell(user('admin'), 'AUTHENTICATED', 'client')).toBe(false);
  });

  it('uses the existing workspace authority and denies arbitrary role switching', () => {
    expect(canRenderDashboardShell(user('accountant'), 'AUTHENTICATED', 'accountant')).toBe(true);
    expect(canRenderDashboardShell(user('accountant'), 'AUTHENTICATED', 'reviewer')).toBe(false);
    expect(canRenderDashboardShell(user('reviewer'), 'AUTHENTICATED', 'reviewer')).toBe(true);
    expect(canRenderDashboardShell(user('senior_reviewer'), 'AUTHENTICATED', 'reviewer')).toBe(true);
    expect(canRenderDashboardShell(user('super_admin'), 'AUTHENTICATED', 'admin')).toBe(true);
    expect(canRenderDashboardShell(user('admin'), 'AUTHENTICATED', 'accountant')).toBe(false);
  });

  it('does not turn presentation-only experience labels into live grants', () => {
    expect(Object.keys(DASHBOARD_EXPERIENCES)).toHaveLength(10);
    for (const role of ['bookkeeper', 'practice_manager', 'executive', 'unknown']) {
      for (const workspace of ['client', 'accountant', 'reviewer', 'admin'] as const) {
        expect(canRenderDashboardShell(user(role), 'AUTHENTICATED', workspace)).toBe(false);
      }
    }
  });
});
