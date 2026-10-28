import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, closeBrowser, control, dumpOnFailure, durableSession, liveSessionWithToken, pause, providerControl, providerToken, realErrors, sees } from './helpers';

// Staff security on the DURABLE identity path, through the real server: provider sign-in with MFA
// assurance, durable sessions in the browser, recent-sign-in enforcement, and complete MFA recovery
// through the real provider adapter against the loopback provider emulation. Synthetic users only.
// Provider user IDs are UUIDs (the SDK's admin MFA API requires them).
const D = { adminA: 'd0000000-0000-4000-8000-00000000000a', adminB: 'd0000000-0000-4000-8000-00000000000b', adminC: 'd0000000-0000-4000-8000-00000000000c',
  staff: 'd0000000-0000-4000-8000-000000000001', staff2: 'd0000000-0000-4000-8000-000000000002' };
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });
beforeAll(async () => {
  for (const uid of [D.adminA, D.adminB, D.adminC, D.staff, D.staff2])
    expect((await providerControl('/e2e/provider-user', { uid, email: `${uid}@example.test`, name: `Synthetic ${uid}` })).status).toBe(200);
});
const signIn = async (uid: string, opts: { aal?: 'aal1' | 'aal2'; primaryAgeSeconds?: number } = {}) => durableSession(await providerToken(uid, opts));

describe('provider sign-in and durable sessions', () => {
  it('requires MFA (AAL2) for staff and never accepts a local token as durable', async () => {
    const aal1 = await signIn(D.staff, { aal: 'aal1' });
    expect(aal1.status).toBeGreaterThanOrEqual(400); expect(aal1.body?.token).toBeUndefined();
    const ok = await signIn(D.staff);
    expect(ok.status).toBe(200); expect(ok.body.token).toMatch(/^tg_live_[a-f0-9]{64}$/);
    const me = await api(ok.body.token, 'GET', '/api/auth/me');
    expect(me.body.user).toMatchObject({ id: D.staff, role: 'accountant', tenantId: 'tenantE2E' });
    expect((await durableSession('not-a-provider-token')).status).toBe(401);
  });

  it('lists and revokes durable sessions through the real server; the browser page renders for the durable session', async () => {
    const first = (await signIn(D.staff2)).body.token, second = (await signIn(D.staff2)).body.token;
    const listed = await api(first, 'GET', '/api/staff-access/sessions');
    expect(listed.status).toBe(200);
    expect(listed.body.items.filter((x: any) => x.current)).toHaveLength(1);
    expect(listed.body.items.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(listed.body)).not.toMatch(/tg_live_|session_token_hash/);
    expect((await api(first, 'POST', '/api/staff-access/sessions/revoke-others')).body.revokedSessions).toBeGreaterThanOrEqual(1);
    expect((await api(second, 'GET', '/api/auth/me')).status).toBe(401);
    expect((await api(first, 'GET', '/api/auth/me')).status).toBe(200);
    // The page restores the durable session, but its tools are gated on the browser's provider
    // configuration (absent here), so it says so instead of calling the API. Recorded limitation.
    const s = await liveSessionWithToken(first, '/staff/account-security');
    await sees(s.page, 'Account security');
    await sees(s.page, 'Account security tools are not enabled in this environment.');
    // Staff are labelled by role, never with a client ID derived from their user ID.
    await sees(s.page, 'Staff · accountant');
    expect(await s.page.locator('body').innerText()).not.toMatch(/Client ID: #/);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
});

describe('recent sign-in for privileged actions', () => {
  it('refuses an administrator whose sign-in is older than 15 minutes and accepts a fresh one', async () => {
    const stale = (await signIn(D.adminA, { primaryAgeSeconds: 20 * 60 })).body.token;
    const refused = await api(stale, 'POST', `/api/staff-access/members/${D.staff2}/status`, { action: 'suspend', reason: 'Synthetic access review' });
    expect(refused.status).toBe(403); expect(refused.body.code).toBe('STAFF_RECENT_SIGN_IN_REQUIRED');
    const fresh = (await signIn(D.adminA)).body.token;
    expect((await api(fresh, 'POST', `/api/staff-access/members/${D.staff2}/status`, { action: 'suspend', reason: 'Synthetic access review' })).body.status).toBe('suspended');
    const other = (await signIn(D.adminB)).body.token;
    expect((await api(other, 'POST', `/api/staff-access/members/${D.staff2}/status`, { action: 'reactivate', reason: 'Synthetic review complete' })).body.status).toBe('active');
  });
});

describe('MFA recovery end to end on the real server', () => {
  const requestId = uuid(801);
  let staffSession = '';
  it('requests and independently approves; the staff member is signed out and cannot sign in', async () => {
    staffSession = (await signIn(D.staff)).body.token;
    const a = (await signIn(D.adminA)).body.token, b = (await signIn(D.adminB)).body.token;
    expect((await api(a, 'POST', '/api/staff-access/mfa-recoveries', { requestId, targetUid: D.staff, reasonCategory: 'lost_authenticator', reason: 'Synthetic lost phone' })).status).toBe(201);
    expect((await api(a, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/approve`)).body.code).toBe('INDEPENDENT_APPROVER_REQUIRED');
    expect((await api(b, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/approve`)).body).toMatchObject({ status: 'approved', jobId: requestId });
    expect((await api(staffSession, 'GET', '/api/auth/me')).status).toBe(401);
    expect((await signIn(D.staff)).status).toBeGreaterThanOrEqual(400);
  });
  it('resets the provider factors through the real adapter and verifies the reset by inventory', async () => {
    const c = control();
    const run = await fetch(c.origin + '/e2e/run-reset-worker', { method: 'POST', headers: { apikey: c.key } }).then(r => r.json());
    expect(run.outcome, JSON.stringify(run)).toMatchObject({ jobId: requestId, status: 'reset_verified' });
    const list = (await api((await signIn(D.adminC)).body.token, 'GET', '/api/staff-access/mfa-recoveries')).body;
    expect(list.items.find((x: any) => x.requestId === requestId)).toMatchObject({ jobStatus: 'reset_verified', resetAvailability: 'verified' });
  });
  it('accepts re-enrolment proven through the provider, but the member stays suspended until an administrator acts', async () => {
    const early = await providerToken(D.staff);
    expect((await fetch(`${process.env.E2E_ORIGIN}/api/staff-access/mfa-recovery/enrollment`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerAccessToken: early }) }).then(r => r.json())).code).toBe('MFA_ENROLLMENT_NEW_FACTOR_REQUIRED');
    await pause(1100); // the enrolment sign-in must come after the reset
    await providerControl('/e2e/provider-factor', { uid: D.staff });
    const enrolled = await fetch(`${process.env.E2E_ORIGIN}/api/staff-access/mfa-recovery/enrollment`, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerAccessToken: await providerToken(D.staff) }) }).then(r => r.json());
    expect(enrolled).toMatchObject({ status: 'enrollment_verified' });
    expect((await signIn(D.staff)).status).toBeGreaterThanOrEqual(400);
  });
  it('is reactivated by another administrator with a recent sign-in; the member then signs in afresh', async () => {
    const stale = (await signIn(D.adminC, { primaryAgeSeconds: 30 * 60 })).body.token;
    expect((await api(stale, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/complete`)).body.code).toBe('STAFF_RECENT_SIGN_IN_REQUIRED');
    const c = (await signIn(D.adminC)).body.token;
    expect((await api(c, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/complete`)).body).toMatchObject({ status: 'completed' });
    await pause(1100); // a sign-in from before reactivation is stale by design
    const back = await signIn(D.staff);
    expect(back.status).toBe(200);
    expect((await api(back.body.token, 'GET', '/api/auth/me')).body.user).toMatchObject({ id: D.staff, status: 'active' });
    const list = (await api(c, 'GET', '/api/staff-access/mfa-recoveries?status=completed')).body;
    expect(list.items.map((x: any) => [x.requestId, x.completedBy])).toEqual([[requestId, D.adminC]]);
  });
});
