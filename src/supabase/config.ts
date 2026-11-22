import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const configured = Boolean(supabaseUrl && supabaseAnonKey);

export function isSupabaseConfigured(): boolean {
  return configured;
}

export function isStaffIdentityDevelopmentConfigured(): boolean {
  return Boolean(configured || import.meta.env.DEV);
}

export const supabase: SupabaseClient | null = configured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
