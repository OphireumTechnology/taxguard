import { supabase, isSupabaseConfigured } from './config';

export type AuthLifecycleState =
  | 'INITIALIZING'
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'MFA_REQUIRED'
  | 'MFA_ENROLLMENT_REQUIRED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'ERROR';

export type RegistrationResultState =
  | 'IDLE'
  | 'READY'
  | 'SUBMITTING'
  | 'SUCCESS'
  | 'ACCOUNT_CREATED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'FAILED'
  | 'ERROR'
  | string;

export type ControlledAuthErrorCode =
  | 'AUTH_NOT_CONFIGURED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'ACCOUNT_LOCKED'
  | 'ACCOUNT_SUSPENDED'
  | 'VALIDATION_ERROR'
  | 'VALIDATION_FAILED'
  | 'REGISTRATION_FAILED'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR'
  | string;

export function sanitizeAuthErrorMessage(
  error: unknown,
  fallbackCode: ControlledAuthErrorCode = 'UNKNOWN_ERROR'
): { code: ControlledAuthErrorCode; message: string } {
  const errObj = error as { code?: string; message?: string } | null;
  const rawCode: ControlledAuthErrorCode = errObj?.code || fallbackCode;
  const rawMsg =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : typeof errObj?.message === 'string'
      ? errObj.message
      : 'Authentication failed. Please check your credentials and try again.';

  if (/invalid login credentials/i.test(rawMsg)) {
    return { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' };
  }
  if (/email not confirmed/i.test(rawMsg)) {
    return {
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Please verify your email address before signing in.',
    };
  }
  return { code: rawCode, message: rawMsg };
}

export function validateRegistrationInput(input: {
  email?: string;
  password?: string;
  confirmPassword?: string;
  name?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  [key: string]: any;
}): { valid: boolean; error?: string; message?: string; code?: ControlledAuthErrorCode } {
  const email = (input.email || '').trim();
  const password = input.password || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const msg = 'Please enter a valid email address.';
    return { valid: false, error: msg, message: msg, code: 'VALIDATION_ERROR' };
  }
  if (password.length < 8) {
    const msg = 'Password must be at least 8 characters.';
    return { valid: false, error: msg, message: msg, code: 'VALIDATION_ERROR' };
  }
  if (input.confirmPassword !== undefined && password !== input.confirmPassword) {
    const msg = 'Passwords do not match.';
    return { valid: false, error: msg, message: msg, code: 'VALIDATION_ERROR' };
  }
  return { valid: true };
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<{
  success: boolean;
  session?: any;
  accessToken?: string | null;
  user?: any;
  error?: string;
  code?: ControlledAuthErrorCode;
  emailVerificationRequired?: boolean;
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED',
      error: 'Identity provider is not configured in this environment.',
    };
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const emailVerificationRequired = /email not confirmed/i.test(error.message);
    const sanitized = sanitizeAuthErrorMessage(
      error,
      emailVerificationRequired ? 'EMAIL_VERIFICATION_REQUIRED' : 'INVALID_CREDENTIALS'
    );
    return {
      success: false,
      error: sanitized.message,
      code: sanitized.code,
      emailVerificationRequired,
    };
  }
  return {
    success: true,
    session: data.session,
    accessToken: data.session?.access_token ?? null,
    user: data.user,
  };
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  phone?: string,
  companyName?: string
): Promise<{
  success: boolean;
  session?: any;
  accessToken?: string | null;
  user?: any;
  emailVerificationRequired?: boolean;
  duplicateRegistration?: boolean;
  error?: string;
  code?: ControlledAuthErrorCode;
}> {
  if (!isSupabaseConfigured() || !supabase) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED',
      error: 'Identity provider is not configured in this environment.',
    };
  }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        full_name: name,
        ...(phone ? { phone } : {}),
        ...(companyName ? { company_name: companyName } : {}),
      },
    },
  });
  if (error) {
    const duplicate = /already registered|user already exists/i.test(error.message);
    const sanitized = sanitizeAuthErrorMessage(error, 'REGISTRATION_FAILED');
    return {
      success: false,
      error: sanitized.message,
      code: sanitized.code,
      duplicateRegistration: duplicate,
    };
  }
  const identities = (data.user as any)?.identities;
  if (Array.isArray(identities) && identities.length === 0) {
    return {
      success: false,
      duplicateRegistration: true,
      code: 'REGISTRATION_FAILED',
      error: 'An account with this email address already exists.',
    };
  }
  return {
    success: true,
    session: data.session,
    accessToken: data.session?.access_token ?? null,
    user: data.user,
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
  return data?.session?.access_token ?? null;
}

export async function supabaseMfaStatus(): Promise<{
  enrolled: boolean;
  verified: boolean;
  needsChallenge: boolean;
  currentLevel?: string | null;
  nextLevel?: string | null;
  factorId?: string | null;
  factors?: any[];
}> {
  if (!supabase) {
    return { enrolled: false, verified: false, needsChallenge: false, factors: [] };
  }
  try {
    const [{ data: aal }, { data: factorsData }] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const verifiedTotp = (factorsData?.totp || []).filter((f: any) => f.status === 'verified');
    const verified = aal?.currentLevel === 'aal2';
    const enrolled = verifiedTotp.length > 0;
    const needsChallenge = enrolled && !verified;
    return {
      enrolled,
      verified,
      needsChallenge,
      currentLevel: aal?.currentLevel ?? null,
      nextLevel: aal?.nextLevel ?? null,
      factorId: verifiedTotp[0]?.id ?? null,
      factors: verifiedTotp,
    };
  } catch {
    return { enrolled: false, verified: false, needsChallenge: false, factors: [] };
  }
}

export async function verifySupabaseMfa(
  code: string,
  factorId?: string
): Promise<{
  success: boolean;
  accessToken?: string | null;
  error?: string;
  code?: ControlledAuthErrorCode;
}> {
  if (!supabase) {
    return { success: false, code: 'AUTH_NOT_CONFIGURED', error: 'MFA provider unavailable.' };
  }
  try {
    let targetFactorId = factorId;
    if (!targetFactorId) {
      const status = await supabaseMfaStatus();
      targetFactorId = status.factorId ?? undefined;
    }
    if (!targetFactorId) {
      return { success: false, code: 'MFA_REQUIRED', error: 'No verified authenticator factor found.' };
    }
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({
      factorId: targetFactorId,
    });
    if (chErr || !challenge) {
      return { success: false, code: 'MFA_INVALID', error: chErr?.message || 'Unable to start MFA challenge.' };
    }
    const { error: verErr } = await supabase.auth.mfa.verify({
      factorId: targetFactorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verErr) {
      return { success: false, code: 'MFA_INVALID', error: 'Invalid verification code.' };
    }
    const { data: sessionData } = await supabase.auth.getSession();
    return {
      success: true,
      accessToken: sessionData?.session?.access_token ?? null,
    };
  } catch (err) {
    return { success: false, code: 'MFA_INVALID', error: sanitizeAuthErrorMessage(err, 'MFA_INVALID').message };
  }
}

export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  if (!supabase) {
    return { success: false, message: 'Identity provider is not configured.', error: 'AUTH_NOT_CONFIGURED' };
  }
  const { error } = await supabase.auth.resend({ type: 'signup', email });
  if (error) {
    const sanitized = sanitizeAuthErrorMessage(error);
    return { success: false, message: sanitized.message, error: error.message };
  }
  return { success: true, message: 'Verification email sent. Please check your inbox.' };
}

export async function requestPasswordReset(
  email: string,
  redirectTo?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  if (!supabase) {
    return { success: false, error: 'Identity provider is not configured in this environment.' };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) {
    return { success: false, error: sanitizeAuthErrorMessage(error).message };
  }
  return { success: true, message: 'If an account exists for that email, a reset link has been sent.' };
}
