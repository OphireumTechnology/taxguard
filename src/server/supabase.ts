import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface VerifiedSupabaseUser {
  id: string;
  email?: string;
  aal?: 'aal1' | 'aal2';
  app_metadata?: Record<string, any>;
  user_metadata?: Record<string, any>;
  [key: string]: any;
}

let cachedAdmin: SupabaseClient | null = null;

export function cleanSupabaseUrl(raw?: string): string {
  return (raw || '').trim().replace(/\/+$/, '');
}

export function isSupabaseServerConfigured(): boolean {
  const url = cleanSupabaseUrl(process.env.SUPABASE_URL);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return Boolean(url && key);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cachedAdmin) return cachedAdmin;
  const url = cleanSupabaseUrl(process.env.SUPABASE_URL);
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) {
    throw new Error('Supabase server credentials are not configured.');
  }
  cachedAdmin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}
