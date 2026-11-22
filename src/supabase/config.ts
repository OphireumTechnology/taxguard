import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
const anonKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY || '').trim();

const configured: boolean = Boolean(url && anonKey);

export function isSupabaseConfigured(): boolean {
  return configured;
}

export const supabase: SupabaseClient | null = configured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export function isStaffIdentityDevelopmentConfigured(): boolean {
  return Boolean(import.meta.env?.VITE_STAFF_IDENTITY_DEV === 'true' && configured);
}
