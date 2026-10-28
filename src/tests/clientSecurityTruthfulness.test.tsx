import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { User } from '../types';
import type { ProfileSecurityTab } from '../types/clientPortal';
const state = vi.hoisted(() => ({ allowed: true, status: 'ready' as 'ready' | 'loading' | 'error', data: {} as any }));
vi.mock('../hooks/useAuthoritativeClientProfile', () => ({ useAuthoritativeClientProfile: () => ({ ...state }) }));
import { ProfileSecurityView } from '../components/portal/views/ProfileSecurityView';
import { ClientAuditUnavailable, ClientSecurityPanel } from '../components/portal/views/ClientSecurityPanel';
const user = { id: 'synthetic-client', role: 'client', status: 'active', name: 'Synthetic Taxpayer' } as User;
describe('live client security truthfulness', () => {
  it.each(['taxpayer_profile', 'business_entity', 'dependents_reps', 'storage_selection', 'devices_sessions', 'mfa_security', 'privacy_consent', 'data_export_closure', 'audit_activity'] as ProfileSecurityTab[])('does not substitute sample or success evidence in %s', tab => {
    const html = renderToStaticMarkup(<ClientSecurityPanel tab={tab} user={user} profile={{}} status="ready" onRetry={() => {}}/>);
    for (const fabricated of ['Robert Perotti', '1428 Palmetto', 'MacBook Pro', 'iPhone 15', 'Granted Jan 11', 'December 31, 2026', 'Enabled &amp; Verified', 'Enterprise Tier', 'preparing encrypted', 'closure ticket dispatched']) expect(html).not.toContain(fabricated);
    expect(html).toMatch(/Not recorded|not recorded|unavailable/);
  });
  it.each([true, false, undefined])('reports recorded MFA setting %s without claiming verified authentication', mfaEnabled => {
    const html = renderToStaticMarkup(<ClientSecurityPanel tab="mfa_security" user={{ ...user, mfaEnabled }} profile={null} status="ready" onRetry={() => {}}/>);
    expect(html).toContain(mfaEnabled === true ? 'Recorded as enabled' : mfaEnabled === false ? 'Recorded as disabled' : 'Not recorded');
    expect(html).toContain('does not verify the current authentication factor');
  });
  it('renders consent loading and failure with no cached granted record', () => {
    const props = { tab: 'privacy_consent' as const, user, profile: null, onRetry: () => {} };
    expect(renderToStaticMarkup(<ClientSecurityPanel {...props} status="loading"/>)).toContain('role="status"');
    const failed = renderToStaticMarkup(<ClientSecurityPanel {...props} status="error"/>);
    expect(failed).toContain('role="alert"'); expect(failed).toContain('Retry profile records'); expect(failed).not.toContain('Recorded acceptance');
  });
  it('does not offer an operational archive export, closure or audit download', () => {
    const html = renderToStaticMarkup(<ClientSecurityPanel tab="data_export_closure" user={user} profile={null} status="ready" onRetry={() => {}}/>);
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    const audit = renderToStaticMarkup(<ClientAuditUnavailable/>); expect(audit).toContain('disabled=""');
    expect(audit).not.toContain('CERTIFICATE'); expect(audit).not.toContain('sha256');
  });
  it('preserves the nine security modules with a single current navigation item', () => {
    const html = renderToStaticMarkup(<ProfileSecurityView currentUser={user} authLifecycleState="AUTHENTICATED" initialTab="privacy_consent"/>);
    expect(html).toContain('Privacy (IRC 7216)'); expect(html).toContain('Devices &amp; Sessions');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1); expect(html).not.toContain('Security Level:');
  });
  it('denies the whole security view when the read-hook session is ineligible', () => {
    state.allowed = false;
    try {
      const html = renderToStaticMarkup(<ProfileSecurityView currentUser={null} authLifecycleState="INITIALIZING"/>);
      expect(html).toContain('role="alert"'); expect(html).not.toContain('Consent Records');
    } finally { state.allowed = true; }
  });
});
