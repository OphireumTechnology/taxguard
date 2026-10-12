/**
 * Supabase Client Configuration for TaxGuard AI
 * Browser and frontend SDK initialization.
 * Exposes publishable anon key only. Never exposes service role key to frontend.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isProtectedIdentityDestination } from './protectedDestination';

export const SUPABASE_NOT_CONFIGURED_ERROR = 'SUPABASE_NOT_CONFIGURED';

// Reserved .invalid TLD (RFC 2606) never resolves. Combined with the blocking fetch below,
// an unconfigured client can never send credentials to any external host.
const UNCONFIGURED_SUPABASE_URL = 'https://supabase-not-configured.invalid';

export function cleanSupabaseUrl(rawUrl?: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim();
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/rest\/v1\/?$/, '');
  return url.replace(/\/+$/, '');
}

export type SupabaseBrowserConfigIssue =
  | 'URL_MISSING'
  | 'ANON_KEY_MISSING'
  | 'URL_INVALID'
  | 'URL_INSECURE'
  | 'PLACEHOLDER_VALUE'
  | 'PROTECTED_PRODUCTION_DESTINATION'
  | 'URL_CREDENTIALS';

export interface SupabaseBrowserConfig {
  configured: boolean;
  url: string;
  anonKey: string;
  issues: SupabaseBrowserConfigIssue[];
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function looksLikePlaceholder(value: string): boolean {
  const lower = value.toLowerCase();
  return lower.includes('placeholder') || lower.includes('your-project') || lower.includes('your_supabase') || lower.includes('your-anon-key');
}

/**
 * Pure resolution of the browser Supabase contract (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY).
 * Reports issue codes only; never echoes configured values.
 */
export function resolveSupabaseBrowserConfig(rawUrl?: string, rawAnonKey?: string, development = false): SupabaseBrowserConfig {
  const url = cleanSupabaseUrl(rawUrl);
  const anonKey = (rawAnonKey || '').trim();
  const issues: SupabaseBrowserConfigIssue[] = [];

  if (!url) {
    issues.push('URL_MISSING');
  } else {
    let parsed: URL | null = null;
    try {
      parsed = new URL(url);
    } catch {
      issues.push('URL_INVALID');
    }
    if (parsed) {
      if (parsed.username || parsed.password) issues.push('URL_CREDENTIALS');
      if (development && isProtectedIdentityDestination(url)) issues.push('PROTECTED_PRODUCTION_DESTINATION');
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname))) {
        issues.push(parsed.protocol === 'http:' ? 'URL_INSECURE' : 'URL_INVALID');
      }
    }
  }
  if (!anonKey) issues.push('ANON_KEY_MISSING');
  if ((url && looksLikePlaceholder(url)) || (anonKey && looksLikePlaceholder(anonKey))) {
    issues.push('PLACEHOLDER_VALUE');
  }

  return { configured: issues.length === 0, url, anonKey, issues };
}

// Server code (tsx in development) also loads this module; there import.meta.env is undefined and
// the browser client must stay unconfigured (fail-closed), exactly as the esbuild define makes it.
const viteEnv: Partial<ImportMetaEnv> = import.meta.env ?? {};
const browserConfig = resolveSupabaseBrowserConfig(
  viteEnv.VITE_SUPABASE_URL,
  viteEnv.VITE_SUPABASE_ANON_KEY,
  viteEnv.DEV === true
);

let _supabaseClient: SupabaseClient | null = null;
let _blockedDevelopmentClient: SupabaseClient | null = null;

export function setSupabaseClient(client: SupabaseClient | null): void {
  _supabaseClient = client;
  _blockedDevelopmentClient = null;
}

const blockedFetch: typeof fetch = async () => {
  throw new Error(SUPABASE_NOT_CONFIGURED_ERROR);
};

/**
 * Creates a fail-closed client: every network operation rejects locally with
 * SUPABASE_NOT_CONFIGURED, and no session is persisted, refreshed or read from the URL.
 */
export function createUnconfiguredSupabaseClient(): SupabaseClient {
  return createClient(UNCONFIGURED_SUPABASE_URL, 'not-configured', {
    global: { fetch: blockedFetch },
    db: { retry: false },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export function getSupabase(): SupabaseClient {
  if (viteEnv.DEV === true && isProtectedIdentityDestination(browserConfig.url)) {
    _blockedDevelopmentClient ??= createUnconfiguredSupabaseClient();
    return _blockedDevelopmentClient;
  }
  if (!_supabaseClient) {
    if (!browserConfig.configured) {
      console.warn(
        `[Supabase] Browser authentication is not configured (${browserConfig.issues.join(', ')}). ` +
          'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for an authorized non-production project.'
      );
      _supabaseClient = createUnconfiguredSupabaseClient();
    } else {
      _supabaseClient = createClient(browserConfig.url, browserConfig.anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
    }
  }
  return _supabaseClient;
}

export const supabase = {
  get auth() {
    return getSupabase().auth;
  },
  get storage() {
    return getSupabase().storage;
  },
  from(table: string) {
    return getSupabase().from(table);
  }
} as unknown as SupabaseClient;

export function isSupabaseConfigured(): boolean {
  return browserConfig.configured;
}

export function getSupabaseConfigIssues(): readonly SupabaseBrowserConfigIssue[] {
  return [...browserConfig.issues];
}

/** New staff onboarding is never enabled against the protected project or a production build. */
export function isStaffIdentityDevelopmentConfigured(): boolean {
  if (!viteEnv.DEV || viteEnv.VITE_TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED !== 'true' || !browserConfig.configured) return false;
  return !isProtectedIdentityDestination(browserConfig.url);
}
