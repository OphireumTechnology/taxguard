import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { api, closeBrowser, dumpOnFailure, durableSession, newSession, ORIGIN, providerControl, providerToken, type Session } from '../helpers';

// Self-registration is allowed from the client portal only (owner decision 2026-10-18). These cases cover the
// paths around a sign-in rather than the sign-in form itself: simultaneous first sign-ins, a provider sign-out
// that fails on the network, and restoring a provider session that the browser still holds. Synthetic data only.
const uid = (n: string) => `d0000000-0000-4000-8000-0000000000${n}`;
const email = (id: string) => `${id}@example.test`;
const MANAGER = uid('d1');
const PASSWORD = 'Synthetic-restore-1!';
let managerToken = '';
const clientsFor = async (id: string) => (await api(managerToken, 'GET', `/api/practice/clients?q=${encodeURIComponent(email(id))}`)).body.items as any[];
const storedToken = (s: Session) => s.page.evaluate(() => localStorage.getItem('artax_session_token'));
const providerStorage = (s: Session) => s.page.evaluate(() => Object.keys(localStorage).filter(k => /^sb-.*-auth-token$/.test(k)));
/** Records every session-exchange request the page sends, with the portal it claimed and the response status. */
function watchBridge(s: Session) {
  const seen: Array<{ portal: string; status?: number }> = [];
  s.page.on('request', r => { if (r.url().endsWith('/api/auth/supabase-session')) seen.push({ portal: JSON.parse(r.postData() || '{}').portal ?? 'none' }); });
  s.page.on('response', r => { if (r.url().endsWith('/api/auth/supabase-session')) { const open = seen.find(x => x.status === undefined); if (open) open.status = r.status(); } });
  return seen;
}
async function passwordSignIn(s: Session, path: '/portal/login' | '/staff/login', id: string) {
  await s.page.goto(ORIGIN + path);
  if (path === '/staff/login') {
    await s.page.getByPlaceholder('practitioner@artaxservices.com').fill(email(id));
    await s.page.locator('input[type=password]').fill(PASSWORD);
    await s.page.getByRole('button', { name: 'Enter Staff Workspace' }).click();
  } else {
    await s.page.locator('input[type=email]').fill(email(id));
    await s.page.locator('input[type=password]').fill(PASSWORD);
    await s.page.getByRole('button', { name: 'Sign In Securely', exact: true }).click();
  }
}
const settle = (s: Session) => s.page.waitForLoadState('networkidle').then(() => s.page.waitForTimeout(1500));

beforeAll(async () => {
  for (const n of ['b2', 'b3', 'b4', 'b5'])
    expect((await providerControl('/e2e/provider-user', { uid: uid(n), email: email(uid(n)), password: PASSWORD, withFactor: false })).status).toBe(200);
  expect((await providerControl('/e2e/provider-user', { uid: MANAGER, email: email(MANAGER), password: 'Synthetic-durable-manager-1!', withFactor: true })).status).toBe(200);
  const m = await durableSession(await providerToken(MANAGER));
  expect(m.status, m.body?.code).toBe(200);
  managerToken = m.body.token;
});
afterEach(async ctx => { if (ctx.task.result?.state === 'fail') await dumpOnFailure(ctx.task.name); });
afterAll(closeBrowser);

describe('simultaneous first sign-ins', () => {
  it('six simultaneous first sign-ins of one verified identity create exactly one client; replay returns it', async () => {
    const id = uid('b5');
    const tokens = await Promise.all(Array.from({ length: 6 }, () => providerToken(id, { aal: 'aal1' })));
    const sessions = await Promise.all(tokens.map(t => durableSession(t, 'client')));
    for (const r of sessions) expect(r.status, r.body?.code).toBe(200);
    const ids = new Set(sessions.map(r => r.body.user.clientId));
    expect(ids.size).toBe(1);
    const [clientId] = [...ids];
    expect(sessions.every(r => r.body.user.tenantId === 'tenantE2E' && r.body.user.role === 'client')).toBe(true);
    expect(await clientsFor(id)).toEqual([expect.objectContaining({ clientId })]);
    const replay = await durableSession(await providerToken(id, { aal: 'aal1' }));
    expect([replay.status, replay.body.user.clientId]).toEqual([200, clientId]);
    // Each sign-in is its own session; none of them reaches another client's records.
    expect((await api(sessions[0].body.token, 'GET', `/api/billing/clients/e2eClient/invoices`)).status).toBeGreaterThanOrEqual(403);
    expect(await clientsFor(id)).toHaveLength(1);
  });
});

describe('reload after a failed provider sign-out', () => {
  it('a refused staff sign-in whose provider sign-out fails leaves no session and creates no client after reload', async () => {
    const id = uid('b3');
    const s = await newSession(); const bridge = watchBridge(s);
    await s.page.route('**/auth/v1/logout**', r => r.abort());
    await passwordSignIn(s, '/staff/login', id);
    await s.page.getByRole('alert').first().waitFor();
    await s.page.reload(); await settle(s);
    expect(await storedToken(s)).toBeNull();
    expect(await providerStorage(s)).toEqual([]);
    expect(bridge.every(b => b.portal === 'staff')).toBe(true);
    expect(bridge.filter(b => b.status === 200)).toEqual([]);
    expect(new URL(s.page.url()).pathname).toBe('/staff/login');
    expect(await clientsFor(id)).toEqual([]);
    await s.context.close();
  });

  it('a client who signs out while the provider sign-out fails stays signed out after reload; the old session is revoked', async () => {
    const id = uid('b4');
    const s = await newSession(); const bridge = watchBridge(s);
    await passwordSignIn(s, '/portal/login', id);
    await s.page.waitForURL(u => u.pathname === '/portal' || u.pathname === '/portal/dashboard');
    const token = (await storedToken(s))!;
    expect((await api(token, 'GET', '/api/auth/me')).status).toBe(200);
    await s.page.route('**/auth/v1/logout**', r => r.abort());
    await s.page.getByRole('button', { name: /sign out/i }).first().click();
    await s.page.waitForURL(u => u.pathname === '/portal/login');
    const bridgesBeforeReload = bridge.length;
    await s.page.reload(); await settle(s);
    expect(await storedToken(s)).toBeNull();
    expect(await providerStorage(s)).toEqual([]);
    expect(bridge.length).toBe(bridgesBeforeReload); // nothing signs the person back in
    expect(new URL(s.page.url()).pathname).toBe('/portal/login');
    expect((await api(token, 'GET', '/api/auth/me')).status).toBe(401);
    expect(await clientsFor(id)).toHaveLength(1); // the existing client is kept, not duplicated
    await s.context.close();
  });
});

describe('portal intent when a provider session is restored', () => {
  it('restoring on a staff page never creates a client; on the client portal it self-registers; an existing client restores on either', async () => {
    const id = uid('b2');
    const s = await newSession(); const bridge = watchBridge(s);
    // Sign in on the client portal but hold the session exchange, so the provider session stays in the browser
    // without a TaxGuard session (as after an interrupted sign-in or a closed tab).
    // Only the first exchange is held; leaving the page cancels it, so it never reaches the server.
    let holdFirst = true;
    await s.page.route('**/api/auth/supabase-session', route => { if (holdFirst) { holdFirst = false; return; } return route.continue(); });
    const held = s.page.waitForRequest(r => r.url().endsWith('/api/auth/supabase-session'));
    await passwordSignIn(s, '/portal/login', id);
    await held;
    expect(await providerStorage(s)).toHaveLength(1);
    bridge.length = 0;

    await s.page.goto(ORIGIN + '/staff/login'); await settle(s);
    await s.page.unrouteAll({ behavior: 'ignoreErrors' });
    expect(bridge.map(b => b.portal)).toEqual(['staff']);
    expect(bridge[0].status).toBe(403);
    expect(await storedToken(s)).toBeNull();
    expect(await clientsFor(id)).toEqual([]);

    bridge.length = 0;
    await s.page.goto(ORIGIN + '/portal/login'); await settle(s);
    expect(bridge.map(b => [b.portal, b.status])).toEqual([['none', 200]]);
    expect(await storedToken(s)).not.toBeNull();
    const clients = await clientsFor(id);
    expect(clients).toHaveLength(1);

    // An existing client whose TaxGuard session was cleared restores normally even from a staff page.
    await s.page.evaluate(() => { for (const store of [localStorage, sessionStorage]) for (const k of ['artax_session_token', 'token']) store.removeItem(k); });
    bridge.length = 0;
    await s.page.goto(ORIGIN + '/staff/login'); await settle(s);
    expect(bridge.map(b => [b.portal, b.status])).toEqual([['staff', 200]]);
    const restored = (await storedToken(s))!;
    expect((await api(restored, 'GET', '/api/auth/me')).body.user.clientId).toBe(clients[0].clientId);
    expect(await clientsFor(id)).toHaveLength(1);
    await s.context.close();
  });
});
