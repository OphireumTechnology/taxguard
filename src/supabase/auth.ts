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

export async function loginWithEmail(
  email: string,
  pass: string
): Promise<{
  success: boolean;
  user?: AuthUserProfile;
  accessToken?: string;
  error?: string;
}> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pass
    });

    if (error) {
      let msg = error.message || 'Invalid email or password combination.';
      if (error.status === 400 || error.message.toLowerCase().includes('invalid login credentials')) {
        msg = 'Invalid email or password combination. Please check your credentials and try again.';
      } else if (error.message.toLowerCase().includes('rate limit') || error.status === 429) {
        msg = 'Access temporarily restricted due to multiple failed attempts. Please try again later.';
      }
      return { success: false, error: msg };
    }

    if (!data.user || !data.session) {
      return { success: false, error: 'Authentication succeeded but no active session was returned.' };
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
    return {
      success: false,
      error: err?.message || 'Authentication service could not be reached.'
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
  user?: AuthUserProfile;
  accessToken?: string;
  error?: string;
}> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: pass,
      options: {
        data: {
          full_name: name,
          phone: phone || '',
          company_name: companyName || '',
          role: 'client' // New public registrations are strictly client
        }
      }
    });

    if (error) {
      return { success: false, error: error.message || 'Registration failed.' };
    }

    if (!data.user) {
      return { success: false, error: 'Registration succeeded but user profile was not returned.' };
    }

    const sbUser = data.user;
    const profile: AuthUserProfile = {
      uid: sbUser.id,
      email: sbUser.email || normalizedEmail,
      fullName: name,
      role: 'client',
      phone: phone || '',
      organizationId: companyName ? `org_${sbUser.id}` : '',
      status: 'active',
      emailVerified: Boolean(sbUser.confirmed_at || sbUser.email_confirmed_at)
    };

    return {
      success: true,
      user: profile,
      accessToken: data.session?.access_token
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Registration could not be completed.'
    };
  }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut().catch(() => {});
}

export const NEUTRAL_PASSWORD_RESET_MESSAGE =
  'If an account exists for this email address, password recovery instructions have been sent.';

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (!password || password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one uppercase letter.' };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one lowercase letter.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one number.' };
  }
  return { valid: true };
}

export async function requestPasswordReset(
  email: string,
  redirectTo?: string
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://artaxserv.com';
    const redirectUrl = redirectTo || `${defaultOrigin}/#/client/reset-password`;

    // Dispatch Supabase password reset
    await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl
    }).catch(err => {
      console.warn('[Supabase Auth] Password reset request dispatch note:', err?.message || err);
    });

    // Invariant: Always return neutral response to prevent account enumeration
    return {
      success: true,
      message: NEUTRAL_PASSWORD_RESET_MESSAGE
    };
  } catch (err: any) {
    console.warn('[Supabase Auth] Password reset processing note:', err?.message || err);
    return {
      success: true,
      message: NEUTRAL_PASSWORD_RESET_MESSAGE
    };
  }
}

export async function completePasswordReset(
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const check = validatePasswordStrength(newPass);
    if (!check.valid) {
      return { success: false, error: check.message };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPass
    });

    if (error) {
      return {
        success: false,
        error: 'Password update could not be completed. The recovery link may have expired or is invalid.'
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: 'Password reset could not be completed. Please try requesting a new link.'
    };
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}
