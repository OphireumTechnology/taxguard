import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, closeBrowser, dumpOnFailure, durableSession, newSession, ORIGIN, pause, providerControl, providerToken, totpAt, type Session } from '../helpers';

const UID = 'd0000000-0000-4000-8000-0000000000c1';
const PASSWORD = 'Synthetic-client-MFA-1!';
let secret = '', lastStep = -1;
const token = (s: Session) => s.page.evaluate(() => localStorage.getItem('artax_session_token'));
async function fresh() {
  const step = Math.floor(Date.now() / 30000);
  if (step <= lastStep) await pause((lastStep + 1) * 30000 - Date.now() + 250);
  lastStep = Math.floor(Date.now() / 30000);
  return totpAt(secret, lastStep);
}
async function password(s: Session, uid = UID) {
  await s.page.goto(ORIGIN + '/portal/login');
  await s.page.locator('input[type=email]').fill(`${uid}@example.test`);
  await s.page.locator('input[type=password]').fill(PASSWORD);
  await s.page.getByRole('button', { name: 'Sign In Securely', exact: true }).click();
}
beforeAll(async () => {
  expect((await providerControl('/e2e/provider-user', { uid: UID, email: `${UID}@example.test`, password: PASSWORD, withFactor: false })).status).toBe(200);
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(closeBrowser);
describe('client provider MFA browser security', () => {
  it('cancels setup, enrolls, revokes preexisting AAL1 sessions and requires the challenge on subsequent sign-in', async () => {
    const stale = await durableSession(await providerToken(UID, { aal: 'aal1' }));
    expect(stale.status, stale.body.code).toBe(200);
    const oldToken = stale.body.token;
    const s = await newSession();
    await password(s);
    await s.page.waitForURL(u => u.pathname === '/portal' || u.pathname === '/portal/dashboard');
    await s.page.goto(ORIGIN + '/portal/dashboard#nav=security');
    await s.page.getByRole('button', { name: 'MFA & Credentials' }).click();
    await s.page.getByRole('button', { name: 'Start authenticator setup', exact: true }).click();
    await s.page.getByLabel('Setup key', { exact: true }).waitFor();
    await s.page.getByRole('button', { name: 'Cancel setup', exact: true }).click();
    await s.page.getByText('Authenticator setup cancelled. Nothing was added.', { exact: true }).waitFor();
    expect(await s.page.getByLabel('Setup key', { exact: true }).count()).toBe(0);
    expect((await api(oldToken, 'GET', '/api/auth/me')).status).toBe(200);
    await s.page.getByRole('button', { name: 'Start authenticator setup', exact: true }).click();
    secret = await s.page.getByLabel('Setup key', { exact: true }).inputValue();
    await s.page.getByLabel('6-digit code from your app', { exact: true }).fill(totpAt(secret, Math.floor(Date.now() / 30000) + 20));
    await s.page.getByRole('button', { name: 'Verify authenticator', exact: true }).click();
    await s.page.getByText(/That code was not accepted/).waitFor();
    await s.page.getByLabel('6-digit code from your app', { exact: true }).fill(await fresh());
    await s.page.getByRole('button', { name: 'Verify authenticator', exact: true }).click();
    await s.page.getByText(/Authenticator added. You will now be signed out/).waitFor();
    expect((await api(oldToken, 'GET', '/api/auth/me')).status).toBe(401);
    expect((await durableSession(await providerToken(UID, { aal: 'aal1' }))).body.code).toBe('CLIENT_MFA_REQUIRED');
    await s.page.waitForURL(u => u.pathname === '/portal/login' || u.pathname === '/');
    await password(s);
    const otp = s.page.locator('input[autocomplete="one-time-code"]');
    await otp.waitFor();
    expect(await token(s)).toBeNull();
    await otp.fill(totpAt(secret, Math.floor(Date.now() / 30000) + 20));
    await s.page.getByRole('button', { name: 'Verify code and sign in', exact: true }).click();
    await s.page.getByText(/Invalid authenticator code/).waitFor();
    expect(await token(s)).toBeNull();
    await otp.fill(await fresh());
    await s.page.getByRole('button', { name: 'Verify code and sign in', exact: true }).click();
    await s.page.waitForURL(u => u.pathname === '/portal' || u.pathname === '/portal/dashboard');
    const strong = await token(s);
    expect((await api(strong!, 'GET', '/api/auth/me')).status).toBe(200);
    // Logout revokes the application bearer as well as clearing browser state.
    await s.page.getByRole('button', { name: /Sign Out|Log Out|Logout/i }).first().click();
    await s.page.waitForURL(u => u.pathname === '/portal/login' || u.pathname === '/');
    expect((await api(strong!, 'GET', '/api/auth/me')).status).toBe(401);
    await s.context.close();
  });
  it('clears client identity when switching accounts and rejects expired provider enrollment', async () => {
    const other = 'd0000000-0000-4000-8000-0000000000c2';
    await providerControl('/e2e/provider-user', { uid: other, email: `${other}@example.test`, password: PASSWORD, withFactor: false });
    const s = await newSession();
    await password(s, other);
    await s.page.waitForURL(u => u.pathname === '/portal' || u.pathname === '/portal/dashboard');
    const me = await api((await token(s))!, 'GET', '/api/auth/me');
    expect(me.body.user.id).toBe(other);
    expect(me.body.user.clientId).not.toBe('E2EMFAC1');
    await s.page.goto(ORIGIN + '/portal/dashboard#nav=security');
    await s.page.getByRole('button', { name: 'MFA & Credentials' }).click();
    await s.page.getByRole('button', { name: 'Start authenticator setup', exact: true }).click();
    const key = await s.page.getByLabel('Setup key', { exact: true }).inputValue();
    await providerControl('/e2e/provider-expire', { uid: other });
    await s.page.getByLabel('6-digit code from your app', { exact: true }).fill(totpAt(key, Math.floor(Date.now() / 30000)));
    await s.page.getByRole('button', { name: 'Verify authenticator', exact: true }).click();
    await s.page.getByText(/Your sign-in has expired/).waitFor();
    expect(await s.page.getByText(/Authenticator added/).count()).toBe(0);
    await s.context.close();
  });
});
