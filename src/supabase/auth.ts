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

export async function requestPasswordReset(
  email: string,
  redirectTo?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const redirectUrl = redirectTo || (typeof window !== 'undefined' ? `${window.location.origin}/#/client/login` : undefined);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: redirectUrl
    });

    if (error) {
      return {
        success: false,
        error: error.message || 'Unable to dispatch password reset email. Please verify the address.'
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Password reset request could not be processed.'
    };
  }
}

export async function completePasswordReset(
  newPass: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.updateUser({
      password: newPass
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to update password.' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Password reset could not be completed.' };
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}
