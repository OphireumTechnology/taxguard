import { isSupabaseConfigured, supabase } from './config';

export type AuthLifecycleState = 'INITIALIZING' | 'AUTHENTICATED' | 'UNAUTHENTICATED';

export type RegistrationResultState =
  | 'IDLE'
  | 'SUBMITTING'
  | 'ACCOUNT_CREATED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'ESTABLISHING_SESSION'
  | 'INITIALIZING_CLIENT'
  | 'INITIALIZING_CASE'
  | 'READY'
  | 'FAILED';

export type ControlledAuthErrorCode =
  | 'VALIDATION_FAILED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'REGISTRATION_FAILED'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'CLIENT_INITIALIZATION_FAILED'
  | 'CASE_INITIALIZATION_FAILED'
  | 'STAFF_MFA_REQUIRED'
  | 'STAFF_MFA_ENROLLMENT_REQUIRED'
  | 'CLIENT_MFA_REQUIRED'
  | 'PROVIDER_UNCONFIGURED'
  | 'RATE_LIMITED'
  | 'UNKNOWN_ERROR';

export function sanitizeAuthErrorMessage(
  err: unknown,
  fallbackCode: ControlledAuthErrorCode = 'UNKNOWN_ERROR'
): { code: ControlledAuthErrorCode; message: string } {
  const anyErr = err as { code?: ControlledAuthErrorCode; message?: string } | null;
  const code = anyErr?.code || fallbackCode;
  const raw = (anyErr?.message || '').trim();
  if (!raw) {
    return { code, message: 'Authentication could not be completed. Please try again.' };
  }
  return { code, message: raw };
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<{
  success: boolean;
  accessToken?: string;
  emailVerificationRequired?: boolean;
  code?: ControlledAuthErrorCode;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      code: 'PROVIDER_UNCONFIGURED',
      error: 'Authentication is not configured for this environment.',
    };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.session?.access_token) {
    const msg = error?.message || 'Invalid email or password.';
    const needsVerify = msg.toLowerCase().includes('email not confirmed');
    return {
      success: false,
      emailVerificationRequired: needsVerify,
      code: needsVerify ? 'EMAIL_VERIFICATION_REQUIRED' : 'INVALID_CREDENTIALS',
      error: msg,
    };
  }
  return { success: true, accessToken: data.session.access_token };
}

export async function supabaseMfaStatus(): Promise<{ needsChallenge: boolean; factorId?: string }> {
  if (!isSupabaseConfigured()) return { needsChallenge: false };
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = factors?.totp?.find((f: any) => f.status === 'verified');
  const needsChallenge = Boolean(verified && aal?.currentLevel !== 'aal2' && aal?.nextLevel === 'aal2');
  return { needsChallenge, factorId: verified?.id };
}

export async function verifySupabaseMfa(code: string): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured()) return { success: false, error: 'Authentication provider unavailable.' };
  const status = await supabaseMfaStatus();
  if (!status.factorId) return { success: false, error: 'No verified authenticator found.' };
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: status.factorId });
  if (chErr || !challenge) return { success: false, error: chErr?.message || 'MFA challenge failed.' };
  const { data, error } = await supabase.auth.mfa.verify({
    factorId: status.factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) return { success: false, error: error.message || 'Invalid authenticator code.' };
  const token = (data as any)?.access_token || (await getSupabaseAccessToken());
  return { success: true, accessToken: token || undefined };
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  phone?: string,
  companyName?: string
): Promise<{
  success: boolean;
  accessToken?: string;
  emailVerificationRequired?: boolean;
  duplicateRegistration?: boolean;
  code?: ControlledAuthErrorCode;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      code: 'PROVIDER_UNCONFIGURED',
      error: 'Registration is not available because authentication is not configured.',
    };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, phone, companyName } },
  });
  if (error) {
    const dup = error.message.toLowerCase().includes('already');
    return {
      success: false,
      duplicateRegistration: dup,
      code: 'REGISTRATION_FAILED',
      error: error.message,
    };
  }
  if (!data.session?.access_token) {
    return { success: true, emailVerificationRequired: true };
  }
  return { success: true, accessToken: data.session.access_token };
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.signOut();
}

export async function resendVerificationEmail(email: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: '', error: 'Authentication provider is not configured.' };
  }
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) return { success: false, message: '', error: error.message };
  return { success: true, message: 'Verification email sent.' };
}

export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Authentication provider is not configured.' };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Password recovery instructions have been sent.' };
}

export function validateRegistrationInput(input: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  requireConfirmPassword?: boolean;
  acceptedTerms?: boolean;
  requireTerms?: boolean;
  category?: string;
  company?: string;
}): { valid: boolean; code?: ControlledAuthErrorCode; message?: string } {
  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'First and last name are required.' };
  }
  if (!input.email?.trim() || !input.email.includes('@')) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'A valid email address is required.' };
  }
  if (!input.password || input.password.length < 8) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Password must be at least 8 characters.' };
  }
  if (input.requireConfirmPassword && input.password !== input.confirmPassword) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Passwords do not match.' };
  }
  if (input.requireTerms && !input.acceptedTerms) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Please accept the Terms of Service.' };
  }
  return { valid: true };
}
