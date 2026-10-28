import { describe, expect, it, vi } from 'vitest';
import { createStaffInvitationApi } from '../services/staffInvitationApi';

const token = 'a'.repeat(64);
const details = { role: 'accountant', legalFirstName: 'Synthetic', legalLastName: 'Staff', expiresAt: '2099-01-01T00:00:00Z' };
function fixture() {
  const state = { confirmed: true, session: true, level: 'aal1', factors: [{ id: 'factor-1', status: 'verified' }], failChallenge: false };
  const user = () => ({ id: 'synthetic-staff', email: 'staff@example.test', email_confirmed_at: state.confirmed ? '2026-01-01' : null, identities: [{ id: 'synthetic' }] });
  const data = () => ({ user: user(), session: state.session ? { access_token: 'synthetic-provider-token' } : null });
  const auth = {
    signInWithPassword: vi.fn(async () => ({ data: data(), error: null })),
    signUp: vi.fn(async () => ({ data: data(), error: null })),
    getSession: vi.fn(async () => ({ data: { session: data().session }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: user() }, error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: state.level, nextLevel: 'aal2' }, error: null })),
      listFactors: vi.fn(async () => ({ data: { totp: state.factors }, error: null })),
      challengeAndVerify: vi.fn(async () => { if (!state.failChallenge) state.level = 'aal2'; return { error: state.failChallenge ? { message: 'private-provider-error' } : null }; }),
    },
  };
  const transport = vi.fn(async (url: string) => new Response(JSON.stringify(url.endsWith('/accept') ? { status: 'pending_approval', token: 'must-not-be-returned' } : details), { status: 200 }));
  return { api: createStaffInvitationApi({ auth } as any, transport as any), auth, state, transport };
}

describe('provider-only staff invitation identity setup', () => {
  it('signs in without creating a TaxGuard session', async () => {
    const { api, auth, transport } = fixture();
    expect(await api.authenticate('signin', ' Staff@Example.Test ', 'existing-password')).toEqual({ emailVerificationRequired: false });
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'staff@example.test', password: 'existing-password' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('signs up without client role metadata or client onboarding redirect', async () => {
    const { api, auth, transport } = fixture();
    await api.authenticate('signup', 'staff@example.test', 'Synthetic1!');
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'staff@example.test', password: 'Synthetic1!' });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each(['short', 'synthetic1!', 'SYNTHETIC1!', 'Synthetic!', 'Synthetic1'])('rejects weak new password %s before provider calls', async password => {
    const { api, auth } = fixture();
    await expect(api.authenticate('signup', 'staff@example.test', password)).rejects.toMatchObject({ code: 'validation' });
    expect(auth.signUp).not.toHaveBeenCalled();
  });
  it('requires valid email before provider calls', async () => {
    const { api, auth } = fixture();
    await expect(api.authenticate('signin', 'invalid', 'secret')).rejects.toMatchObject({ code: 'validation' });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });
  it.each(['unconfirmed-session', 'no-session'])('truthfully reports verification-required state %s', async scenario => {
    const { api, state } = fixture();
    if (scenario === 'no-session') state.session = false; else state.confirmed = false;
    expect(await api.authenticate('signup', 'staff@example.test', 'Synthetic1!')).toEqual({ emailVerificationRequired: true });
  });
  it('sanitizes rejected provider credentials', async () => {
    const { api, auth } = fixture();
    auth.signInWithPassword.mockRejectedValueOnce(new Error('private-provider-secret'));
    await expect(api.authenticate('signin', 'staff@example.test', 'password')).rejects.toMatchObject({ code: 'unavailable', message: 'Staff onboarding is unavailable in this environment. Contact your administrator.' });
  });
});

describe('staff invitation API boundary', () => {
  it('uses fixed POST route and body secrets with no URL token or application-session bridge', async () => {
    const { api, auth, transport } = fixture();
    expect(await api.lookup(token)).toEqual(details);
    expect(auth.getUser).toHaveBeenCalledWith('synthetic-provider-token');
    expect(transport).toHaveBeenCalledWith('/api/staff-access/invitation/lookup', {
      method: 'POST', credentials: 'omit', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, providerAccessToken: 'synthetic-provider-token' }),
    });
  });
  it('returns pending approval only and drops unexpected server session data', async () => {
    const { api, transport } = fixture();
    expect(await api.accept(token)).toEqual({ status: 'pending_approval' });
    expect(transport.mock.calls[0][0]).toBe('/api/staff-access/invitation/accept');
  });
  it.each(['not-confirmed', 'no-session'])('blocks lookup before transport for %s identity', async scenario => {
    const { api, state, transport } = fixture();
    if (scenario === 'no-session') state.session = false; else state.confirmed = false;
    await expect(api.lookup(token)).rejects.toMatchObject({ code: scenario === 'no-session' ? 'denied' : 'verification' });
    expect(transport).not.toHaveBeenCalled();
  });
  it('rejects malformed invitation before transport', async () => {
    const { api, transport } = fixture();
    await expect(api.lookup('invalid')).rejects.toMatchObject({ code: 'validation' });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([503, 403, 404, 429])('sanitizes HTTP %s without rendering raw provider or store errors', async status => {
    const { api, transport } = fixture();
    transport.mockImplementationOnce(async () => new Response(JSON.stringify({ message: 'private-secret' }), { status }));
    await expect(api.lookup(token)).rejects.toMatchObject({ code: status === 503 ? 'unavailable' : 'denied' });
  });
  it('sanitizes transport failures', async () => {
    const { api, transport } = fixture();
    transport.mockRejectedValueOnce(new Error('private-network-url'));
    await expect(api.lookup(token)).rejects.toMatchObject({ code: 'unavailable' });
  });
  it.each([{ ...details, expiresAt: '2000-01-01' }, { ...details, expiresAt: 'invalid' }, { role: 'admin' }])('rejects invalid authorized lookup output %j', async body => {
    const { api, transport } = fixture();
    transport.mockImplementationOnce(async () => new Response(JSON.stringify(body)));
    await expect(api.lookup(token)).rejects.toMatchObject({ code: 'denied' });
  });
  it('rejects active/session success masquerading as pending approval', async () => {
    const { api, transport } = fixture();
    transport.mockImplementationOnce(async () => new Response(JSON.stringify({ status: 'active', token: 'invalid-session' })));
    await expect(api.accept(token)).rejects.toMatchObject({ code: 'denied' });
  });
});

describe('invitation MFA orchestration', () => {
  it('requires enrollment when no verified factor exists', async () => {
    const { api, state } = fixture(); state.factors = [];
    expect(await api.mfaState()).toEqual({ kind: 'enroll' });
  });
  it('requires challenge for existing factor and verifies AAL2', async () => {
    const { api, auth } = fixture();
    expect(await api.mfaState()).toEqual({ kind: 'challenge', factorId: 'factor-1' });
    await api.challenge('factor-1', '123456');
    expect(auth.mfa.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' });
    expect(await api.mfaState()).toEqual({ kind: 'ready' });
  });
  it('never elevates local state following failed verification', async () => {
    const { api, state } = fixture(); state.failChallenge = true;
    await expect(api.challenge('factor-1', '123456')).rejects.toMatchObject({ code: 'denied' });
    expect(await api.mfaState()).toEqual({ kind: 'challenge', factorId: 'factor-1' });
  });
  it('validates challenge code before provider call', async () => {
    const { api, auth } = fixture();
    await expect(api.challenge('factor-1', '123')).rejects.toMatchObject({ code: 'validation' });
    expect(auth.mfa.challengeAndVerify).not.toHaveBeenCalled();
  });
  it('signs out provider only', async () => {
    const { api, auth, transport } = fixture(); await api.signOut();
    expect(auth.signOut).toHaveBeenCalledOnce(); expect(transport).not.toHaveBeenCalled();
  });
});

it('refuses default provider operations when development onboarding is not explicitly configured', async () => {
  const transport=vi.fn(); const api=createStaffInvitationApi(undefined,transport);
  await expect(api.authenticate('signup','staff@example.test','Synthetic1!')).rejects.toMatchObject({code:'unavailable'});
  await expect(api.lookup('a'.repeat(64))).rejects.toMatchObject({code:'unavailable'});
  await expect(api.mfaState()).rejects.toMatchObject({code:'unavailable'});
  await expect(api.challenge('factor','123456')).rejects.toMatchObject({code:'unavailable'});
  expect(transport).not.toHaveBeenCalled();
  await expect(api.signOut()).resolves.toBeUndefined();
});
