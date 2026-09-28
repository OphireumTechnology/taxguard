import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const sdk = vi.hoisted(() => ({ create: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), reset: vi.fn(), confirm: vi.fn(), update: vi.fn(), verify: vi.fn(), write: vi.fn() }));
vi.mock('../firebase/config', () => ({ auth: {}, db: {} }));
vi.mock('firebase/auth', () => ({
  createUserWithEmailAndPassword: sdk.create, signInWithEmailAndPassword: sdk.signIn, signOut: sdk.signOut,
  sendPasswordResetEmail: sdk.reset, confirmPasswordReset: sdk.confirm, updateProfile: sdk.update, sendEmailVerification: sdk.verify,
  onAuthStateChanged: vi.fn(), getIdTokenResult: vi.fn(),
}));
vi.mock('firebase/firestore', () => ({ doc: vi.fn(), getDoc: vi.fn(), setDoc: sdk.write, serverTimestamp: vi.fn() }));
import { registerWithEmail, loginWithEmail, logout, requestPasswordReset, completePasswordReset } from '../firebase/auth';
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('PROD', true); vi.stubEnv('VITE_PASSWORD_RESET_CONTINUE_URL', '');
  const result = { user: { uid: 'u1', email: 'client@example.com', displayName: 'Client', emailVerified: false } };
  sdk.create.mockResolvedValue(result); sdk.signIn.mockResolvedValue(result);
  sdk.reset.mockResolvedValue(undefined); sdk.confirm.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllEnvs());
it('registers via Firebase and never writes production identity or organization from the browser', async () => {
  const result = await registerWithEmail('Client', 'client@example.com', 'example-password', '', 'Example Company');
  expect(result.success).toBe(true); expect(result.user?.role).toBe('client');
  expect(sdk.write).not.toHaveBeenCalled(); expect(sdk.verify).toHaveBeenCalled();
});
it('logs in through Firebase credentials without accepting a privileged role', async () => {
  const result = await loginWithEmail(' Client@Example.com ', 'example-password');
  expect(sdk.signIn).toHaveBeenCalledWith({}, 'client@example.com', 'example-password');
  expect(result.user?.role).toBe('client');
});
it('returns an invalid credentials result on failed login', async () => {
  sdk.signIn.mockRejectedValueOnce({ code: 'auth/invalid-credential' });
  expect((await loginWithEmail('client@example.com', 'bad')).success).toBe(false);
});
it('signs out from Firebase', async () => { await logout(); expect(sdk.signOut).toHaveBeenCalledWith({}); });
it('uses the Firebase hosted password action without leaking the current onboarding URL', async () => {
  expect((await requestPasswordReset(' client@example.com ')).success).toBe(true);
  expect(sdk.reset).toHaveBeenCalledWith({}, 'client@example.com', undefined);
});
it('reports an unauthorized continuation safely', async () => {
  sdk.reset.mockRejectedValueOnce({ code: 'auth/unauthorized-continue-uri', message: 'private detail' });
  const result = await requestPasswordReset('client@example.com');
  expect(result.success).toBe(false); expect(result.error).not.toContain('private detail');
});
it('confirms reset through Firebase using the one-time action code', async () => {
  expect((await completePasswordReset('one-time-code', 'new-example-password')).success).toBe(true);
  expect(sdk.confirm).toHaveBeenCalledWith({}, 'one-time-code', 'new-example-password');
});
it('rejects an expired reset code', async () => {
  sdk.confirm.mockRejectedValueOnce({ code: 'auth/expired-action-code' });
  expect((await completePasswordReset('expired', 'new-example-password')).success).toBe(false);
});
