import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, api as rawApi, closeBrowser, control, dumpOnFailure, durableSession, newSession, openModule, pause, providerControl, providerToken, realErrors, sees, totpAt, type Session } from '../helpers';

// MFA recovery through the REAL browser UI on the provider-mode profile: administrators and staff
// sign in through the identity-provider emulation (password + RFC 6238 TOTP), the administrator
// panel drives request, independent approval, reactivation and audit history, and the staff member
// re-enrols a new authenticator on the staff portal. Synthetic users, loopback services only.
const D = { adminA: 'd0000000-0000-4000-8000-00000000000a', adminB: 'd0000000-0000-4000-8000-00000000000b', adminC: 'd0000000-0000-4000-8000-00000000000c',
  staff: 'd0000000-0000-4000-8000-000000000001', staff2: 'd0000000-0000-4000-8000-000000000002', foreignAdmin: 'd0000000-0000-4000-8000-0000000000f1',
  nonMember: 'd0000000-0000-4000-8000-0000000000e9' };
const PASSWORD = 'Synthetic-pass-1!';
const email = (uid: string) => `${uid}@example.test`;
const secrets: Record<string, string> = {}, lastStep: Record<string, number> = {};
/** A code for a time step not used before for this user (the provider refuses step replay). */
async function codeFor(uid: string) {
  for (;;) {
    const step = Math.floor(Date.now() / 30000);
    if ((lastStep[uid] ?? -1) < step) { lastStep[uid] = step; return totpAt(secrets[uid], step); }
    await pause((step + 1) * 30000 - Date.now() + 250);
  }
}
// The server rate-limits /api/staff-access per client address (20 a minute) and every browser here
// shares 127.0.0.1. The suite keeps within that limit instead of relaxing it: each staff-access
// request it causes is recorded, and a step waits until its requests fit in the window.
const hits: number[] = [];
async function budget(n: number) {
  for (;;) {
    const cut = Date.now() - 61_000; while (hits.length && hits[0] < cut) hits.shift();
    if (hits.length + n <= 20) return;
    await pause(hits[0] - cut + 50);
  }
}
const count = (s: Session) => { s.page.on('request', r => { if (r.url().includes('/api/staff-access/')) hits.push(Date.now()); }); return s; };
const api = (token: string, method: string, path: string, body?: unknown) => { if (path.startsWith('/api/staff-access/')) hits.push(Date.now()); return rawApi(token, method, path, body); };
const storedToken = (s: Session) => s.page.evaluate(() => localStorage.getItem('artax_session_token') || localStorage.getItem('token'));
const supabaseSessionCalls = (s: Session) => s.api.filter(a => a.path.startsWith('/api/auth/supabase-session')).length;

/** Password + authenticator code on the real staff sign-in form, against the provider emulation. */
async function providerLogin(uid: string) {
  await budget(4);
  const s = count(await newSession()); const { page } = s;
  await page.goto(ORIGIN + '/staff/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('practitioner@artaxservices.com').fill(email(uid));
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  const code = page.locator('input[autocomplete="one-time-code"]');
  await code.waitFor();
  await code.fill(await codeFor(uid));
  await page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  return s;
}
async function adminPanel(uid: string) {
  await budget(12);
  const s = await providerLogin(uid);
  await s.page.waitForURL(u => u.pathname === '/staff');
  await openModule(s.page, 'Practice Staff & Roles');
  await sees(s.page, 'Staff MFA recovery');
  return s;
}
const row = (s: Session, uid: string) => s.page.locator('li', { has: s.page.getByRole('heading', { name: new RegExp(uid) }) });

afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });
beforeAll(async () => {
  for (const uid of Object.values(D)) {
    const r = await providerControl('/e2e/provider-user', { uid, email: email(uid), name: `Synthetic ${uid}`, password: PASSWORD });
    expect(r.status).toBe(200); secrets[uid] = r.body.factorSecret;
  }
});

describe('role restrictions and tenant isolation in the browser', () => {
  it('signs an accountant in, but shows no staff administration and refuses the recovery API', async () => {
    const s = await providerLogin(D.staff2);
    await s.page.waitForURL(u => u.pathname === '/staff');
    await sees(s.page, `Synthetic ${D.staff2}`);
    expect(await s.page.getByRole('button', { name: 'Practice Staff & Roles', exact: true }).count()).toBe(0);
    const token = await storedToken(s);
    expect(token).toMatch(/^tg_live_/);
    expect((await api(token!, 'GET', '/api/staff-access/mfa-recoveries')).status).toBe(403);
    expect((await api(token!, 'POST', '/api/staff-access/mfa-recoveries', { requestId: crypto.randomUUID(), targetUid: D.staff, reasonCategory: 'lost_authenticator', reason: 'Synthetic attempt' })).status).toBe(403);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
  it('refuses a provider account that belongs to another tenant, and an account with no membership', async () => {
    for (const uid of [D.foreignAdmin, D.nonMember]) {
      const s = await providerLogin(uid);
      await s.page.getByRole('alert').first().waitFor();
      expect(s.page.url()).toContain('/staff/login');
      expect(await storedToken(s)).toBeNull();
      await s.context.close();
      expect((await durableSession(await providerToken(uid))).status).toBeGreaterThanOrEqual(400);
    }
  });
});

describe('MFA recovery driven through the administrator and staff UI', () => {
  let staffBrowser: Session; let requestId = '';
  it('an administrator requests recovery; an unknown or foreign target is refused and nothing is recorded', async () => {
    staffBrowser = await providerLogin(D.staff);
    await staffBrowser.page.waitForURL(u => u.pathname === '/staff');
    const a = await adminPanel(D.adminA);
    const form = a.page.getByRole('form', { name: 'Request staff MFA recovery' });
    for (const target of [D.foreignAdmin, D.nonMember]) {
      await form.getByLabel('Target staff UID').fill(target);
      await form.getByLabel('Recorded reason (required)').fill('Synthetic lost phone');
      await form.getByRole('button', { name: 'Request independent approval' }).click();
      await a.page.getByRole('alert').filter({ hasText: /did not confirm|already has|administrator/ }).first().waitFor();
    }
    await form.getByLabel('Target staff UID').fill(D.staff);
    await form.getByLabel('Recorded reason (required)').fill('Synthetic lost phone');
    await form.getByRole('button', { name: 'Request independent approval' }).click();
    await sees(a.page, 'Recovery request recorded for independent approval.');
    const r = row(a, D.staff);
    await r.getByText('Status: pending approval').waitFor();
    // The requester cannot approve their own request: the review control is not offered.
    expect(await r.getByRole('button', { name: `Review recovery approval for ${D.staff}` }).count()).toBe(0);
    const listed = (await api((await storedToken(a))!, 'GET', '/api/staff-access/mfa-recoveries')).body.items;
    expect(listed.map((x: any) => x.targetUid)).toEqual([D.staff]);
    requestId = listed[0].requestId;
    expect(realErrors(a)).toEqual([]);
    await a.context.close();
  });

  it('refuses approval from an administrator whose sign-in is older than 15 minutes, and explains why', async () => {
    await providerControl('/e2e/provider-sign-in-age', { uid: D.adminC, seconds: 20 * 60 });
    const c = await adminPanel(D.adminC);
    await row(c, D.staff).getByRole('button', { name: `Review recovery approval for ${D.staff}` }).click();
    await c.page.getByRole('button', { name: 'Confirm suspension and queue reset' }).click();
    await sees(c.page, 'This action needs an MFA sign-in from the last 15 minutes.');
    await row(c, D.staff).getByText('Status: pending approval').waitFor();
    await c.context.close();
    await providerControl('/e2e/provider-sign-in-age', { uid: D.adminC, seconds: 0 });
  });

  it('a second administrator approves; the staff member\'s open browser session is revoked', async () => {
    const b = await adminPanel(D.adminB);
    await row(b, D.staff).getByRole('button', { name: `Review recovery approval for ${D.staff}` }).click();
    await b.page.getByRole('button', { name: 'Confirm suspension and queue reset' }).click();
    await sees(b.page, 'The server confirmed approval');
    await row(b, D.staff).getByText('Status: approved').waitFor();
    await row(b, D.staff).getByText('Factor reset: Queued').waitFor();
    // A replay by the same approver (a lost response) resumes without effect; the requester's own
    // approval attempt is refused.
    const token = (await storedToken(b))!;
    await budget(3);
    const replay = await api(token, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/approve`);
    expect(replay.status).toBe(200); expect(replay.body).toMatchObject({ requestId, status: 'approved' });
    const requester = (await durableSession(await providerToken(D.adminA))).body.token;
    expect((await api(requester, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/approve`)).status).toBeGreaterThanOrEqual(400);
    // Session revocation: the staff member's earlier session no longer authenticates, and the page drops it.
    expect((await api((await storedToken(staffBrowser))!, 'GET', '/api/auth/me')).status).toBe(401);
    await staffBrowser.page.reload({ waitUntil: 'domcontentloaded' });
    await staffBrowser.page.waitForURL(u => u.pathname !== '/staff', { timeout: 20000 });
    await staffBrowser.context.close();
    await b.context.close();
  });

  it('the reset runs through the real provider adapter; the panel shows the verified reset and the audit history', async () => {
    const c = control();
    const run = await fetch(c.origin + '/e2e/run-reset-worker', { method: 'POST', headers: { apikey: c.key } }).then(r => r.json());
    expect(run.outcome, JSON.stringify(run)).toMatchObject({ jobId: requestId, status: 'reset_verified' });
    const a = await adminPanel(D.adminA);
    const r = row(a, D.staff);
    await r.getByText(/Factor reset: Verified: every previous authenticator was removed/).waitFor();
    await r.getByRole('button', { name: `Audit history for ${D.staff}` }).click();
    const history = a.page.getByLabel(`Audit history for request ${requestId}`);
    await history.locator('li').nth(1).waitFor();
    const lines = await history.locator('li').allInnerTexts();
    expect(lines.some(l => l.includes(D.adminA))).toBe(true);
    expect(lines.some(l => l.includes(D.adminB))).toBe(true);
    // Reason text and factor material never appear in the audit history.
    expect(lines.join('\n')).not.toMatch(/Synthetic lost phone|secret|totp/i);
    // The approval replay left no second approval entry.
    expect(lines.filter(l => / · recovery approved · /.test(l)), lines.join('\n')).toHaveLength(1);
    await r.getByRole('button', { name: `Audit history for ${D.staff}` }).click();
    expect(await a.page.getByLabel(`Audit history for request ${requestId}`).count()).toBe(0);
    await a.context.close();
  });

  it('the staff member re-enrols in the browser without obtaining a TaxGuard session; a wrong code is refused', async () => {
    await pause(1100); // the enrolment sign-in must come after the reset
    await budget(8);
    const s = count(await newSession()); const { page } = s;
    await page.goto(ORIGIN + '/staff/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Complete MFA Recovery' }).click();
    const signIn = page.getByRole('form', { name: 'Sign in to continue recovery' });
    await signIn.getByLabel('Work email').fill(email(D.staff));
    await signIn.getByLabel('Password').fill(PASSWORD);
    await signIn.getByRole('button', { name: 'Continue recovery' }).click();
    await page.getByLabel('Recovery step').filter({ hasText: 'Set up a new authenticator below.' }).waitFor();
    await page.getByRole('button', { name: 'Start authenticator setup' }).click();
    const secret = await page.getByLabel('Setup key').inputValue();
    expect(secret).toMatch(/^[A-Z2-7]{16,}$/);
    const now = Math.floor(Date.now() / 30000), valid = [now - 1, now, now + 1, now + 2].map(step => totpAt(secret, step));
    await page.getByLabel('Authenticator code').fill(['000000', '111111', '222222'].find(code => !valid.includes(code))!);
    await page.getByRole('button', { name: 'Verify authenticator' }).click();
    await page.getByRole('alert').first().waitFor();
    expect(await page.getByText('New authenticator verified by the server').count()).toBe(0);
    secrets[D.staff] = secret; delete lastStep[D.staff];
    await page.getByLabel('Authenticator code').fill(await codeFor(D.staff));
    await page.getByRole('button', { name: 'Verify authenticator' }).click();
    await sees(page, 'New authenticator verified by the server. An administrator must now reactivate your access.');
    await page.getByLabel('Recovery step').filter({ hasText: 'An administrator must now reactivate your access' }).waitFor();
    // The recovery identity was never bridged into a TaxGuard session.
    expect(supabaseSessionCalls(s)).toBe(0);
    expect(await storedToken(s)).toBeNull();
    // Still suspended: a full provider sign-in cannot open a session before reactivation.
    expect((await durableSession(await providerToken(D.staff))).status).toBeGreaterThanOrEqual(400);
    // Re-sending the enrolment proof resumes the recorded result; it advances nothing.
    await budget(2); hits.push(Date.now());
    const replay = await fetch(ORIGIN + '/api/staff-access/mfa-recovery/enrollment', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerAccessToken: await providerToken(D.staff) }) });
    expect(replay.status).toBe(200); expect(await replay.json()).toMatchObject({ status: 'enrollment_verified' });
    expect((await durableSession(await providerToken(D.staff))).status).toBeGreaterThanOrEqual(400);
    await page.getByRole('button', { name: 'Leave recovery' }).click();
    await page.getByRole('button', { name: 'Enter Staff Workspace' }).waitFor();
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('a fresh administrator reactivates through the panel; replays are refused; the staff member signs in afresh', async () => {
    const c = await adminPanel(D.adminC);
    const r = row(c, D.staff);
    await r.getByText(/New authenticator verified\. Waiting for an independent administrator/).waitFor();
    await r.getByRole('button', { name: `Review reactivation for ${D.staff}` }).click();
    await c.page.getByRole('button', { name: 'Confirm reactivation' }).click();
    await sees(c.page, 'The server confirmed reactivation.');
    await c.page.getByRole('combobox', { name: 'Recovery status' }).selectOption('completed');
    await row(c, D.staff).getByText(`Reactivated by: ${D.adminC}`).waitFor();
    const token = (await storedToken(c))!;
    await budget(8);
    // Same administrator: an idempotent resume. Anyone else, or any other action, is refused.
    const again = await api(token, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/complete`);
    expect(again.status).toBe(200); expect(again.body).toMatchObject({ status: 'completed', resumed: true });
    const other = (await durableSession(await providerToken(D.adminA))).body.token;
    expect((await api(other, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/complete`)).body.code).toBe('MFA_RECOVERY_NOT_READY_FOR_COMPLETION');
    for (const action of ['approve', 'retry'])
      expect((await api(token, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/${action}`)).status, action).toBeGreaterThanOrEqual(400);
    expect((await api(token, 'POST', `/api/staff-access/mfa-recoveries/${requestId}/cancel`, { reason: 'Synthetic late cancellation' })).status).toBeGreaterThanOrEqual(400);
    expect((await api(token, 'GET', `/api/staff-access/mfa-recoveries/${crypto.randomUUID()}/history`)).status).toBeGreaterThanOrEqual(400);
    expect((await api(token, 'POST', '/api/staff-access/mfa-recoveries/not-a-request/approve')).status).toBeGreaterThanOrEqual(400);
    await c.context.close();

    await pause(1100); // a sign-in from before reactivation is stale by design
    const s = await providerLogin(D.staff);
    await s.page.waitForURL(u => u.pathname === '/staff');
    await sees(s.page, `Synthetic ${D.staff}`);
    expect((await api((await storedToken(s))!, 'GET', '/api/auth/me')).body.user).toMatchObject({ id: D.staff, status: 'active' });
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
});
