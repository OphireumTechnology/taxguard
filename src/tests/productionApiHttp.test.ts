import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createProductionApp } from '../server/productionApp';
import { setSupabaseAdmin } from '../server/supabase';
import { createMockSupabaseClient } from './helpers/mockSupabase';

const state = vi.hoisted(() => ({
  verify: vi.fn(),
  user: {
    uid: 'uid1',
    email: 'client@example.com',
    displayName: 'Client',
    authTime: Math.floor(Date.now() / 1000)
  }
}));

vi.mock('../server/supabase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../server/supabase')>();
  return {
    ...actual,
    verifySupabaseAccessToken: (...args: any[]) => state.verify(...args),
    isSupabaseServerConfigured: () => true
  };
});

let server: Server;
let origin: string;
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
  vi.stubEnv('SUPABASE_URL', 'https://mock.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key');
  mockSupabase = createMockSupabaseClient();
  setSupabaseAdmin(mockSupabase.client);
  server = createServer(createProductionApp());
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
  vi.unstubAllEnvs();
});

beforeEach(() => {
  mockSupabase = createMockSupabaseClient();
  setSupabaseAdmin(mockSupabase.client);
  state.verify.mockReset().mockResolvedValue(state.user);
});

const call = (path: string, token?: string) =>
  fetch(origin + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

const session = () =>
  fetch(origin + '/api/auth/supabase-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'https://artaxserv.com' },
    body: JSON.stringify({ accessToken: 'verified-supabase-token', role: 'super_admin' })
  });

it('creates a server-owned client session and restores authenticated identity via Supabase', async () => {
  const response = await session();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  const result = await response.json();
  expect(result.user.role).toBe('client');
  expect((await (await call('/api/auth/me', result.token)).json()).user.id).toBe('uid1');
  expect(state.verify).toHaveBeenCalledWith('verified-supabase-token');
});

it('rejects invalid Supabase token without provisioning', async () => {
  state.verify.mockRejectedValue(new Error('private diagnostics'));
  const response = await session();
  expect(response.status).toBe(401);
  expect(await response.text()).not.toContain('private diagnostics');
});

it('protects profile and case routes without a session', async () => {
  expect((await call('/api/auth/me')).status).toBe(401);
  expect((await call('/api/case-authority/t/c/e/2025')).status).toBe(401);
});

it('revokes the durable session on logout', async () => {
  const { token } = await (await session()).json();
  expect(
    (await fetch(origin + '/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }))
      .status
  ).toBe(200);
  expect((await call('/api/auth/me', token)).status).toBe(401);
});

it('allows production CORS preflight and denies foreign origins', async () => {
  const response = await fetch(origin + '/api/auth/supabase-session', {
    method: 'OPTIONS',
    headers: { Origin: 'https://artaxserv.com' }
  });
  expect(response.status).toBe(204);
  expect(response.headers.get('access-control-allow-origin')).toBe('https://artaxserv.com');
  expect((await fetch(origin + '/api/health', { headers: { Origin: 'https://evil.example' } })).status).toBe(403);
});

it.each(['/api/documents/upload', '/api/admin', '/api/live-workflow/complete-stage'])(
  'blocks unfinished legacy API %s',
  async path => {
    expect((await fetch(origin + path, { method: 'POST' })).status).toBe(503);
  }
);
