/**
 * Supabase Authentication Service for TaxGuard AI
 * Replaces Firebase client authentication while preserving all role and security invariants.
 *
 * Security Invariant: The frontend NEVER sets or trusts its own role.
 * Roles and professional authorization must be obtained from authoritative TaxGuard records
 * through the server session bridge (/api/auth/supabase-session).
 */

import { supabase } from './config';
import { UserRole } from '../types';

export type ControlledAuthErrorCode =
  | 'REGISTRATION_FAILED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'CLIENT_INITIALIZATION_FAILED'
  | 'TENANT_ACCESS_DENIED'
  | 'CASE_INITIALIZATION_FAILED'
  | 'AUTH_SERVICE_UNAVAILABLE'
  | 'DUPLICATE_REGISTRATION'
  | 'INVALID_CREDENTIALS'
  | 'VALIDATION_FAILED';

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
  | 'ERROR';

export interface AuthUserProfile {
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string;
  organizationId?: string;
  status: 'active' | 'suspended' | 'pending';
  emailVerified: boolean;
  createdAt?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmailFormat(email: string): { valid: boolean; message?: string } {
  const normalized = (email || '').trim().toLowerCase();
  if (!normalized) {
    return { valid: false, message: 'Email address is required.' };
  }
  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, message: 'Please enter a valid email address.' };
  }
  return { valid: true };
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  isValid: boolean;
  errors: string[];
  message?: string;
} {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(password || '')) {
    errors.push('Password must contain at least one uppercase letter.');
  }
  if (!/[a-z]/.test(password || '')) {
    errors.push('Password must contain at least one lowercase letter.');
  }
  if (!/[0-9]/.test(password || '')) {
    errors.push('Password must contain at least one number.');
  }
  if (!/[^A-Za-z0-9]/.test(password || '')) {
    errors.push('Password must contain at least one special character.');
  }

  const valid = errors.length === 0;
  return {
    valid,
    isValid: valid,
    errors,
    message: errors[0]
  };
}

export interface RegistrationValidationInput {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  requireConfirmPassword?: boolean;
  acceptedTerms?: boolean;
  requireTerms?: boolean;
  category?: string;
  company?: string;
}

export function validateRegistrationInput(input: RegistrationValidationInput): {
  valid: boolean;
  code?: ControlledAuthErrorCode;
  message?: string;
} {
  const nameToCheck =
    input.fullName?.trim() ||
    [input.firstName?.trim(), input.lastName?.trim()].filter(Boolean).join(' ');

  if (!nameToCheck || nameToCheck.length < 2) {
    return {
      valid: false,
      code: 'VALIDATION_FAILED',
      message: 'First and last name are required.'
    };
  }

  if (input.firstName !== undefined && !input.firstName.trim()) {
    return {
      valid: false,
      code: 'VALIDATION_FAILED',
      message: 'First name is required.'
    };
  }

  if (input.lastName !== undefined && !input.lastName.trim()) {
    return {
      valid: false,
      code: 'VALIDATION_FAILED',
      message: 'Last name is required.'
    };
  }

  const emailCheck = validateEmailFormat(input.email);
  if (!emailCheck.valid) {
    return {
      valid: false,
      code: 'VALIDATION_FAILED',
      message: emailCheck.message
    };
  }

  if (input.phone !== undefined) {
    const digits = input.phone.replace(/\D/g, '');
    if (digits.length < 7) {
      return {
        valid: false,
        code: 'VALIDATION_FAILED',
        message: 'A valid mobile telephone number is required.'
      };
    }
  }

  if (input.category && input.category !== 'individual') {
    if (!input.company || !input.company.trim()) {
      return {
        valid: false,
        code: 'VALIDATION_FAILED',
        message: 'Entity or business legal name is required for business classifications.'
      };
    }
  }

  const pwCheck = validatePasswordStrength(input.password || '');
  if (!pwCheck.valid) {
    return {
      valid: false,
      code: 'VALIDATION_FAILED',
      message: pwCheck.message
    };
  }

  if (input.requireConfirmPassword || input.confirmPassword !== undefined) {
    if ((input.password || '') !== (input.confirmPassword || '')) {
      return {
        valid: false,
        code: 'VALIDATION_FAILED',
        message: 'Password confirmation does not match.'
      };
    }
  }

  if (input.requireTerms && !input.acceptedTerms) {
    return {
      valid: false,
      code: 'VALIDATION_FAILED',
      message: 'Please accept the Terms of Service, Privacy Policy and IRC § 7216 disclosure to proceed.'
    };
  }

  return { valid: true };
}

/**
 * Sanitizes any upstream authentication error so raw SQL errors, Supabase internal
 * stack traces, JWTs, database URLs, or service-role keys are never exposed.
 */
export function sanitizeAuthErrorMessage(
  rawError: unknown,
  fallbackCode: ControlledAuthErrorCode = 'AUTH_SERVICE_UNAVAILABLE'
): { code: ControlledAuthErrorCode; message: string } {
  const rawMessage =
    typeof rawError === 'string'
      ? rawError
      : rawError && typeof (rawError as any).message === 'string'
        ? (rawError as any).message
        : '';

  const lower = rawMessage.toLowerCase();

  if (
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('user_already_exists') ||
    lower.includes('duplicate')
  ) {
    return {
      code: 'REGISTRATION_FAILED',
      message:
        'Unable to complete registration with the provided email address. If you already have an account, please sign in or reset your password.'
    };
  }

  if (
    lower.includes('email not confirmed') ||
    lower.includes('email_not_confirmed') ||
    lower.includes('verify your email')
  ) {
    return {
      code: 'EMAIL_VERIFICATION_REQUIRED',
      message:
        'Your email address has not been verified yet. Please check your inbox and verify your email to continue.'
    };
  }

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid email or password') ||
    lower.includes('invalid_credentials')
  ) {
    return {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password combination. Please check your credentials and try again.'
    };
  }

  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return {
      code: 'AUTH_SERVICE_UNAVAILABLE',
      message: 'Access temporarily restricted due to multiple attempts. Please wait a moment and try again.'
    };
  }

  if (lower.includes('tenant_access_denied') || lower.includes('identity_denied')) {
    return {
      code: 'TENANT_ACCESS_DENIED',
      message: 'Access to this TaxGuard tenant is restricted. Please contact support.'
    };
  }

  if (lower.includes('client_initialization_failed')) {
    return {
      code: 'CLIENT_INITIALIZATION_FAILED',
      message: 'Your Client Tax Center profile could not be initialized. Please try again.'
    };
  }

  if (lower.includes('case_initialization_failed')) {
    return {
      code: 'CASE_INITIALIZATION_FAILED',
      message: 'Your Stage 01 onboarding case could not be initialized. Please try again.'
    };
  }

  if (lower.includes('session_establishment_failed') || lower.includes('invalid_token')) {
    return {
      code: 'SESSION_ESTABLISHMENT_FAILED',
      message: 'A secure TaxGuard session could not be established. Please sign in again.'
    };
  }

  if (fallbackCode === 'REGISTRATION_FAILED') {
    return {
      code: 'REGISTRATION_FAILED',
      message: 'Registration could not be completed at this time. Please verify your information and try again.'
    };
  }

  return {
    code: fallbackCode,
    message: 'The TaxGuard authentication service is temporarily unavailable. Please try again shortly.'
  };
}

export async function loginWithEmail(
  email: string,
  pass: string
): Promise<{
  success: boolean;
  user?: AuthUserProfile;
  accessToken?: string;
  code?: ControlledAuthErrorCode;
  emailVerificationRequired?: boolean;
  error?: string;
}> {
  try {
    const emailCheck = validateEmailFormat(email);
    if (!emailCheck.valid) {
      return {
        success: false,
        code: 'VALIDATION_FAILED',
        error: emailCheck.message
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pass
    });

    if (error) {
      const sanitized = sanitizeAuthErrorMessage(error, 'INVALID_CREDENTIALS');
      return {
        success: false,
        code: sanitized.code,
        emailVerificationRequired: sanitized.code === 'EMAIL_VERIFICATION_REQUIRED',
        error: sanitized.message
      };
    }

    if (!data.user || !data.session || !data.session.access_token) {
      return {
        success: false,
        code: 'SESSION_ESTABLISHMENT_FAILED',
        error: 'Authentication succeeded but no active session was returned.'
      };
    }

    const sbUser = data.user;
    const profile: AuthUserProfile = {
      uid: sbUser.id,
      email: sbUser.email || normalizedEmail,
      fullName: sbUser.user_metadata?.full_name || 'Client',
      role: 'client', // Default placeholder; authoritative role is established by server
      phone: sbUser.user_metadata?.phone || '',
      organizationId: sbUser.user_metadata?.organization_id || '',
      status: 'active',
      emailVerified: Boolean(sbUser.confirmed_at || sbUser.email_confirmed_at)
    };

    return {
      success: true,
      user: profile,
      accessToken: data.session.access_token
    };
  } catch (err: any) {
    const sanitized = sanitizeAuthErrorMessage(err, 'AUTH_SERVICE_UNAVAILABLE');
    return {
      success: false,
      code: sanitized.code,
      error: sanitized.message
    };
  }
}

export async function registerWithEmail(
  name: string,
  email: string,
  pass: string,
  phone?: string,
  companyName?: string
): Promise<{
  success: boolean;
  status?: 'SESSION_READY' | 'EMAIL_VERIFICATION_REQUIRED' | 'FAILED';
  emailVerificationRequired?: boolean;
  duplicateRegistration?: boolean;
  code?: ControlledAuthErrorCode;
  user?: AuthUserProfile;
  accessToken?: string;
  error?: string;
}> {
  try {
    const emailCheck = validateEmailFormat(email);
    if (!emailCheck.valid) {
      return {
        success: false,
        status: 'FAILED',
        code: 'VALIDATION_FAILED',
        error: emailCheck.message
      };
    }

    const pwCheck = validatePasswordStrength(pass);
    if (!pwCheck.valid) {
      return {
        success: false,
        status: 'FAILED',
        code: 'VALIDATION_FAILED',
        error: pwCheck.message
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://artaxserv.com';

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: pass,
      options: {
        emailRedirectTo: `${defaultOrigin}/#/stage_one_onboard`,
        data: {
          full_name: name.trim(),
          phone: phone || '',
          company_name: companyName || '',
          role: 'client' // New public registrations are strictly client
        }
      }
    });

    if (error) {
      const sanitized = sanitizeAuthErrorMessage(error, 'REGISTRATION_FAILED');
      const isDuplicate =
        error.message?.toLowerCase().includes('already') ||
        error.message?.toLowerCase().includes('exists') ||
        error.message?.toLowerCase().includes('duplicate');
      return {
        success: false,
        status: 'FAILED',
        code: sanitized.code,
        duplicateRegistration: Boolean(isDuplicate),
        error: sanitized.message
      };
    }

    if (!data.user) {
      return {
        success: false,
        status: 'FAILED',
        code: 'REGISTRATION_FAILED',
        error: 'Registration could not be completed. No account record was returned.'
      };
    }

    const sbUser = data.user;

    // Supabase obfuscates duplicate signups when email confirmation is enabled by returning
    // a user object with an empty identities array. Detect this safely without leaking taxpayer PII.
    if (Array.isArray(sbUser.identities) && sbUser.identities.length === 0) {
      return {
        success: false,
        status: 'FAILED',
        code: 'REGISTRATION_FAILED',
        duplicateRegistration: true,
        error:
          'Unable to complete registration with the provided email address. If you already have an account, please sign in or reset your password.'
      };
    }

    const profile: AuthUserProfile = {
      uid: sbUser.id,
      email: sbUser.email || normalizedEmail,
      fullName: name.trim(),
      role: 'client',
      phone: phone || '',
      organizationId: companyName ? `org_${sbUser.id}` : '',
      status: 'active',
      emailVerified: Boolean(sbUser.confirmed_at || sbUser.email_confirmed_at)
    };

    const accessToken = data.session?.access_token;

    if (!accessToken) {
      // CASE B: User created, but Supabase requires email confirmation before issuing a session
      return {
        success: true,
        status: 'EMAIL_VERIFICATION_REQUIRED',
        emailVerificationRequired: true,
        code: 'EMAIL_VERIFICATION_REQUIRED',
        user: profile,
        accessToken: undefined
      };
    }

    // CASE A: Supabase returned an active session immediately
    return {
      success: true,
      status: 'SESSION_READY',
      emailVerificationRequired: false,
      user: profile,
      accessToken
    };
  } catch (err: any) {
    const sanitized = sanitizeAuthErrorMessage(err, 'REGISTRATION_FAILED');
    return {
      success: false,
      status: 'FAILED',
      code: sanitized.code,
      error: sanitized.message
    };
  }
}

export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const emailCheck = validateEmailFormat(email);
    if (!emailCheck.valid) {
      return {
        success: false,
        message: '',
        error: emailCheck.message
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://artaxserv.com';

    const resendFn = (supabase.auth as any).resend;
    if (typeof resendFn === 'function') {
      const { error } = await resendFn.call(supabase.auth, {
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${defaultOrigin}/#/stage_one_onboard`
        }
      });

      if (error) {
        const sanitized = sanitizeAuthErrorMessage(error, 'AUTH_SERVICE_UNAVAILABLE');
        return {
          success: false,
          message: '',
          error: sanitized.message
        };
      }
    }

    return {
      success: true,
      message: 'A new verification email has been sent. Please check your inbox and spam folder.'
    };
  } catch (err: any) {
    const sanitized = sanitizeAuthErrorMessage(err, 'AUTH_SERVICE_UNAVAILABLE');
    return {
      success: false,
      message: '',
      error: sanitized.message
    };
  }
}

export async function logout(): Promise<boolean> {
  try {
    await supabase.auth.signOut();
    return true;
  } catch {
    return false;
  }
}

export const NEUTRAL_PASSWORD_RESET_MESSAGE =
  'If an account exists for this email address, password recovery instructions have been sent.';
export const NEUTRAL_RECOVERY_MESSAGE = NEUTRAL_PASSWORD_RESET_MESSAGE;

export async function requestPasswordReset(
  email: string,
  redirectTo?: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const emailValidation = validateEmailFormat(email);
    if (!emailValidation.valid) {
      return {
        success: false,
        error: emailValidation.message || 'Please enter a valid email address.'
      };
    }

    const normalizedEmail = email.trim().toLowerCase();
    const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://artaxserv.com';
    const redirectUrl = redirectTo || `${defaultOrigin}/#/client/reset-password`;

    // Dispatch Supabase password reset
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl
    });

    if (error) {
      const errMsg = (error.message || '').toLowerCase();
      if (errMsg.includes('rate') || errMsg.includes('too many') || (error as any).status === 429) {
        return {
          success: false,
          error: 'Access temporarily restricted due to excessive requests. Please try again later.'
        };
      }
    }

    // Invariant: Always return neutral response to prevent account enumeration
    return {
      success: true,
      message: NEUTRAL_PASSWORD_RESET_MESSAGE
    };
  } catch (err: any) {
    const errStr = (err?.message || String(err)).toLowerCase();
    if (errStr.includes('rate') || errStr.includes('too many') || err?.status === 429) {
      return {
        success: false,
        error: 'Access temporarily restricted due to excessive requests. Please try again later.'
      };
    }
    return {
      success: true,
      message: NEUTRAL_PASSWORD_RESET_MESSAGE
    };
  }
}

export async function completePasswordReset(
  newPass: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const check = validatePasswordStrength(newPass);
    if (!check.valid) {
      return { success: false, error: check.message || check.errors[0] };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPass
    });

    if (error) {
      return {
        success: false,
        error: 'Password update could not be completed. The recovery link is invalid or has expired.'
      };
    }

    return {
      success: true,
      message: 'Password successfully updated. You may now log in with your new password.'
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Password reset could not be completed. Please try requesting a new link.'
    };
  }
}

export async function checkRecoverySession(): Promise<{
  isValid: boolean;
  email?: string;
  isExpired?: boolean;
  error?: string;
}> {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const fullQuery = `${hash}&${search}`;
      if (
        fullQuery.includes('error=access_denied') ||
        fullQuery.includes('otp_expired') ||
        fullQuery.includes('expired')
      ) {
        const descMatch = fullQuery.match(/error_description=([^&]+)/);
        const description = descMatch
          ? decodeURIComponent(descMatch[1].replace(/\+/g, ' '))
          : 'Email link is invalid or has expired.';
        return {
          isValid: false,
          isExpired: true,
          error: description
        };
      }
    }

    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.user) {
      return {
        isValid: false,
        error: 'No active recovery session found.'
      };
    }

    return {
      isValid: true,
      email: data.session.user.email
    };
  } catch (err: any) {
    return {
      isValid: false,
      error: err?.message || 'Failed to verify recovery session.'
    };
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session) {
      return null;
    }

    const session = data.session;
    const expiresAtMs = session.expires_at ? session.expires_at * 1000 : 0;

    // Refresh token if expired or expiring within 60 seconds
    if (expiresAtMs > 0 && expiresAtMs <= Date.now() + 60_000) {
      const refreshFn = (supabase.auth as any).refreshSession;
      if (typeof refreshFn === 'function') {
        const { data: refreshed, error: refreshError } = await refreshFn.call(supabase.auth);
        if (!refreshError && refreshed?.session?.access_token) {
          return refreshed.session.access_token;
        }
        return null;
      }
    }

    return session.access_token || null;
  } catch {
    return null;
  }
}
