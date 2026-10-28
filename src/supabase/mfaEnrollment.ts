import { supabase, isStaffIdentityDevelopmentConfigured } from './config';

export interface TotpEnrollment { factorId: string; qrCode: string; secret: string }

/** Enrolls only for the signed-in provider identity; never creates an application session. */
export async function beginTotpEnrollment(): Promise<TotpEnrollment> {
  if (!isStaffIdentityDevelopmentConfigured()) throw new Error('Authenticator enrollment is unavailable in this environment.');
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session.session) throw new Error('Sign in before enrolling an authenticator.');
  const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
  if (factorError || !factors) throw new Error('Authenticator status could not be checked.');
  if (factors.totp.some(f => f.status === 'verified')) throw new Error('An authenticator is already enrolled. Sign in with its code.');
  const pending = (factors.all || []).find(f => f.factor_type === 'totp' && f.status === 'unverified');
  // Provider does not re-expose setup material: resume with the already configured app.
  if (pending) return { factorId: pending.id, qrCode: '', secret: '' };
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'TaxGuard staff authenticator' });
  if (error || !data) throw new Error('Authenticator enrollment could not be started.');
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

export async function confirmTotpEnrollment(factorId: string, code: string): Promise<void> {
  if (!isStaffIdentityDevelopmentConfigured()) throw new Error('Authenticator enrollment is unavailable in this environment.');
  if (!factorId || !/^\d{6}$/.test(code)) throw new Error('Enter the 6-digit authenticator code.');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new Error('Authenticator verification failed. Try the next code.');
  const { data, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError || data?.currentLevel !== 'aal2') throw new Error('Multi-factor assurance could not be confirmed.');
}

/** Cancellation discards the UI state only. Factor deletion belongs to approved recovery.
 * Never use list-then-delete: another tab can verify the factor between those requests. */
export async function cancelTotpEnrollment(_factorId: string): Promise<void> {
  // Intentionally no provider mutation, even if the factor currently appears unverified.
}
