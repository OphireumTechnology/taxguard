import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ProviderReadinessRegistry } from '../server/taxguard/providerReadiness.service';
beforeEach(() => {
  ProviderReadinessRegistry.setTestingOverrides(undefined);
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('SUPABASE_URL', 'https://synthetic.invalid'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic_only');
  vi.stubEnv('DOCUMENT_AI_PROCESSOR_ID', 'synthetic_only'); vi.stubEnv('OPENAI_API_KEY', 'synthetic_only');
});
afterEach(() => { ProviderReadinessRegistry.setTestingOverrides(undefined); vi.unstubAllEnvs(); });
it.each(['DATABASE', 'AUTHENTICATION', 'STORAGE', 'DOCUMENT_STORAGE', 'OCR', 'AI'] as const)('does not certify configured %s as operational without verified health', provider => {
  const result = ProviderReadinessRegistry.getProviderStatus(provider);
  expect(result).toMatchObject({ status: 'CONFIGURED', isOperational: false, verificationState: 'CONFIGURATION_ONLY' });
  expect(result.description).toContain('have not been verified'); expect(JSON.stringify(result)).not.toContain('synthetic_only');
});
it('cannot turn production provider health operational using testing overrides', () => {
  ProviderReadinessRegistry.setTestingOverrides({ DATABASE: 'CONFIGURED', AUTHENTICATION: 'CONFIGURED', FILING: 'CONFIGURED' });
  expect(ProviderReadinessRegistry.getAllProviderStatuses().every(p => !p.isOperational)).toBe(true);
});
it('labels synthetic configured test evidence without promoting it to production', () => {
  vi.stubEnv('NODE_ENV', 'test'); ProviderReadinessRegistry.setTestingOverrides({ OCR: 'CONFIGURED' });
  expect(ProviderReadinessRegistry.getProviderStatus('OCR')).toMatchObject({ isOperational: true, verificationState: 'SYNTHETIC_TEST' });
});
it('retains uncommissioned signature, filing, accounting and scanner refusals', () => {
  for (const provider of ['E_SIGNATURE', 'FILING', 'QUICKBOOKS', 'XERO', 'MALWARE_SCANNER'] as const) expect(ProviderReadinessRegistry.getProviderStatus(provider)).toMatchObject({ status: 'NOT_CONFIGURED', isOperational: false, verificationState: 'NOT_VERIFIED' });
});
