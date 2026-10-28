import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { createSession, hashPassword, PRIVILEGED_SESSION_ABSOLUTE_MS, PRIVILEGED_SESSION_IDLE_MS } from '../server/auth';
import { base32Decode, currentTotpStep, generateTotpCode, generateTotpSecret, removeTotpSecret, verifyTotp, registerTotpSecret } from '../server/totp';
import { bootstrapSuperAdministrator, superAdminUserId } from '../server/superAdminBootstrap';
import { authRouter, clearPasswordResetThrottle } from '../server/routes/auth.routes';
import { adminRouter } from '../server/routes/admin.routes';
import { superAdminRouter } from '../server/routes/superAdmin.routes';
import { accountantRouter } from '../server/routes/accountant.routes';
import { assignmentsRouter } from '../server/routes/assignments.routes';
import { caseAuthorityRouter } from '../server/routes/case-authority.routes';
import { GOVERNANCE_OPERATOR_ROLES } from '../server/ai/governance/governanceOperator';
import { DASHBOARD_DIRECTORY } from '../config/superAdminDashboards';

/**
 * Real local super administrator: environment bootstrap, password + TOTP login, server-side role,
 * session expiry / revocation, tenant scope, inspection audit, and no universal override.
 * Synthetic accounts and secrets generated per run; nothing is read from the developer's .env.
 */
let server: Server, origin: string;
beforeAll(async () => {
  const app = express(); app.set('trust proxy', true); app.use(express.json());
  app.use('/api/auth', authRouter); app.use('/api/admin', adminRouter); app.use('/api/super-admin', superAdminRouter);
  app.use('/api/accountant', accountantRouter); app.use('/api/assignments', assignmentsRouter); app.use('/api/case-authority', caseAuthorityRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const PASSWORD = 'Synthetic-SuperAdmin-Passw0rd!';
const EMAIL = 'sa-test@example.invalid';
const TENANT = 'tenant-sa';
let secret = '';
const SA_ID = superAdminUserId(EMAIL);
const env = (overrides: Record<string, string | undefined> = {}) => ({
  NODE_ENV: 'test', TAXGUARD_SUPER_ADMIN_EMAIL: EMAIL, TAXGUARD_SUPER_ADMIN_PASSWORD_HASH: hashPassword(PASSWORD),
  TAXGUARD_SUPER_ADMIN_TOTP_SECRET: secret, TAXGUARD_SUPER_ADMIN_TENANT_ID: TENANT, ...overrides,
}) as NodeJS.ProcessEnv;
const codeAt = (ms: number) => generateTotpCode(base32Decode(secret), currentTotpStep(ms));

const others = {
  admin: { id: 'sa-t-admin', email: 'sa-t-admin@example.invalid', name: 'Admin', role: 'admin', status: 'active', tenantId: TENANT },
  accountant: { id: 'sa-t-acct', email: 'sa-t-acct@example.invalid', name: 'Accountant', role: 'accountant', status: 'active', tenantId: TENANT },
  otherAdmin: { id: 'sa-o-admin', email: 'sa-o-admin@example.invalid', name: 'Other admin', role: 'admin', status: 'active', tenantId: 'tenant-other' },
  client: { id: 'sa-t-client', clientId: 'sa-t-client', email: 'sa-t-client@example.invalid', name: 'Client', role: 'client', status: 'active', tenantId: TENANT },
  otherClient: { id: 'sa-o-client', clientId: 'sa-o-client', email: 'sa-o-client@example.invalid', name: 'Other client', role: 'client', status: 'active', tenantId: 'tenant-other' },
};

async function call(method: string, path: string, token?: string, body?: unknown, ip = '10.9.0.1') {
  const r = await fetch(`${origin}${path}`, {
    method, headers: { 'content-type': 'application/json', 'x-forwarded-for': ip, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const login = (extra: Record<string, unknown> = {}, ip = '10.9.0.1') => call('POST', '/api/auth/login', undefined, { email: EMAIL, password: PASSWORD, ...extra }, ip);
const sessionsFor = (userId: string) => Array.from(db.sessions.values()).filter((s: any) => s.userId === userId).length;
const saToken = () => createSession(SA_ID, 'super_admin');

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test');
  clearPasswordResetThrottle();
  secret = generateTotpSecret();
  expect(bootstrapSuperAdministrator(env()).status).toBe('provisioned');
  for (const u of Object.values(others)) db.users.set(u.id, { ...u } as any);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  removeTotpSecret(SA_ID);
  for (const id of [SA_ID, ...Object.values(others).map(u => u.id)]) {
    db.users.delete(id);
    for (const [t, s] of Array.from(db.sessions.entries())) if ((s as any).userId === id) db.sessions.delete(t);
  }
  db.userPasswords.delete(EMAIL);
  for (const k of Array.from(db.loginAttempts.keys())) if (k.endsWith(EMAIL)) db.loginAttempts.delete(k);
  for (const [id, je] of Array.from(db.journalEntries.entries())) if (String((je as any).clientId).startsWith('sa-')) db.journalEntries.delete(id);
  for (const [id, rec] of Array.from(db.bankReconciliations.entries())) if (String((rec as any).clientId).startsWith('sa-')) db.bankReconciliations.delete(id);
});

describe('TOTP verifier (RFC 6238)', () => {
  it('matches the RFC 6238 SHA-1 test vector (T=59s)', () => {
    expect(generateTotpCode(Buffer.from('12345678901234567890'), 1)).toBe('287082');
  });
  it('accepts ±1 step, rejects further drift, and rejects replay of an accepted step', () => {
    const now = Date.now();
    expect(verifyTotp(SA_ID, codeAt(now - 30_000), now)).toBe('valid');
    expect(verifyTotp(SA_ID, codeAt(now - 30_000), now)).toBe('replayed');
    expect(verifyTotp(SA_ID, codeAt(now - 120_000), now)).toBe('invalid');
    expect(verifyTotp(SA_ID, '12345', now)).toBe('invalid');
    expect(verifyTotp('nobody', '123456', now)).toBe('not_enrolled');
  });
  it('refuses secrets shorter than 128 bits', () => {
    expect(() => registerTotpSecret('weak', 'JBSWY3DPEHPK3PXP')).toThrow();
  });
});

describe('environment bootstrap (no hard-coded credentials)', () => {
  it('does nothing when not configured and never runs in production', () => {
    expect(bootstrapSuperAdministrator({ NODE_ENV: 'test' } as any).status).toBe('not_configured');
    expect(bootstrapSuperAdministrator(env({ NODE_ENV: 'production' })).status).toBe('disabled_in_production');
  });
  it.each([
    ['a plaintext password', { TAXGUARD_SUPER_ADMIN_PASSWORD_HASH: PASSWORD }],
    ['no TOTP secret (MFA mandatory)', { TAXGUARD_SUPER_ADMIN_TOTP_SECRET: '' }],
    ['no tenant', { TAXGUARD_SUPER_ADMIN_TENANT_ID: '', TAXGUARD_TENANT_ID: '' }],
    ['an invalid e-mail', { TAXGUARD_SUPER_ADMIN_EMAIL: 'not-an-email' }],
  ])('rejects %s', (_label, overrides) => {
    expect(bootstrapSuperAdministrator(env(overrides)).status).toBe('rejected');
  });
  it('never elevates an existing account with another role', () => {
    const result = bootstrapSuperAdministrator(env({ TAXGUARD_SUPER_ADMIN_EMAIL: others.admin.email }));
    expect(result.status).toBe('rejected');
    expect(db.users.get(others.admin.id)!.role).toBe('admin');
  });
  it('provisions a tenant-scoped, MFA-required account and stores no secret on the user', () => {
    const user = db.users.get(SA_ID) as any;
    expect(user).toMatchObject({ role: 'super_admin', tenantId: TENANT, mfaEnabled: true, status: 'active' });
    expect(JSON.stringify(user)).not.toContain(secret);
    expect(db.auditLogs.some(l => l.action === 'SUPER_ADMIN_BOOTSTRAPPED' && l.userId === SA_ID)).toBe(true);
  });
});

describe('login: password + server-verified TOTP', () => {
  it('password alone issues no session', async () => {
    const r = await login();
    expect(r.body).toMatchObject({ mfaRequired: true });
    expect(r.body).not.toHaveProperty('token');
    expect(sessionsFor(SA_ID)).toBe(0);
  });
  it('a wrong code or wrong password issues no session', async () => {
    const wrong = codeAt(Date.now()) === '000000' ? '111111' : '000000';
    expect((await login({ mfaCode: wrong })).body.code).toBe('MFA_CODE_INVALID');
    expect((await call('POST', '/api/auth/login', undefined, { email: EMAIL, password: 'wrong', mfaCode: codeAt(Date.now()) })).status).toBe(401);
    expect(sessionsFor(SA_ID)).toBe(0);
  });
  it('a valid code signs in; the role comes from the server; the same code cannot be replayed', async () => {
    const code = codeAt(Date.now());
    const ok = await login({ mfaCode: code, role: 'client', tenantId: 'tenant-other' });
    expect(ok.status).toBe(200);
    expect(ok.body.user).toMatchObject({ role: 'super_admin', tenantId: TENANT });
    const me = await call('GET', '/api/auth/me', ok.body.token);
    expect(me.body.user).toMatchObject({ id: SA_ID, role: 'super_admin' });
    const replay = await login({ mfaCode: code });
    expect(replay.status).toBe(401);
    expect(replay.body.code).toBe('MFA_CODE_REPLAYED');
    expect(db.auditLogs.some(l => l.action === 'USER_LOGIN_SUCCESS' && l.userId === SA_ID)).toBe(true);
  });
  it('a super administrator without an enrolled authenticator cannot sign in even if the stored MFA flag is off', async () => {
    removeTotpSecret(SA_ID);
    (db.users.get(SA_ID) as any).mfaEnabled = false;
    expect((await login()).body).toMatchObject({ mfaRequired: true });
    expect((await login({ mfaCode: '123456' })).status).toBe(503);
    expect(sessionsFor(SA_ID)).toBe(0);
  });
  it('MFA failures count toward the lockout', async () => {
    for (let i = 0; i < 5; i++) await login({ mfaCode: 'abcdef' }, '10.9.9.9');
    expect((await login({ mfaCode: codeAt(Date.now()) }, '10.9.9.9')).status).toBe(429);
  });
});

describe('console API: authentication and authorization', () => {
  it('rejects unauthenticated requests', async () => {
    for (const path of ['/api/super-admin/session', '/api/super-admin/dashboards', '/api/admin/system-health']) {
      expect((await call('GET', path)).status).toBe(401);
    }
    expect((await call('POST', '/api/super-admin/dashboard-views', undefined, { dashboard: 'accountant' })).status).toBe(401);
  });
  it('rejects administrators and other roles (the console is super-administrator only)', async () => {
    for (const u of [others.admin, others.accountant, others.client]) {
      const token = createSession(u.id, u.role);
      expect((await call('GET', '/api/super-admin/session', token)).status).toBe(403);
      expect((await call('POST', '/api/super-admin/dashboard-views', token, { dashboard: 'accountant' })).status).toBe(403);
    }
  });
  it('returns the real session for a super administrator', async () => {
    const r = await call('GET', '/api/super-admin/session', saToken());
    expect(r.status).toBe(200);
    expect(r.body.user).toMatchObject({ id: SA_ID, role: 'super_admin', tenantId: TENANT });
    expect(r.body.secondFactor).toBe('totp');
    expect(r.body.session.idleTimeoutMinutes).toBe(30);
  });
  it('lists all ten dashboards plus the console', async () => {
    const r = await call('GET', '/api/super-admin/dashboards', saToken());
    expect(r.body.dashboards).toHaveLength(11);
    expect(DASHBOARD_DIRECTORY.slice(1).map(d => d.id)).toEqual(['client', 'accountant', 'reviewer', 'bookkeeper', 'practice_manager', 'client_service', 'billing', 'administrator', 'security_compliance', 'executive']);
  });
});

describe('dashboard view mode does not escalate permissions', () => {
  it('records each view in the audit log and rejects unknown dashboards', async () => {
    const token = saToken();
    expect((await call('POST', '/api/super-admin/dashboard-views', token, { dashboard: 'reviewer' })).status).toBe(201);
    expect(db.auditLogs.some(l => l.action === 'DASHBOARD_INSPECTION_VIEW' && l.userId === SA_ID && l.resource === 'Dashboard reviewer')).toBe(true);
    expect((await call('POST', '/api/super-admin/dashboard-views', token, { dashboard: '../admin' })).status).toBe(400);
  });
  it('the session role is unchanged after switching views, whatever the request body says', async () => {
    const token = saToken();
    await call('POST', '/api/super-admin/dashboard-views', token, { dashboard: 'accountant', role: 'accountant' });
    expect((await call('GET', '/api/auth/me', token)).body.user.role).toBe('super_admin');
    expect((db.sessions.get(token) as any).role).toBe('super_admin');
  });
  it('role-exclusive routes stay closed to the super administrator (no universal override)', async () => {
    const token = saToken();
    await call('POST', '/api/super-admin/dashboard-views', token, { dashboard: 'reviewer' });
    expect((await call('GET', '/api/case-authority/reviewer/dashboard', token)).status).toBe(403);
    expect((await call('POST', '/api/assignments/request-reassignment', token, { reason: 'synthetic' })).status).toBe(403);
  });
});

describe('maker-checker and regulated controls still bind the super administrator', () => {
  const lines = [{ accountNumber: '1000', accountName: 'Cash', debit: 10 }, { accountNumber: '4000', accountName: 'Revenue', credit: 10 }];
  it('cannot approve a journal entry it prepared', async () => {
    const token = saToken();
    const created = await call('POST', '/api/accountant/journal-entries', token, { clientId: 'sa-t-client', lines });
    expect(created.status).toBe(201);
    const review = await call('POST', `/api/accountant/journal-entries/${created.body.journalEntry.id}/review`, token, { action: 'approve' });
    expect(review.status).toBe(403);
    expect(db.journalEntries.get(created.body.journalEntry.id)!.status).toBe('prepared');
  });
  it('cannot edit an approved journal entry or a locked reconciliation period', async () => {
    db.journalEntries.set('sa-je-approved', { id: 'sa-je-approved', clientId: 'sa-t-client', engagementId: 'e', date: '2026-01-01', reference: 'R', memo: 'M', lines: [], status: 'approved', preparedBy: others.accountant.id } as any);
    expect((await call('POST', '/api/accountant/journal-entries', saToken(), { id: 'sa-je-approved', clientId: 'sa-t-client', lines })).status).toBe(403);
    db.bankReconciliations.set('sa-rec-locked', { id: 'sa-rec-locked', clientId: 'sa-t-client', isPeriodLocked: true, preparedBy: others.accountant.id } as any);
    const r = await call('POST', '/api/accountant/reconciliations', saToken(), { id: 'sa-rec-locked', clientId: 'sa-t-client', periodStart: '2026-01-01', periodEnd: '2026-01-31', statementEndingBalance: 1, clearedBookBalance: 1 });
    expect(r.status).toBe(400);
    expect((db.bankReconciliations.get('sa-rec-locked') as any).statementEndingBalance).toBeUndefined();
  });
  it('cannot sign off a reconciliation it prepared', async () => {
    db.bankReconciliations.set('sa-rec-own', { id: 'sa-rec-own', clientId: 'sa-t-client', isPeriodLocked: false, preparedBy: SA_ID, status: 'balanced', variance: 0 } as any);
    expect((await call('POST', '/api/accountant/reconciliations/sa-rec-own/sign-off', saToken(), {})).status).toBe(403);
  });
});

describe('tenant boundaries', () => {
  it('administrative lists are scoped to the super administrator\'s tenant', async () => {
    const r = await call('GET', '/api/admin/users', saToken());
    const ids = r.body.users.map((u: any) => u.id);
    expect(ids).toContain(others.admin.id);
    expect(ids).not.toContain(others.otherAdmin.id);
    expect(ids).not.toContain(others.otherClient.id);
  });
  it('cannot act on another tenant\'s client records', async () => {
    db.journalEntries.set('sa-je-other', { id: 'sa-je-other', clientId: 'sa-o-client', engagementId: 'e', date: '2026-01-01', reference: 'R', memo: 'M', lines: [], status: 'prepared', preparedBy: 'someone' } as any);
    expect((await call('POST', '/api/accountant/journal-entries/sa-je-other/review', saToken(), { action: 'approve' })).status).toBe(403);
    expect(db.journalEntries.get('sa-je-other')!.status).toBe('prepared');
  });
});

describe('session expiration and revocation', () => {
  it('privileged sessions use a 30-minute idle window', () => {
    const token = saToken();
    const s = db.sessions.get(token)!;
    expect(s.expiresAt - s.createdAt).toBe(PRIVILEGED_SESSION_IDLE_MS);
  });
  it('an idle-expired session is rejected', async () => {
    const token = saToken();
    db.sessions.get(token)!.expiresAt = Date.now() - 1;
    expect((await call('GET', '/api/super-admin/session', token)).body.code).toBe('SESSION_EXPIRED');
  });
  it('activity cannot extend a session past its absolute lifetime', async () => {
    const token = saToken();
    const s = db.sessions.get(token)!;
    s.createdAt = Date.now() - PRIVILEGED_SESSION_ABSOLUTE_MS - 1000;
    s.expiresAt = Date.now() + 60_000;
    expect((await call('GET', '/api/super-admin/session', token)).status).toBe(401);
  });
  it('logout revokes the session', async () => {
    const token = saToken();
    expect((await call('POST', '/api/auth/logout', token)).status).toBe(200);
    expect((await call('GET', '/api/super-admin/session', token)).status).toBe(401);
  });
  it('suspending the account ends its sessions on the next request', async () => {
    const token = saToken();
    (db.users.get(SA_ID) as any).status = 'suspended';
    expect((await call('GET', '/api/super-admin/session', token)).status).toBe(403);
    expect(db.sessions.has(token)).toBe(false);
  });
});

describe('seed credentials and governance', () => {
  it('seeded accounts get no default password when SEED_* variables are absent', async () => {
    vi.stubEnv('SEED_CLIENT_PASSWORD', ''); vi.stubEnv('SEED_STAFF_PASSWORD', '');
    const { initSeedPasswords } = await import('../server/auth');
    const before = new Map(db.userPasswords);
    for (const email of ['admin@artaxservices.com', 'security@artaxservices.com', 'dhinds@artaxservices.com', 'm.perotti@example.com']) db.userPasswords.delete(email);
    initSeedPasswords();
    for (const email of ['admin@artaxservices.com', 'security@artaxservices.com', 'dhinds@artaxservices.com', 'm.perotti@example.com']) expect(db.userPasswords.has(email)).toBe(false);
    for (const [k, v] of before) db.userPasswords.set(k, v);
  });
  it('the seeded super administrator never receives a staff seed password', async () => {
    vi.stubEnv('SEED_STAFF_PASSWORD', 'Synthetic-Seed-Passw0rd!');
    const { initSeedPasswords } = await import('../server/auth');
    const before = db.userPasswords.get('security@artaxservices.com');
    db.userPasswords.delete('security@artaxservices.com');
    initSeedPasswords();
    expect(db.userPasswords.has('security@artaxservices.com')).toBe(false);
    if (before) db.userPasswords.set('security@artaxservices.com', before);
  });
  it('super_admin is a governance operator (administrator superset)', () => {
    expect(GOVERNANCE_OPERATOR_ROLES).toContain('super_admin');
  });
});
