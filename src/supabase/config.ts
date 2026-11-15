import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function isSupabaseConfigured(): boolean {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return Boolean(url && key && !url.includes('placeholder') && !key.includes('placeholder'));
}

export function isStaffIdentityDevelopmentConfigured(): boolean {
  return !import.meta.env.PROD && isSupabaseConfigured();
}

const createSafeOfflineClient = (): SupabaseClient => {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({
        data: { user: null, session: null },
        error: { message: 'Supabase authentication is not configured.' },
      }),
      signUp: async () => ({
        data: { user: null, session: null },
        error: { message: 'Supabase authentication is not configured.' },
      }),
      signOut: async () => ({ error: null }),
      resend: async () => ({ data: null, error: { message: 'Supabase authentication is not configured.' } }),
      resetPasswordForEmail: async () => ({ data: null, error: { message: 'Supabase authentication is not configured.' } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({
          data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
          error: null,
        }),
        listFactors: async () => ({ data: { all: [], totp: [], phone: [] }, error: null }),
        enroll: async () => ({ data: null, error: { message: 'MFA unavailable offline.' } }),
        challenge: async () => ({ data: null, error: { message: 'MFA unavailable offline.' } }),
        verify: async () => ({ data: null, error: { message: 'MFA unavailable offline.' } }),
        unenroll: async () => ({ data: null, error: { message: 'MFA unavailable offline.' } }),
      },
    },
  } as unknown as SupabaseClient;
};

export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)
  : createSafeOfflineClient();
