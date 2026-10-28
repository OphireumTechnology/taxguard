import { afterAll, describe, expect, it } from 'vitest';
import { api, closeBrowser, freshCode, newSession, ORIGIN, realErrors, sees, staffLogin, totpAt, user } from './helpers';

// Staff sign-in, MFA, sign-out and session handling through the real browser UI and server.
afterAll(async () => { await closeBrowser(); });
const storedToken = (s: Awaited<ReturnType<typeof newSession>>) => s.page.evaluate(() => localStorage.getItem('artax_session_token'));

describe('staff sign-in and MFA', () => {
  it('refuses a wrong password without issuing a session', async () => {
    const s = await newSession(); const u = user('e2e-recruiter');
    await s.page.goto(ORIGIN + '/staff/login');
    await s.page.getByPlaceholder('practitioner@artaxservices.com').fill(u.email);
    await s.page.locator('input[type=password]').fill(u.password + 'x');
    await s.page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
    expect(await sees(s.page, 'Invalid email or password.')).toBe(true);
    expect(await storedToken(s)).toBeNull();
    expect(s.api.find(a => a.path === '/api/auth/login')?.status).toBe(401);
    await s.context.close();
  });

  it('asks for the authenticator code after the password and refuses a wrong code', async () => {
    const s = await newSession(); const u = user('e2e-recruiter');
    await s.page.goto(ORIGIN + '/staff/login');
    await s.page.getByPlaceholder('practitioner@artaxservices.com').fill(u.email);
    await s.page.locator('input[type=password]').fill(u.password);
    await s.page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
    const code = s.page.locator('input[autocomplete="one-time-code"]');
    await code.waitFor();
    expect(await storedToken(s)).toBeNull();
    await code.fill(totpAt(u.totp, Math.floor(Date.now() / 30000) + 20));
    await s.page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
    expect(await sees(s.page, /Invalid authenticator code/)).toBe(true);
    expect(await storedToken(s)).toBeNull();
    expect(s.page.url()).toContain('/staff/login');
    await s.context.close();
  });

  it('signs in with password and TOTP, loads the session identity, and refuses a replayed code', async () => {
    const s = await staffLogin('e2e-admin');
    const token = await storedToken(s);
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const me = await api(token!, 'GET', '/api/auth/me');
    expect(me.status).toBe(200); expect(me.body.user).toMatchObject({ id: 'e2e-admin', role: 'admin', tenantId: 'tenantE2E' });
    expect(JSON.stringify(me.body)).not.toMatch(/password|totp|secret/i);
    // The same authenticator code cannot open a second session.
    const u = user('e2e-acct'); const code = await freshCode('e2e-acct');
    const login = (mfaCode: string) => fetch(ORIGIN + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password, mfaCode }) })
      .then(async r => ({ status: r.status, body: await r.json() }));
    expect((await login(code)).body.token).toBeTruthy();
    const replay = await login(code);
    expect(replay.status).toBe(401); expect(replay.body.code).toBe('MFA_CODE_REPLAYED'); expect(replay.body.token).toBeUndefined();
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });

  it('signs out from the workspace and revokes the session on the server', async () => {
    const s = await staffLogin('e2e-rev');
    const token = await storedToken(s);
    expect((await api(token!, 'GET', '/api/auth/me')).status).toBe(200);
    await s.page.getByRole('button', { name: 'Sign Out' }).first().click();
    await s.page.waitForURL(url => !url.pathname.startsWith('/staff') || url.pathname.startsWith('/staff/login'));
    expect(await storedToken(s)).toBeNull();
    const after = await api(token!, 'GET', '/api/auth/me');
    expect(after.status).toBe(401);
    await s.context.close();
  });
});

describe('sign-out destination', () => {
  // Every account that signs in at the staff portal returns to the staff sign-in page, not the client one.
  for (const id of ['e2e-mgr', 'e2e-bk', 'e2e-acct', 'e2e-admin']) {
    it(`returns ${id} to the staff sign-in page and revokes the session`, async () => {
      const s = await staffLogin(id);
      const token = await storedToken(s);
      await s.page.getByRole('button', { name: /^Sign Out$/i }).first().click();
      await s.page.waitForURL(url => url.pathname.endsWith('/login'));
      expect(new URL(s.page.url()).pathname).toBe('/staff/login');
      expect(await storedToken(s)).toBeNull();
      expect((await api(token!, 'GET', '/api/auth/me')).status).toBe(401);
      await s.context.close();
    });
  }
});

describe('session boundaries', () => {
  it('keeps anonymous visitors out of the staff workspace and every durable API', async () => {
    const s = await newSession();
    await s.page.goto(ORIGIN + '/staff');
    await s.page.waitForURL(url => url.pathname.startsWith('/staff/login'));
    for (const path of ['/api/practice/clients', '/api/cases', '/api/vault/review-queue', '/api/billing/catalog', '/api/book-to-tax/categories/1040', '/api/bookkeeping/work-queue?clientId=e2eClient&taxYear=2025'])
      expect((await fetch(ORIGIN + path)).status, path).toBe(401);
    expect((await api('0'.repeat(64), 'GET', '/api/auth/me')).status).toBe(401);
    await s.context.close();
  });

  it('shows the account security page and keeps durable session management closed for local sessions', async () => {
    const s = await staffLogin('e2e-mgr');
    await s.page.goto(ORIGIN + '/staff/account-security');
    expect(await sees(s.page, 'Account security')).toBe(true);
    // Session management and security history require durable (provider) sessions; a local
    // session is never treated as one, so the server refuses rather than inventing data.
    const token = await storedToken(s);
    const sessions = await api(token!, 'GET', '/api/staff-access/sessions');
    expect(sessions.status).toBeGreaterThanOrEqual(400);
    expect(JSON.stringify(sessions.body ?? {})).not.toMatch(/session_token_hash|[a-f0-9]{64}/);
    expect(realErrors(s)).toEqual([]);
    await s.context.close();
  });
});
