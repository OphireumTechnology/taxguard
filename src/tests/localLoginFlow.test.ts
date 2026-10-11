import { describe, expect, it, vi } from 'vitest';
import { attemptLocalServerLogin, checkLocalLoginAvailable, LOCAL_SERVER_UNREACHABLE } from '../context/localServerLogin';
import { mapLocalLoginError } from '../context/localLoginErrors';
import { hashPassword as serverHash, verifyPassword } from '../server/auth';
import { hashPassword as offlineHash, hashMatches } from '../../scripts/super-admin-password.mjs';

/**
 * Local staff sign-in decision logic. Regressions covered:
 * - an unreachable local server previously fell through to the Supabase branch (no request to
 *   /api/auth/login, misleading message);
 * - every outcome must say what happened to *this* attempt.
 * Synthetic values only.
 */
const user = { id: 'u-synthetic', role: 'super_admin' };
const deps = (over: Partial<Parameters<typeof attemptLocalServerLogin>[0]> = {}) => ({
  checkAvailable: vi.fn(async () => true),
  login: vi.fn(async () => ({ mfaRequired: true })),
  ...over,
}) as any;

describe('attemptLocalServerLogin', () => {
  it('reports an unreachable local server and sends nothing (no Supabase fallback)', async () => {
    for (const checkAvailable of [vi.fn(async () => false), vi.fn(async () => { throw new TypeError('Failed to fetch'); })]) {
      const d = deps({ checkAvailable });
      const out = await attemptLocalServerLogin(d, 'a@example.invalid', 'Synthetic-1!');
      expect(out).toEqual({ kind: 'failed', result: { success: false, error: LOCAL_SERVER_UNREACHABLE } });
      expect(d.login).not.toHaveBeenCalled();
    }
  });
  it('sends exactly email, password and (when present) the code', async () => {
    const d = deps();
    await attemptLocalServerLogin(d, 'a@example.invalid', '  Synthetic pass with spaces  ');
    expect(d.login).toHaveBeenCalledWith('a@example.invalid', '  Synthetic pass with spaces  ', undefined);
    await attemptLocalServerLogin(d, 'a@example.invalid', 'Synthetic-1!', '123456');
    expect(d.login).toHaveBeenLastCalledWith('a@example.invalid', 'Synthetic-1!', '123456');
    await attemptLocalServerLogin(d, 'a@example.invalid', 'Synthetic-1!', '');
    expect(d.login).toHaveBeenLastCalledWith('a@example.invalid', 'Synthetic-1!', undefined);
  });
  it('a correct password leads to the authenticator step, never to a session', async () => {
    const out = await attemptLocalServerLogin(deps(), 'a@example.invalid', 'Synthetic-1!');
    expect(out).toMatchObject({ kind: 'mfa_required', result: { mfaRequired: true } });
  });
  it('only a token and a user establish success', async () => {
    expect(await attemptLocalServerLogin(deps({ login: vi.fn(async () => ({ token: 't', user })) }), 'a', 'b')).toEqual({ kind: 'success', token: 't', user });
    const odd = await attemptLocalServerLogin(deps({ login: vi.fn(async () => ({ token: 't' })) }), 'a', 'b');
    expect(odd.kind).toBe('failed');
    expect((odd as any).result.error).not.toBe('Invalid email or password.');
  });
  it('maps server refusals by code and keeps the correlation reference', async () => {
    const refused = Object.assign(new Error('x'), { status: 401, code: 'INVALID_CREDENTIALS', requestId: 'abcdef123456' });
    const out = await attemptLocalServerLogin(deps({ login: vi.fn(async () => { throw refused; }) }), 'a', 'b');
    expect(out).toEqual({ kind: 'failed', result: { success: false, code: 'INVALID_CREDENTIALS', error: 'Invalid email or password.', reference: 'abcdef123456' } });
  });
  it('a wrong authenticator code keeps the user on the code step', async () => {
    const wrongCode = Object.assign(new Error('Invalid authenticator code.'), { status: 401, code: 'MFA_CODE_INVALID' });
    const out = await attemptLocalServerLogin(deps({ login: vi.fn(async () => { throw wrongCode; }) }), 'a', 'b', '000000');
    expect(out).toMatchObject({ kind: 'failed', result: { mfaRequired: true } });
  });
});

describe('checkLocalLoginAvailable', () => {
  const respond = (ok: boolean, body: unknown) => vi.fn(async () => ({ ok, json: async () => body })) as any;
  it('is true only when the server says the local login is available', async () => {
    expect(await checkLocalLoginAvailable(respond(true, { localLoginAvailable: true }))).toBe(true);
    expect(await checkLocalLoginAvailable(respond(true, { localLoginAvailable: false }))).toBe(false);
    expect(await checkLocalLoginAvailable(respond(false, null))).toBe(false);
    expect(await checkLocalLoginAvailable(respond(true, 'not json'))).toBe(false);
  });
  it('asks the same-origin status endpoint without caching', async () => {
    const f = respond(true, { localLoginAvailable: true });
    await checkLocalLoginAvailable(f);
    expect(f).toHaveBeenCalledWith('/api/auth/local-login-status', { cache: 'no-store' });
  });
});

describe('error references', () => {
  it('are attached only when the server supplied one', () => {
    expect(mapLocalLoginError({ status: 401, code: 'INVALID_CREDENTIALS' })).not.toHaveProperty('reference');
    expect(mapLocalLoginError({ status: 429, message: 'Too many failed login attempts.', requestId: 'r1' })).toMatchObject({ reference: 'r1' });
  });
});

describe('offline utility and server use compatible password hashing', () => {
  it.each(['Synthetic-Compat-Passw0rd!', 'Synthétic-Ünïcode-Pässw0rd!', 'Synthetic pass with inner spaces 1!'])('%s', password => {
    expect(verifyPassword(password, offlineHash(password))).toBe(true);
    expect(hashMatches(password, serverHash(password))).toBe(true);
    expect(verifyPassword(password + 'x', offlineHash(password))).toBe(false);
    expect(hashMatches(password.toUpperCase(), serverHash(password))).toBe(false);
  });
});
