/**
 * Server-Side Supabase Administration & JWT Verification
 * Provides privileged database access and cryptographic token validation.
 * NEVER exposed to the browser or frontend bundles.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _supabaseAdmin: SupabaseClient | null = null;

export function cleanSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1\/?$/, '');
  return url.replace(/\/+$/, '');
}

export function setSupabaseAdmin(client: SupabaseClient | null): void {
  _supabaseAdmin = client;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    const url = cleanSupabaseUrl(process.env.SUPABASE_URL);
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!url || !serviceRoleKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SUPABASE_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
      }
      // Development fallback client
      _supabaseAdmin = createClient(url || 'http://127.0.0.1:54321', serviceRoleKey || 'dev-service-role-key', {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    } else {
      _supabaseAdmin = createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  }
  return _supabaseAdmin;
}

export function isSupabaseServerConfigured(): boolean {
  const url = cleanSupabaseUrl(process.env.SUPABASE_URL);
  if (!url || url.includes('your-project') || url.includes('placeholder')) {
    return false;
  }
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY));
}

export interface VerifiedSupabaseUser {
  uid: string;
  email: string;
  displayName?: string;
  phone?: string;
  metadata?: Record<string, any>;
  authTime: number;
}

/**
 * Cryptographically verifies a Supabase access token (JWT) using the Supabase server client.
 * Returns the verified user identity or throws if invalid or expired.
 */
export async function verifySupabaseAccessToken(accessToken: string, client?: SupabaseClient): Promise<VerifiedSupabaseUser> {
  if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
    throw new Error('ACCESS_TOKEN_REQUIRED');
  }

  const admin = client || getSupabaseAdmin();
  const { data: { user }, error } = await admin.auth.getUser(accessToken);

  if (error || !user) {
    throw new Error(`INVALID_SUPABASE_TOKEN: ${error?.message || 'Token verification failed'}`);
  }

  const email = (user.email || '').trim().toLowerCase();
  if (!email) {
    throw new Error('TOKEN_EMAIL_MISSING');
  }

  return {
    uid: user.id,
    email,
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || email,
    phone: user.user_metadata?.phone || '',
    metadata: user.user_metadata || {},
    authTime: user.last_sign_in_at ? Math.floor(new Date(user.last_sign_in_at).getTime() / 1000) : Math.floor(Date.now() / 1000)
  };
}
