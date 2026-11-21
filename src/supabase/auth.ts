import { isSupabaseConfigured, supabase } from './config';

export type AuthLifecycleState =
  | 'INITIALIZING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'MFA_REQUIRED'
  | 'SESSION_EXPIRED';

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
  | 'DUPLICATE_REGISTRATION'
  | 'REGISTRATION_FAILED'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'CLIENT_INITIALIZATION_FAILED'
  | 'CASE_INITIALIZATION_FAILED'
  | 'MFA_REQUIRED'
  | 'STAFF_MFA_REQUIRED'
  | 'STAFF_MFA_ENROLLMENT_REQUIRED'
  | 'CLIENT_MFA_REQUIRED'
  | 'AUTH_NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'ACCOUNT_DISABLED'
  | 'UNAUTHORIZED'
  | 'UNKNOWN_ERROR'
  | string;

export interface AuthActionResult {
  success: boolean;
  accessToken?: string;
  emailVerificationRequired?: boolean;
  duplicateRegistration?: boolean;
  code?: ControlledAuthErrorCode;
  error?: string;
}

export function sanitizeAuthErrorMessage(
  err: unknown,
  fallbackCode: ControlledAuthErrorCode = 'UNKNOWN_ERROR'
): { code: ControlledAuthErrorCode; message: string } {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const lower = raw.toLowerCase();
  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }
  if (lower.includes('email not confirmed')) {
    return {
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Please verify your email address before signing in.',
    };
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait a moment and try again.' };
  }
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return {
      code: 'DUPLICATE_REGISTRATION',
      message: 'An account with this email address already exists.',
    };
  }
  return {
    code: fallbackCode,
    message: raw && raw.length < 240 ? raw : 'Authentication could not be completed. Please try again.',
  };
}

export function validateRegistrationInput(input: {
  firstName?: string;
  lastName?: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword?: string;
  requireConfirmPassword?: boolean;
  acceptedTerms?: boolean;
  requireTerms?: boolean;
  category?: string;
  company?: string;
}): { valid: boolean; code?: ControlledAuthErrorCode; message?: string } {
  if (input.firstName !== undefined && !input.firstName.trim()) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'First name is required.' };
  }
  if (input.lastName !== undefined && !input.lastName.trim()) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Last name is required.' };
  }
  const email = (input.email || '').trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Please enter a valid email address.' };
  }
  if (!input.password || input.password.length < 8) {
    return {
      valid: false,
      code: 'VALIDATION_FAILED',
      message: 'Password must be at least 8 characters long.',
    };
  }
  if (input.requireConfirmPassword && input.password !== input.confirmPassword) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Passwords do not match.' };
  }
  if (input.requireTerms && !input.acceptedTerms) {
    return {
      valid: false,
      code: 'VALIDATION_FAILED',
      message: 'You must accept the terms of service to register.',
    };
  }
  return { valid: true };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthActionResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED',
      error: 'Authentication is not configured in this environment.',
    };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error, 'INVALID_CREDENTIALS');
    return {
      success: false,
      code: sanitized.code,
      emailVerificationRequired: sanitized.code === 'EMAIL_VERIFICATION_REQUIRED',
      error: sanitized.message,
    };
  }
  return {
    success: true,
    accessToken: data.session?.access_token,
  };
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  phone?: string,
  companyName?: string
): Promise<AuthActionResult> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED',
      error: 'Registration is not configured in this environment.',
    };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        phone: phone || '',
        company_name: companyName || '',
      },
    },
  });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error, 'REGISTRATION_FAILED');
    return {
      success: false,
      code: sanitized.code,
      duplicateRegistration: sanitized.code === 'DUPLICATE_REGISTRATION',
      error: sanitized.message,
    };
  }
  const accessToken = data.session?.access_token;
  return {
    success: true,
    accessToken,
    emailVerificationRequired: !accessToken,
  };
}

export async function logout(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut().catch(() => {});
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function supabaseMfaStatus(): Promise<{
  needsChallenge: boolean;
  currentLevel: string | null;
  nextLevel: string | null;
}> {
  if (!supabase) {
    return { needsChallenge: false, currentLevel: null, nextLevel: null };
  }
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) {
    return { needsChallenge: false, currentLevel: null, nextLevel: null };
  }
  return {
    needsChallenge: data.nextLevel === 'aal2' && data.currentLevel !== 'aal2',
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
  };
}

export async function verifySupabaseMfa(code: string): Promise<AuthActionResult> {
  if (!supabase) {
    return { success: false, code: 'AUTH_NOT_CONFIGURED', error: 'Authentication is not configured.' };
  }
  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) {
    return { success: false, code: 'MFA_REQUIRED', error: listErr.message };
  }
  const totp = factors?.totp?.find(f => f.status === 'verified') ?? factors?.totp?.[0];
  if (!totp) {
    return { success: false, code: 'MFA_REQUIRED', error: 'No verified authenticator factor found.' };
  }
  const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (chErr || !challenge) {
    return { success: false, code: 'MFA_REQUIRED', error: chErr?.message || 'Unable to create MFA challenge.' };
  }
  const { error: verErr } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: challenge.id,
    code,
  });
  if (verErr) {
    return { success: false, code: 'INVALID_CREDENTIALS', error: 'Invalid authenticator code.' };
  }
  const token = await getSupabaseAccessToken();
  return { success: Boolean(token), accessToken: token ?? undefined };
}

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Password recovery is not configured in this environment.' };
  }
  const redirectTo =
    (import.meta.env.VITE_AUTH_RECOVERY_REDIRECT_URL || '').trim() ||
    (typeof window !== 'undefined' ? `${window.location.origin}/portal/login` : undefined);
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) {
    return { success: false, error: sanitizeAuthErrorMessage(error).message };
  }
  return {
    success: true,
    message: 'If an account matches that email, a password recovery link has been sent.',
  };
}

export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isSupabaseConfigured() || !supabase) {
    const error = 'Email verification is not configured in this environment.';
    return { success: false, message: error, error };
  }
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) {
    const msg = sanitizeAuthErrorMessage(error).message;
    return { success: false, message: msg, error: msg };
  }
  return { success: true, message: 'Verification email sent.' };
}
