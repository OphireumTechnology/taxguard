/**
 * Offline staging environment validator (Phase 10). Pure function over a map of variable values:
 * it never reads the process environment itself, never connects to anything, never creates,
 * resets or migrates anything, and never returns or prints a value — only field names, area
 * states and fixed issue codes. It fails closed: a missing, malformed or inconsistent setting, any
 * reference to the protected production project, and any overlap between staging and production
 * are issues. Passing is NOT a release authorization (releaseAuthorized is always false).
 */
import { assessStagingConfiguration } from './stagingConfiguration';

export const PROTECTED_PROJECT_REF = 'cvrlhixxczerytiocxid';
export const PRODUCTION_HOSTS = ['artaxserv.com', 'www.artaxserv.com'];
export type StagingArea = 'APP' | 'API_HOST' | 'PROJECT' | 'KEYS' | 'DATABASE' | 'TENANT' | 'AUTH_MFA' | 'STORAGE' | 'SCANNER' | 'AI' | 'BILLING' | 'SECRETS' | 'INTEGRATIONS' | 'MONITORING' | 'BACKUP';
export type AreaState = 'PASS' | 'FAIL' | 'MANUAL';
export interface StagingIssue { area: StagingArea; field: string; code: string }
export interface StagingValidation { state: 'INVALID' | 'READY_FOR_OWNER_REVIEW'; releaseAuthorized: false; areas: Record<StagingArea, AreaState>; issues: StagingIssue[]; manualChecks: string[] }

/** Areas no offline check can prove; each needs an owner-recorded confirmation in the release checklist. */
export const MANUAL_CHECKS: Readonly<Record<'STORAGE' | 'MONITORING' | 'BACKUP', string>> = Object.freeze({
  STORAGE: 'STORAGE_BUCKET_PRIVATE_CONFIRMED_AT_RUNTIME',
  MONITORING: 'LOG_SHIPPING_AND_ALERT_ROUTING_CONFIRMED_BY_OWNER',
  BACKUP: 'PROJECT_BACKUPS_AND_RESTORE_REHEARSAL_CONFIRMED_BY_OWNER',
});

/** Third-party integrations that are not commissioned for staging; any value is refused. */
export const UNCOMMISSIONED_SECRETS = ['OPENAI_API_KEY', 'GOOGLE_CLOUD_VISION_KEY', 'GOOGLE_CLOUD_ACCESS_TOKEN', 'DOCUMENT_AI_PROCESSOR_ID', 'XERO_CLIENT_ID', 'XERO_CLIENT_SECRET',
  'QUICKBOOKS_CLIENT_ID', 'QUICKBOOKS_CLIENT_SECRET', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'SENDGRID_API_KEY', 'SMTP_HOST', 'GMAIL_CLIENT_ID', 'GMAIL_ACCESS_TOKEN',
  'GOOGLE_DRIVE_API_KEY', 'GOOGLE_DRIVE_ACCESS_TOKEN', 'EMAIL_INGESTION_IMAP_HOST'] as const;

const AREAS: StagingArea[] = ['APP', 'API_HOST', 'PROJECT', 'KEYS', 'DATABASE', 'TENANT', 'AUTH_MFA', 'STORAGE', 'SCANNER', 'AI', 'BILLING', 'SECRETS', 'INTEGRATIONS', 'MONITORING', 'BACKUP'];
const clean = (v: string | undefined) => typeof v === 'string' && v.length > 0 && v.trim() === v && !/[\r\n\0]/.test(v);

function httpsOrigin(value: string | undefined): URL | null {
  if (!clean(value)) return null;
  try {
    const u = new URL(value!);
    if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) return null;
    return u;
  } catch { return null; }
}
/** Project ref of a hosted Supabase URL (https://<20 lowercase letters>.supabase.co), else null. */
export function supabaseProjectRef(value: string | undefined): string | null {
  const u = httpsOrigin(value);
  const m = u && /^([a-z]{20})\.supabase\.co$/.exec(u.hostname);
  return m ? m[1] : null;
}
/** Claims of a legacy JWT-format key (payload only; the signature is not, and cannot be, verified offline). */
function jwtClaims(value: string | undefined): Record<string, unknown> | null {
  if (!clean(value) || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value!)) return null;
  try { const c = JSON.parse(Buffer.from(value!.split('.')[1], 'base64url').toString('utf8')); return c && typeof c === 'object' ? c : null; } catch { return null; }
}

export function validateStagingEnvironment(values: Readonly<Record<string, string | undefined>>): StagingValidation {
  const issues: StagingIssue[] = [];
  const add = (area: StagingArea, field: string, code: string) => { if (!issues.some(i => i.field === field && i.code === code)) issues.push({ area, field, code }); };
  const v = (k: string) => values[k];

  // Fail closed on any reference to the protected project or a production host, in any field.
  for (const [field, value] of Object.entries(values)) {
    if (typeof value !== 'string' || !value) continue;
    if (value.toLowerCase().includes(PROTECTED_PROJECT_REF)) add('PROJECT', field, 'PROTECTED_PRODUCTION_PROJECT_REFUSED');
    if (/^https?:\/\//i.test(value)) { try { if (PRODUCTION_HOSTS.includes(new URL(value).hostname.toLowerCase())) add('API_HOST', field, 'STAGING_PRODUCTION_OVERLAP'); } catch { /* reported by the field checks */ } }
  }

  // Existing release-preparation rules (NODE_ENV, uncommissioned flags, VITE secrets, AI-16, required fields).
  const areaOf: Record<string, StagingArea> = { NODE_ENV: 'APP', PORT: 'APP', TAXGUARD_TENANT_ID: 'TENANT', SUPABASE_URL: 'PROJECT', SUPABASE_SERVICE_ROLE_KEY: 'KEYS', SUPABASE_ANON_KEY: 'KEYS',
    TAXGUARD_OCR_PROVIDER_MODE: 'AI', AI16: 'AI', TAXGUARD_AI_GOVERNANCE_ENABLED: 'AI', TAXGUARD_OPENAI_CASES_ENABLED: 'AI', TAXGUARD_OCR_ENABLED: 'AI', TAXGUARD_MALWARE_SCANNER_ENABLED: 'SCANNER', VITE_SECRET: 'SECRETS' };
  for (const i of assessStagingConfiguration(values).issues) add(areaOf[i.field] ?? 'APP', i.field, i.code);

  // APP: an explicit staging identity on both server and client, and no development shortcuts.
  if (v('TAXGUARD_DEPLOYMENT_ENVIRONMENT') !== 'staging') add('APP', 'TAXGUARD_DEPLOYMENT_ENVIRONMENT', 'STAGING_IDENTITY_REQUIRED');
  if (v('VITE_APP_ENV') !== 'staging') add('APP', 'VITE_APP_ENV', 'STAGING_IDENTITY_REQUIRED');
  for (const field of ['TAXGUARD_DEV_EXPOSE_RESET_TOKEN', 'TAXGUARD_STAFF_ACCESS_DEVELOPMENT_ENABLED', 'SEED_STAFF_PASSWORD', 'SEED_CLIENT_PASSWORD', 'TAXGUARD_ALLOW_FAKE_SCANNER'])
    if (v(field)) add('APP', field, 'DEVELOPMENT_SHORTCUT_DENIED');

  // API_HOST: a dedicated https staging origin used by the browser build.
  const apiOrigin = httpsOrigin(v('TAXGUARD_STAGING_API_ORIGIN'));
  if (!apiOrigin) add('API_HOST', 'TAXGUARD_STAGING_API_ORIGIN', 'HTTPS_ORIGIN_REQUIRED');
  const appOrigin = httpsOrigin(v('TAXGUARD_STAGING_APP_ORIGIN'));
  if (!appOrigin) add('API_HOST', 'TAXGUARD_STAGING_APP_ORIGIN', 'HTTPS_ORIGIN_REQUIRED');
  if (apiOrigin && v('VITE_API_BASE_URL')?.replace(/\/+$/, '') !== apiOrigin.origin) add('API_HOST', 'VITE_API_BASE_URL', 'API_ORIGIN_MISMATCH');
  if (v('TAXGUARD_LISTEN_HOST') && !/^(0\.0\.0\.0|127\.0\.0\.1|::|::1)$/.test(v('TAXGUARD_LISTEN_HOST')!)) add('API_HOST', 'TAXGUARD_LISTEN_HOST', 'INVALID_LISTEN_HOST');

  // PROJECT: a separate hosted project, positively confirmed, never the production project.
  const ref = supabaseProjectRef(v('SUPABASE_URL'));
  if (!ref) add('PROJECT', 'SUPABASE_URL', 'HOSTED_PROJECT_URL_REQUIRED');
  if (supabaseProjectRef(v('VITE_SUPABASE_URL')) !== ref || !ref) add('PROJECT', 'VITE_SUPABASE_URL', 'PROJECT_MISMATCH');
  if (!clean(v('TAXGUARD_STAGING_PROJECT_REF')) || v('TAXGUARD_STAGING_PROJECT_REF') !== ref) add('PROJECT', 'TAXGUARD_STAGING_PROJECT_REF', 'STAGING_PROJECT_CONFIRMATION_REQUIRED');
  if (!clean(v('TAXGUARD_PRODUCTION_PROJECT_REF'))) add('PROJECT', 'TAXGUARD_PRODUCTION_PROJECT_REF', 'PRODUCTION_REFERENCE_REQUIRED_FOR_OVERLAP_CHECK');
  else if (v('TAXGUARD_PRODUCTION_PROJECT_REF') === ref) add('PROJECT', 'TAXGUARD_PRODUCTION_PROJECT_REF', 'STAGING_PRODUCTION_OVERLAP');
  if (ref === PROTECTED_PROJECT_REF) add('PROJECT', 'SUPABASE_URL', 'PROTECTED_PRODUCTION_PROJECT_REFUSED');

  // KEYS: distinct anon and service keys of this project; the service key never reaches the browser.
  const anon = v('SUPABASE_ANON_KEY'), service = v('SUPABASE_SERVICE_ROLE_KEY');
  if (clean(anon) && anon === service) add('KEYS', 'SUPABASE_SERVICE_ROLE_KEY', 'KEYS_NOT_DISTINCT');
  if (v('VITE_SUPABASE_ANON_KEY') !== anon) add('KEYS', 'VITE_SUPABASE_ANON_KEY', 'KEY_PROJECT_MISMATCH');
  for (const [field, value] of Object.entries(values)) if (/^VITE_/.test(field) && clean(service) && value === service) add('KEYS', field, 'SERVICE_ROLE_KEY_EXPOSED');
  for (const [field, key, role] of [['SUPABASE_ANON_KEY', anon, 'anon'], ['SUPABASE_SERVICE_ROLE_KEY', service, 'service_role']] as const) {
    const claims = jwtClaims(key);
    if (claims && ((claims.ref !== undefined && claims.ref !== ref) || (claims.role !== undefined && claims.role !== role))) add('KEYS', field, 'KEY_PROJECT_MISMATCH');
  }

  // DATABASE: optional direct connection (migrations only) — TLS required, same project, never production.
  if (v('DATABASE_URL')) {
    try {
      const u = new URL(v('DATABASE_URL')!);
      if (!/^postgres(ql)?:$/.test(u.protocol)) add('DATABASE', 'DATABASE_URL', 'POSTGRES_URL_REQUIRED');
      if (u.searchParams.get('sslmode') !== 'require' && u.searchParams.get('sslmode') !== 'verify-full') add('DATABASE', 'DATABASE_URL', 'TLS_REQUIRED');
      if (!ref || !(u.hostname.includes(ref) || decodeURIComponent(u.username).includes(ref))) add('DATABASE', 'DATABASE_URL', 'PROJECT_MISMATCH');
    } catch { add('DATABASE', 'DATABASE_URL', 'POSTGRES_URL_REQUIRED'); }
  }

  // TENANT: one tenant per environment, different from production.
  if (clean(v('TAXGUARD_TENANT_ID')) && !/^[A-Za-z0-9_-]{1,128}$/.test(v('TAXGUARD_TENANT_ID')!)) add('TENANT', 'TAXGUARD_TENANT_ID', 'INVALID_TENANT_ID');
  if (clean(v('TAXGUARD_PRODUCTION_TENANT_ID')) && v('TAXGUARD_PRODUCTION_TENANT_ID') === v('TAXGUARD_TENANT_ID')) add('TENANT', 'TAXGUARD_TENANT_ID', 'STAGING_PRODUCTION_OVERLAP');

  // AUTH_MFA: recovery links return to the staging app; real MFA resets only after a recorded validation.
  const redirect = v('VITE_AUTH_RECOVERY_REDIRECT_URL');
  try { const u = new URL(redirect ?? ''); if (u.protocol !== 'https:' || !appOrigin || u.origin !== appOrigin.origin) add('AUTH_MFA', 'VITE_AUTH_RECOVERY_REDIRECT_URL', 'REDIRECT_ORIGIN_MISMATCH'); }
  catch { add('AUTH_MFA', 'VITE_AUTH_RECOVERY_REDIRECT_URL', 'REDIRECT_ORIGIN_MISMATCH'); }
  const mfa = v('TAXGUARD_MFA_RESET_PROVIDER');
  if (mfa && mfa !== 'supabase-admin') add('AUTH_MFA', 'TAXGUARD_MFA_RESET_PROVIDER', 'UNKNOWN_MFA_PROVIDER');
  if (mfa === 'supabase-admin' && v('TAXGUARD_MFA_PROVIDER_VALIDATION_RECORDED') !== 'true') add('AUTH_MFA', 'TAXGUARD_MFA_RESET_PROVIDER', 'MFA_PROVIDER_VALIDATION_REQUIRED');

  // SCANNER: no provider is commissioned; the fake scanner is local-only.
  const scanner = (v('TAXGUARD_MALWARE_SCANNER') || '').toLowerCase();
  if (scanner === 'fake') add('SCANNER', 'TAXGUARD_MALWARE_SCANNER', 'FAKE_SCANNER_DENIED');
  else if (scanner && scanner !== 'disabled') add('SCANNER', 'TAXGUARD_MALWARE_SCANNER', 'SCANNER_NOT_COMMISSIONED');

  // AI: no model provider until the owner selects and approves one.
  if (v('OPENAI_MODEL')) add('AI', 'OPENAI_MODEL', 'AI_PROVIDER_NOT_APPROVED');

  // BILLING: sandbox keys only.
  if (v('STRIPE_SECRET_KEY') && !/^sk_test_[A-Za-z0-9]+$/.test(v('STRIPE_SECRET_KEY')!)) add('BILLING', 'STRIPE_SECRET_KEY', 'LIVE_PAYMENT_KEY_DENIED');
  for (const [field, value] of Object.entries(values)) if (typeof value === 'string' && /\b(sk|rk|pk)_live_/.test(value)) add('BILLING', field, 'LIVE_PAYMENT_KEY_DENIED');

  // SECRETS: per-environment secrets of sufficient length, none reused.
  const secrets = ['TAXGUARD_CONSULTATION_FINGERPRINT_SALT', 'TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET'];
  for (const field of secrets) if (!clean(v(field)) || v(field)!.length < 32) add('SECRETS', field, 'SECRET_REQUIRED_32_CHARACTERS');
  const all = [...secrets, 'TAXGUARD_MALWARE_SCANNER_CALLBACK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_WEBHOOK_SECRET'];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (clean(v(all[i])) && v(all[i]) === v(all[j])) add('SECRETS', all[j], 'SECRET_REUSED');
  if (v('TAXGUARD_MALWARE_SCANNER_CALLBACK_SECRET') && v('TAXGUARD_MALWARE_SCANNER_CALLBACK_SECRET')!.length < 32) add('SECRETS', 'TAXGUARD_MALWARE_SCANNER_CALLBACK_SECRET', 'SECRET_REQUIRED_32_CHARACTERS');

  // INTEGRATIONS: nothing third-party is commissioned.
  for (const field of UNCOMMISSIONED_SECRETS) if (v(field)) add(field === 'OPENAI_API_KEY' ? 'AI' : 'INTEGRATIONS', field, field === 'OPENAI_API_KEY' ? 'AI_PROVIDER_NOT_APPROVED' : 'INTEGRATION_NOT_COMMISSIONED');

  const areas = Object.fromEntries(AREAS.map(a => [a, issues.some(i => i.area === a) ? 'FAIL' : a in MANUAL_CHECKS ? 'MANUAL' : 'PASS'])) as Record<StagingArea, AreaState>;
  return { state: issues.length ? 'INVALID' : 'READY_FOR_OWNER_REVIEW', releaseAuthorized: false, areas, issues, manualChecks: Object.values(MANUAL_CHECKS) };
}

/** Parses KEY=VALUE lines (no interpolation, no export, no quotes processing beyond one pair). */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (/^"[^"]*"$/.test(value) || /^'[^']*'$/.test(value)) value = value.slice(1, -1);
    if (value !== '') out[m[1]] = value;
  }
  return out;
}
