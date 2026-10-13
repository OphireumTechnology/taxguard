import { describe, expect, it } from 'vitest';
import { validationTarget } from '../server/providerValidationTarget';

// The provider MFA validation may run only against a separately authorized non-production project.
const base = { TAXGUARD_VALIDATION_CONFIRM: 'non-production', TAXGUARD_VALIDATION_SUPABASE_URL: 'https://synthetic-validation.example.test',
  TAXGUARD_VALIDATION_SERVICE_ROLE_KEY: 'synthetic-service', TAXGUARD_VALIDATION_ANON_KEY: 'synthetic-anon' } as NodeJS.ProcessEnv;
const reason = (env: Record<string, string | undefined>) => { const t = validationTarget({ ...base, ...env } as NodeJS.ProcessEnv); return 'reason' in t ? t.reason : 'ok'; };

describe('provider validation destination guard', () => {
  it('accepts an explicitly confirmed https non-production project', () => {
    expect(reason({})).toBe('ok');
    expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: 'http://127.0.0.1:54321' })).toBe('ok');
  });
  it('refuses the protected production project in any spelling', () => {
    for (const url of ['https://cvrlhixxczerytiocxid.supabase.co', 'https://CVRLHIXXCZERYTIOCXID.supabase.co/', 'https://cvrlhixxczerytiocxid.supabase.co/auth/v1'])
      expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: url }), url).toBe('REFUSED_PROTECTED_PROJECT');
  });
  it('refuses without confirmation, in production, without a configured project, or with unsafe URLs and keys', () => {
    expect(reason({ TAXGUARD_VALIDATION_CONFIRM: undefined })).toBe('CONFIRMATION_MISSING');
    expect(reason({ TAXGUARD_VALIDATION_CONFIRM: 'yes' })).toBe('CONFIRMATION_MISSING');
    expect(reason({ NODE_ENV: 'production' })).toBe('REFUSED_PRODUCTION_RUNTIME');
    expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: '' })).toBe('NON_PRODUCTION_PROJECT_NOT_CONFIGURED');
    expect(reason({ TAXGUARD_VALIDATION_SERVICE_ROLE_KEY: '' })).toBe('NON_PRODUCTION_PROJECT_NOT_CONFIGURED');
    expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: 'http://validation.example.test' })).toBe('URL_INSECURE');
    expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: 'https://user:pass@validation.example.test' })).toBe('URL_INVALID');
    expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: 'not a url' })).toBe('URL_INVALID');
    expect(reason({ TAXGUARD_VALIDATION_ANON_KEY: 'synthetic-service' })).toBe('KEYS_INVALID');
  });
  it('refuses the application\'s own configured project', () => {
    expect(reason({ SUPABASE_URL: 'https://synthetic-validation.example.test/' })).toBe('REFUSED_APPLICATION_PROJECT');
  });
});
