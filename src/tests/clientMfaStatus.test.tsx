import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { beginClientTotpEnrollment, cancelClientTotpEnrollment, clientMfaErrorText, confirmClientTotpEnrollment, readClientMfaStatus } from '../supabase/clientMfa';
import { ClientMfaStatusBody, ClientTotpEnrollment } from '../components/portal/views/ClientMfaPanel';
import { clientMfaDenial, staffMfaDenial } from '../server/staffMfa';

// Contract C2: the client's MFA status and enrolment go through the identity provider only (injected
// synthetic provider). No factor secret is stored and no other credential store is used.
const provider = (over: { session?: unknown; aal?: unknown; factors?: unknown; aalError?: unknown } = {}) => {
  const p = { auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: 'session' in over ? over.session : { access_token: 'synthetic' } }, error: null }),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: over.aal ?? { currentLevel: 'aal1', nextLevel: 'aal1' }, error: over.aalError ?? null }),
      listFactors: vi.fn().mockResolvedValue({ data: over.factors ?? { all: [], totp: [] }, error: null }),
      enroll: vi.fn(), challenge: vi.fn(), verify: vi.fn(), challengeAndVerify: vi.fn(), unenroll: vi.fn().mockResolvedValue({ data: {}, error: null }),
    } } };
  return p as any;
};
const read = (p: any, configured = true) => readClientMfaStatus({ provider: p, configured: () => configured });

describe('client MFA status (C2)', () => {
  it('reports the provider assurance level and factor counts for this session', async () => {
    const p = provider({ aal: { currentLevel: 'aal2' }, factors: { all: [{ status: 'verified' }, { status: 'unverified' }] } });
    expect(await read(p)).toEqual({ state: 'READY', currentLevel: 'aal2', verifiedFactors: 1, pendingFactors: 1 });
    for (const m of ['enroll', 'challenge', 'verify', 'challengeAndVerify', 'unenroll']) expect(p.auth.mfa[m], m).not.toHaveBeenCalled();
  });
  it('is unavailable without a configured provider or a provider session, and fails closed on errors', async () => {
    const p = provider();
    expect(await read(p, false)).toEqual({ state: 'UNAVAILABLE' });
    expect(p.auth.getSession).not.toHaveBeenCalled();
    expect(await read(provider({ session: null }))).toEqual({ state: 'NO_PROVIDER_SESSION' });
    expect(await read(provider({ aalError: { message: 'synthetic' } }))).toEqual({ state: 'ERROR' });
    const throwing = provider(); throwing.auth.mfa.listFactors.mockRejectedValue(new Error('network'));
    expect(await read(throwing)).toEqual({ state: 'ERROR' });
  });
  it('keeps enrolment blocked where it is not enabled and explains why', () => {
    const out = renderToStaticMarkup(<ClientMfaStatusBody status={{ state: 'READY', currentLevel: 'aal1', verifiedFactors: 0, pendingFactors: 0 }} user={null} />);
    expect(out).toContain('This sign-in used a password only');
    expect(out).toContain('Adding an authenticator is not available yet.');
    expect(out).toContain('Your practice enables it once its client security policy is approved');
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Add authenticator \(unavailable\)/);
    expect(out).not.toMatch(/<input|qr|secret/i);
  });
  it('never claims protection it cannot confirm', () => {
    for (const status of [{ state: 'UNAVAILABLE' }, { state: 'NO_PROVIDER_SESSION' }, { state: 'ERROR' }] as const) {
      const out = renderToStaticMarkup(<ClientMfaStatusBody status={status} user={{ mfaEnabled: true } as any} />);
      expect(out, status.state).not.toMatch(/used an authenticator|Verified authenticators|protects your account/);
      expect(out).toContain('Profile record: Recorded as enabled');
    }
  });
});

const UUID = '11111111-2222-4333-8444-555555555555';
const enrolProvider = (factors: Array<{ id: string; status: string }> = [], over: { level?: string; verify?: unknown } = {}) => {
  const p = provider({ factors: { all: factors.map(f => ({ factor_type: 'totp', ...f })), totp: [] }, aal: { currentLevel: over.level ?? 'aal2' } });
  p.auth.mfa.enroll.mockResolvedValue({ data: { id: UUID, type: 'totp', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SYNTHETICSECRET', uri: 'otpauth://x' } }, error: null });
  p.auth.mfa.challengeAndVerify.mockResolvedValue(over.verify ?? { data: {}, error: null });
  return p;
};
const on = (p: any) => ({ provider: p, enrollmentConfigured: () => true });

describe('client authenticator enrolment (C2, Phase 13B)', () => {
  it('is refused when not enabled for the environment, without touching the provider', async () => {
    const p = enrolProvider();
    await expect(beginClientTotpEnrollment({ provider: p, enrollmentConfigured: () => false })).rejects.toMatchObject({ code: 'CLIENT_MFA_ENROLLMENT_UNAVAILABLE' });
    expect(p.auth.getSession).not.toHaveBeenCalled();
    expect(p.auth.mfa.enroll).not.toHaveBeenCalled();
  });
  it('enrols through the provider factor API and returns the provider setup only to the caller', async () => {
    const p = enrolProvider();
    expect(await beginClientTotpEnrollment(on(p))).toEqual({ factorId: UUID, qrCode: 'data:image/svg+xml;utf-8,<svg/>', secret: 'SYNTHETICSECRET' });
    expect(p.auth.mfa.enroll).toHaveBeenCalledWith({ factorType: 'totp', friendlyName: 'TaxGuard client authenticator' });
  });
  it('refuses a second authenticator, requires a provider session and replaces only an unfinished setup', async () => {
    await expect(beginClientTotpEnrollment(on(enrolProvider([{ id: UUID, status: 'verified' }])))).rejects.toMatchObject({ code: 'CLIENT_MFA_ALREADY_ENROLLED' });
    await expect(beginClientTotpEnrollment(on(provider({ session: null })))).rejects.toMatchObject({ code: 'CLIENT_MFA_SESSION_REQUIRED' });
    const pending = enrolProvider([{ id: 'aaaaaaaa-0000-4000-8000-000000000000', status: 'unverified' }]);
    await beginClientTotpEnrollment(on(pending));
    expect(pending.auth.mfa.unenroll).toHaveBeenCalledTimes(1);
    expect(pending.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: 'aaaaaaaa-0000-4000-8000-000000000000' });
  });
  it('confirms only with a 6-digit code accepted by the provider and an AAL2 result', async () => {
    await expect(confirmClientTotpEnrollment(UUID, '12345', on(enrolProvider()))).rejects.toMatchObject({ code: 'CLIENT_MFA_CODE_INVALID' });
    await expect(confirmClientTotpEnrollment('not-a-factor', '123456', on(enrolProvider()))).rejects.toMatchObject({ code: 'CLIENT_MFA_CODE_INVALID' });
    await expect(confirmClientTotpEnrollment(UUID, '123456', on(enrolProvider([], { verify: { data: null, error: { message: 'Invalid TOTP code entered', status: 422 } } }))))
      .rejects.toMatchObject({ code: 'CLIENT_MFA_CODE_INVALID' });
    await expect(confirmClientTotpEnrollment(UUID, '123456', on(enrolProvider([], { verify: { data: null, error: { message: 'jwt expired', status: 401 } } }))))
      .rejects.toMatchObject({ code: 'CLIENT_MFA_SESSION_REQUIRED' });
    await expect(confirmClientTotpEnrollment(UUID, '123456', on(enrolProvider([], { level: 'aal1' })))).rejects.toMatchObject({ code: 'CLIENT_MFA_ASSURANCE_UNCONFIRMED' });
    await expect(confirmClientTotpEnrollment(UUID, '123456', on(enrolProvider()))).resolves.toBeUndefined();
  });
  it('cancellation removes the attempt only while it is unverified', async () => {
    const unverified = enrolProvider([{ id: UUID, status: 'unverified' }]);
    await cancelClientTotpEnrollment(UUID, on(unverified));
    expect(unverified.auth.mfa.unenroll).toHaveBeenCalledWith({ factorId: UUID });
    const verified = enrolProvider([{ id: UUID, status: 'verified' }]);
    await cancelClientTotpEnrollment(UUID, on(verified));
    expect(verified.auth.mfa.unenroll).not.toHaveBeenCalled();
  });
  it('explains every refusal without exposing provider internals', () => {
    for (const code of ['CLIENT_MFA_ENROLLMENT_UNAVAILABLE', 'CLIENT_MFA_SESSION_REQUIRED', 'CLIENT_MFA_ALREADY_ENROLLED', 'CLIENT_MFA_CODE_INVALID', 'CLIENT_MFA_ASSURANCE_UNCONFIRMED', undefined])
      expect(clientMfaErrorText(code)).not.toMatch(/jwt|422|401|supabase/i);
    expect(clientMfaErrorText('CLIENT_MFA_ALREADY_ENROLLED')).toMatch(/contact your practice/);
  });
});

describe('client sign-in gate (server)', () => {
  it('refuses an AAL1 session for a client with a verified authenticator and leaves others alone', () => {
    expect(clientMfaDenial('client', { aal: 'aal1', verifiedFactorCount: 1 })).toBe('CLIENT_MFA_REQUIRED');
    expect(clientMfaDenial(undefined, { aal: 'aal1', verifiedFactorCount: 2 })).toBe('CLIENT_MFA_REQUIRED'); // unresolved role: treated as non-staff
    expect(clientMfaDenial('prospective_client', { verifiedFactorCount: 1 })).toBe('CLIENT_MFA_REQUIRED');
    expect(clientMfaDenial('client', { aal: 'aal2', verifiedFactorCount: 1 })).toBeNull();
    expect(clientMfaDenial('client', { aal: 'aal1', verifiedFactorCount: 0 })).toBeNull();
    // Staff stay under the stricter, unchanged staff gate.
    expect(clientMfaDenial('accountant', { aal: 'aal1', verifiedFactorCount: 1 })).toBeNull();
    expect(staffMfaDenial('accountant', { aal: 'aal1', verifiedFactorCount: 1 })).toBe('STAFF_MFA_REQUIRED');
    expect(staffMfaDenial('accountant', { aal: 'aal2', verifiedFactorCount: 0 })).toBe('STAFF_MFA_ENROLLMENT_REQUIRED');
  });
});

describe('client MFA panel states', () => {
  it('describes a protected account without offering removal', () => {
    const out = renderToStaticMarkup(<ClientMfaStatusBody status={{ state: 'READY', currentLevel: 'aal2', verifiedFactors: 1, pendingFactors: 0 }} user={null} enrollmentAvailable />);
    expect(out).toContain('every sign-in asks for its code');
    expect(out).toContain('it cannot be removed here');
    expect(out).not.toMatch(/Remove authenticator|Add authenticator/);
  });
  it('offers to start setup without rendering any secret before the provider returns one', () => {
    const out = renderToStaticMarkup(<ClientTotpEnrollment onEnrolled={() => undefined} />);
    expect(out).toContain('Start authenticator setup');
    expect(out).not.toMatch(/Setup key|<input/);
  });
});
