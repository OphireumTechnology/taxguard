import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifiedPrimaryAuthTime } from '../server/verifiedPrimaryAuthTime';
import { verifySupabaseAccessToken } from '../server/supabase';
const NOW = 1_800_000_000_000;
const SECOND = NOW / 1000;
const token = (claims: unknown) => Buffer.from(JSON.stringify({ alg: 'TEST', typ: 'JWT' })).toString('base64url') + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.synthetic-signature';
const primaryToken = (timestamp: unknown, method = 'password') => token({ amr: [{ method, timestamp }], aal: 'aal2', iat: SECOND });
afterEach(() => { vi.restoreAllMocks(); });
describe('primary authentication proof in an already verified token', () => {
  it.each(['password', 'oauth', 'otp', 'sso', 'magiclink'])('accepts explicit primary method %s', method => {
    expect(verifiedPrimaryAuthTime(primaryToken(SECOND - 120, method), NOW)).toBe(SECOND - 120);
  });
  it('uses newest primary evidence and excludes newer MFA or refresh evidence', () => {
    expect(verifiedPrimaryAuthTime(token({ amr: [
      { method: 'password', timestamp: SECOND - 3600 }, { method: 'oauth', timestamp: SECOND - 120 },
      { method: 'totp', timestamp: SECOND }, { method: 'token_refresh', timestamp: SECOND }
    ] }), NOW)).toBe(SECOND - 120);
  });
  it.each(['totp', 'recovery', 'invite', 'email', 'signup', 'token_refresh', 'anonymous', 'PASSWORD', 'unknown'])('refuses %s as primary evidence', method => {
    expect(verifiedPrimaryAuthTime(primaryToken(SECOND - 120, method), NOW)).toBeUndefined();
  });
  it.each([{}, { iat: SECOND }, { amr: null }, { amr: [] }, { amr: {} }, { amr: 'password' }])('does not infer proof from absent/malformed AMR %j', claims => {
    expect(verifiedPrimaryAuthTime(token(claims), NOW)).toBeUndefined();
  });
  it.each([null, undefined, '1799999880', 0, -1, SECOND - 0.5, SECOND + 31, Number.MAX_SAFE_INTEGER])('refuses invalid timestamp %j', timestamp => {
    expect(verifiedPrimaryAuthTime(primaryToken(timestamp), NOW)).toBeUndefined();
  });
  it('permits only bounded 30 second provider clock skew', () => {
    expect(verifiedPrimaryAuthTime(primaryToken(SECOND + 30), NOW)).toBe(SECOND + 30);
    expect(verifiedPrimaryAuthTime(primaryToken(SECOND + 31), NOW)).toBeUndefined();
  });
  it.each([null, [], 'password', { timestamp: SECOND }, { method: 42, timestamp: SECOND }, { method: 'password' }])('fails closed if any AMR entry is malformed %j', entry => {
    expect(verifiedPrimaryAuthTime(token({ amr: [{ method: 'password', timestamp: SECOND - 10 }, entry] }), NOW)).toBeUndefined();
  });
  it('rejects malformed and oversized payloads and unbounded claims', () => {
    for (const value of ['', 'broken', 'a.@@@.b', 'a.' + Buffer.from('{bad').toString('base64url') + '.b', 'a.' + 'a'.repeat(32769) + '.b']) {
      expect(verifiedPrimaryAuthTime(value, NOW)).toBeUndefined();
    }
    expect(verifiedPrimaryAuthTime(token({ amr: Array.from({ length: 33 }, () => ({ method: 'password', timestamp: SECOND })) }), NOW)).toBeUndefined();
  });
});
describe('Supabase verified identity primary proof', () => {
  const user = (lastSignIn = SECOND) => ({ id: 'synthetic-user', email: 'staff@example.test', email_confirmed_at: new Date(NOW).toISOString(), last_sign_in_at: new Date(lastSignIn * 1000).toISOString(), factors: [{ status: 'verified' }] });
  it('does not let an old access token inherit a later account-wide sign-in timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const oldToken = primaryToken(SECOND - 3600);
    const getUser = vi.fn(async () => ({ data: { user: user(SECOND) }, error: null }));
    const verified = await verifySupabaseAccessToken(oldToken, { auth: { getUser } } as any);
    expect(verified.primaryAuthTime).toBe(SECOND - 3600);
    expect(verified.authTime).toBe(SECOND); // Legacy field remains compatible; epoch must use primaryAuthTime.
    expect(verified.aal).toBe('aal2');
    expect(getUser).toHaveBeenCalledWith(oldToken);
  });
  it('never falls back to mutable sign-in time or current time for missing primary proof', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
    const getUser = vi.fn(async () => ({ data: { user: { ...user(), last_sign_in_at: undefined } }, error: null }));
    const verified = await verifySupabaseAccessToken(token({ iat: SECOND, aal: 'aal2', amr: [{ method: 'totp', timestamp: SECOND }] }), { auth: { getUser } } as any);
    expect(verified.primaryAuthTime).toBeUndefined();
    expect(verified.authTime).toBe(SECOND);
  });
  it('does not decode or accept AMR when provider verification fails', async () => {
    const getUser = vi.fn(async () => ({ data: { user: null }, error: { message: 'Synthetic invalid token' } }));
    await expect(verifySupabaseAccessToken(primaryToken(SECOND), { auth: { getUser } } as any)).rejects.toThrow('INVALID_SUPABASE_TOKEN');
  });
});
