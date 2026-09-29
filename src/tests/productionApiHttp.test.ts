import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
const state = vi.hoisted(() => ({ db: null as any, auth: null as any, verify: vi.fn() }));
vi.mock('../server/firebase-admin', () => ({
  getFirebaseAdminDb: () => state.db,
  getFirebaseAdminAuth: () => state.auth,
  verifyFirebaseIdToken: (...args: any[]) => state.verify(...args),
}));
import { createProductionApp } from '../server/productionApp';
let server: Server; let origin: string;
const decoded = { uid: 'uid1', email: 'client@example.com', auth_time: Math.floor(Date.now() / 1000) };
beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
  server = createServer(createProductionApp());
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); vi.unstubAllEnvs(); });
beforeEach(() => {
  state.db = new TransactionalFirestore();
  state.auth = { getUser: vi.fn().mockResolvedValue({ email: decoded.email, disabled: false, emailVerified: true, tokensValidAfterTime: '2020-01-01' }) };
  state.verify.mockReset().mockResolvedValue(decoded);
});
const call = (path: string, token?: string) => fetch(origin + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
const session = () => fetch(origin + '/api/auth/firebase-session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://artaxserv.com' }, body: JSON.stringify({ idToken: 'verified-by-mock', role: 'super_admin' }) });
it('creates a server-owned client session and restores authenticated identity', async () => {
  const response = await session(); expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const result = await response.json(); expect(result.user.role).toBe('client');
  expect((await (await call('/api/auth/me', result.token)).json()).user.id).toBe('uid1');
  expect(state.verify).toHaveBeenCalledWith('verified-by-mock');
});
it('rejects invalid Firebase proof without provisioning', async () => {
  state.verify.mockRejectedValue(new Error('private diagnostics'));
  const response = await session(); expect(response.status).toBe(401);
  expect(await response.text()).not.toContain('private diagnostics'); expect(state.db.records.size).toBe(0);
});
it('protects profile and case routes without a session', async () => {
  expect((await call('/api/auth/me')).status).toBe(401);
  expect((await call('/api/case-authority/t/c/e/2025')).status).toBe(401);
});
it('revokes the durable session on logout', async () => {
  const { token } = await (await session()).json();
  expect((await fetch(origin + '/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })).status).toBe(200);
  expect((await call('/api/auth/me', token)).status).toBe(401);
});
it('rejects expired persisted sessions', async () => {
  const { token } = await (await session()).json();
  for (const [key, value] of state.db.records) if (key.startsWith('taxguardSessions/')) value.expiresAt = 1;
  expect((await call('/api/auth/me', token)).status).toBe(401);
});
it('allows production CORS preflight and denies foreign origins', async () => {
  const response = await fetch(origin + '/api/auth/firebase-session', { method: 'OPTIONS', headers: { Origin: 'https://artaxserv.com' } });
  expect(response.status).toBe(204); expect(response.headers.get('access-control-allow-origin')).toBe('https://artaxserv.com');
  expect((await fetch(origin + '/api/health', { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
});
it.each(['/api/documents/upload', '/api/admin', '/api/live-workflow/complete-stage'])('blocks unfinished legacy API %s', async path => {
  expect((await fetch(origin + path, { method: 'POST' })).status).toBe(503);
});
it('does not serve server artifacts or fall through to a SPA', async () => {
  expect((await call('/server.cjs')).status).toBe(404);
  expect((await call('/server.cjs.map')).status).toBe(404);
});
it('rejects malformed JSON without disclosing internals', async () => {
  const response = await fetch(origin + '/api/auth/firebase-session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  expect(response.status).toBe(400); expect(await response.json()).toEqual({ code: 'REQUEST_FAILED' });
});
it('disables password and caller-role legacy registration endpoints', async () => {
  expect((await fetch(origin + '/api/auth/register', { method: 'POST' })).status).toBe(410);
  expect((await fetch(origin + '/api/auth/login', { method: 'POST' })).status).toBe(410);
});
it('supports Cloud Functions URL prefix normalization for routes', async () => {
  const healthRes = await fetch(origin + '/taxguardApi/api/health');
  expect(healthRes.status).toBe(200);
  expect((await healthRes.json()).status).toBe('available');

  const sessionRes = await fetch(origin + '/taxguardApi/api/auth/firebase-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://artaxserv.com' },
    body: JSON.stringify({ idToken: 'verified-by-mock' })
  });
  expect(sessionRes.status).toBe(200);
});

