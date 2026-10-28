import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Phase 14 / Block 14: the production session bridge throttles failed provider-token verifications.
vi.mock('../server/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('../server/supabase')>()), isSupabaseServerConfigured: () => true }));
import { setSupabaseAdmin } from '../server/supabase';
import { createProductionApp } from '../server/productionApp';
import { AuthFailureLimiter, MAX_PROVIDER_ACCESS_TOKEN_LENGTH, sessionVerificationFailures } from '../server/authFailureLimiter';

const getUser = vi.fn(async () => ({ data: { user: null }, error: { message: 'invalid JWT', status: 401 } }));
let server: Server; let origin = '';
const bridge = (accessToken: unknown) => fetch(origin + '/api/auth/supabase-session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ accessToken }) })
  .then(async r => ({ status: r.status, retryAfter: r.headers.get('retry-after'), body: await r.json() as any }));

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantThrottle');
  setSupabaseAdmin({ auth: { getUser } } as any);
  server = createServer(createProductionApp());
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); setSupabaseAdmin(null as any); vi.unstubAllEnvs(); });
beforeEach(() => { sessionVerificationFailures.reset(); getUser.mockClear(); });

describe('production session bridge throttling', () => {
  it('refuses further attempts from an address after 20 failed verifications, before contacting the provider', async () => {
    for (let i = 0; i < 20; i++) expect((await bridge('synthetic-invalid-' + i)).status).toBe(401);
    const calls = getUser.mock.calls.length;
    expect(calls).toBe(20);
    const blocked = await bridge('synthetic-invalid-final');
    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Too many failed sign-in attempts. Try again later.', code: 'SESSION_VERIFICATION_RATE_LIMITED' });
    expect(Number(blocked.retryAfter)).toBeGreaterThan(0);
    expect(getUser.mock.calls.length).toBe(calls);
  });
  it('rejects an oversized token without a provider call and counts it as a failure', async () => {
    const r = await bridge('x'.repeat(MAX_PROVIDER_ACCESS_TOKEN_LENGTH + 1));
    expect(r.status).toBe(400); expect(r.body.code).toBe('TOKEN_REQUIRED');
    expect(getUser).not.toHaveBeenCalled();
    for (let i = 0; i < 19; i++) await bridge(42);
    expect((await bridge('synthetic-invalid')).status).toBe(429);
    expect(getUser).not.toHaveBeenCalled();
  });
});

describe('AuthFailureLimiter', () => {
  it('blocks only after the limit, reports seconds remaining, and forgets after the window', () => {
    let now = 1_000;
    const limiter = new AuthFailureLimiter(3, 60_000, 100, () => now);
    for (let i = 0; i < 2; i++) limiter.recordFailure('a');
    expect(limiter.blockedFor('a')).toBe(0);
    limiter.recordFailure('a');
    expect(limiter.blockedFor('a')).toBe(60);
    expect(limiter.blockedFor('b')).toBe(0);
    now += 59_500; expect(limiter.blockedFor('a')).toBe(1);
    now += 500; expect(limiter.blockedFor('a')).toBe(0);
  });
  it('stays bounded when every slot is live', () => {
    const limiter = new AuthFailureLimiter(1, 60_000, 2, () => 0);
    for (const key of ['a', 'b', 'c']) limiter.recordFailure(key);
    expect(limiter.blockedFor('a')).toBe(0); // the oldest entry was evicted to make room
    expect(limiter.blockedFor('c')).toBe(1 * 60);
  });
});
