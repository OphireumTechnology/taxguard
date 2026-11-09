import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function isSupabaseServerConfigured(): boolean {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return Boolean(url && key && !url.includes('placeholder') && !key.includes('placeholder'));
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isSupabaseServerConfigured() && url && key) {
    return createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  // Fail-closed server client
  return createClient('https://unconfigured.invalid', 'fail-closed-service-key', {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      fetch: async () => {
        throw new Error('SUPABASE_CONFIG_MISSING: Supabase server is not configured.');
      }
    }
  });
}
