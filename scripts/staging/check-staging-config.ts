/**
 * Offline staging configuration check. Reads the variables named in
 * docs/development/staging.env.template from the environment, runs the existing
 * assessStagingConfiguration rules and refuses the protected production project. Prints field
 * names and issue codes only — never values. Connects to nothing.
 *
 *   node node_modules/tsx/dist/cli.mjs scripts/staging/check-staging-config.ts
 * Exit 0: no issues found by these checks (this is NOT a release authorization); 1: issues.
 */
import fs from 'node:fs';
import { assessStagingConfiguration } from '../../src/server/config/stagingConfiguration';
import { isProtectedIdentityDestination } from '../../src/supabase/protectedDestination';

const names = fs.readFileSync('docs/development/staging.env.template', 'utf8').split(/\r?\n/)
  .map(l => /^([A-Z0-9_]+)=/.exec(l)?.[1]).filter((n): n is string => Boolean(n));
const extra = Object.keys(process.env).filter(n => /^VITE_|^TAXGUARD_/i.test(n));
const values = Object.fromEntries([...new Set([...names, ...extra])].map(n => [n, process.env[n]]));
const assessment = assessStagingConfiguration(values);
const issues = [...assessment.issues];
for (const field of ['SUPABASE_URL', 'VITE_SUPABASE_URL']) {
  const v = values[field];
  if (v && (isProtectedIdentityDestination(v) || /cvrlhixxczerytiocxid/i.test(v))) issues.push({ field, code: 'PROTECTED_PRODUCTION_PROJECT_REFUSED' });
}
if (values.SUPABASE_URL && values.VITE_SUPABASE_URL && values.SUPABASE_URL.replace(/\/+$/, '') !== values.VITE_SUPABASE_URL.replace(/\/+$/, ''))
  issues.push({ field: 'VITE_SUPABASE_URL', code: 'PROJECT_MISMATCH' });
if (!values.TAXGUARD_CONSULTATION_FINGERPRINT_SALT || values.TAXGUARD_CONSULTATION_FINGERPRINT_SALT.length < 32)
  issues.push({ field: 'TAXGUARD_CONSULTATION_FINGERPRINT_SALT', code: 'SALT_REQUIRED_32_CHARACTERS' });
console.log(JSON.stringify({ checkedFields: names.length, releaseAuthorized: false, issues }, null, 2));
process.exit(issues.length ? 1 : 0);
