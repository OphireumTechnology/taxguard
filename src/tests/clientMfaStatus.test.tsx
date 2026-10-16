import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readClientMfaStatus } from '../supabase/clientMfa';
import { ClientMfaStatusBody } from '../components/portal/views/ClientMfaPanel';

// Contract C2: the client's MFA status is read from the identity provider for its own session only
// (injected synthetic provider). Nothing is enrolled, verified or removed, and no other store is used.
const provider = (over: { session?: unknown; aal?: unknown; factors?: unknown; aalError?: unknown } = {}) => {
  const p = { auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: 'session' in over ? over.session : { access_token: 'synthetic' } }, error: null }),
    mfa: {
      getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({ data: over.aal ?? { currentLevel: 'aal1', nextLevel: 'aal1' }, error: over.aalError ?? null }),
      listFactors: vi.fn().mockResolvedValue({ data: over.factors ?? { all: [], totp: [] }, error: null }),
      enroll: vi.fn(), challenge: vi.fn(), verify: vi.fn(), challengeAndVerify: vi.fn(), unenroll: vi.fn(),
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
  it('shows the report, keeps enrolment blocked and explains why', () => {
    const out = renderToStaticMarkup(<ClientMfaStatusBody status={{ state: 'READY', currentLevel: 'aal1', verifiedFactors: 0, pendingFactors: 0 }} user={null} />);
    expect(out).toContain('This sign-in used a password only');
    expect(out).toContain('Adding an authenticator is not available yet.');
    expect(out).toContain('Client sign-in does not yet ask for an authenticator code');
    expect(out).toMatch(/<button[^>]*disabled=""[^>]*>Add authenticator \(unavailable\)/);
    expect(out).not.toMatch(/<input|qr|secret/i);
  });
  it('never claims protection it cannot confirm', () => {
    for (const status of [{ state: 'UNAVAILABLE' }, { state: 'NO_PROVIDER_SESSION' }, { state: 'ERROR' }] as const) {
      const out = renderToStaticMarkup(<ClientMfaStatusBody status={status} user={{ mfaEnabled: true } as any} />);
      expect(out, status.state).not.toMatch(/used an authenticator|Verified authenticators/);
      expect(out).toContain('Profile record: Recorded as enabled');
    }
  });
});
