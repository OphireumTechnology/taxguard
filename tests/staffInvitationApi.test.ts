import { describe, expect, it, vi } from 'vitest';
vi.mock('../src/supabase/config', () => ({ supabase: {}, isStaffIdentityDevelopmentConfigured: () => false }));
import { createStaffInvitationApi } from '../src/services/staffInvitationApi';

const invitation = 'a'.repeat(64);
function fixture() {
  const auth = {
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'synthetic-provider-token' } }, error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'synthetic', email_confirmed_at: '2026-01-01' } }, error: null }),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null }),
      listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
      challengeAndVerify: vi.fn().mockResolvedValue({ error: null }),
    },
    signInWithPassword: vi.fn(), signUp: vi.fn(), signOut: vi.fn().mockResolvedValue({ error: null }),
  };
  const transport = vi.fn();
  const api = createStaffInvitationApi({ auth } as any, transport);
  return { auth, transport, api };
}
describe('staff invitation provider verification', () => {
  it('keeps the existing environment gate closed', async () => {
    await expect(createStaffInvitationApi().mfaState()).rejects.toMatchObject({ code: 'unavailable' });
  });
  it('does not report MFA ready without a verified provider factor', async () => {
    const { api, auth } = fixture();
    await expect(api.mfaState()).resolves.toEqual({ kind: 'enroll' });
    auth.mfa.listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor', status: 'verified' }] }, error: null } as any);
    await expect(api.mfaState()).resolves.toEqual({ kind: 'challenge', factorId: 'factor' });
    auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null });
    await expect(api.mfaState()).resolves.toEqual({ kind: 'ready' });
  });
  it('requires verified email before disclosing invitation details', async () => {
    const { api, auth, transport } = fixture();
    auth.getUser.mockResolvedValue({ data: { user: { id: 'synthetic', email_confirmed_at: null } }, error: null } as any);
    await expect(api.lookup(invitation)).rejects.toMatchObject({ code: 'verification' }); expect(transport).not.toHaveBeenCalled();
  });
  it('requires server acceptance into pending approval', async () => {
    const { api, transport } = fixture();
    transport.mockResolvedValueOnce(Response.json({ success: true })).mockResolvedValueOnce(Response.json({ status: 'pending_approval' }));
    await expect(api.accept(invitation)).rejects.toMatchObject({ code: 'denied' });
    await expect(api.accept(invitation)).resolves.toEqual({ status: 'pending_approval' });
    expect(transport).toHaveBeenLastCalledWith('/api/staff-access/invitation/accept', expect.objectContaining({ credentials: 'omit', body: JSON.stringify({ token: invitation, providerAccessToken: 'synthetic-provider-token' }) }));
  });
  it('rejects invalid codes and unconfirmed MFA challenges', async () => {
    const { api, transport } = fixture();
    await expect(api.lookup('invalid')).rejects.toMatchObject({ code: 'validation' }); expect(transport).not.toHaveBeenCalled();
    await expect(api.challenge('factor', '123456')).rejects.toMatchObject({ code: 'denied' });
  });
  it('rejects weak registration credentials before calling the provider', async () => {
    const { api, auth } = fixture();
    await expect(api.authenticate('signup', 'test@example.test', 'weak')).rejects.toMatchObject({ code: 'validation' }); expect(auth.signUp).not.toHaveBeenCalled();
  });
});
