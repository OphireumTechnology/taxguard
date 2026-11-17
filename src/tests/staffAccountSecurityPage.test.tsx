import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({
  currentUser: { id: 'staff-test', tenantId: 'tenant-test', role: 'accountant', status: 'active', name: 'Test Staff' },
  authLifecycleState: 'AUTHENTICATED',
}));
vi.mock('../context/AppContext', () => ({ useApp: () => fixture }));
vi.mock('../services/api', () => ({ getStoredToken: () => 'test-token', api: { staffAccess: { securityEvents: async () => ({ items: [] }) } } }));
vi.mock('../components/admin/StaffSessionsPanel', () => ({ StaffSessionsPanel: () => null }));
import { StaffAccountSecurityPage, accountStatusMessage, securityEventLabel } from '../components/auth/StaffAccountSecurityPage';
import { resolveCanonicalPageRoute } from '../config/canonicalRouting';

describe('staff account security page', () => {
  it('labels events for people and marks administrator actions', () => {
    expect(securityEventLabel({ action: 'SESSIONS_OTHER_REVOKED_BY_OWNER', byAdministrator: false })).toBe('You signed out other sessions');
    expect(securityEventLabel({ action: 'STAFF_MEMBERSHIP_SUSPENDED', byAdministrator: true })).toBe('Staff membership suspended (by an administrator)');
  });
  it('explains suspension, re-enrolment and fresh sign-in states without exposing internals', () => {
    expect(accountStatusMessage('STAFF_MFA_REENROLLMENT_REQUIRED')).toMatch(/re-enrolled/);
    expect(accountStatusMessage('SESSION_AUTHORITY_DENIED')).toMatch(/not active/);
    expect(accountStatusMessage('ANYTHING_ELSE')).toBeNull();
  });
  it('is routed at /staff/account-security', () => {
    expect(resolveCanonicalPageRoute('/staff/account-security')).toBe('staff_account_security');
  });
  it('renders readable UTF-8 punctuation in the account heading and loading state', () => {
    const html = renderToStaticMarkup(<StaffAccountSecurityPage />);
    expect(html).toContain('Test Staff · accountant');
    expect(html).toContain('Loading security history…');
    expect(html).not.toMatch(/Â|â€¦/);
  });
  it.each(['client', 'prospective_client'])('refuses the account-security page for %s roles', role => {
    fixture.currentUser.role = role;
    const html = renderToStaticMarkup(<StaffAccountSecurityPage />);
    expect(html).toContain('This page is for practice staff accounts.');
    expect(html).not.toContain('Account security</h1>');
    fixture.currentUser.role = 'accountant';
  });
  it('does not load or display account security without an authenticated session', () => {
    fixture.authLifecycleState = 'UNAUTHENTICATED';
    const html = renderToStaticMarkup(<StaffAccountSecurityPage />);
    expect(html).toContain('Sign in to manage your account security.');
    expect(html).not.toContain('Account security</h1>');
    fixture.authLifecycleState = 'AUTHENTICATED';
  });
});
