import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEnvText, validateStagingEnvironment, PROTECTED_PROJECT_REF } from '../server/config/stagingEnvironmentValidator';

// Phase 10 staging validator: offline, values never echoed, fail closed. Synthetic values only;
// the project refs below are invented and the hosts use the reserved .test / .invalid domains.
const REF = 'abcdefghijklmnopqrst', PROD_REF = 'zyxwvutsrqponmlkjihg';
const jwt = (claims: Record<string, unknown>) => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'c3ludGhldGljLXNpZ25hdHVyZQ'].join('.');
const ANON = jwt({ ref: REF, role: 'anon' }), SERVICE = jwt({ ref: REF, role: 'service_role' });
const valid = (): Record<string, string | undefined> => ({
  NODE_ENV: 'production', TAXGUARD_DEPLOYMENT_ENVIRONMENT: 'staging', VITE_APP_ENV: 'staging', PORT: '8080', TAXGUARD_TENANT_ID: 'staging-tenant', TAXGUARD_PRODUCTION_TENANT_ID: 'prod-tenant',
  TAXGUARD_STAGING_APP_ORIGIN: 'https://staging.taxguard.test', TAXGUARD_STAGING_API_ORIGIN: 'https://api.staging.taxguard.test', VITE_API_BASE_URL: 'https://api.staging.taxguard.test',
  VITE_AUTH_RECOVERY_REDIRECT_URL: 'https://staging.taxguard.test/reset-password',
  SUPABASE_URL: `https://${REF}.supabase.co`, VITE_SUPABASE_URL: `https://${REF}.supabase.co`, TAXGUARD_STAGING_PROJECT_REF: REF, TAXGUARD_PRODUCTION_PROJECT_REF: PROD_REF,
  SUPABASE_ANON_KEY: ANON, VITE_SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE,
  DATABASE_URL: `postgresql://postgres.${REF}:synthetic@db.${REF}.supabase.co:5432/postgres?sslmode=require`,
  TAXGUARD_AI_GOVERNANCE_ENABLED: 'false', TAXGUARD_OPENAI_CASES_ENABLED: 'false', TAXGUARD_OCR_ENABLED: 'false', TAXGUARD_OCR_PROVIDER_MODE: 'FAIL_SAFE', TAXGUARD_MALWARE_SCANNER_ENABLED: 'false',
  TAXGUARD_MALWARE_SCANNER: 'disabled',
  TAXGUARD_CONSULTATION_FINGERPRINT_SALT: 'synthetic-consultation-salt-0123456789abcdef', TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET: 'synthetic-security-event-secret-0123456789',
  STRIPE_SECRET_KEY: 'sk_test_synthetic0123', STRIPE_WEBHOOK_SECRET: 'whsec_synthetic_0123456789',
});
const codes = (values: Record<string, string | undefined>) => validateStagingEnvironment(values).issues.map(i => `${i.field}:${i.code}`);

describe('staging environment validator', () => {
  it('accepts a complete synthetic staging configuration for owner review only', () => {
    const r = validateStagingEnvironment(valid());
    expect(r.issues).toEqual([]);
    expect(r).toMatchObject({ state: 'READY_FOR_OWNER_REVIEW', releaseAuthorized: false });
    expect(Object.entries(r.areas).filter(([, s]) => s !== 'PASS')).toEqual([['STORAGE', 'MANUAL'], ['MONITORING', 'MANUAL'], ['BACKUP', 'MANUAL']]);
  });

  it.each<[string, Record<string, string | undefined>, string]>([
    ['the protected project as staging', { SUPABASE_URL: `https://${PROTECTED_PROJECT_REF}.supabase.co`, VITE_SUPABASE_URL: `https://${PROTECTED_PROJECT_REF}.supabase.co`, TAXGUARD_STAGING_PROJECT_REF: PROTECTED_PROJECT_REF }, 'SUPABASE_URL:PROTECTED_PRODUCTION_PROJECT_REFUSED'],
    ['the protected ref in any field', { DATABASE_URL: `postgresql://x@db.${PROTECTED_PROJECT_REF}.supabase.co/postgres?sslmode=require` }, 'DATABASE_URL:PROTECTED_PRODUCTION_PROJECT_REFUSED'],
    ['staging equal to the production project', { TAXGUARD_PRODUCTION_PROJECT_REF: REF }, 'TAXGUARD_PRODUCTION_PROJECT_REF:STAGING_PRODUCTION_OVERLAP'],
    ['no production reference to compare', { TAXGUARD_PRODUCTION_PROJECT_REF: undefined }, 'TAXGUARD_PRODUCTION_PROJECT_REF:PRODUCTION_REFERENCE_REQUIRED_FOR_OVERLAP_CHECK'],
    ['no positive staging confirmation', { TAXGUARD_STAGING_PROJECT_REF: undefined }, 'TAXGUARD_STAGING_PROJECT_REF:STAGING_PROJECT_CONFIRMATION_REQUIRED'],
    ['a confirmation for another project', { TAXGUARD_STAGING_PROJECT_REF: PROD_REF }, 'TAXGUARD_STAGING_PROJECT_REF:STAGING_PROJECT_CONFIRMATION_REQUIRED'],
    ['a browser build for another project', { VITE_SUPABASE_URL: `https://${PROD_REF}.supabase.co` }, 'VITE_SUPABASE_URL:PROJECT_MISMATCH'],
    ['a self-hosted or http project URL', { SUPABASE_URL: `http://${REF}.supabase.co` }, 'SUPABASE_URL:HOSTED_PROJECT_URL_REQUIRED'],
    ['the production domain as API host', { TAXGUARD_STAGING_API_ORIGIN: 'https://artaxserv.com', VITE_API_BASE_URL: 'https://artaxserv.com' }, 'TAXGUARD_STAGING_API_ORIGIN:STAGING_PRODUCTION_OVERLAP'],
    ['an API origin with a path', { TAXGUARD_STAGING_API_ORIGIN: 'https://api.staging.taxguard.test/v1' }, 'TAXGUARD_STAGING_API_ORIGIN:HTTPS_ORIGIN_REQUIRED'],
    ['a browser build pointing elsewhere', { VITE_API_BASE_URL: 'https://api.other.test' }, 'VITE_API_BASE_URL:API_ORIGIN_MISMATCH'],
    ['identical anon and service keys', { SUPABASE_SERVICE_ROLE_KEY: ANON }, 'SUPABASE_SERVICE_ROLE_KEY:KEYS_NOT_DISTINCT'],
    ['a service key from another project', { SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: PROD_REF, role: 'service_role' }) }, 'SUPABASE_SERVICE_ROLE_KEY:KEY_PROJECT_MISMATCH'],
    ['an anon key in the service slot', { SUPABASE_SERVICE_ROLE_KEY: jwt({ ref: REF, role: 'anon' }) }, 'SUPABASE_SERVICE_ROLE_KEY:KEY_PROJECT_MISMATCH'],
    ['the service key in the browser build', { VITE_EXTRA_KEY: SERVICE }, 'VITE_EXTRA_KEY:SERVICE_ROLE_KEY_EXPOSED'],
    ['a different browser anon key', { VITE_SUPABASE_ANON_KEY: jwt({ ref: REF, role: 'anon', x: 1 }) }, 'VITE_SUPABASE_ANON_KEY:KEY_PROJECT_MISMATCH'],
    ['a database URL without TLS', { DATABASE_URL: `postgresql://postgres.${REF}:x@db.${REF}.supabase.co:5432/postgres` }, 'DATABASE_URL:TLS_REQUIRED'],
    ['a database of another project', { DATABASE_URL: `postgresql://postgres:x@db.${PROD_REF}.supabase.co:5432/postgres?sslmode=require` }, 'DATABASE_URL:PROJECT_MISMATCH'],
    ['the production tenant', { TAXGUARD_TENANT_ID: 'prod-tenant' }, 'TAXGUARD_TENANT_ID:STAGING_PRODUCTION_OVERLAP'],
    ['a recovery redirect to another origin', { VITE_AUTH_RECOVERY_REDIRECT_URL: 'https://evil.invalid/reset' }, 'VITE_AUTH_RECOVERY_REDIRECT_URL:REDIRECT_ORIGIN_MISMATCH'],
    ['real MFA resets without a recorded validation', { TAXGUARD_MFA_RESET_PROVIDER: 'supabase-admin' }, 'TAXGUARD_MFA_RESET_PROVIDER:MFA_PROVIDER_VALIDATION_REQUIRED'],
    ['the fake scanner', { TAXGUARD_MALWARE_SCANNER: 'fake' }, 'TAXGUARD_MALWARE_SCANNER:FAKE_SCANNER_DENIED'],
    ['an uncommissioned scanner', { TAXGUARD_MALWARE_SCANNER: 'hosted-av' }, 'TAXGUARD_MALWARE_SCANNER:SCANNER_NOT_COMMISSIONED'],
    ['an AI provider key', { OPENAI_API_KEY: 'sk-synthetic' }, 'OPENAI_API_KEY:AI_PROVIDER_NOT_APPROVED'],
    ['AI governance switched on', { TAXGUARD_AI_GOVERNANCE_ENABLED: 'true' }, 'TAXGUARD_AI_GOVERNANCE_ENABLED:UNCOMMISSIONED_FEATURE_DENIED'],
    ['an AI-16 material-action flag', { TAXGUARD_AI16_ENABLED: 'true' }, 'AI16:MATERIAL_ACTION_DENIED'],
    ['a live payment key', { STRIPE_SECRET_KEY: 'sk_' + 'live_synthetic' }, 'STRIPE_SECRET_KEY:LIVE_PAYMENT_KEY_DENIED'],
    ['a payment key that is not a test key', { STRIPE_SECRET_KEY: 'sk_synthetic_unknown_mode' }, 'STRIPE_SECRET_KEY:LIVE_PAYMENT_KEY_DENIED'],
    ['a live key in any field', { STRIPE_WEBHOOK_SECRET: 'rk_' + 'live_synthetic' }, 'STRIPE_WEBHOOK_SECRET:LIVE_PAYMENT_KEY_DENIED'],
    ['a short secret', { TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET: 'short' }, 'TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET:SECRET_REQUIRED_32_CHARACTERS'],
    ['a reused secret', { TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET: 'synthetic-consultation-salt-0123456789abcdef' }, 'TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET:SECRET_REUSED'],
    ['a third-party integration secret', { XERO_CLIENT_SECRET: 'synthetic' }, 'XERO_CLIENT_SECRET:INTEGRATION_NOT_COMMISSIONED'],
    ['a development shortcut', { TAXGUARD_DEV_EXPOSE_RESET_TOKEN: 'true' }, 'TAXGUARD_DEV_EXPOSE_RESET_TOKEN:DEVELOPMENT_SHORTCUT_DENIED'],
    ['a demonstration seed password', { SEED_STAFF_PASSWORD: 'synthetic' }, 'SEED_STAFF_PASSWORD:DEVELOPMENT_SHORTCUT_DENIED'],
    ['a development runtime', { NODE_ENV: 'development' }, 'NODE_ENV:PRODUCTION_BOUNDARY_REQUIRED'],
    ['no staging identity', { TAXGUARD_DEPLOYMENT_ENVIRONMENT: 'production' }, 'TAXGUARD_DEPLOYMENT_ENVIRONMENT:STAGING_IDENTITY_REQUIRED'],
    ['a secret in a VITE variable', { VITE_SERVICE_ROLE_KEY: 'x' }, 'VITE_SECRET:CLIENT_SECRET_DENIED'],
    ['a value with a line break', { TAXGUARD_TENANT_ID: 'staging\ntenant' }, 'TAXGUARD_TENANT_ID:REQUIRED_SERVER_CONFIGURATION'],
  ])('refuses %s', (_l, change, expected) => {
    const r = validateStagingEnvironment({ ...valid(), ...change });
    expect(r.state).toBe('INVALID');
    expect(codes({ ...valid(), ...change })).toContain(expected);
    // No value is ever returned.
    for (const value of Object.values(change)) if (value && value.length > 6) expect(JSON.stringify(r)).not.toContain(value);
  });

  it('fails closed on an empty configuration and never returns values', () => {
    const r = validateStagingEnvironment({});
    expect(r.state).toBe('INVALID');
    expect(r.issues.length).toBeGreaterThan(10);
    const full = validateStagingEnvironment({ ...valid(), NODE_ENV: 'development' });
    for (const value of Object.values(valid())) if (value && value.length > 8) expect(JSON.stringify(full)).not.toContain(value);
  });

  it('parses env files without interpolation', () => {
    expect(parseEnvText('A=1\n# c\nB="two words"\nexport C=3\nD=\nE=$A\n')).toEqual({ A: '1', B: 'two words', E: '$A' });
  });
});

describe('check-staging-config CLI (offline)', () => {
  const run = (text: string) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), 'tg-staging-'));
    try {
      writeFileSync(path.join(dir, 'staging.env'), text);
      const env = { ...process.env }; delete env.SUPABASE_URL; delete env.VITE_SUPABASE_URL;
      return spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/staging/check-staging-config.ts', '--config-file', path.join(dir, 'staging.env')], { encoding: 'utf8', env, timeout: 60000 });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  };
  const asText = (v: Record<string, string | undefined>) => Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${k}=${x}`).join('\n');
  it('exits 0 for a valid synthetic file and 1 for the protected project, printing codes only', () => {
    const ok = run(asText(valid()));
    expect(ok.status).toBe(0);
    expect(JSON.parse(ok.stdout)).toMatchObject({ state: 'READY_FOR_OWNER_REVIEW', releaseAuthorized: false, issues: [] });
    const bad = run(asText({ ...valid(), SUPABASE_URL: `https://${PROTECTED_PROJECT_REF}.supabase.co` }));
    expect(bad.status).toBe(1);
    expect(JSON.parse(bad.stdout).issues).toEqual(expect.arrayContaining([expect.objectContaining({ field: 'SUPABASE_URL', code: 'PROTECTED_PRODUCTION_PROJECT_REFUSED' })]));
    for (const value of [SERVICE, ANON, 'synthetic-consultation-salt-0123456789abcdef']) { expect(ok.stdout).not.toContain(value); expect(bad.stdout).not.toContain(value); }
  }, 120000);
  it('exits 2 for an unreadable file', () => {
    const r = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/staging/check-staging-config.ts', '--config-file', path.join(os.tmpdir(), 'tg-missing-' + Date.now())], { encoding: 'utf8', timeout: 60000 });
    expect(r.status).toBe(2);
    expect(JSON.parse(r.stdout)).toEqual({ error: 'ENV_FILE_UNREADABLE' });
  }, 120000);
});
