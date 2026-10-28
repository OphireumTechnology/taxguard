import { describe, expect, it } from 'vitest';
import { mfaValidationReadiness, validationTarget } from '../server/providerValidationTarget';

// The provider MFA validation may run only against a separately authorized non-production project.
// Project refs below are invented (20 lowercase letters, the hosted format).
const REF = 'abcdefghijklmnopqrst', PROD = 'zyxwvutsrqponmlkjihg';
const base = { TAXGUARD_VALIDATION_CONFIRM: 'non-production', TAXGUARD_VALIDATION_SUPABASE_URL: `https://${REF}.supabase.co`, TAXGUARD_VALIDATION_PROJECT_REF: REF,
  TAXGUARD_VALIDATION_PRODUCTION_PROJECT_REF: PROD, TAXGUARD_VALIDATION_SERVICE_ROLE_KEY: 'synthetic-service', TAXGUARD_VALIDATION_ANON_KEY: 'synthetic-anon' } as NodeJS.ProcessEnv;
const reason = (env: Record<string, string | undefined>) => { const t = validationTarget({ ...base, ...env } as NodeJS.ProcessEnv); return 'reason' in t ? t.reason : 'ok'; };

describe('provider validation destination guard', () => {
  it('accepts an explicitly confirmed hosted non-production project, or a loopback emulator', () => {
    expect(reason({})).toBe('ok');
    expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: 'http://127.0.0.1:54321', TAXGUARD_VALIDATION_PROJECT_REF: undefined, TAXGUARD_VALIDATION_PRODUCTION_PROJECT_REF: undefined })).toBe('ok');
  });
  it('refuses the protected production project in any spelling', () => {
    for (const url of ['https://cvrlhixxczerytiocxid.supabase.co', 'https://CVRLHIXXCZERYTIOCXID.supabase.co/', 'https://cvrlhixxczerytiocxid.supabase.co/auth/v1'])
      expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: url, TAXGUARD_VALIDATION_PROJECT_REF: 'cvrlhixxczerytiocxid' }), url).toBe('REFUSED_PROTECTED_PROJECT');
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
  it('requires the hosted project to be confirmed by ref and proven different from production', () => {
    expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: 'https://validation.example.test' })).toBe('HOSTED_PROJECT_URL_REQUIRED');
    expect(reason({ TAXGUARD_VALIDATION_SUPABASE_URL: `https://${REF}.supabase.co/auth/v1` })).toBe('HOSTED_PROJECT_URL_REQUIRED');
    expect(reason({ TAXGUARD_VALIDATION_PROJECT_REF: undefined })).toBe('PROJECT_CONFIRMATION_MISMATCH');
    expect(reason({ TAXGUARD_VALIDATION_PROJECT_REF: PROD })).toBe('PROJECT_CONFIRMATION_MISMATCH');
    expect(reason({ TAXGUARD_VALIDATION_PRODUCTION_PROJECT_REF: undefined })).toBe('PRODUCTION_REFERENCE_REQUIRED');
    expect(reason({ TAXGUARD_VALIDATION_PRODUCTION_PROJECT_REF: REF })).toBe('REFUSED_PRODUCTION_OVERLAP');
  });
  it('refuses the application\'s own configured project', () => {
    expect(reason({ SUPABASE_URL: `https://${REF}.supabase.co/` })).toBe('REFUSED_APPLICATION_PROJECT');
  });
  it('reports readiness without values: BLOCKED with a reason, or READY_TO_RUN', () => {
    expect(mfaValidationReadiness({} as NodeJS.ProcessEnv)).toEqual({ status: 'BLOCKED', reason: 'CONFIRMATION_MISSING' });
    expect(mfaValidationReadiness({ TAXGUARD_VALIDATION_CONFIRM: 'non-production' } as NodeJS.ProcessEnv)).toEqual({ status: 'BLOCKED', reason: 'NON_PRODUCTION_PROJECT_NOT_CONFIGURED' });
    expect(mfaValidationReadiness(base)).toEqual({ status: 'READY_TO_RUN', target: 'HOSTED_NON_PRODUCTION_PROJECT' });
    expect(JSON.stringify(mfaValidationReadiness(base))).not.toMatch(/synthetic|abcdefghij/);
  });
});
