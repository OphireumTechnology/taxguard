import { expect, it } from 'vitest';
import { assessStagingConfiguration as assess } from '../server/config/stagingConfiguration';
const fixture = { NODE_ENV: 'production', PORT: '3000', TAXGUARD_TENANT_ID: 'synthetic', SUPABASE_URL: 'https://synthetic.invalid', SUPABASE_SERVICE_ROLE_KEY: 'synthetic_private', SUPABASE_ANON_KEY: 'synthetic_public' };
it('validates configuration without commissioning or granting release authority', () => {
  expect(assess(fixture)).toEqual({ state: 'CONFIGURATION_ONLY', releaseAuthorized: false, issues: [] });
});
it.each(['0', '65536', '-1', '3000oops', '1.5', ' 3000'])('rejects malformed port %s', PORT => expect(assess({ ...fixture, PORT }).state).toBe('INVALID'));
it.each(['http://synthetic.invalid', 'https://user:secret@synthetic.invalid', 'https://synthetic.invalid?token=private', 'invalid'])('rejects unsafe URL %s without echoing it', SUPABASE_URL => {
  const result = assess({ ...fixture, SUPABASE_URL }); expect(result.state).toBe('INVALID'); expect(JSON.stringify(result)).not.toContain(SUPABASE_URL);
});
it.each(['TAXGUARD_AI_GOVERNANCE_ENABLED', 'TAXGUARD_OPENAI_CASES_ENABLED', 'TAXGUARD_OCR_ENABLED', 'TAXGUARD_MALWARE_SCANNER_ENABLED'])('requires disabled uncommissioned %s', field => {
  expect(assess({ ...fixture, [field]: 'true' }).issues).toContainEqual({ field, code: 'UNCOMMISSIONED_FEATURE_DENIED' });
});
it.each(['VITE_OPENAI_API_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_PASSWORD', 'VITE_ACCESS_TOKEN'])('rejects browser secret %s without value exposure', field => {
  const result = assess({ ...fixture, [field]: 'private_synthetic' }); expect(result.state).toBe('INVALID'); expect(JSON.stringify(result)).not.toContain('private_synthetic');
});
it('refuses material-write flags and inappropriate runtime', () => {
  expect(assess({ ...fixture, NODE_ENV: 'development', TAXGUARD_AI_16_ENABLED: 'true' }).issues).toEqual(expect.arrayContaining([{ field: 'AI16', code: 'MATERIAL_ACTION_DENIED' }, { field: 'NODE_ENV', code: 'PRODUCTION_BOUNDARY_REQUIRED' }]));
});
it.each(['TAXGUARD_TENANT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'])('rejects missing %s', field => expect(assess({ ...fixture, [field]: '' }).state).toBe('INVALID'));
it('returns immutable detached results', () => {
  const input = { ...fixture, PORT: '0' }; const result = assess(input); input.PORT = '3000';
  expect(result.state).toBe('INVALID'); expect(Object.isFrozen(result.issues[0])).toBe(true);
});
