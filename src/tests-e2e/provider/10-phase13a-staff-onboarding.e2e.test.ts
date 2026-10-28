import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ORIGIN, closeBrowser, dumpOnFailure, newSession, pause, providerControl, providerToken, totpAt, type Session } from '../helpers';

// Contract C4 in the browser on the provider-mode profile: a durable staff member signs in through
// the identity-provider emulation (password + TOTP) and opens the durable onboarding status page,
// which reads the verified provider session. Synthetic user only; it is used by no other suite.
const UID = 'd0000000-0000-4000-8000-000000000003';
const PASSWORD = 'Synthetic-pass-1!';
let secret = ''; let lastStep = -1;
async function code() {
  for (;;) {
    const step = Math.floor(Date.now() / 30000);
    if (lastStep < step) { lastStep = step; return totpAt(secret, step); }
    await pause((step + 1) * 30000 - Date.now() + 250);
  }
}
// The staff-access rate limit (20 a minute per address) is shared with the previous suite: start
// with a clear window instead of relaxing the limit.
beforeAll(async () => {
  await pause(61_000);
  const r = await providerControl('/e2e/provider-user', { uid: UID, email: `${UID}@example.test`, name: 'Synthetic Onboarding Accountant', password: PASSWORD });
  expect(r.status).toBe(200); secret = r.body.factorSecret;
}, 120_000);
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(async () => { await closeBrowser(); });

async function signIn(): Promise<Session> {
  const s = await newSession(); const { page } = s;
  await page.goto(ORIGIN + '/staff/login', { waitUntil: 'domcontentloaded' });
  await page.getByPlaceholder('practitioner@artaxservices.com').fill(`${UID}@example.test`);
  await page.locator('input[type=password]').fill(PASSWORD);
  await page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  const otp = page.locator('input[autocomplete="one-time-code"]');
  await otp.waitFor();
  await otp.fill(await code());
  await page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  await page.waitForURL(u => u.pathname === '/staff');
  return s;
}

describe('C4 durable staff onboarding status', () => {
  it('shows the verified member status and next step, read from the server, with nothing to approve', async () => {
    const s = await signIn();
    await s.page.goto(ORIGIN + '/staff-onboarding', { waitUntil: 'domcontentloaded' });
    const main = s.page.getByRole('main', { name: 'Your onboarding status' });
    await main.getByText('Waiting for client assignments').waitFor();
    const t = await main.innerText();
    expect(t).toMatch(/Membership\s*Active · accountant/);
    expect(t).toMatch(/This sign-in\s*Authenticator used/);
    expect(t).toMatch(/0 active · 0 clients/);
    expect(t).toContain('Nothing on this page grants access or approves anything.');
    expect(t).not.toMatch(/PTIN|EFIN|example\.test/);
    expect(await main.getByRole('button').allInnerTexts()).toEqual(['Refresh']);
    expect(s.api.filter(a => a.path === '/api/staff-access/onboarding/status').map(a => a.status)).toContain(200);
    expect(s.api.filter(a => a.path.startsWith('/api/onboarding'))).toEqual([]); // no legacy dossier calls
    await s.context.close();
  });
  it('refuses the status endpoint without a verified provider identity and ignores a forged uid', async () => {
    const anonymous = await fetch(ORIGIN + '/api/staff-access/onboarding/status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(anonymous.status).toBe(401);
    const forged = await fetch(ORIGIN + '/api/staff-access/onboarding/status', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerAccessToken: 'not-a-real-token', uid: UID }) });
    expect(forged.status).toBe(401);
    const token = await providerToken(UID, { aal: 'aal1' });
    const r = await fetch(ORIGIN + '/api/staff-access/onboarding/status', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerAccessToken: token, uid: 'd0000000-0000-4000-8000-00000000000a' }) });
    const b = await r.json() as any;
    expect(r.status).toBe(200);
    expect(b).toMatchObject({ membershipStatus: 'active', role: 'accountant' });
    expect(b.nextSteps[0]).toMatch(/^(SIGN_IN_WITH_AUTHENTICATOR|ENROLL_AUTHENTICATOR)$/); // the password-only session is not treated as ready
  });
});
