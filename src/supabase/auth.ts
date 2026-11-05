/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from './config';

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

export type AuthLifecycleState =
  | 'INITIALIZING'
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'MFA_REQUIRED'
  | 'ERROR';

export type ControlledAuthErrorCode =
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'USER_ALREADY_EXISTS'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | (string & {});

export function sanitizeAuthErrorMessage(error: any): string {
  if (!error) return 'An error occurred during authentication.';
  if (typeof error === 'string') return error;
  const msg = error.message || error.error || 'Authentication error';
  return String(msg);
}

export function validateRegistrationInput(input: {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  acceptedTerms?: boolean;
  [key: string]: any;
}): { valid: boolean; error?: string } {
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return { valid: false, error: 'Please enter a valid email address.' };
  }
  if (input.password && input.confirmPassword && input.password !== input.confirmPassword) {
    return { valid: false, error: 'Passwords do not match.' };
  }
  return { valid: true };
}

export async function loginWithEmail(email: string, password: string): Promise<{
  success: boolean;
  accessToken?: string;
  emailVerificationRequired?: boolean;
  code?: ControlledAuthErrorCode;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        return { success: false, emailVerificationRequired: true, code: 'EMAIL_VERIFICATION_REQUIRED', error: error.message };
      }
      return { success: false, code: 'INVALID_CREDENTIALS', error: error.message };
    }
    return { success: true, accessToken: data.session?.access_token };
  } catch (err: any) {
    return { success: false, code: 'NETWORK_ERROR', error: err?.message || 'Login failed' };
  }
}

export async function registerWithEmail(payload: {
  email: string;
  password?: string;
  name?: string;
  phone?: string;
  companyName?: string;
  [key: string]: any;
}): Promise<{
  success: boolean;
  accessToken?: string;
  emailVerificationRequired?: boolean;
  code?: ControlledAuthErrorCode;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password || 'TemporaryPass123!',
      options: {
        data: {
          name: payload.name,
          phone: payload.phone,
          companyName: payload.companyName,
        },
      },
    });
    if (error) {
      return { success: false, code: 'USER_ALREADY_EXISTS', error: error.message };
    }
    const session = data.session;
    return {
      success: true,
      accessToken: session?.access_token,
      emailVerificationRequired: !session,
    };
  } catch (err: any) {
    return { success: false, code: 'NETWORK_ERROR', error: err?.message || 'Registration failed' };
  }
}

export async function supabaseMfaStatus(): Promise<{
  needsChallenge: boolean;
  factors: any[];
}> {
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return { needsChallenge: false, factors: [] };
    const verifiedTotp = data.totp?.filter(f => f.status === 'verified') || [];
    return {
      needsChallenge: verifiedTotp.length > 0,
      factors: data.totp || [],
    };
  } catch {
    return { needsChallenge: false, factors: [] };
  }
}

export async function verifySupabaseMfa(code: string): Promise<{
  success: boolean;
  accessToken?: string;
  error?: string;
}> {
  try {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verified = factors?.totp?.find(f => f.status === 'verified');
    if (!verified) return { success: false, error: 'No enrolled authenticator found.' };

    const challenge = await supabase.auth.mfa.challenge({ factorId: verified.id });
    if (challenge.error) return { success: false, error: challenge.error.message };

    const verify = await supabase.auth.mfa.verify({
      factorId: verified.id,
      challengeId: challenge.data.id,
      code,
    });
    if (verify.error) return { success: false, error: verify.error.message };

    const { data: sessionData } = await supabase.auth.getSession();
    return { success: true, accessToken: sessionData.session?.access_token };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Authenticator verification failed' };
  }
}

export async function logout(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore signout errors
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token || null;
  } catch {
    return null;
  }
}

export async function resendVerificationEmail(email: string): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) return { success: false, message: error.message, error: error.message };
    return { success: true, message: 'Verification email sent.' };
  } catch (err: any) {
    return { success: false, message: 'Could not send verification email.', error: err?.message };
  }
}

export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Could not request password reset.' };
  }
}
