import { createClient, SupabaseClient } from '@supabase/supabase-js';

const metaEnv = typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined;
const nodeEnv = typeof process !== 'undefined' ? process.env : undefined;
const supabaseUrl = metaEnv?.VITE_SUPABASE_URL || nodeEnv?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = metaEnv?.VITE_SUPABASE_ANON_KEY || nodeEnv?.VITE_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http'));
}

export function isStaffIdentityDevelopmentConfigured(): boolean {
  return isSupabaseConfigured();
}

export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (createClient('https://supabase-not-configured.invalid', 'not-configured', {
      global: {
        fetch: async () => {
          throw new Error('Supabase is not configured.');
        }
      }
    }));
