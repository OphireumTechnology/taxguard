/**
 * Contract C2: client multi-factor authentication through the identity provider only.
 *   * Status: the provider's assurance level and factor counts for its own session.
 *   * Enrolment (when isClientMfaEnrollmentConfigured): the provider's TOTP factor API. The setup
 *     secret is shown once by the provider and never stored by TaxGuard (no localStorage, no
 *     database). Verification is the provider's challenge-and-verify, which must reach AAL2.
 *   * Sign-in: once a factor is verified, the server refuses any AAL1 session (CLIENT_MFA_REQUIRED),
 *     and sign-in asks for the code. After enrolment the client signs in again with the code.
 *   * Cancellation removes only the unverified factor created by this attempt. A verified factor is
 *     never removed here; recovery goes through the practice.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isClientMfaEnrollmentConfigured, isSupabaseConfigured, supabase } from './config';

export type ClientMfaStatus =
  | { state: 'UNAVAILABLE' }
  | { state: 'NO_PROVIDER_SESSION' }
  | { state: 'ERROR' }
  | { state: 'READY'; currentLevel: 'aal1' | 'aal2' | 'unknown'; verifiedFactors: number; pendingFactors: number };

export async function readClientMfaStatus(injected?: { provider?: SupabaseClient; configured?: () => boolean }): Promise<ClientMfaStatus> {
  if (!(injected?.configured ?? isSupabaseConfigured)()) return { state: 'UNAVAILABLE' };
  const provider = injected?.provider ?? (supabase as unknown as SupabaseClient);
  try {
    const { data: session, error: sessionError } = await provider.auth.getSession();
    if (sessionError || !session?.session) return { state: 'NO_PROVIDER_SESSION' };
    const [{ data: aal, error: aalError }, { data: factors, error: factorError }] = await Promise.all([provider.auth.mfa.getAuthenticatorAssuranceLevel(), provider.auth.mfa.listFactors()]);
    if (aalError || factorError || !factors) return { state: 'ERROR' };
    const all = (factors.all ?? []) as Array<{ status?: string }>;
    const level = aal?.currentLevel === 'aal2' ? 'aal2' : aal?.currentLevel === 'aal1' ? 'aal1' : 'unknown';
    return { state: 'READY', currentLevel: level, verifiedFactors: all.filter(f => f.status === 'verified').length, pendingFactors: all.filter(f => f.status === 'unverified').length };
  } catch { return { state: 'ERROR' }; }
}

export class ClientMfaError extends Error { constructor(public readonly code: string) { super(code); } }
export interface ClientTotpEnrollment { factorId: string; qrCode: string; secret: string }
type Injected = { provider?: SupabaseClient; enrollmentConfigured?: () => boolean };
const providerOf = (i?: Injected) => i?.provider ?? (supabase as unknown as SupabaseClient);

export const clientMfaEnrollmentAvailable = (i?: Injected) => (i?.enrollmentConfigured ?? isClientMfaEnrollmentConfigured)();

/** Starts TOTP enrolment for the signed-in provider identity. Refuses if a verified factor exists. */
export async function beginClientTotpEnrollment(i?: Injected): Promise<ClientTotpEnrollment> {
  if (!clientMfaEnrollmentAvailable(i)) throw new ClientMfaError('CLIENT_MFA_ENROLLMENT_UNAVAILABLE');
  const provider = providerOf(i);
  const { data: session, error: sessionError } = await provider.auth.getSession();
  if (sessionError || !session?.session) throw new ClientMfaError('CLIENT_MFA_SESSION_REQUIRED');
  const { data: factors, error: factorError } = await provider.auth.mfa.listFactors();
  if (factorError || !factors) throw new ClientMfaError('CLIENT_MFA_PROVIDER_UNAVAILABLE');
  if ((factors.all ?? []).some((f: { status?: string }) => f.status === 'verified')) throw new ClientMfaError('CLIENT_MFA_ALREADY_ENROLLED');
  // An unfinished setup from an earlier attempt cannot be resumed (the provider does not re-expose
  // its secret): remove only that UNVERIFIED factor, then start again.
  for (const f of (factors.all ?? []) as Array<{ id: string; status?: string; factor_type?: string }>)
    if (f.status === 'unverified' && f.factor_type === 'totp') {
      const { error } = await provider.auth.mfa.unenroll({ factorId: f.id });
      if (error) throw new ClientMfaError('CLIENT_MFA_PROVIDER_UNAVAILABLE');
    }
  const { data, error } = await provider.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'TaxGuard client authenticator' });
  if (error || !data || data.type !== 'totp') throw new ClientMfaError('CLIENT_MFA_PROVIDER_UNAVAILABLE');
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/** Verifies the first code with the provider; succeeds only when the provider session is AAL2. */
export async function confirmClientTotpEnrollment(factorId: string, code: string, i?: Injected): Promise<void> {
  if (!clientMfaEnrollmentAvailable(i)) throw new ClientMfaError('CLIENT_MFA_ENROLLMENT_UNAVAILABLE');
  if (!/^[0-9a-f-]{36}$/.test(factorId) || !/^\d{6}$/.test(code)) throw new ClientMfaError('CLIENT_MFA_CODE_INVALID');
  const provider = providerOf(i);
  const { error } = await provider.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new ClientMfaError((error as { status?: number }).status === 401 ? 'CLIENT_MFA_SESSION_REQUIRED' : 'CLIENT_MFA_CODE_INVALID');
  const { data, error: aalError } = await provider.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || data?.currentLevel !== 'aal2') throw new ClientMfaError('CLIENT_MFA_ASSURANCE_UNCONFIRMED');
}

/** Cancels THIS attempt: removes the factor it created only while it is still unverified. */
export async function cancelClientTotpEnrollment(factorId: string, i?: Injected): Promise<void> {
  const provider = providerOf(i);
  const { data: factors } = await provider.auth.mfa.listFactors();
  const mine = (factors?.all ?? []).find((f: { id: string; status?: string }) => f.id === factorId);
  if (!mine || mine.status !== 'unverified') return; // a verified factor is never removed here
  await provider.auth.mfa.unenroll({ factorId });
}

export function clientMfaErrorText(code: string | undefined): string {
  switch (code) {
    case 'CLIENT_MFA_ENROLLMENT_UNAVAILABLE': return 'Adding an authenticator is not available in this environment.';
    case 'CLIENT_MFA_SESSION_REQUIRED': return 'Your sign-in has expired. Sign in again, then add your authenticator.';
    case 'CLIENT_MFA_ALREADY_ENROLLED': return 'An authenticator is already set up for your account. To replace it, contact your practice.';
    case 'CLIENT_MFA_CODE_INVALID': return 'That code was not accepted. Enter the current 6-digit code from your authenticator app.';
    case 'CLIENT_MFA_ASSURANCE_UNCONFIRMED': return 'The identity provider did not confirm the authenticator. Nothing was changed; try again.';
    default: return 'The identity provider is not responding. Nothing was changed; try again shortly.';
  }
}
