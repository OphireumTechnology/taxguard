import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface VerifiedSupabaseUser {
  id: string;
  email: string;
  emailVerified?: boolean;
  appMetadata?: Record<string, any>;
  userMetadata?: Record<string, any>;
  [key: string]: any;
}

let cachedAdmin: SupabaseClient | null = null;

export function isSupabaseServerConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean((env.SUPABASE_URL || '').trim() && (env.SUPABASE_SERVICE_ROLE_KEY || '').trim());
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseServerConfigured()) return null;
  if (!cachedAdmin) {
    cachedAdmin = createClient(
      (process.env.SUPABASE_URL || '').trim(),
      (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
  }
  return cachedAdmin;
}
