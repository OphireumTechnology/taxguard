import { supabase, isSupabaseConfigured } from './config';

export type ControlledAuthErrorCode =
  | 'AUTH_NOT_CONFIGURED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'REGISTRATION_FAILED'
  | 'VALIDATION_FAILED'
  | 'CLIENT_MFA_REQUIRED'
  | 'STAFF_MFA_REQUIRED'
  | 'STAFF_MFA_ENROLLMENT_REQUIRED'
  | string;

export type RegistrationResultState =
  | 'IDLE'
  | 'SUBMITTING'
  | 'ACCOUNT_CREATED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'FAILED'
  | 'READY';

export type AuthLifecycleState =
  | 'INITIALIZING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED';

export interface RegistrationInputParams {
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
}

export function validateRegistrationInput(params: RegistrationInputParams): {
  valid: boolean;
  code?: ControlledAuthErrorCode;
  message?: string;
} {
  if (!params.firstName?.trim()) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'First name is required.' };
  }
  if (!params.lastName?.trim()) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Last name is required.' };
  }
  if (!params.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email.trim())) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'A valid email address is required.' };
  }
  if (!params.password || params.password.length < 8) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Password must be at least 8 characters long.' };
  }
  if (params.requireConfirmPassword && params.password !== params.confirmPassword) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'Passwords do not match.' };
  }
  if (params.requireTerms && !params.acceptedTerms) {
    return { valid: false, code: 'VALIDATION_FAILED', message: 'You must accept the terms of service to continue.' };
  }
  return { valid: true };
}

export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  code?: ControlledAuthErrorCode;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED',
      error: 'Authentication is not configured in this environment. Please contact your administrator.'
    };
  }
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) {
      return { success: false, error: error.message };
    }
    return {
      success: true,
      message: 'If an account exists for this email address, password recovery instructions have been sent.'
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Password reset request failed.' };
  }
}

export async function loginWithEmail(email: string, password: string): Promise<{
  success: boolean;
  accessToken?: string;
  code?: ControlledAuthErrorCode;
  error?: string;
  emailVerificationRequired?: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED',
      error: 'Authentication is not configured in this environment.'
    };
  }
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    if (error) {
      const isEmailUnconfirmed =
        error.message?.toLowerCase().includes('email not confirmed') ||
        error.message?.toLowerCase().includes('unconfirmed');
      if (isEmailUnconfirmed) {
        return {
          success: false,
          code: 'EMAIL_VERIFICATION_REQUIRED',
          emailVerificationRequired: true,
          error: error.message
        };
      }
      return {
        success: false,
        code: 'INVALID_CREDENTIALS',
        error: error.message
      };
    }
    return {
      success: true,
      accessToken: data.session?.access_token
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'SESSION_ESTABLISHMENT_FAILED',
      error: err?.message || 'Login failed.'
    };
  }
}

export async function supabaseMfaStatus(): Promise<{
  needsChallenge: boolean;
  verifiedFactors: number;
  pendingFactors?: number;
  currentLevel?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { needsChallenge: false, verifiedFactors: 0 };
  }
  try {
    const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !aal) {
      return { needsChallenge: false, verifiedFactors: 0 };
    }
    const needsChallenge = aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2';
    return {
      needsChallenge,
      verifiedFactors: aal.currentLevel === 'aal2' ? 1 : 0,
      currentLevel: aal.currentLevel
    };
  } catch {
    return { needsChallenge: false, verifiedFactors: 0 };
  }
}

export async function verifySupabaseMfa(code: string): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Authentication not configured.' };
  }
  try {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError || !factors?.totp?.length) {
      return { success: false, error: 'No MFA factor enrolled.' };
    }
    const totpFactor = factors.totp.find(f => f.status === 'verified') || factors.totp[0];
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: totpFactor.id
    });
    if (challengeError) {
      return { success: false, error: challengeError.message };
    }
    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId: totpFactor.id,
      challengeId: challenge.id,
      code: code.trim()
    });
    if (verifyError) {
      return { success: false, error: verifyError.message };
    }
    return {
      success: true,
      accessToken: verifyData?.access_token
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Verification failed.' };
  }
}

export async function registerWithEmail(
  name: string,
  email: string,
  password: string,
  phone?: string,
  company?: string
): Promise<{
  success: boolean;
  accessToken?: string;
  emailVerificationRequired?: boolean;
  code?: ControlledAuthErrorCode;
  error?: string;
  duplicateRegistration?: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return {
      success: false,
      code: 'AUTH_NOT_CONFIGURED',
      error: 'Authentication is not configured in this environment.'
    };
  }
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: name.trim(),
          phone: phone?.trim() || null,
          company: company?.trim() || null
        }
      }
    });
    if (error) {
      const isDuplicate = error.message?.toLowerCase().includes('already registered') || error.status === 422;
      return {
        success: false,
        code: isDuplicate ? 'DUPLICATE_REGISTRATION' : 'REGISTRATION_FAILED',
        duplicateRegistration: isDuplicate,
        error: error.message
      };
    }
    const accessToken = data.session?.access_token;
    return {
      success: true,
      accessToken,
      emailVerificationRequired: !accessToken
    };
  } catch (err: any) {
    return {
      success: false,
      code: 'REGISTRATION_FAILED',
      error: err?.message || 'Registration failed.'
    };
  }
}

export async function logout(): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore signOut errors
    }
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function resendVerificationEmail(email: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { success: false, message: '', error: 'Authentication not configured.' };
  }
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim().toLowerCase()
    });
    if (error) {
      return { success: false, message: '', error: error.message };
    }
    return { success: true, message: 'Verification email has been resent.' };
  } catch (err: any) {
    return { success: false, message: '', error: err?.message || 'Could not resend email.' };
  }
}

export function sanitizeAuthErrorMessage(
  err: any,
  fallbackCode: ControlledAuthErrorCode = 'SESSION_ESTABLISHMENT_FAILED'
): { code: ControlledAuthErrorCode; message: string } {
  const code: ControlledAuthErrorCode = err?.code || fallbackCode;
  const message: string = err?.message || 'An error occurred during authentication.';
  return { code, message };
}
