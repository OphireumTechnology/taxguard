import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(key: string): string {
  const val = (import.meta.env as Record<string, string | undefined>)[key];
  return (val || '').trim();
}

export function isSupabaseConfigured(): boolean {
  const url = readEnv('VITE_SUPABASE_URL');
  const anonKey = readEnv('VITE_SUPABASE_ANON_KEY');
  return Boolean(
    url &&
    anonKey &&
    !url.includes('placeholder') &&
    !anonKey.includes('placeholder') &&
    !url.includes('unconfigured')
  );
}

export function isStaffIdentityDevelopmentConfigured(): boolean {
  if (import.meta.env.PROD) return false;
  return readEnv('VITE_STAFF_IDENTITY_DEVELOPMENT') === 'true' || !isSupabaseConfigured();
}

function createFailClosedSupabaseClient(): SupabaseClient {
  const unconfiguredError = { message: 'Supabase authentication is not configured for this environment.' };
  const stubAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
    signInWithPassword: async () => ({ data: { user: null, session: null }, error: unconfiguredError }),
    signUp: async () => ({ data: { user: null, session: null }, error: unconfiguredError }),
    signOut: async () => ({ error: null }),
    resend: async () => ({ data: null, error: unconfiguredError }),
    resetPasswordForEmail: async () => ({ data: null, error: unconfiguredError }),
    onAuthStateChange: () => ({
      data: {
        subscription: {
          id: 'stub-subscription',
          callback: () => {},
          unsubscribe: () => {}
        }
      }
    }),
    mfa: {
      getAuthenticatorAssuranceLevel: async () => ({
        data: { currentLevel: null, nextLevel: null, currentAuthenticationMethods: [] },
        error: unconfiguredError
      }),
      listFactors: async () => ({ data: { all: [], totp: [], phone: [] }, error: unconfiguredError }),
      enroll: async () => ({ data: null, error: unconfiguredError }),
      challenge: async () => ({ data: null, error: unconfiguredError }),
      verify: async () => ({ data: null, error: unconfiguredError }),
      challengeAndVerify: async () => ({ data: null, error: unconfiguredError }),
      unenroll: async () => ({ data: null, error: unconfiguredError })
    }
  };

  return {
    auth: stubAuth
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createClient(readEnv('VITE_SUPABASE_URL'), readEnv('VITE_SUPABASE_ANON_KEY'), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : createFailClosedSupabaseClient();
