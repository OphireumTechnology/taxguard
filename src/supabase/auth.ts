import { isSupabaseConfigured, supabase } from './config';

export type AuthLifecycleState =
  | 'INITIALIZING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'MFA_REQUIRED'
  | 'EMAIL_UNVERIFIED';

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
  | 'AUTH_NOT_CONFIGURED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_CONFIRMED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'VALIDATION_FAILED'
  | 'REGISTRATION_FAILED'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'
  | string;

export function sanitizeAuthErrorMessage(
  err: unknown,
  fallbackCode: ControlledAuthErrorCode = 'UNKNOWN_ERROR'
): { code: ControlledAuthErrorCode; message: string } {
  const raw = typeof err === 'string' ? err : err instanceof Error ? err.message : (err as any)?.message || '';
  const code: ControlledAuthErrorCode = (err as any)?.code || fallbackCode;
  if (!raw) {
    return { code, message: 'Authentication request could not be completed.' };
  }
  if (/invalid login credentials/i.test(raw)) {
    return { code: 'INVALID_CREDENTIALS', message: 'Invalid email address or password.' };
  }
  if (/email not confirmed/i.test(raw)) {
    return { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please verify your email address before signing in.' };
  }
  if (/rate limit/i.test(raw)) {
    return { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment and try again.' };
  }
  return { code, message: String(raw).slice(0, 240) };
}

export function validateRegistrationInput(input: {
  email?: string;
  password?: string;
  name?: string;
  confirmPassword?: string;
  [key: string]: any;
}): { valid: boolean; message?: string; error?: string; code?: ControlledAuthErrorCode } {
  const email = (input.email || '').trim();
  const password = input.password || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const msg = 'Please enter a valid email address.';
    return { valid: false, message: msg, error: msg, code: 'VALIDATION_ERROR' };
  }
  if (password.length < 8) {
    const msg = 'Password must be at least 8 characters long.';
    return { valid: false, message: msg, error: msg, code: 'VALIDATION_ERROR' };
  }
  if (input.confirmPassword !== undefined && input.confirmPassword !== password) {
    const msg = 'Passwords do not match.';
    return { valid: false, message: msg, error: msg, code: 'VALIDATION_ERROR' };
  }
  return { valid: true };
}

export async function loginWithEmail(email: string, password: string): Promise<any> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED' as ControlledAuthErrorCode,
      error: 'Identity provider is not configured in this environment.',
    };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error, 'INVALID_CREDENTIALS');
    return {
      success: false,
      code: sanitized.code,
      error: sanitized.message,
      emailVerificationRequired: sanitized.code === 'EMAIL_VERIFICATION_REQUIRED',
    };
  }
  return {
    success: true,
    session: data.session,
    user: data.user,
    accessToken: data.session?.access_token,
  };
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  phone?: string,
  companyName?: string
): Promise<any> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED' as ControlledAuthErrorCode,
      error: 'Identity provider is not configured in this environment.',
    };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name, phone, companyName } },
  });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error, 'REGISTRATION_FAILED');
    return {
      success: false,
      code: sanitized.code,
      error: sanitized.message,
    };
  }
  return {
    success: true,
    user: data.user,
    session: data.session,
    accessToken: data.session?.access_token,
    emailVerificationRequired: !data.session,
  };
}

export async function logout(): Promise<void> {
  if (supabase) {
    await supabase.auth.signOut().catch(() => undefined);
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function supabaseMfaStatus(): Promise<{
  currentLevel: 'aal1' | 'aal2' | null;
  nextLevel: 'aal1' | 'aal2' | null;
  factors: any[];
  totpFactors: any[];
  needsChallenge: boolean;
  needsEnrollment: boolean;
}> {
  if (!supabase) {
    return {
      currentLevel: null,
      nextLevel: null,
      factors: [],
      totpFactors: [],
      needsChallenge: false,
      needsEnrollment: false,
    };
  }
  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  const totp = factors?.totp || [];
  const verified = totp.filter((f: any) => f.status === 'verified');
  return {
    currentLevel: (aal?.currentLevel as 'aal1' | 'aal2' | null) ?? null,
    nextLevel: (aal?.nextLevel as 'aal1' | 'aal2' | null) ?? null,
    factors: factors?.all || [],
    totpFactors: verified,
    needsChallenge: aal?.currentLevel !== 'aal2' && verified.length > 0,
    needsEnrollment: verified.length === 0,
  };
}

export async function verifySupabaseMfa(
  code: string,
  factorId?: string
): Promise<{ success: boolean; accessToken?: string; error?: string; code?: ControlledAuthErrorCode }> {
  if (!supabase) {
    return { success: false, code: 'AUTH_NOT_CONFIGURED', error: 'Identity provider is not configured.' };
  }
  const targetFactorId = factorId || (await supabaseMfaStatus()).totpFactors[0]?.id;
  if (!targetFactorId) {
    return { success: false, code: 'MFA_INVALID', error: 'No verified authenticator factor found.' };
  }
  const { data: challenge, error: challengeErr } = await supabase.auth.mfa.challenge({
    factorId: targetFactorId,
  });
  if (challengeErr || !challenge) {
    return { success: false, code: 'MFA_INVALID', error: sanitizeAuthErrorMessage(challengeErr, 'MFA_INVALID').message };
  }
  const { error: verifyErr } = await supabase.auth.mfa.verify({
    factorId: targetFactorId,
    challengeId: challenge.id,
    code,
  });
  if (verifyErr) {
    return { success: false, code: 'MFA_INVALID', error: sanitizeAuthErrorMessage(verifyErr, 'MFA_INVALID').message };
  }
  const accessToken = (await getSupabaseAccessToken()) || undefined;
  return { success: true, accessToken };
}

export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!supabase) {
    const msg = 'Identity provider is not configured in this environment.';
    return { success: false, message: msg, error: msg };
  }
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) {
    const msg = sanitizeAuthErrorMessage(error).message;
    return { success: false, message: msg, error: msg };
  }
  return { success: true, message: 'Verification email sent. Please check your inbox.' };
}

export async function requestPasswordReset(
  email: string,
  redirectTo?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!supabase) {
    const msg = 'Password recovery service is not configured in this environment.';
    return { success: false, message: msg, error: msg };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) {
    const msg = sanitizeAuthErrorMessage(error).message;
    return { success: false, message: msg, error: msg };
  }
  return { success: true, message: 'If an account matches that email, password reset instructions have been sent.' };
}
