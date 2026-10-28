import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Browser-side Supabase MFA step used by staff sign-in (mocked Supabase client; synthetic values). */
const mfa = vi.hoisted(() => ({
  aal: { currentLevel: 'aal1', nextLevel: 'aal2' } as any,
  factors: [{ id: 'synthetic-factor', status: 'verified' }] as any[],
  verifyError: null as any,
  session: { access_token: 'synthetic.aal2.token' } as any,
  verifyCalls: [] as any[],
}));
vi.mock('../supabase/config', () => ({
  isSupabaseConfigured: () => true,
  supabase: { auth: {
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({ data: mfa.aal, error: null }),
      listFactors: async () => ({ data: { totp: mfa.factors } }),
      challengeAndVerify: async (args: any) => { mfa.verifyCalls.push(args); return { error: mfa.verifyError }; },
    },
    getSession: async () => ({ data: { session: mfa.session } }),
  } },
}));
import { supabaseMfaStatus, verifySupabaseMfa } from '../supabase/auth';

beforeEach(() => {
  mfa.aal = { currentLevel: 'aal1', nextLevel: 'aal2' };
  mfa.factors = [{ id: 'synthetic-factor', status: 'verified' }];
  mfa.verifyError = null; mfa.session = { access_token: 'synthetic.aal2.token' }; mfa.verifyCalls = [];
});

describe('Supabase MFA step for staff sign-in', () => {
  it('requires a challenge when an enrolled factor exists and the session is AAL1', async () => {
    expect(await supabaseMfaStatus()).toEqual({ needsChallenge: true, factorId: 'synthetic-factor' });
  });
  it('needs no challenge when already AAL2 or when no factor is enrolled', async () => {
    mfa.aal = { currentLevel: 'aal2', nextLevel: 'aal2' };
    expect((await supabaseMfaStatus()).needsChallenge).toBe(false);
    mfa.aal = { currentLevel: 'aal1', nextLevel: 'aal1' };
    expect((await supabaseMfaStatus()).needsChallenge).toBe(false);
  });
  it('verifies the code against the enrolled factor and returns the upgraded session token', async () => {
    expect(await verifySupabaseMfa('123456')).toEqual({ success: true, accessToken: 'synthetic.aal2.token' });
    expect(mfa.verifyCalls).toEqual([{ factorId: 'synthetic-factor', code: '123456' }]);
  });
  it('rejects malformed and wrong codes without returning a token', async () => {
    expect((await verifySupabaseMfa('12345')).success).toBe(false);
    expect(mfa.verifyCalls).toHaveLength(0);
    mfa.verifyError = { message: 'invalid' };
    expect(await verifySupabaseMfa('000000')).toEqual({ success: false, error: 'Invalid authenticator code.' });
  });
});
