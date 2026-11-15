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
  | 'DUPLICATE_REGISTRATION'
  | 'REGISTRATION_FAILED'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'CLIENT_INITIALIZATION_FAILED'
  | 'CASE_INITIALIZATION_FAILED'
  | 'CLIENT_MFA_REQUIRED'
  | 'STAFF_MFA_REQUIRED'
  | 'STAFF_MFA_ENROLLMENT_REQUIRED'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'RATE_LIMITED'
  | 'AUTH_ERROR';

export function sanitizeAuthErrorMessage(
  err: unknown,
  fallbackCode: ControlledAuthErrorCode = 'AUTH_ERROR'
): { code: ControlledAuthErrorCode; message: string } {
  const raw = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const lower = raw.toLowerCase();
  if (lower.includes('email not confirmed') || lower.includes('verification')) {
    return {
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Please verify your email address before signing in.'
    };
  }
  if (lower.includes('already registered') || lower.includes('already exists')) {
    return {
      code: 'DUPLICATE_REGISTRATION',
      message: 'An account with this email address already exists.'
    };
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please wait a few minutes and try again.'
    };
  }
  if (lower.includes('invalid login credentials') || lower.includes('invalid password')) {
    return {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password.'
    };
  }
  const errCode = (err as { code?: ControlledAuthErrorCode } | null)?.code;
  return {
    code: errCode || fallbackCode,
    message: raw && raw.length < 220 ? raw : 'Authentication could not be completed. Please try again.'
  };
}

export function validateRegistrationInput(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
  requireConfirmPassword?: boolean;
  acceptedTerms?: boolean;
  requireTerms?: boolean;
  category?: string;
  company?: string;
}): { valid: boolean; code?: ControlledAuthErrorCode; message?: string } {
  if (!input.firstName?.trim() || !input.lastName?.trim()) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'First name and last name are required.' };
  }
  if (!input.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Please enter a valid email address.' };
  }
  if (!input.phone?.trim() || input.phone.replace(/\D/g, '').length < 7) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Please enter a valid telephone number.' };
  }
  if (!input.password || input.password.length < 10) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Password must be at least 10 characters long.' };
  }
  if (input.requireConfirmPassword && input.password !== input.confirmPassword) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Passwords do not match.' };
  }
  if (input.requireTerms && !input.acceptedTerms) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'You must accept the terms of service to register.' };
  }
  if (input.category && input.category !== 'individual' && !input.company?.trim()) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Business name is required for entity accounts.' };
  }
  return { valid: true };
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
      code: 'PROVIDER_NOT_CONFIGURED',
      error: 'Authentication provider is not configured for this environment.'
    };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error, 'INVALID_CREDENTIALS');
    return {
      success: false,
      emailVerificationRequired: sanitized.code === 'EMAIL_VERIFICATION_REQUIRED',
      code: sanitized.code,
      error: sanitized.message
    };
  }
  if (!data?.session?.access_token) {
    return {
      success: false,
      code: 'SESSION_ESTABLISHMENT_FAILED',
      error: 'Authentication succeeded, but no access token was returned.'
    };
  }
  return { success: true, accessToken: data.session.access_token };
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
      code: 'PROVIDER_NOT_CONFIGURED',
      error: 'Authentication provider is not configured for this environment.'
    };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: name,
        phone: phone || '',
        company_name: companyName || ''
      }
    }
  });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error, 'REGISTRATION_FAILED');
    return {
      success: false,
      duplicateRegistration: sanitized.code === 'DUPLICATE_REGISTRATION',
      code: sanitized.code,
      error: sanitized.message
    };
  }
  if (!data?.session?.access_token) {
    return {
      success: true,
      emailVerificationRequired: true
    };
  }
  return {
    success: true,
    accessToken: data.session.access_token,
    emailVerificationRequired: false
  };
}

export async function supabaseMfaStatus(): Promise<{ needsChallenge: boolean; currentLevel?: string | null; nextLevel?: string | null }> {
  if (!isSupabaseConfigured()) return { needsChallenge: false };
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsChallenge = Boolean(data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2');
  return { needsChallenge, currentLevel: data?.currentLevel, nextLevel: data?.nextLevel };
}

export async function verifySupabaseMfa(
  code: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Authentication provider is not configured.' };
  }
  const { data: factorsData, error: factorsErr } = await supabase.auth.mfa.listFactors();
  if (factorsErr || !factorsData?.totp?.length) {
    return { success: false, error: 'No verified authenticator factor was found.' };
  }
  const factor = factorsData.totp.find(f => f.status === 'verified') || factorsData.totp[0];
  const { error: verifyErr } = await supabase.auth.mfa.challengeAndVerify({
    factorId: factor.id,
    code: code.trim()
  });
  if (verifyErr) {
    return { success: false, error: 'Invalid authenticator code.' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  return {
    success: Boolean(sessionData?.session?.access_token),
    accessToken: sessionData?.session?.access_token
  };
}

export async function logout(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await supabase.auth.signOut().catch(() => {});
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: '', error: 'Authentication provider is not configured.' };
  }
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) {
    return { success: false, message: '', error: sanitizeAuthErrorMessage(error).message };
  }
  return {
    success: true,
    message: `A new verification link has been dispatched to ${email}.`
  };
}

export async function requestPasswordReset(
  email: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Authentication provider is not configured.' };
  }
  const redirectTo = (import.meta.env.VITE_PASSWORD_RESET_CONTINUE_URL || import.meta.env.VITE_AUTH_RECOVERY_REDIRECT_URL || '').trim() || undefined;
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) {
    return { success: false, error: sanitizeAuthErrorMessage(error).message };
  }
  return {
    success: true,
    message: 'If an account exists for this email address, password recovery instructions have been sent.'
  };
}
