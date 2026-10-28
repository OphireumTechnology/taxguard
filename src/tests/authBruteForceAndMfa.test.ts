import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { hashPassword } from '../server/auth';
import { authRouter, clearPasswordResetThrottle } from '../server/routes/auth.routes';

/** Legacy local login: MFA enforcement, account-wide lockout, reset-token exposure and throttling. Synthetic data. */
let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.set('trust proxy', true); app.use(express.json()); app.use('/api/auth', authRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const password = 'Synthetic-Passw0rd!';
const accounts = { plain: 'bf-plain@example.invalid', mfa: 'bf-mfa@example.invalid' };
const login = async (email: string, pass: string, ip: string, extra: Record<string, unknown> = {}) => {
  const r = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email, password: pass, ...extra }) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const forgot = async (email: string) => {
  const r = await fetch(`${origin}/api/auth/forgot-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const sessionsFor = (userId: string) => Array.from(db.sessions.values()).filter((s: any) => s.userId === userId).length;

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  clearPasswordResetThrottle();
  for (const [key, email] of Object.entries(accounts)) {
    db.users.set(`bf-${key}`, { id: `bf-${key}`, email, name: key, role: 'accountant', status: 'active', tenantId: 'tenant-bf', mfaEnabled: key === 'mfa' } as any);
    db.userPasswords.set(email, hashPassword(password));
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  for (const [key, email] of Object.entries(accounts)) {
    db.users.delete(`bf-${key}`); db.userPasswords.delete(email);
    for (const k of Array.from(db.loginAttempts.keys())) if (k.endsWith(email)) db.loginAttempts.delete(k);
    for (const [t, s] of Array.from(db.sessions.entries())) if ((s as any).userId === `bf-${key}`) db.sessions.delete(t);
    for (const [t, r] of Array.from(db.passwordResetTokens.entries())) if ((r as any).email === email) db.passwordResetTokens.delete(t);
  }
});

describe('MFA enforcement', () => {
  it('prompts for MFA without issuing a session', async () => {
    const r = await login(accounts.mfa, password, '10.0.0.1');
    expect(r.body).toMatchObject({ mfaRequired: true });
    expect(r.body).not.toHaveProperty('token');
    expect(sessionsFor('bf-mfa')).toBe(0);
  });
  it.each(['000000', '123456', 'x'])('refuses an unverifiable MFA code %j (previously any non-empty code logged in)', async code => {
    const r = await login(accounts.mfa, password, '10.0.0.1', { mfaCode: code });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('MFA_VERIFICATION_UNAVAILABLE');
    expect(r.body).not.toHaveProperty('token');
    expect(sessionsFor('bf-mfa')).toBe(0);
  });
  it('non-MFA accounts still sign in normally (control)', async () => {
    const r = await login(accounts.plain, password, '10.0.0.1');
    expect(r.status).toBe(200);
    expect(typeof r.body.token).toBe('string');
  });
});

describe('brute-force protection', () => {
  it('locks one source after 5 failures', async () => {
    for (let i = 0; i < 5; i++) expect((await login(accounts.plain, 'wrong', '10.0.1.1')).status).toBe(401);
    expect((await login(accounts.plain, password, '10.0.1.1')).status).toBe(429);
  });
  it('locks the account after 15 failures spread across rotating IPs (previously unlimited)', async () => {
    for (let i = 0; i < 15; i++) expect((await login(accounts.plain, 'wrong', `10.0.2.${i}`)).status).toBe(401);
    const r = await login(accounts.plain, password, '10.0.3.99');
    expect(r.status).toBe(429);
    expect(r.body.locked).toBe(true);
    expect(sessionsFor('bf-plain')).toBe(0);
  });
  it('a successful login clears both counters', async () => {
    for (let i = 0; i < 4; i++) await login(accounts.plain, 'wrong', '10.0.4.1');
    expect((await login(accounts.plain, password, '10.0.4.1')).status).toBe(200);
    expect(db.loginAttempts.has(`account_${accounts.plain}`)).toBe(false);
  });
  it('rejects non-string credentials without crashing', async () => {
    expect((await login(accounts.plain, { $ne: null } as any, '10.0.5.1')).status).toBe(400);
  });
});

describe('password reset', () => {
  it('never returns the reset token to the caller in test or staging-like environments', async () => {
    for (const env of ['test', 'staging', 'development']) {
      vi.stubEnv('NODE_ENV', env); clearPasswordResetThrottle();
      const r = await forgot(accounts.plain);
      expect(r.status).toBe(200);
      expect(r.body).not.toHaveProperty('devResetToken');
    }
  });
  it('exposes the token only with the explicit local-development opt-in', async () => {
    vi.stubEnv('NODE_ENV', 'development'); vi.stubEnv('TAXGUARD_DEV_EXPOSE_RESET_TOKEN', 'true');
    expect(typeof (await forgot(accounts.plain)).body.devResetToken).toBe('string');
  });
  it('throttles repeated requests per address with an identical neutral response', async () => {
    const responses = [];
    for (let i = 0; i < 5; i++) responses.push(await forgot(accounts.plain));
    expect(new Set(responses.map(r => JSON.stringify(r.body))).size).toBe(1);
    const tokens = Array.from(db.passwordResetTokens.values()).filter((r: any) => r.email === accounts.plain);
    expect(tokens).toHaveLength(3);
  });
  it('responds identically for unknown addresses (no enumeration)', async () => {
    expect((await forgot('nobody@example.invalid')).body).toEqual((await forgot(accounts.plain)).body);
  });
});
