import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../config/apiEndpoint', () => ({ apiEndpoint: (path: string) => 'http://127.0.0.1:3000' + path }));
import { recoveryErrorText, recoveryResetText } from '../components/admin/StaffMfaRecoveryPanel';
import { StaffMfaRecoveryEnrollmentFlow } from '../components/auth/StaffMfaRecoveryEnrollmentFlow';
import { createRecoveryEnrollmentApi } from '../services/staffRecoveryEnrollmentApi';

// MFA recovery UI pieces (synthetic): truthful reset wording, refusal explanations, and the staff
// re-enrolment client, which talks to the identity provider and the server only.
const row = (over: Record<string, unknown> = {}) => ({ requestId: 'r', targetUid: 't', targetName: null, targetRole: null, makerUid: 'm', checkerUid: null, reasonCategory: 'lost_authenticator',
  reason: 'x', status: 'approved', createdAt: '', approvedAt: '', jobId: 'r', jobStatus: 'pending', jobAttempts: 0, jobLastError: null, completedAt: null, completedBy: null,
  cancelledAt: null, resetAvailability: 'unavailable', actions: { approve: false, complete: false, cancel: false, retry: false }, ...over }) as any;

describe('administrator panel wording', () => {
  it('states only what the server confirmed for each reset state', () => {
    expect(recoveryResetText(row({ jobStatus: null, status: 'pending_approval' }))).toMatch(/awaiting independent approval/);
    expect(recoveryResetText(row({ jobAttempts: 2, jobLastError: 'PROVIDER_UNAVAILABLE' }))).toBe('Queued for retry after attempt 2 (PROVIDER_UNAVAILABLE)');
    expect(recoveryResetText(row({ jobStatus: 'reset_verified' }))).toMatch(/every previous authenticator was removed/);
    expect(recoveryResetText(row({ jobStatus: 'enrollment_verified' }))).toMatch(/independent administrator to reactivate/);
    expect(recoveryResetText(row({ jobStatus: 'failed', jobLastError: 'PROVIDER_NOT_AUTHORIZED' }))).toMatch(/^Failed \(PROVIDER_NOT_AUTHORIZED\)\. The staff member stays suspended/);
  });
  it('explains an expired recent sign-in and independence refusals', () => {
    expect(recoveryErrorText({ code: 'STAFF_RECENT_SIGN_IN_REQUIRED' })).toMatch(/last 15 minutes/);
    expect(recoveryErrorText({ code: 'INDEPENDENT_APPROVER_REQUIRED' })).toMatch(/different administrator/);
    expect(recoveryErrorText({})).toMatch(/did not confirm/);
  });
});

describe('staff re-enrolment', () => {
  const provider = (token: string | null = 'provider-token') => ({ auth: { getSession: vi.fn().mockResolvedValue({ data: { session: token ? { access_token: token } : null }, error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ error: null }), signOut: vi.fn().mockResolvedValue({ error: null }) } }) as any;
  it('is unavailable without provider identity and says so', () => {
    const api = createRecoveryEnrollmentApi({ available: () => false });
    expect(renderToStaticMarkup(<StaffMfaRecoveryEnrollmentFlow onCancel={() => undefined} api={api} />)).toContain('MFA recovery is not available in this environment.');
  });
  it('signs in at the provider only, then sends the provider token to the server', async () => {
    const p = provider(); const fetchImpl = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ step: 'ready_for_enrollment' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'enrollment_verified' }), { status: 200 }));
    const api = createRecoveryEnrollmentApi({ provider: p, fetchImpl, available: () => true });
    await api.signIn(' Staff@Example.test ', 'synthetic-password');
    expect(p.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'staff@example.test', password: 'synthetic-password' });
    expect(await api.step()).toBe('ready_for_enrollment');
    expect(await api.submit()).toBe('enrollment_verified');
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, JSON.parse(init.body), init.credentials])).toEqual([
      ['http://127.0.0.1:3000/api/staff-access/mfa-recovery/status', { providerAccessToken: 'provider-token' }, 'omit'],
      ['http://127.0.0.1:3000/api/staff-access/mfa-recovery/enrollment', { providerAccessToken: 'provider-token' }, 'omit']]);
  });
  it('maps server refusals to guidance and refuses without a provider session', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'MFA_ENROLLMENT_NEW_FACTOR_REQUIRED' }), { status: 409 }));
    await expect(createRecoveryEnrollmentApi({ provider: provider(), fetchImpl, available: () => true }).submit()).rejects.toMatchObject({ code: 'MFA_ENROLLMENT_NEW_FACTOR_REQUIRED', message: expect.stringMatching(/new authenticator/) });
    await expect(createRecoveryEnrollmentApi({ provider: provider(null), fetchImpl, available: () => true }).step()).rejects.toMatchObject({ code: 'PROVIDER_IDENTITY_DENIED' });
    await expect(createRecoveryEnrollmentApi({ provider: provider(), fetchImpl, available: () => true }).signIn('not-an-email', 'x')).rejects.toMatchObject({ code: 'VALIDATION' });
  });
});
