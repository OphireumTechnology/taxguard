import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigResolution {
  isConfigured: boolean;
  issues: string[];
  url?: string;
  anonKey?: string;
}

export function resolveSupabaseBrowserConfig(): SupabaseConfigResolution {
  const url = import.meta.env?.VITE_SUPABASE_URL;
  const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;
  const issues: string[] = [];

  if (!url || typeof url !== 'string' || !url.trim()) {
    issues.push('URL_MISSING');
  } else if (url.includes('placeholder') || url.includes('example.com')) {
    issues.push('PLACEHOLDER_VALUE');
  } else {
    try {
      const parsed = new URL(url);
      const isLoopback = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
      if (parsed.protocol !== 'https:' && !isLoopback) {
        issues.push('URL_INSECURE');
      }
    } catch {
      issues.push('URL_INVALID');
    }
  }

  if (!anonKey || typeof anonKey !== 'string' || !anonKey.trim()) {
    issues.push('ANON_KEY_MISSING');
  } else if (anonKey.includes('placeholder')) {
    issues.push('PLACEHOLDER_VALUE');
  }

  const isConfigured = issues.length === 0;
  return {
    isConfigured,
    issues,
    url: isConfigured ? url : undefined,
    anonKey: isConfigured ? anonKey : undefined,
  };
}

export function isSupabaseConfigured(): boolean {
  return resolveSupabaseBrowserConfig().isConfigured;
}

export function isStaffIdentityDevelopmentConfigured(): boolean {
  return isSupabaseConfigured() && Boolean(import.meta.env?.DEV || import.meta.env?.VITE_APP_ENV === 'development');
}

const config = resolveSupabaseBrowserConfig();

export const supabase: SupabaseClient = config.isConfigured
  ? createClient(config.url!, config.anonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://unconfigured.invalid', 'fail-closed-anon-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: async () => {
          throw new Error('TaxGuard authentication is not configured in this environment.');
        },
      },
    });
