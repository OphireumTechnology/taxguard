/** Offline preparation only. Never loads secrets, connects providers or grants release authority. */
export interface StagingConfigurationAssessment {
  state: 'INVALID' | 'CONFIGURATION_ONLY';
  releaseAuthorized: false;
  issues: ReadonlyArray<Readonly<{ field: string; code: string }>>;
}
export function assessStagingConfiguration(values: Readonly<Record<string, string | undefined>>): StagingConfigurationAssessment {
  const issues: Array<{ field: string; code: string }> = [];
  const add = (field: string, code: string) => issues.push({ field, code });
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
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) add('SUPABASE_URL', 'INVALID_PROVIDER_URL');
    } catch { add('SUPABASE_URL', 'INVALID_PROVIDER_URL'); }
  }
  for (const field of ['TAXGUARD_TENANT_ID', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY']) {
    const value = values[field];
    if (!value || value.trim() !== value || /[\r\n\0]/.test(value)) add(field, 'REQUIRED_SERVER_CONFIGURATION');
  }
  return Object.freeze({ state: issues.length ? 'INVALID' : 'CONFIGURATION_ONLY', releaseAuthorized: false,
    issues: Object.freeze(issues.map(issue => Object.freeze(issue))) });
}
