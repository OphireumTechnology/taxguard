import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase, isStaffIdentityDevelopmentConfigured } from '../supabase/config';
import { validateEmailFormat, validatePasswordStrength } from '../supabase/auth';

export interface StaffInvitationDetails { role: string; legalFirstName: string; legalLastName: string; expiresAt: string }
export class StaffInvitationFlowError extends Error {
  constructor(public readonly code: 'unavailable' | 'verification' | 'denied' | 'validation', message: string) { super(message); }
}
const denied = () => new StaffInvitationFlowError('denied', 'Staff onboarding could not be completed. Check your information or contact your administrator.');
const unavailable = () => new StaffInvitationFlowError('unavailable', 'Staff onboarding is unavailable in this environment. Contact your administrator.');
/** Only states the member can act on; everything else stays a neutral refusal. */
const RECOVERY_MESSAGES: Record<string, string> = {
  MFA_RECOVERY_NOT_READY_FOR_ENROLLMENT: 'Your administrator has not finished resetting your authenticator yet. Try again later.',
  MFA_ENROLLMENT_FRESH_SIGN_IN_REQUIRED: 'Sign in again with your password, then set up your authenticator within 15 minutes.',
  MFA_ENROLLMENT_AAL2_REQUIRED: 'Verify your new authenticator code before continuing.',
  MFA_ENROLLMENT_NEW_FACTOR_REQUIRED: 'Set up a new authenticator. An authenticator that existed before the reset cannot be used.',
};

/** Provider-only identity setup: no TaxGuard session, role metadata, or client provisioning. */
export function createStaffInvitationApi(injectedProvider?: Pick<SupabaseClient, 'auth'>, transport: typeof fetch = fetch) {
  const provider = injectedProvider || supabase;
  const requireAvailable = () => { if (!injectedProvider && !isStaffIdentityDevelopmentConfigured()) throw unavailable(); };

  async function providerToken() {
    requireAvailable();
    const { data, error } = await provider.auth.getSession();
    const token = data.session?.access_token;
    if (error || !token) throw denied();
    const identity = await provider.auth.getUser(token);
    if (identity.error || !identity.data.user) throw denied();
    if (!identity.data.user.email_confirmed_at) throw new StaffInvitationFlowError('verification', 'Verify your email before continuing staff onboarding.');
    return token;
  }
  async function post(action: 'lookup' | 'accept', token: string) {
    if (!/^[a-f0-9]{64}$/.test(token)) throw new StaffInvitationFlowError('validation', 'Enter the invitation code supplied by your administrator.');
    try {
      const response = await transport('/api/staff-access/invitation/' + action, {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, providerAccessToken: await providerToken() }),
      });
      if (response.status === 503) throw unavailable();
      if (!response.ok) throw denied();
      return await response.json();
    } catch (error) {
      if (error instanceof StaffInvitationFlowError) throw error;
      throw unavailable();
    }
  }
  return {
    async authenticate(mode: 'signin' | 'signup', email: string, password: string) {
      requireAvailable();
      if (!validateEmailFormat(email).valid) throw new StaffInvitationFlowError('validation', 'Enter a valid email address.');
      if (mode === 'signup' && !validatePasswordStrength(password).valid) throw new StaffInvitationFlowError('validation', validatePasswordStrength(password).message || 'Choose a stronger password.');
      try {
        const credentials = { email: email.trim().toLowerCase(), password };
        const result = mode === 'signup' ? await provider.auth.signUp({ ...credentials, ...(typeof window !== 'undefined' ? { options: { emailRedirectTo: window.location.origin + '/staff/login' } } : {}) }) : await provider.auth.signInWithPassword(credentials);
        if (result.error || !result.data.user || (mode === 'signup' && result.data.user.identities?.length === 0)) throw denied();
        return { emailVerificationRequired: !result.data.session || !result.data.user.email_confirmed_at };
      } catch (error) {
        if (error instanceof StaffInvitationFlowError) throw error;
        throw unavailable();
      }
    },
    async lookup(token: string): Promise<StaffInvitationDetails> {
      const result = await post('lookup', token);
      if (!result || !['role', 'legalFirstName', 'legalLastName', 'expiresAt'].every(key => typeof result[key] === 'string') || !(Date.parse(result.expiresAt) > Date.now())) throw denied();
      return { role: result.role, legalFirstName: result.legalFirstName, legalLastName: result.legalLastName, expiresAt: result.expiresAt };
    },
    async mfaState(): Promise<{ kind: 'ready' | 'enroll' | 'challenge'; factorId?: string }> {
      try {
        await providerToken();
        const assurance = await provider.auth.mfa.getAuthenticatorAssuranceLevel();
        const factors = await provider.auth.mfa.listFactors();
        if (assurance.error || !assurance.data || factors.error || !factors.data) throw unavailable();
        const factor = factors.data.totp.find(value => value.status === 'verified');
        if (!factor) return { kind: 'enroll' };
        if (assurance.data.currentLevel === 'aal2') return { kind: 'ready' };
        return { kind: 'challenge', factorId: factor.id };
      } catch (error) { if (error instanceof StaffInvitationFlowError) throw error; throw unavailable(); }
    },
    async challenge(factorId: string, code: string) {
      requireAvailable();
      if (!factorId || !/^[0-9]{6}$/.test(code)) throw new StaffInvitationFlowError('validation', 'Enter the 6-digit authenticator code.');
      try {
        const result = await provider.auth.mfa.challengeAndVerify({ factorId, code });
        if (result.error) throw denied();
        const assurance = await provider.auth.mfa.getAuthenticatorAssuranceLevel();
        if (assurance.error || assurance.data?.currentLevel !== 'aal2') throw denied();
      } catch (error) { if (error instanceof StaffInvitationFlowError) throw error; throw unavailable(); }
    },
    async accept(token: string): Promise<{ status: 'pending_approval' }> {
      const result = await post('accept', token);
      if (result?.status !== 'pending_approval') throw denied();
      return { status: 'pending_approval' };
    },
    /**
     * MFA recovery: the suspended member proves re-enrolment with a provider token only. The server
     * checks AAL2, a primary sign-in after the reset and a newly created factor; it never reactivates.
     */
    async submitRecoveryEnrollment(): Promise<{ status: 'enrollment_verified' }> {
      let response: Response;
      try {
        response = await transport('/api/staff-access/mfa-recovery/enrollment', {
          method: 'POST', credentials: 'omit', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ providerAccessToken: await providerToken() }),
        });
      } catch (error) {
        if (error instanceof StaffInvitationFlowError) throw error;
        throw unavailable();
      }
      if (response.status === 503) throw new StaffInvitationFlowError('unavailable', 'Authenticator recovery is unavailable in this environment. Contact your administrator.');
      if (!response.ok) {
        const code = await response.json().then(body => body?.code, () => null);
        const message = RECOVERY_MESSAGES[code as string];
        throw new StaffInvitationFlowError(message ? 'verification' : 'denied', message || 'Authenticator recovery could not be confirmed. Contact your administrator.');
      }
      const result = await response.json().catch(() => null);
      if (result?.status !== 'enrollment_verified' || typeof result.jobId !== 'string') throw denied();
      return { status: 'enrollment_verified' };
    },
    async signOut() { if (!injectedProvider && !isStaffIdentityDevelopmentConfigured()) return; try { const result = await provider.auth.signOut(); if (result.error) throw unavailable(); } catch { throw unavailable(); } },
  };
}
export type StaffInvitationApi = ReturnType<typeof createStaffInvitationApi>;
