import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { authRouter, clearPasswordResetThrottle } from '../server/routes/auth.routes';
import { bootstrapSuperAdministrator, superAdminUserId } from '../server/superAdminBootstrap';
import { generateTotpSecret, removeTotpSecret } from '../server/totp';
import { createHiddenInputParser, passwordProblems } from '../../scripts/lib/hiddenInput.mjs';
import { diagnosePassword, hashPassword, replaceHashLine } from '../../scripts/super-admin-password.mjs';
import { mapLocalLoginError } from '../context/localLoginErrors';

/**
 * Regression: the provisioning prompt read raw-mode input per chunk, so a paste or fast typing
 * could store Enter / newline / backspace characters inside the password hash. The browser
 * login can never send those characters, so sign-in failed with "Invalid email or password".
 * Synthetic credentials only.
 */
const PASSWORD = 'Synthetic-Local-Passw0rd!';
const EMAIL = 'input-regression@example.invalid';
const SA_ID = superAdminUserId(EMAIL);

const parse = (chunks: string[]) => {
  const parser = createHiddenInputParser();
  let state = 'reading';
  for (const chunk of chunks) { state = parser.feed(chunk); if (state !== 'reading') break; }
  return { state, value: parser.value };
};

describe('hidden password input parser', () => {
  it.each([
    ['typed one character at a time', [...PASSWORD, '\r']],
    ['pasted, then Enter', [PASSWORD, '\r']],
    ['pasted with a trailing CRLF (previously stored "\\r\\n")', [PASSWORD + '\r\n']],
    ['fast typing with Enter in the same chunk (previously stored "\\r")', [PASSWORD.slice(0, -3), PASSWORD.slice(-3) + '\r']],
    ['LF only', [PASSWORD + '\n']],
    ['bracketed-paste markers', ['\u001b[200~' + PASSWORD + '\u001b[201~', '\r']],
    ['arrow keys while typing', [PASSWORD.slice(0, 5), '\u001b[D', '\u001b[C', '\u001bOA', PASSWORD.slice(5), '\r']],
    ['backspace inside a chunk (previously stored "\\b")', [PASSWORD + 'X\b', '\r']],
    ['DEL as backspace', [PASSWORD + 'Y\u007f\r']],
    ['stray control characters', [PASSWORD.slice(0, 4) + '\u0001\u0007' + PASSWORD.slice(4) + '\r']],
  ])('%s yields exactly the typed password', (_label, chunks) => {
    expect(parse(chunks as string[])).toEqual({ state: 'done', value: PASSWORD });
  });
  it('ignores the LF half of a CRLF split across prompts', () => {
    expect(parse(['\n', PASSWORD, '\r'])).toEqual({ state: 'done', value: PASSWORD });
  });
  it('discards anything after Enter in the same chunk', () => {
    expect(parse([PASSWORD + '\rextra'])).toEqual({ state: 'done', value: PASSWORD });
  });
  it('Ctrl+C cancels', () => {
    expect(parse([PASSWORD.slice(0, 4) + '\u0003']).state).toBe('cancelled');
  });
  it('keeps non-ASCII characters and removes them whole on backspace', () => {
    expect(parse(['Pässwörd€\b€\r']).value).toBe('Pässwörd€');
  });
  it('the password policy rejects control characters', () => {
    expect(passwordProblems(PASSWORD + '\r', EMAIL)).toContain('no control characters');
    expect(passwordProblems(PASSWORD, EMAIL)).toEqual([]);
  });
});

describe('offline password check and reset tool', () => {
  it('detects a hash that was created with a captured newline', () => {
    expect(diagnosePassword(PASSWORD, hashPassword(PASSWORD))).toBe('match');
    expect(diagnosePassword(PASSWORD, hashPassword(PASSWORD + '\r'))).toBe('legacy_newline');
    expect(diagnosePassword(PASSWORD, hashPassword(PASSWORD + '\r\n'))).toBe('legacy_newline');
    expect(diagnosePassword('Different-Passw0rd!', hashPassword(PASSWORD))).toBe('no_match');
  });
  it.each(['\n', '\r\n'])('reset replaces only the hash line and keeps line endings (%j)', eol => {
    const before = ['# local', `TAXGUARD_SUPER_ADMIN_EMAIL=${EMAIL}`, 'TAXGUARD_SUPER_ADMIN_PASSWORD_HASH=' + 'a'.repeat(32) + ':' + 'b'.repeat(128),
      'TAXGUARD_SUPER_ADMIN_TOTP_SECRET=SYNTHETICSECRET', 'TAXGUARD_SUPER_ADMIN_TENANT_ID=tenant-x', 'TAXGUARD_SUPER_ADMIN_NAME="Synthetic"', ''].join(eol);
    const after = replaceHashLine(before, 'c'.repeat(32) + ':' + 'd'.repeat(128));
    const a = before.split(eol), b = after.split(eol);
    expect(b).toHaveLength(a.length);
    expect(b.filter((line, i) => line !== a[i])).toEqual(['TAXGUARD_SUPER_ADMIN_PASSWORD_HASH=' + 'c'.repeat(32) + ':' + 'd'.repeat(128)]);
  });
  it('reset refuses a file without exactly one hash line', () => {
    expect(() => replaceHashLine('TAXGUARD_SUPER_ADMIN_EMAIL=x\n', 'h')).toThrow();
  });
});

describe('server login with the provisioned hash (end to end, synthetic)', () => {
  let server: Server, origin: string;
  beforeAll(async () => {
    const app = express(); app.set('trust proxy', true); app.use(express.json()); app.use('/api/auth', authRouter);
    server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  beforeEach(() => { vi.stubEnv('NODE_ENV', 'test'); clearPasswordResetThrottle(); });
  afterEach(() => {
    vi.unstubAllEnvs(); removeTotpSecret(SA_ID); db.users.delete(SA_ID); db.userPasswords.delete(EMAIL);
    for (const k of Array.from(db.loginAttempts.keys())) if (k.endsWith(EMAIL)) db.loginAttempts.delete(k);
  });
  const provision = (storedHash: string) => expect(bootstrapSuperAdministrator({
    NODE_ENV: 'test', TAXGUARD_SUPER_ADMIN_EMAIL: EMAIL, TAXGUARD_SUPER_ADMIN_PASSWORD_HASH: storedHash,
    TAXGUARD_SUPER_ADMIN_TOTP_SECRET: generateTotpSecret(), TAXGUARD_SUPER_ADMIN_TENANT_ID: 'tenant-input',
  } as any).status).toBe('provisioned');
  const login = async (email: string) => {
    const r = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.7.0.1' }, body: JSON.stringify({ email, password: PASSWORD }) });
    return { status: r.status, body: await r.json() };
  };

  it('reproduces the original failure: a hash containing a captured CR rejects the typed password', async () => {
    provision(hashPassword(PASSWORD + '\r'));
    expect((await login(EMAIL)).body.code).toBe('INVALID_CREDENTIALS');
  });
  it('a hash from the fixed prompt (pasted with CRLF) reaches the authenticator-code step', async () => {
    provision(hashPassword(parse([PASSWORD + '\r\n']).value));
    const r = await login(EMAIL);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ mfaRequired: true });
    expect(r.body).not.toHaveProperty('token');
  });
  it('e-mail matching is case- and whitespace-insensitive in the browser path', async () => {
    provision(hashPassword(PASSWORD));
    expect((await login('  Input-Regression@Example.Invalid '.trim().toLowerCase())).body).toMatchObject({ mfaRequired: true });
  });
});

describe('sign-in page error mapping', () => {
  it('only INVALID_CREDENTIALS is reported as a wrong e-mail or password', () => {
    expect(mapLocalLoginError({ status: 401, code: 'INVALID_CREDENTIALS', message: 'x' }).error).toBe('Invalid email or password.');
    for (const err of [{ status: 500 }, { status: 400, code: 'BAD_REQUEST' }, { status: 503, code: 'AUTH_UNAVAILABLE' }, {}]) {
      expect(mapLocalLoginError(err).error).not.toBe('Invalid email or password.');
    }
  });
  it('keeps lockout, disabled-account and MFA outcomes distinct', () => {
    expect(mapLocalLoginError({ status: 429, message: 'Too many failed login attempts.' }).error).toContain('Too many');
    expect(mapLocalLoginError({ status: 401, code: 'MFA_CODE_INVALID', message: 'Invalid authenticator code.' })).toMatchObject({ mfaRequired: true });
    expect(mapLocalLoginError(undefined).error).toContain('could not be reached');
  });
});
