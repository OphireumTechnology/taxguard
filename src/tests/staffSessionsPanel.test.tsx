import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({ enabled: true, base: 'http://127.0.0.1:3000' }));
vi.mock('../supabase/config', () => ({ isStaffIdentityDevelopmentConfigured: () => config.enabled }));
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => config.base + path }));
import { api, setStoredToken, clearStoredToken } from '../services/api';
import { StaffSessionsPanel, parseSessionList, sessionActionMessage } from '../components/admin/StaffSessionsPanel';

const transport = vi.fn();
const row = (over: Record<string, unknown> = {}) => ({ sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', createdAt: '2026-10-12T00:00:00+00:00',
  authenticatedAt: '2026-10-12T00:00:00+00:00', expiresAt: '2026-10-12T02:00:00+00:00', assuranceLevel: 'aal2', current: true, ...over });
const member = (uid: string, role = 'accountant') => ({ uid, name: 'Synthetic ' + uid, email: uid + '@example.test', role, status: 'active', createdAt: '2026-10-12T00:00:00Z',
  invitedBy: null, approvedBy: null, approvedAt: null, statusChangedBy: null, statusChangedAt: null, mfaReenrollmentRequired: false,
  actions: { approve: false, suspend: true, deactivate: true, reactivate: false } });
beforeEach(() => { config.enabled = true; config.base = 'http://127.0.0.1:3000'; transport.mockReset().mockImplementation(async () => new Response(JSON.stringify({ revokedSessions: 1 }), { status: 200 })); vi.stubGlobal('fetch', transport); setStoredToken('synthetic-session-A'); });
afterEach(() => { clearStoredToken(); vi.unstubAllGlobals(); });

describe('session API client', () => {
  it('uses fixed encoded paths, sends only the reason category, and never puts the bearer in the URL', async () => {
    await api.staffAccess.revokeSession('id/../x');
    expect(transport.mock.calls[0][0]).toBe(config.base + '/api/staff-access/sessions/id%2F..%2Fx/revoke');
    await api.staffAccess.revokeOtherSessions();
    expect(transport.mock.calls[1][0]).toBe(config.base + '/api/staff-access/sessions/revoke-others');
    expect(transport.mock.calls[1][1].body).toBeUndefined();
    await api.staffAccess.revokeMemberSessions('staff-1', 'offboarding');
    const [url, options] = transport.mock.calls[2];
    expect(url).toBe(config.base + '/api/staff-access/members/staff-1/sessions/revoke');
    expect(JSON.parse(options.body)).toEqual({ reasonCategory: 'offboarding' });
    expect(options.cache).toBe('no-store'); expect(options.credentials).toBe('omit');
    expect(transport.mock.calls.map(c => c[0]).join()).not.toContain('synthetic-session');
  });
  it('refuses protected public hosts, disabled development configuration and missing sessions before transport', async () => {
    config.base = 'https://api.artaxserv.com';
    await expect(api.staffAccess.sessions()).rejects.toMatchObject({ status: 503 });
    config.base = 'http://127.0.0.1:3000'; config.enabled = false;
    await expect(api.staffAccess.revokeOtherSessions()).rejects.toMatchObject({ status: 503 });
    config.enabled = true; clearStoredToken();
    await expect(api.staffAccess.sessions()).rejects.toMatchObject({ status: 401 });
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('session list parsing and messages', () => {
  it('accepts a durable list with exactly one current session', () => {
    expect(parseSessionList({ source: 'durable', items: [row(), row({ sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current: false })] })).toHaveLength(2);
  });
  it.each([
    ['non-durable source', { source: 'demo', items: [row()] }],
    ['no current session', { source: 'durable', items: [row({ current: false })] }],
    ['two current sessions', { source: 'durable', items: [row(), row({ sessionId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })] }],
    ['malformed id', { source: 'durable', items: [row({ sessionId: 'x' })] }],
    ['unknown assurance', { source: 'durable', items: [row({ assuranceLevel: 'aal3' })] }],
    ['oversized page', { source: 'durable', items: Array.from({ length: 51 }, () => row()) }],
  ])('rejects %s', (_label, value) => { expect(() => parseSessionList(value)).toThrow(); });
  it('explains the step-up requirement and keeps unknown failures generic', () => {
    expect(sessionActionMessage('STAFF_REAUTHENTICATION_REQUIRED')).toMatch(/sign in again/i);
    expect(sessionActionMessage('private database detail')).toBe('The server did not confirm this session action. Refresh before retrying.');
  });
});

describe('sessions panel rendering', () => {
  const user = (role: string) => ({ id: 'me', tenantId: 'tenantA', role, status: 'active' }) as any;
  it('renders nothing without an authenticated active session', () => {
    clearStoredToken();
    expect(renderToStaticMarkup(<StaffSessionsPanel user={user('admin')} authStatus="AUTHENTICATED" />)).toBe('');
    setStoredToken('synthetic-session-A');
    expect(renderToStaticMarkup(<StaffSessionsPanel user={user('admin')} authStatus="UNAUTHENTICATED" />)).toBe('');
  });
  it('shows member revocation only to administrators and never offers self or super administrator targets', () => {
    const members = [member('me', 'admin'), member('staff-1'), member('root', 'super_administrator')] as any;
    const html = renderToStaticMarkup(<StaffSessionsPanel user={user('admin')} authStatus="AUTHENTICATED" members={members} />);
    expect(html).toContain('Signed-in sessions');
    expect(html).toContain('Revoke a staff member');
    expect(html).toContain('value="staff-1"');
    expect(html).not.toContain('value="me"'); expect(html).not.toContain('value="root"');
    expect(html).toContain('within the last 15 minutes');
    const staffHtml = renderToStaticMarkup(<StaffSessionsPanel user={user('accountant')} authStatus="AUTHENTICATED" members={members} />);
    expect(staffHtml).toContain('Signed-in sessions');
    expect(staffHtml).not.toContain('Revoke a staff member');
  });
});
