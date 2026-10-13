import { isProtectedIdentityDestination } from '../../supabase/protectedDestination';
/** Offline preparation only. Never loads secrets, connects providers or grants release authority. */
export interface StagingConfigurationAssessment {
  state: 'INVALID' | 'CONFIGURATION_ONLY';
  releaseAuthorized: false;
  issues: ReadonlyArray<Readonly<{ field: string; code: string }>>;
}
export function assessStagingConfiguration(values: Readonly<Record<string, string | undefined>>): StagingConfigurationAssessment {
  const issues: Array<{ field: string; code: string }> = [];
  const add = (field: string, code: string) => issues.push({ field, code });
  if (values.TAXGUARD_TENANT_ID && !/^[A-Za-z0-9_-]{1,128}$/.test(values.TAXGUARD_TENANT_ID)) add('TAXGUARD_TENANT_ID', 'TENANT_INVALID');
  if (values.SUPABASE_SERVICE_ROLE_KEY && values.SUPABASE_SERVICE_ROLE_KEY === values.SUPABASE_ANON_KEY) add('SUPABASE_SERVICE_ROLE_KEY', 'KEY_SEPARATION_REQUIRED');
  for (const field of ['SUPABASE_URL', 'VITE_SUPABASE_URL']) {
    const value = values[field];
    if (value && (isProtectedIdentityDestination(value) || /cvrlhixxczerytiocxid/i.test(value))) add(field, 'PROTECTED_PRODUCTION_PROJECT_REFUSED');
  }
  if (values.SUPABASE_URL && values.VITE_SUPABASE_URL && values.SUPABASE_URL.replace(/\/+$/, '') !== values.VITE_SUPABASE_URL.replace(/\/+$/, '')) add('VITE_SUPABASE_URL', 'PROJECT_MISMATCH');
  if (values.TAXGUARD_LEGACY_ROUTES !== undefined && values.TAXGUARD_LEGACY_ROUTES !== 'retired') add('TAXGUARD_LEGACY_ROUTES', 'LEGACY_RETIREMENT_REQUIRED');
  for (const field of ['TAXGUARD_LIVE_PAYMENTS_ENABLED', 'TAXGUARD_EFILING_ENABLED', 'TAXGUARD_TAX_SIGNATURES_ENABLED']) {
    if (values[field] !== undefined && values[field] !== 'false') add(field, 'UNAPPROVED_ACTION_DENIED');
  }
  if (values.NODE_ENV !== 'production') add('NODE_ENV', 'PRODUCTION_BOUNDARY_REQUIRED');
  if (values.PORT !== undefined && (!/^\d{1,5}$/.test(values.PORT) || +values.PORT < 1 || +values.PORT > 65535)) add('PORT', 'INVALID_PORT');
  for (const field of ['TAXGUARD_AI_GOVERNANCE_ENABLED', 'TAXGUARD_OPENAI_CASES_ENABLED', 'TAXGUARD_OCR_ENABLED', 'TAXGUARD_MALWARE_SCANNER_ENABLED']) {
    if (values[field] !== undefined && values[field] !== 'false') add(field, 'UNCOMMISSIONED_FEATURE_DENIED');
  }
  if (values.TAXGUARD_OCR_PROVIDER_MODE !== undefined && values.TAXGUARD_OCR_PROVIDER_MODE !== 'FAIL_SAFE') add('TAXGUARD_OCR_PROVIDER_MODE', 'FAIL_SAFE_REQUIRED');
  for (const field of Object.keys(values)) {
    // Report bounded field identifiers, never untrusted values or arbitrary key text.
    if (/^VITE_/i.test(field) && /(secret|password|token|service.?role|private.?key|database.?url|openai.?api.?key|google.*key)/i.test(field) && values[field]) add('VITE_SECRET', 'CLIENT_SECRET_DENIED');
    if (/AI[_-]?16/i.test(field) && values[field] && values[field] !== 'false') add('AI16', 'MATERIAL_ACTION_DENIED');
  }
  if (values.SUPABASE_URL) {
    try {
      const url = new URL(values.SUPABASE_URL);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) add('SUPABASE_URL', 'INVALID_PROVIDER_URL');
    } catch { add('SUPABASE_URL', 'INVALID_PROVIDER_URL'); }
  }
  for (const field of ['TAXGUARD_TENANT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY']) {
    const value = values[field];
    if (!value || value.trim() !== value || /[\r\n\0]/.test(value)) add(field, 'REQUIRED_SERVER_CONFIGURATION');
  }
  return Object.freeze({ state: issues.length ? 'INVALID' : 'CONFIGURATION_ONLY', releaseAuthorized: false,
    issues: Object.freeze(issues.map(issue => Object.freeze(issue))) });
}
