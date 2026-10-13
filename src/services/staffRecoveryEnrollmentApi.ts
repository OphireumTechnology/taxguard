/**
 * Staff MFA recovery re-enrolment from the browser. A staff member under recovery is suspended and
 * has no TaxGuard session, so every step uses the identity PROVIDER session only:
 *   sign in (password; the old authenticators were removed by the approved reset) -> read the coarse
 *   recovery step -> enrol and verify a new authenticator (TotpEnrollmentPanel) -> send the provider
 *   access token so the server can verify the new factor.
 * No TaxGuard session is created here; access returns only after an administrator reactivates.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiEndpoint } from '../config/apiEndpoint';
import { isStaffIdentityDevelopmentConfigured, supabase } from '../supabase/config';
import { validateEmailFormat } from '../supabase/auth';

export type RecoveryStep = 'none' | 'awaiting_approval' | 'awaiting_reset' | 'reset_failed' | 'ready_for_enrollment' | 'awaiting_reactivation';
export class RecoveryEnrollmentError extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
const STEPS: RecoveryStep[] = ['none', 'awaiting_approval', 'awaiting_reset', 'reset_failed', 'ready_for_enrollment', 'awaiting_reactivation'];
const MESSAGES: Record<string, string> = {
  MFA_ENROLLMENT_NEW_FACTOR_REQUIRED: 'No new authenticator was found. Finish setting up the new authenticator first.',
  MFA_ENROLLMENT_AAL2_REQUIRED: 'Verify a code from your new authenticator first.',
  MFA_ENROLLMENT_FRESH_SIGN_IN_REQUIRED: 'Your sign-in is too old or predates the reset. Sign out and sign in again.',
  MFA_RECOVERY_NOT_READY_FOR_ENROLLMENT: 'Your previous authenticators have not been removed yet. Check again shortly.',
  MFA_RECOVERY_NOT_FOUND: 'There is no open recovery for this account. Contact your administrator.',
  PROVIDER_IDENTITY_DENIED: 'Your sign-in could not be verified. Sign in again.',
  MFA_RESET_PROVIDER_UNAVAILABLE: 'The identity provider is unavailable. Try again later.',
};
export const recoveryEnrollmentMessage = (code: string) => MESSAGES[code] ?? 'The server did not confirm this step. Try again.';

export function createRecoveryEnrollmentApi(injected?: { provider?: SupabaseClient; fetchImpl?: typeof fetch; available?: () => boolean }) {
  const provider = () => injected?.provider ?? (supabase as unknown as SupabaseClient);
  const available = () => (injected?.available ?? isStaffIdentityDevelopmentConfigured)();
  const doFetch = injected?.fetchImpl ?? fetch;
  const require = () => { if (!available()) throw new RecoveryEnrollmentError('UNAVAILABLE', 'MFA recovery is not available in this environment.'); };
  async function token() {
    const { data, error } = await provider().auth.getSession();
    const t = data?.session?.access_token;
    if (error || !t) throw new RecoveryEnrollmentError('PROVIDER_IDENTITY_DENIED', recoveryEnrollmentMessage('PROVIDER_IDENTITY_DENIED'));
    return t;
  }
  async function post(path: 'status' | 'enrollment') {
    const response = await doFetch(apiEndpoint('/api/staff-access/mfa-recovery/' + path), { method: 'POST', cache: 'no-store', credentials: 'omit',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerAccessToken: await token() }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { const code = typeof data?.code === 'string' ? data.code : 'UNAVAILABLE'; throw new RecoveryEnrollmentError(code, recoveryEnrollmentMessage(code)); }
    return data;
  }
  return {
    available,
    async signIn(email: string, password: string) {
      require();
      if (!validateEmailFormat(email).valid || !password) throw new RecoveryEnrollmentError('VALIDATION', 'Enter your work email and password.');
      const { error } = await provider().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw new RecoveryEnrollmentError('PROVIDER_IDENTITY_DENIED', 'Sign-in failed. Check your email and password.');
    },
    async step(): Promise<RecoveryStep> {
      require();
      const data = await post('status');
      if (!data || !STEPS.includes(data.step)) throw new RecoveryEnrollmentError('UNAVAILABLE', recoveryEnrollmentMessage('UNAVAILABLE'));
      return data.step;
    },
    /** Sends the provider token after the new authenticator was verified (AAL2). */
    async submit(): Promise<'enrollment_verified'> {
      require();
      const data = await post('enrollment');
      if (data?.status !== 'enrollment_verified') throw new RecoveryEnrollmentError('UNAVAILABLE', recoveryEnrollmentMessage('UNAVAILABLE'));
      return 'enrollment_verified';
    },
    async signOut() { try { await provider().auth.signOut(); } catch { /* local state is cleared by the provider client */ } },
  };
}
export type RecoveryEnrollmentApi = ReturnType<typeof createRecoveryEnrollmentApi>;
