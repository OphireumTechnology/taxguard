import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
  return Boolean(url && key && !url.includes('placeholder') && !key.includes('placeholder'));
}

export function isStaffIdentityDevelopmentConfigured(): boolean {
  return !import.meta.env.PROD || import.meta.env.VITE_APP_ENV === 'development';
}

function createNoOpSupabaseClient(): SupabaseClient {
  const unconfiguredError = { message: 'Identity provider is not configured in this environment.', name: 'AuthError', status: 503 };
  return {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null, session: null }, error: unconfiguredError }),
      signUp: async () => ({ data: { user: null, session: null }, error: unconfiguredError }),
      signOut: async () => ({ error: null }),
      resetPasswordForEmail: async () => ({ data: {}, error: unconfiguredError }),
      resend: async () => ({ data: {}, error: unconfiguredError }),
      mfa: {
        getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1', currentAuthenticationMethods: [] }, error: null }),
        listFactors: async () => ({ data: { all: [], totp: [], phone: [] }, error: null }),
        enroll: async () => ({ data: null, error: unconfiguredError }),
        challenge: async () => ({ data: null, error: unconfiguredError }),
        verify: async () => ({ data: null, error: unconfiguredError }),
        challengeAndVerify: async () => ({ data: null, error: unconfiguredError }),
        unenroll: async () => ({ data: null, error: unconfiguredError }),
      },
    },
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(import.meta.env.VITE_SUPABASE_URL!.trim(), import.meta.env.VITE_SUPABASE_ANON_KEY!.trim())
  : createNoOpSupabaseClient();
