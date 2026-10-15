import { describe, expect, it, vi } from 'vitest';
import { createStaffInvitationApi, StaffInvitationFlowError } from '../services/staffInvitationApi';
import { normalizeCancellationReason, recoveryCanFollowUp, validateRecoveryFollowUp } from '../hooks/useStaffMfaRecovery';
import type { RecoveryRow } from '../hooks/useStaffMfaRecovery';

function provider(confirmed = true) {
  const user = { id: 'synthetic-staff', email: 'staff@example.test', email_confirmed_at: confirmed ? '2026-01-01' : null };
  return { auth: {
    getSession: vi.fn(async () => ({ data: { session: { access_token: 'synthetic-provider-token' } }, error: null })),
    getUser: vi.fn(async () => ({ data: { user }, error: null })),
  } } as any;
}
const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe('MFA recovery re-enrolment client (provider token only)', () => {
  it('posts only the provider access token and accepts a verified enrolment', async () => {
    const transport = respond(200, { jobId: '11111111-1111-4111-8111-111111111111', status: 'enrollment_verified', replayed: false });
    await expect(createStaffInvitationApi(provider(), transport as any).submitRecoveryEnrollment()).resolves.toEqual({ status: 'enrollment_verified' });
    const [url, init] = transport.mock.calls[0] as any[];
    expect(url).toBe('/api/staff-access/mfa-recovery/enrollment');
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', cache: 'no-store' });
    expect(JSON.parse(init.body)).toEqual({ providerAccessToken: 'synthetic-provider-token' });
    expect(init.headers.Authorization).toBeUndefined();
  });
  it('refuses before any request when the provider email is unconfirmed', async () => {
    const transport = respond(200, {});
    await expect(createStaffInvitationApi(provider(false), transport as any).submitRecoveryEnrollment()).rejects.toMatchObject({ code: 'verification' });
    expect(transport).not.toHaveBeenCalled();
  });
  it.each([
    ['MFA_RECOVERY_NOT_READY_FOR_ENROLLMENT', 409, 'not finished resetting'],
    ['MFA_ENROLLMENT_FRESH_SIGN_IN_REQUIRED', 403, 'Sign in again'],
    ['MFA_ENROLLMENT_NEW_FACTOR_REQUIRED', 409, 'existed before the reset'],
    ['MFA_ENROLLMENT_AAL2_REQUIRED', 403, 'Verify your new authenticator'],
  ])('explains actionable refusal %s', async (code, status, text) => {
    const error = await createStaffInvitationApi(provider(), respond(status, { code }) as any).submitRecoveryEnrollment().catch(e => e);
    expect(error).toBeInstanceOf(StaffInvitationFlowError);
    expect(error.message).toContain(text);
  });
  it('keeps other refusals neutral and treats 503 as unavailable', async () => {
    const denied = await createStaffInvitationApi(provider(), respond(404, { code: 'MFA_RECOVERY_NOT_FOUND' }) as any).submitRecoveryEnrollment().catch(e => e);
    expect(denied.code).toBe('denied');
    expect(denied.message).not.toContain('NOT_FOUND');
    const down = await createStaffInvitationApi(provider(), respond(503, { code: 'MFA_RESET_PROVIDER_UNAVAILABLE' }) as any).submitRecoveryEnrollment().catch(e => e);
    expect(down.code).toBe('unavailable');
  });
  it('does not report success for a malformed server response', async () => {
    for (const body of [{ status: 'completed', jobId: 'x' }, { status: 'enrollment_verified' }, null]) {
      await expect(createStaffInvitationApi(provider(), respond(200, body) as any).submitRecoveryEnrollment()).rejects.toMatchObject({ code: 'denied' });
    }
  });
});

const base: RecoveryRow = { requestId: '11111111-1111-4111-8111-111111111111', targetUid: 'staff-a', targetName: null, targetRole: 'accountant', makerUid: 'admin-b', checkerUid: 'admin-c',
  reasonCategory: 'lost_authenticator', reason: 'Synthetic reason', status: 'approved', createdAt: '2026-01-01T00:00:00Z', approvedAt: '2026-01-01T00:01:00Z',
  jobId: '11111111-1111-4111-8111-111111111111', jobStatus: 'enrollment_verified', jobAttempts: 1, jobLastError: null, completedAt: null, completedBy: null, cancelledAt: null,
  resetAvailability: 'verified', actions: { approve: false, complete: true, cancel: false, retry: false } };

describe('administrator recovery follow-up guards', () => {
  it('requires the server hint, the matching state and an actor other than the target', () => {
    expect(recoveryCanFollowUp(base, 'complete', 'admin-d')).toBe(true);
    expect(recoveryCanFollowUp(base, 'complete', 'staff-a')).toBe(false);
    expect(recoveryCanFollowUp(base, 'complete', undefined)).toBe(false);
    expect(recoveryCanFollowUp({ ...base, actions: { ...base.actions, complete: false } }, 'complete', 'admin-d')).toBe(false);
    expect(recoveryCanFollowUp({ ...base, jobStatus: 'reset_verified' }, 'complete', 'admin-d')).toBe(false);
    const failed = { ...base, jobStatus: 'failed' as const, actions: { ...base.actions, complete: false, retry: true } };
    expect(recoveryCanFollowUp(failed, 'retry', 'admin-d')).toBe(true);
    expect(recoveryCanFollowUp({ ...failed, status: 'completed' }, 'retry', 'admin-d')).toBe(false);
    const pending = { ...base, status: 'pending_approval' as const, checkerUid: null, approvedAt: null, jobId: null, jobStatus: null, actions: { approve: true, complete: false, cancel: true, retry: false } };
    expect(recoveryCanFollowUp(pending, 'cancel', 'admin-d')).toBe(true);
    expect(recoveryCanFollowUp({ ...pending, status: 'approved' }, 'cancel', 'admin-d')).toBe(false);
  });
  it('validates follow-up results against the acted-on row', () => {
    expect(() => validateRecoveryFollowUp({ requestId: base.requestId, targetUid: 'staff-a', status: 'completed', resumed: false }, 'complete', base)).not.toThrow();
    expect(() => validateRecoveryFollowUp({ requestId: base.requestId, targetUid: 'staff-b', status: 'completed', resumed: false }, 'complete', base)).toThrow();
    expect(() => validateRecoveryFollowUp({ requestId: base.requestId, targetUid: 'staff-a', status: 'completed' }, 'complete', base)).toThrow();
    expect(() => validateRecoveryFollowUp({ requestId: base.requestId, targetUid: 'staff-a', status: 'cancelled' }, 'cancel', base)).not.toThrow();
    expect(() => validateRecoveryFollowUp({ requestId: base.requestId, targetUid: 'staff-a', status: 'completed', resumed: false }, 'cancel', base)).toThrow();
    expect(() => validateRecoveryFollowUp({ jobId: base.requestId, status: 'pending' }, 'retry', base)).not.toThrow();
    expect(() => validateRecoveryFollowUp({ jobId: '22222222-2222-4222-8222-222222222222', status: 'pending' }, 'retry', base)).toThrow();
  });
  it('bounds the cancellation reason like the server', () => {
    expect(() => normalizeCancellationReason('too short')).toThrow();
    expect(() => normalizeCancellationReason('x'.repeat(1001))).toThrow();
    expect(() => normalizeCancellationReason('Raised in error\u0007 by admin')).toThrow();
    expect(normalizeCancellationReason('  Raised in error by the requester  ')).toBe('Raised in error by the requester');
  });
});
