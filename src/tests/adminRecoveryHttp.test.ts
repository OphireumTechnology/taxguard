/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Production HTTP Admin Recovery Security Tests
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProductionApp } from '../server/productionApp';
import { setSupabaseAdmin } from '../server/supabase';
import {
  clearPasswordResetThrottle,
  setAdminRecoveryDispatcherForTest
} from '../server/routes/auth.routes';
import { CANONICAL_ADMIN_RECOVERY_URL } from '../config/authRecoveryPolicy';
import { NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE } from '../server/adminRecoveryLimiter';
import { createMockSupabaseClient } from './helpers/mockSupabase';

let server: Server;
let origin: string;
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
const dispatchSpy = vi.fn();

describe('Production HTTP POST /api/auth/admin-recovery-request — Abuse Protection & Neutrality', () => {
  beforeAll(async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
    vi.stubEnv('SUPABASE_URL', 'https://mock.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'mock-service-key');
    mockSupabase = createMockSupabaseClient();
    setSupabaseAdmin(mockSupabase.client);
    setAdminRecoveryDispatcherForTest(dispatchSpy);
    server = createServer(createProductionApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    setAdminRecoveryDispatcherForTest(null);
    clearPasswordResetThrottle();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    clearPasswordResetThrottle();
    dispatchSpy.mockReset().mockResolvedValue({ error: null });
    mockSupabase = createMockSupabaseClient();
    setSupabaseAdmin(mockSupabase.client);
  });

  const postRecovery = (body: Record<string, unknown>, reqOrigin = 'https://destriataxservices.com') =>
    fetch(`${origin}/api/auth/admin-recovery-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: reqOrigin
      },
      body: JSON.stringify(body)
    });

  it('dispatches canonical recovery with no-store header, neutral response, and zero privilege elevation', async () => {
    const res = await postRecovery({
      email: 'synthetic.admin@destria-test.invalid',
      role: 'super_admin',
      tenantId: 'tenantB',
      status: 'active'
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const json = await res.json();
    expect(json.accepted).toBe(true);
    expect(json.message).toBe(NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE);
    expect(json).not.toHaveProperty('token');
    expect(json).not.toHaveProperty('role');
    expect(json).not.toHaveProperty('session');
    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith(
      'synthetic.admin@destria-test.invalid',
      CANONICAL_ADMIN_RECOVERY_URL
    );
    // Unauthenticated recovery must NEVER create or mutate memberships
    expect(mockSupabase.store.members.size).toBe(0);
    expect(mockSupabase.store.sessions.size).toBe(0);
  });

  it('suppresses duplicate per-account dispatch within cooldown with identical neutral 200 and blocks IP bursts with 429', async () => {
    const first = await postRecovery({ email: 'dup.admin@destria-test.invalid' });
    const second = await postRecovery({ email: 'dup.admin@destria-test.invalid' });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).message).toBe(NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE);
    // Only 1 actual provider call was sent despite 2 requests
    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    // Exhaust the remaining IP burst budget (3 more distinct addresses -> total 5 from same IP)
    for (let i = 1; i <= 3; i++) {
      const ok = await postRecovery({ email: `burst.${i}@destria-test.invalid` });
      expect(ok.status).toBe(200);
    }

    // 6th request from same IP triggers HTTP 429 + Retry-After
    const blocked = await postRecovery({ email: 'burst.4@destria-test.invalid' });
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    const blockedBody = await blocked.json();
    expect(blockedBody.code).toBe('ADMIN_RECOVERY_RATE_LIMITED');
  });

  it('rejects untrusted redirectTo values and foreign CORS origins', async () => {
    const badRedirect = await postRecovery({
      email: 'synthetic.admin@destria-test.invalid',
      redirectTo: 'https://evil.example/admin/reset-password'
    });
    expect(badRedirect.status).toBe(400);
    expect((await badRedirect.json()).code).toBe('UNAUTHORIZED_REDIRECT_URL');
    expect(dispatchSpy).not.toHaveBeenCalled();

    const foreignOrigin = await postRecovery(
      { email: 'synthetic.admin@destria-test.invalid' },
      'https://evil.example'
    );
    expect(foreignOrigin.status).toBe(403);
    expect((await foreignOrigin.json()).code).toBe('ORIGIN_DENIED');
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
