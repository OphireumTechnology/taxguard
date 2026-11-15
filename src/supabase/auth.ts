import { isSupabaseConfigured, supabase } from './config';

export type AuthLifecycleState =
  | 'INITIALIZING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'MFA_REQUIRED'
  | 'ERROR';

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
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'MFA_REQUIRED'
  | 'STAFF_MFA_REQUIRED'
  | 'STAFF_MFA_ENROLLMENT_REQUIRED'
  | 'CLIENT_MFA_REQUIRED'
  | 'VALIDATION_FAILED'
  | 'REGISTRATION_FAILED'
  | 'DUPLICATE_REGISTRATION'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'CLIENT_INITIALIZATION_FAILED'
  | 'CASE_INITIALIZATION_FAILED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNCONFIGURED'
  | 'UNKNOWN_ERROR';

export function sanitizeAuthErrorMessage(
  err: unknown,
  fallbackCode: ControlledAuthErrorCode = 'UNKNOWN_ERROR',
): { code: ControlledAuthErrorCode; message: string } {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const lower = raw.toLowerCase();
  if (lower.includes('email not confirmed') || lower.includes('verify your email')) {
    return { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please verify your email address before signing in.' };
  }
  if (lower.includes('invalid login credentials')) {
    return { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }
  if (lower.includes('already registered')) {
    return { code: 'DUPLICATE_REGISTRATION', message: 'An account with this email already exists.' };
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a moment and try again.' };
  }
  return {
    code: fallbackCode,
    message: raw && raw.length < 180 ? raw : 'Authentication could not be completed at this time.',
  };
}

export function validateRegistrationInput(input: {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  phone?: string;
  requireConfirmPassword?: boolean;
  acceptedTerms?: boolean;
  requireTerms?: boolean;
  category?: string;
  company?: string;
  [key: string]: any;
}): { valid: boolean; error?: string; message?: string; code?: ControlledAuthErrorCode } {
  const fullName = input.name || [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  if (!fullName || fullName.trim().length < 2) {
    const msg = 'Full name is required.';
    return { valid: false, code: 'VALIDATION_FAILED', error: msg, message: msg };
  }
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    const msg = 'A valid email address is required.';
    return { valid: false, code: 'VALIDATION_FAILED', error: msg, message: msg };
  }
  if (!input.password || input.password.length < 8) {
    const msg = 'Password must be at least 8 characters.';
    return { valid: false, code: 'VALIDATION_FAILED', error: msg, message: msg };
  }
  if ((input.requireConfirmPassword || input.confirmPassword !== undefined) && input.password !== input.confirmPassword) {
    const msg = 'Passwords do not match.';
    return { valid: false, code: 'VALIDATION_FAILED', error: msg, message: msg };
  }
  if (input.requireTerms && !input.acceptedTerms) {
    const msg = 'Please accept the terms of service to continue.';
    return { valid: false, code: 'VALIDATION_FAILED', error: msg, message: msg };
  }
  return { valid: true };
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

export async function loginWithEmail(
  email: string,
  password: string,
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
      error: 'Identity provider is not configured in this environment.',
    };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error, 'INVALID_CREDENTIALS');
    return {
      success: false,
      emailVerificationRequired: sanitized.code === 'EMAIL_VERIFICATION_REQUIRED',
      code: sanitized.code,
      error: sanitized.message,
    };
  }
  return { success: true, accessToken: data.session?.access_token };
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  phone?: string,
  companyName?: string,
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
      error: 'Identity provider is not configured in this environment.',
    };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name, phone: phone ?? '', company_name: companyName ?? '' } },
  });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error, 'REGISTRATION_FAILED');
    return {
      success: false,
      duplicateRegistration: sanitized.code === 'DUPLICATE_REGISTRATION',
      code: sanitized.code,
      error: sanitized.message,
    };
  }
  return {
    success: true,
    accessToken: data.session?.access_token,
    emailVerificationRequired: !data.session,
  };
}

export async function supabaseMfaStatus(): Promise<{ needsChallenge: boolean; factorId?: string }> {
  if (!isSupabaseConfigured()) return { needsChallenge: false };
  try {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.filter((f: { status?: string }) => f.status === 'verified') ?? [];
    if (aal?.nextLevel === 'aal2' && aal?.currentLevel !== 'aal2' && verified.length > 0) {
      return { needsChallenge: true, factorId: verified[0].id };
    }
    return { needsChallenge: false };
  } catch {
    return { needsChallenge: false };
  }
}

export async function verifySupabaseMfa(
  code: string,
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Identity provider is not configured.' };
  }
  const status = await supabaseMfaStatus();
  if (!status.factorId) {
    return { success: false, error: 'No verified authenticator factor found.' };
  }
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: status.factorId, code });
  if (error) {
    return { success: false, error: error.message || 'Invalid authenticator code.' };
  }
  const accessToken = await getSupabaseAccessToken();
  return { success: Boolean(accessToken), accessToken: accessToken ?? undefined };
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.signOut().catch(() => {});
}

export async function resendVerificationEmail(
  email: string,
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: '', error: 'Identity provider is not configured.' };
  }
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) return { success: false, message: '', error: error.message };
  return { success: true, message: 'Verification email sent.' };
}

export async function requestPasswordReset(
  email: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Password recovery is unavailable because the identity provider is not configured.' };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { success: false, error: error.message };
  return { success: true, message: 'Password recovery instructions sent.' };
}
