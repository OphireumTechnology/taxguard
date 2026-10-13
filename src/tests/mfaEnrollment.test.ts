import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  available: true,
  getSession: vi.fn(), listFactors: vi.fn(), enroll: vi.fn(), challengeAndVerify: vi.fn(), getAuthenticatorAssuranceLevel: vi.fn(), unenroll: vi.fn(),
}));
vi.mock('../supabase/config', () => ({ isStaffIdentityDevelopmentConfigured: () => mock.available, supabase: { auth: { getSession: mock.getSession, mfa: mock } } }));
import { beginTotpEnrollment, confirmTotpEnrollment, cancelTotpEnrollment } from '../supabase/mfaEnrollment';
beforeEach(() => {
  vi.resetAllMocks();
  mock.available = true;
  mock.getSession.mockResolvedValue({ data: { session: { user: { id: 'synthetic' } } }, error: null });
  mock.listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
  mock.enroll.mockResolvedValue({ data: { id: 'factor', totp: { qr_code: 'data:image/svg+xml,synthetic', secret: 'SYNTHETIC' } }, error: null });
  mock.challengeAndVerify.mockResolvedValue({ error: null });
  mock.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null });
  mock.unenroll.mockResolvedValue({ error: null });
});
describe('staff TOTP enrollment', () => {
  it('starts enrollment for a signed-in identity', async () => {
    expect(await beginTotpEnrollment()).toEqual({ factorId: 'factor', qrCode: 'data:image/svg+xml,synthetic', secret: 'SYNTHETIC' });
  });
  it('does not enroll without a session or when factor discovery fails', async () => {
    mock.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(beginTotpEnrollment()).rejects.toThrow('Sign in');
    mock.listFactors.mockResolvedValueOnce({ data: null, error: {} });
    await expect(beginTotpEnrollment()).rejects.toThrow('could not be checked');
    expect(mock.enroll).not.toHaveBeenCalled();
  });
  it('does not add a replacement to an already enrolled identity', async () => {
    mock.listFactors.mockResolvedValue({ data: { totp: [{ id: 'existing', status: 'verified' }] }, error: null });
    await expect(beginTotpEnrollment()).rejects.toThrow('already enrolled');
    expect(mock.enroll).not.toHaveBeenCalled();
  });
  it('requires a valid code and provider AAL2 after verification', async () => {
    await expect(confirmTotpEnrollment('factor', 'bad')).rejects.toThrow('6-digit');
    expect(mock.challengeAndVerify).not.toHaveBeenCalled();
    mock.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null });
    await expect(confirmTotpEnrollment('factor', '123456')).rejects.toThrow('assurance');
    mock.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null });
    await expect(confirmTotpEnrollment('factor', '123456')).resolves.toBeUndefined();
  });
  it('resumes a pending factor without accumulating new enrollments', async () => {
    mock.listFactors.mockResolvedValue({ data: { totp: [], all: [{ id: 'pending', factor_type: 'totp', status: 'unverified' }] }, error: null });
    expect(await beginTotpEnrollment()).toEqual({ factorId: 'pending', qrCode: '', secret: '' });
    expect(mock.enroll).not.toHaveBeenCalled();
  });
  it('rejects wrong codes', async () => {
    mock.challengeAndVerify.mockResolvedValue({ error: {} });
    await expect(confirmTotpEnrollment('factor', '123456')).rejects.toThrow('verification failed');
  });
  it('cancellation never deletes provider factors, including concurrent verification', async () => {
    mock.listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor', status: 'verified' }] }, error: null });
    await cancelTotpEnrollment('factor');
    expect(mock.unenroll).not.toHaveBeenCalled();
    mock.listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor', status: 'unverified' }] }, error: null });
    await cancelTotpEnrollment('factor');
    expect(mock.unenroll).not.toHaveBeenCalled();
  });
});

it('blocks enrollment and verification before provider calls outside approved development', async () => {
  mock.available=false;
  await expect(beginTotpEnrollment()).rejects.toThrow('unavailable in this environment');
  await expect(confirmTotpEnrollment('factor','123456')).rejects.toThrow('unavailable in this environment');
  expect(mock.getSession).not.toHaveBeenCalled();
  expect(mock.challengeAndVerify).not.toHaveBeenCalled();
});
