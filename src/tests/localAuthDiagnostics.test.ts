import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { hashPassword } from '../server/auth';
import { authRouter, clearPasswordResetThrottle } from '../server/routes/auth.routes';
import { bootstrapSuperAdministrator, superAdminUserId } from '../server/superAdminBootstrap';
import { generateTotpSecret, removeTotpSecret } from '../server/totp';

/**
 * Opt-in local login diagnostics: distinguish account lookup failure, password mismatch,
 * lockout and acceptance on the server console without revealing secrets or changing the
 * uniform HTTP response. Synthetic credentials only.
 */
const EMAIL = 'diag-synthetic@example.invalid';
const PASSWORD = 'Synthetic-Diag-Passw0rd!';
const ACCENTED = 'Synthétic-Diag-Pässw0rd!';
const SA_ID = superAdminUserId(EMAIL);
let secret = '', storedHash = '';
let server: Server, origin: string;
let lines: string[] = [];

beforeAll(async () => {
  const app = express(); app.set('trust proxy', true); app.use(express.json()); app.use('/api/auth', authRouter);
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

const provision = (password: string) => {
  secret = generateTotpSecret(); storedHash = hashPassword(password);
  expect(bootstrapSuperAdministrator({ NODE_ENV: 'test', TAXGUARD_SUPER_ADMIN_EMAIL: EMAIL, TAXGUARD_SUPER_ADMIN_PASSWORD_HASH: storedHash,
    TAXGUARD_SUPER_ADMIN_TOTP_SECRET: secret, TAXGUARD_SUPER_ADMIN_TENANT_ID: 'tenant-diag' } as any).status).toBe('provisioned');
};
const login = async (email: string, password: string, ip = '10.6.0.1') => {
  const r = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify({ email, password }) });
  return { status: r.status, body: await r.json(), requestId: r.headers.get('x-taxguard-request-id') };
};
const diagnostics = () => lines.filter(l => l.startsWith('[auth-diagnostic] ')).map(l => JSON.parse(l.slice('[auth-diagnostic] '.length)));
const assertNoSecrets = () => {
  const out = lines.join('\n');
  for (const s of [PASSWORD, ACCENTED, storedHash, storedHash.split(':')[1], secret, EMAIL, 'diag-synthetic']) expect(out).not.toContain(s);
};

beforeEach(() => {
  vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('TAXGUARD_LOCAL_AUTH_DIAGNOSTICS', 'true'); clearPasswordResetThrottle();
  lines = []; vi.spyOn(console, 'info').mockImplementation((line: unknown) => { lines.push(String(line)); });
});
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllEnvs(); removeTotpSecret(SA_ID); db.users.delete(SA_ID); db.userPasswords.delete(EMAIL);
  for (const k of Array.from(db.loginAttempts.keys())) if (k.endsWith(EMAIL) || k.includes('nobody-diag')) db.loginAttempts.delete(k);
});

describe('reason categories', () => {
  it('a correct password reaches the authenticator step and is reported as accepted', async () => {
    provision(PASSWORD);
    expect((await login(EMAIL, PASSWORD)).body).toMatchObject({ mfaRequired: true });
    expect(diagnostics()).toHaveLength(1);
    expect(diagnostics()[0]).toMatchObject({ outcome: 'password_accepted', next: 'authenticator_code_required' });
    assertNoSecrets();
  });
  it('distinguishes an unknown account from a wrong password, while the HTTP responses stay identical', async () => {
    provision(PASSWORD);
    const unknown = await login('nobody-diag@example.invalid', PASSWORD);
    const wrong = await login(EMAIL, 'Wrong-Diag-Passw0rd!');
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body).toEqual(wrong.body);
    expect(diagnostics().map(d => d.reason)).toEqual(['account_not_found', 'password_mismatch']);
    assertNoSecrets();
  });
  it('flags autofill / pasted whitespace without revealing the password', async () => {
    provision(PASSWORD);
    await login(EMAIL, PASSWORD + ' ');
    expect(diagnostics()[0]).toMatchObject({ reason: 'password_mismatch', hints: { surroundingWhitespace: true, matchesWhenTrimmed: true } });
    assertNoSecrets();
  });
  it('flags a Unicode-normalization mismatch (decomposed accents)', async () => {
    provision(ACCENTED.normalize('NFC'));
    await login(EMAIL, ACCENTED.normalize('NFD'));
    expect(diagnostics()[0]).toMatchObject({ reason: 'password_mismatch', hints: { nonAscii: true, matchesUnicodeNormalized: true } });
    assertNoSecrets();
  });
  it('reports lockout separately', async () => {
    provision(PASSWORD);
    for (let i = 0; i < 5; i++) await login(EMAIL, 'Wrong-Diag-Passw0rd!', '10.6.9.9');
    lines = [];
    expect((await login(EMAIL, PASSWORD, '10.6.9.9')).status).toBe(429);
    expect(diagnostics()[0]).toMatchObject({ reason: 'source_ip_locked' });
  });
  it('reports a malformed request body', async () => {
    const r = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'x' });
    expect(r.status).toBe(400);
    expect(diagnostics()[0]).toMatchObject({ reason: 'missing_or_non_string_fields', contentType: 'text/plain' });
  });
});

describe('browser / server correlation', () => {
  it('returns a request ID header that appears in the matching server line, with a timestamp', async () => {
    provision(PASSWORD);
    const r = await login(EMAIL, 'Wrong-Diag-Passw0rd!');
    expect(r.requestId).toMatch(/^[0-9a-f]{12}$/);
    expect(diagnostics()[0]).toMatchObject({ requestId: r.requestId });
    expect(Number.isFinite(Date.parse(diagnostics()[0].at))).toBe(true);
  });
  it('reports whether the server still holds the hash from its environment file', async () => {
    provision(PASSWORD);
    vi.stubEnv('TAXGUARD_SUPER_ADMIN_PASSWORD_HASH', storedHash);
    await login(EMAIL, 'Wrong-Diag-Passw0rd!');
    vi.stubEnv('TAXGUARD_SUPER_ADMIN_PASSWORD_HASH', hashPassword('Another-Synthetic-1!'));
    await login(EMAIL, 'Wrong-Diag-Passw0rd!', '10.6.0.2');
    expect(diagnostics().map(d => d.serverHashMatchesEnvironmentFile)).toEqual([true, false]);
    assertNoSecrets();
  });
});

describe('opt-in and production safety', () => {
  it('prints nothing unless explicitly enabled', async () => {
    vi.stubEnv('TAXGUARD_LOCAL_AUTH_DIAGNOSTICS', '');
    provision(PASSWORD);
    await login(EMAIL, 'Wrong-Diag-Passw0rd!');
    expect(diagnostics()).toEqual([]);
    expect((await login(EMAIL, PASSWORD)).requestId).toBeNull();
  });
  it('does not change any decision: a wrong password is still refused and counted', async () => {
    provision(PASSWORD);
    expect((await login(EMAIL, PASSWORD + ' ')).body.code).toBe('INVALID_CREDENTIALS');
    expect(db.loginAttempts.get(`account_${EMAIL}`)?.count).toBe(1);
  });
});
