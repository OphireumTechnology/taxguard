import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  resolveSupabaseBrowserConfig,
  createUnconfiguredSupabaseClient,
  setSupabaseClient,
  SUPABASE_NOT_CONFIGURED_ERROR
} from '../supabase/config';
import { loginWithEmail, requestPasswordReset, sanitizeAuthErrorMessage } from '../supabase/auth';
import { getSupabaseAdmin, isSupabaseServerConfigured, setSupabaseAdmin, verifySupabaseAccessToken } from '../server/supabase';
import { ProviderReadinessRegistry } from '../server/taxguard/providerReadiness.service';

describe('Supabase configuration fails closed', () => {
  afterEach(() => {
    setSupabaseClient(null);
    setSupabaseAdmin(null);
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('browser configuration contract', () => {
    it('accepts an https project URL with an anon key and strips a REST suffix', () => {
      const cfg = resolveSupabaseBrowserConfig(' https://abc123.supabase.co/rest/v1/ ', ' anon-key ');
      expect(cfg.configured).toBe(true);
      expect(cfg.url).toBe('https://abc123.supabase.co');
      expect(cfg.anonKey).toBe('anon-key');
      expect(cfg.issues).toEqual([]);
    });

    it('allows plain http only for loopback development hosts', () => {
      expect(resolveSupabaseBrowserConfig('http://127.0.0.1:54321', 'k').configured).toBe(true);
      expect(resolveSupabaseBrowserConfig('http://localhost:54321', 'k').configured).toBe(true);
      const remote = resolveSupabaseBrowserConfig('http://abc123.supabase.co', 'k');
      expect(remote.configured).toBe(false);
      expect(remote.issues).toContain('URL_INSECURE');
    });

    it('reports each missing value as a distinct issue code', () => {
      expect(resolveSupabaseBrowserConfig(undefined, undefined).issues).toEqual(['URL_MISSING', 'ANON_KEY_MISSING']);
      expect(resolveSupabaseBrowserConfig('https://abc123.supabase.co', '').issues).toEqual(['ANON_KEY_MISSING']);
      expect(resolveSupabaseBrowserConfig('', 'k').issues).toEqual(['URL_MISSING']);
    });

    it('rejects malformed URLs, non-http schemes and template placeholders', () => {
      expect(resolveSupabaseBrowserConfig('not a url', 'k').issues).toContain('URL_INVALID');
      expect(resolveSupabaseBrowserConfig('ftp://abc.supabase.co', 'k').issues).toContain('URL_INVALID');
      expect(resolveSupabaseBrowserConfig('https://placeholder.supabase.co', 'k').issues).toContain('PLACEHOLDER_VALUE');
      expect(resolveSupabaseBrowserConfig('https://your-project.supabase.co', 'k').issues).toContain('PLACEHOLDER_VALUE');
      expect(resolveSupabaseBrowserConfig('https://abc.supabase.co', 'placeholder-key').issues).toContain('PLACEHOLDER_VALUE');
    });
  });

  describe('unconfigured browser client', () => {
    it('never performs network I/O and surfaces a controlled AUTH_NOT_CONFIGURED error on sign-in', async () => {
      const networkSpy = vi.spyOn(globalThis, 'fetch');
      setSupabaseClient(createUnconfiguredSupabaseClient());

      const result = await loginWithEmail('client@example.test', 'Sup3r$ecretPass!');

      expect(networkSpy).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.code).toBe('AUTH_NOT_CONFIGURED');
      expect(result.accessToken).toBeUndefined();
      expect(result.error).not.toContain('Sup3r$ecretPass!');
      expect(result.error).not.toContain('supabase-not-configured.invalid');
    });

    it('does not report password-reset success when authentication is unconfigured', async () => {
      const networkSpy = vi.spyOn(globalThis, 'fetch');
      setSupabaseClient(createUnconfiguredSupabaseClient());

      const result: any = await requestPasswordReset('client@example.test');

      expect(networkSpy).not.toHaveBeenCalled();
      expect(result.success).toBe(false);
    });

    it('returns no session rather than a fabricated one', async () => {
      const client = createUnconfiguredSupabaseClient();
      const { data } = await client.auth.getSession();
      expect(data.session).toBeNull();
    });

    it('maps the configuration error to a stable code without echoing internals', () => {
      const sanitized = sanitizeAuthErrorMessage(new Error(SUPABASE_NOT_CONFIGURED_ERROR));
      expect(sanitized.code).toBe('AUTH_NOT_CONFIGURED');
      expect(sanitized.message).not.toContain(SUPABASE_NOT_CONFIGURED_ERROR);
    });
  });

  describe('server administration client', () => {
    it('throws in production when configuration is missing', () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('SUPABASE_URL', '');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      vi.stubEnv('SUPABASE_ANON_KEY', '');
      expect(() => getSupabaseAdmin()).toThrow(/SUPABASE_CONFIG_MISSING/);
    });

    it('outside production, rejects token verification locally without inventing credentials or network I/O', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('SUPABASE_URL', '');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      vi.stubEnv('SUPABASE_ANON_KEY', '');
      const networkSpy = vi.spyOn(globalThis, 'fetch');

      await expect(verifySupabaseAccessToken('header.payload.signature')).rejects.toThrow(/INVALID_SUPABASE_TOKEN/);
      expect(networkSpy).not.toHaveBeenCalled();
    });

    describe('public anon key is never a privileged substitute', () => {
      const anonOnly = (nodeEnv: string) => {
        vi.stubEnv('NODE_ENV', nodeEnv);
        vi.stubEnv('SUPABASE_URL', 'https://synthetic-project.supabase.co');
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
        vi.stubEnv('SUPABASE_ANON_KEY', 'synthetic-public-anon-key');
      };

      it('does not report server configuration with only an anon key', () => {
        anonOnly('development');
        expect(isSupabaseServerConfigured()).toBe(false);
      });

      it('throws in production rather than building an admin client from the anon key', () => {
        anonOnly('production');
        expect(() => getSupabaseAdmin()).toThrow(/SUPABASE_CONFIG_MISSING/);
      });

      it('outside production, never sends the anon key to the configured project', async () => {
        anonOnly('development');
        const networkSpy = vi.spyOn(globalThis, 'fetch');
        const { error } = await getSupabaseAdmin().from('users').select('id').limit(1);
        expect(networkSpy).not.toHaveBeenCalled();
        expect(String(error?.message)).toMatch(/SUPABASE_CONFIG_MISSING/);
      });

      it('provider readiness does not report database, authentication or storage as configured', () => {
        anonOnly('development');
        for (const type of ['DATABASE', 'AUTHENTICATION', 'DOCUMENT_STORAGE'] as const) {
          expect(ProviderReadinessRegistry.getProviderStatus(type).status).toBe('NOT_CONFIGURED');
        }
      });

      it('the service-role key alone (with URL) is accepted', () => {
        vi.stubEnv('NODE_ENV', 'development');
        vi.stubEnv('SUPABASE_URL', 'https://synthetic-project.supabase.co');
        vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-role');
        vi.stubEnv('SUPABASE_ANON_KEY', '');
        expect(isSupabaseServerConfigured()).toBe(true);
      });
    });

    it('outside production, database operations fail with a configuration error', async () => {
      vi.stubEnv('NODE_ENV', 'development');
      vi.stubEnv('SUPABASE_URL', '');
      vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
      vi.stubEnv('SUPABASE_ANON_KEY', '');
      const networkSpy = vi.spyOn(globalThis, 'fetch');

      const { data, error } = await getSupabaseAdmin().from('users').select('id').limit(1);

      expect(networkSpy).not.toHaveBeenCalled();
      expect(data).toBeNull();
      expect(String(error?.message)).toMatch(/SUPABASE_CONFIG_MISSING/);
    });
  });
});
