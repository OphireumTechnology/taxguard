import { verifiedPrimaryAuthTime } from './verifiedPrimaryAuthTime';
import { isProtectedIdentityDestination } from '../supabase/protectedDestination';
/**
 * Server-Side Supabase Administration & JWT Verification
 * Provides privileged database access and cryptographic token validation.
 * NEVER exposed to the browser or frontend bundles.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { verifiedTokenAssuranceLevel } from './staffMfa';

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
  if (process.env.NODE_ENV !== 'production' && isProtectedIdentityDestination(cleanSupabaseUrl(process.env.SUPABASE_URL))) {
    throw new Error('SUPABASE_PRODUCTION_PROJECT_BLOCKED');
  }
  if (!_supabaseAdmin) {
    const url = cleanSupabaseUrl(process.env.SUPABASE_URL);
    // The public anon key is never a substitute for the privileged service credential.
    const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

    if (!url || !serviceRoleKey) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SUPABASE_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
      }
      // Fail-closed development client: never invents credentials or targets an assumed
      // local endpoint. Every request rejects locally with SUPABASE_CONFIG_MISSING.
      _supabaseAdmin = createClient('https://supabase-not-configured.invalid', 'not-configured', {
        global: {
          fetch: async () => {
            throw new Error('SUPABASE_CONFIG_MISSING: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not configured.');
          }
        },
        db: { retry: false },
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
  if (process.env.NODE_ENV !== 'production' && isProtectedIdentityDestination(url)) return false;
  if (!url || url.includes('your-project') || url.includes('placeholder')) {
    return false;
  }
  return Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim());
}

export interface VerifiedSupabaseUser {
  uid: string;
  email: string;
  displayName?: string;
  emailVerified?: boolean;
  phone?: string;
  metadata?: Record<string, any>;
  authTime: number;
  /** Token-bound primary sign-in proof; absent if verified AMR evidence is missing or malformed. */
  primaryAuthTime?: number;
  /** Authenticator assurance level of the verified access token (aal2 = an MFA factor was used). */
  aal?: 'aal1' | 'aal2';
  /** Number of verified MFA factors enrolled on the Supabase user. */
  verifiedFactorCount?: number;
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
    emailVerified: Boolean(user.email_confirmed_at),
    displayName: user.user_metadata?.full_name || user.user_metadata?.name || email,
    phone: user.user_metadata?.phone || '',
    metadata: user.user_metadata || {},
    authTime: user.last_sign_in_at ? Math.floor(new Date(user.last_sign_in_at).getTime() / 1000) : Math.floor(Date.now() / 1000),
    primaryAuthTime: verifiedPrimaryAuthTime(accessToken),
    // The token was just verified by the Supabase Auth server, so its claims can be read.
    aal: verifiedTokenAssuranceLevel(accessToken),
    verifiedFactorCount: (user.factors || []).filter((factor: { status?: string }) => factor.status === 'verified').length
  };
}
