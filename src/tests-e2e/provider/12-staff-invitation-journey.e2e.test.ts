import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, api, closeBrowser, durableSession, dumpOnFailure, newSession, openModule, pause, providerControl, providerToken, realErrors, sees, totpAt, type Session } from '../helpers';

// Journey H on the provider-mode profile: an administrator invites a staff member in the browser, the
// invitee accepts through the identity-provider emulation with mandatory authenticator enrolment and
// gets no TaxGuard session, the inviting administrator cannot activate them, an independent
// administrator does, and the new staff member then signs in with their new authenticator.
// Synthetic users only; the invitee has no membership row until acceptance.
const ADMIN_A = 'd0000000-0000-4000-8000-00000000000a', ADMIN_B = 'd0000000-0000-4000-8000-00000000000b';
const INVITEE = 'd0000000-0000-4000-8000-0000000000e1';
const PASSWORD = 'Synthetic-pass-1!';
const email = (uid: string) => `${uid}@example.test`;
const secrets: Record<string, string> = {}, lastStep: Record<string, number> = {};
async function codeFor(uid: string) {
  for (;;) {
    const step = Math.floor(Date.now() / 30000);
    if ((lastStep[uid] ?? -1) < step) { lastStep[uid] = step; return totpAt(secrets[uid], step); }
    await pause((step + 1) * 30000 - Date.now() + 250);
  }
}
const storedToken = (s: Session) => s.page.evaluate(() => localStorage.getItem('artax_session_token') || localStorage.getItem('token'));
async function providerLogin(uid: string) {
  const s = await newSession(); const { page } = s;
  await page.goto(ORIGIN + '/staff/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('practitioner@artaxservices.com').fill(email(uid));
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  const otp = page.locator('input[autocomplete="one-time-code"]');
  await otp.waitFor();
  await otp.fill(await codeFor(uid));
  await page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  await page.waitForURL(u => u.pathname === '/staff');
  return s;
}
async function staffAccess(uid: string) {
  const s = await providerLogin(uid);
  await openModule(s.page, 'Practice Staff & Roles');
  await sees(s.page, 'Invite a staff member');
  return s;
}

// The staff-access rate limit (20 a minute per address) is shared with earlier suites: start with a
// clear window instead of relaxing the limit.
beforeAll(async () => {
  await pause(61_000);
  for (const uid of [ADMIN_A, ADMIN_B]) {
    const r = await providerControl('/e2e/provider-user', { uid, email: email(uid), name: `Synthetic ${uid}`, password: PASSWORD });
    expect(r.status).toBe(200); secrets[uid] = r.body.factorSecret; delete lastStep[uid];
  }
  const invitee = await providerControl('/e2e/provider-user', { uid: INVITEE, email: email(INVITEE), name: 'Synthetic Invitee', password: PASSWORD, withFactor: false });
  expect(invitee.status).toBe(200); expect(invitee.body.factors).toBe(0);
}, 120_000);
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

describe('journey H: invitation, enrolment and independent activation', () => {
  let token = '';
  it('an administrator issues a one-time invitation in the browser; nothing is sent', async () => {
    const a = await staffAccess(ADMIN_A);
    const form = a.page.locator('form', { has: a.page.getByRole('heading', { name: 'Invite a staff member' }) });
    await form.getByLabel('Email').fill(email(INVITEE));
    await form.getByLabel('Staff role').selectOption('accountant');
    await form.getByLabel('Legal first name').fill('Synthetic');
    await form.getByLabel('Legal last name').fill('Invitee');
    await form.getByRole('button', { name: 'Create invitation' }).click();
    const handoff = a.page.getByRole('region', { name: 'One-time invitation token' });
    token = await handoff.getByLabel('Invitation token').inputValue();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    await handoff.getByRole('button', { name: 'Dismiss and clear token' }).click();
    expect(await a.page.getByRole('region', { name: 'One-time invitation token' }).count()).toBe(0);
    expect(realErrors(a)).toEqual([]);
    await a.context.close();
  });

  it('a provider sign-in for the invited e-mail is not turned into a client account before acceptance', async () => {
    const r = await durableSession(await providerToken(INVITEE, { aal: 'aal1' }));
    expect(r.status).toBe(403); expect(r.body.code).toBe('STAFF_INVITATION_ACCEPTANCE_REQUIRED'); expect(r.body.token).toBeUndefined();
  });

  it('the invitee accepts with mandatory authenticator enrolment and receives no TaxGuard session', async () => {
    const s = await newSession(); const { page } = s;
    const bridged: string[] = [];
    page.on('request', r => { if (r.url().includes('/api/auth/supabase-session')) bridged.push(r.url()); });
    await page.goto(ORIGIN + '/staff/login', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Accept Staff Invite' }).click();
    const flow = page.getByRole('region', { name: 'Staff invitation onboarding' }).or(page.locator('section[aria-label="Staff invitation onboarding"]'));
    await flow.getByLabel('Invitation code').fill(token);
    await flow.getByLabel('Invited work email').fill(email(INVITEE));
    await flow.getByLabel('Password').fill(PASSWORD);
    await flow.getByRole('button', { name: 'Verify invitation' }).click();
    await flow.getByText('Synthetic Invitee').waitFor();
    await flow.getByRole('button', { name: 'Start authenticator setup' }).click();
    secrets[INVITEE] = await flow.getByLabel('Setup key').inputValue();
    expect(secrets[INVITEE]).toMatch(/^[A-Z2-7]{16,}$/);
    await flow.getByLabel('Authenticator code').fill(await codeFor(INVITEE));
    await flow.getByRole('button', { name: 'Verify authenticator' }).click();
    await sees(page, 'Invitation accepted. Your account is pending independent administrator approval.');
    expect(bridged).toEqual([]);
    expect(await storedToken(s)).toBeNull();
    // Pending approval: a full provider sign-in still cannot open a TaxGuard session.
    expect((await durableSession(await providerToken(INVITEE))).status).toBeGreaterThanOrEqual(400);
    // The invitation is single-use.
    const reuse = await fetch(ORIGIN + '/api/staff-access/invitation/accept', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, providerAccessToken: await providerToken(INVITEE) }) });
    expect(reuse.status).toBeGreaterThanOrEqual(400);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('the inviting administrator cannot activate; an independent administrator does in the browser', async () => {
    await pause(61_000); // fresh staff-access rate window
    const inviter = (await durableSession(await providerToken(ADMIN_A))).body.token;
    const self = await api(inviter, 'POST', `/api/staff-access/members/${INVITEE}/approve`);
    expect(self.status).toBe(403); expect(self.body.code).toBe('STAFF_ACTIVATION_DENIED');
    const b = await staffAccess(ADMIN_B);
    const directoryStatus = b.page.getByRole('combobox', { name: 'Status', exact: true }).first(); // the staff directory filter precedes the session and recovery panels
    await directoryStatus.selectOption('pending_approval');
    await b.page.getByRole('button', { name: `approve ${email(INVITEE)}` }).click();
    await b.page.getByRole('button', { name: /^Confirm approve/ }).click();
    await directoryStatus.selectOption('active');
    await b.page.getByRole('row', { name: new RegExp(email(INVITEE).replace(/\./g, '\\.')) }).getByText('active', { exact: true }).waitFor();
    expect(realErrors(b)).toEqual([]);
    await b.context.close();
  });

  it('the activated staff member signs in with the new authenticator and gets an AAL2 staff session', async () => {
    await pause(1100);
    const s = await providerLogin(INVITEE);
    const me = (await api((await storedToken(s))!, 'GET', '/api/auth/me')).body.user;
    expect(me).toMatchObject({ id: INVITEE, role: 'accountant', status: 'active' });
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
});
