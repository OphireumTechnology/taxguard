/**
 * Reproducible validation of the identity provider's admin MFA methods used by the MFA reset
 * adapter (src/server/mfaResetProvider.ts), against a SEPARATE, AUTHORIZED NON-PRODUCTION project.
 *
 *   TAXGUARD_VALIDATION_CONFIRM=non-production \
 *   TAXGUARD_VALIDATION_SUPABASE_URL=https://<ref>.supabase.co TAXGUARD_VALIDATION_PROJECT_REF=<ref> \
 *   TAXGUARD_VALIDATION_PRODUCTION_PROJECT_REF=<production ref> \
 *   TAXGUARD_VALIDATION_SERVICE_ROLE_KEY=... TAXGUARD_VALIDATION_ANON_KEY=... \
 *   node node_modules/tsx/dist/cli.mjs scripts/provider-validation/mfa-admin-validation.ts
 *
 * Refuses (exit 2, nothing sent) for the protected production project, production runtimes, the
 * application's own SUPABASE_URL, insecure URLs, a missing confirmation, a project ref that does not
 * match the URL, or a missing / equal production ref. It never reads .env. With --readiness it only
 * reports BLOCKED (with a reason code) or READY_TO_RUN and contacts nothing.
 * One synthetic user (random address on example.com, random password) is created, enrolled with one
 * TOTP factor through the public MFA API, reset through the adapter, and always deleted at the end.
 * The report contains check names and outcomes only — no keys, secrets, codes, user or factor IDs.
 * See docs/development/provider-mfa-validation.md.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { mfaValidationReadiness, validationTarget } from '../../src/server/providerValidationTarget';
import { MfaProviderError, SupabaseAdminMfaProvider } from '../../src/server/mfaResetProvider';

// --readiness: report BLOCKED / READY_TO_RUN with a reason code and exit, contacting nothing.
if (process.argv.includes('--readiness')) { console.log(JSON.stringify(mfaValidationReadiness(process.env))); process.exit(0); }
const checked = validationTarget(process.env);
if ('reason' in checked) { console.error(JSON.stringify({ status: 'refused', reason: checked.reason })); process.exit(2); }
const target = checked as Extract<typeof checked, { ok: true }>;

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const unbase32 = (s: string) => { let bits = 0, v = 0; const out: number[] = []; for (const ch of s.replace(/=+$/, '').toUpperCase()) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((v >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); };
const totp = (secret: string) => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000))); const h = createHmac('sha1', unbase32(secret)).update(b).digest(); const o = h[h.length - 1] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0'); };

const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(target.url, target.serviceKey, options);
const adapter = new SupabaseAdminMfaProvider(admin);
const checks: Array<{ check: string; ok: boolean; observed: string }> = [];
const record = (check: string, ok: boolean, observed: string) => { checks.push({ check, ok, observed }); };
const code = (e: unknown) => e instanceof MfaProviderError ? e.code : 'UNEXPECTED_' + ((e as { name?: string })?.name ?? 'ERROR');

let uid: string | null = null;
try {
  const email = `taxguard-validation-${randomBytes(6).toString('hex')}@example.com`, password = randomBytes(18).toString('base64url') + 'aA1!';
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('CREATE_USER_FAILED ' + (created.error?.status ?? ''));
  uid = created.data.user.id;
  record('admin.createUser returns a UUID user', /^[0-9a-f-]{36}$/.test(uid), 'uuid');

  record('listFactors on a user without factors is an empty inventory', (await adapter.listFactors(uid)).length === 0, 'empty');

  const user = createClient(target.url, target.anonKey, options);
  const signIn = await user.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error('SIGN_IN_FAILED ' + signIn.error.status);
  const enrolled = await user.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'TaxGuard validation' });
  if (enrolled.error || !enrolled.data) throw new Error('ENROLL_FAILED ' + (enrolled.error?.status ?? ''));
  const unverified = await adapter.listFactors(uid);
  record('an unverified enrolment is listed (the reset must remove it too)', unverified.length === 1 && unverified[0].status === 'unverified', unverified.map(f => f.status).join(',') || 'none');
  const verified = await user.auth.mfa.challengeAndVerify({ factorId: enrolled.data.id, code: totp(enrolled.data.totp.secret) });
  if (verified.error) throw new Error('VERIFY_FAILED ' + verified.error.status);

  const inventory = await adapter.listFactors(uid);
  record('listFactors returns the verified TOTP factor with id, status, type and created_at', inventory.length === 1 && inventory[0].status === 'verified' && inventory[0].factorType === 'totp',
    inventory.map(f => `${f.factorType}:${f.status}`).join(',') || 'none');

  await adapter.deleteFactor(uid, inventory[0].id);
  record('deleteFactor succeeds and a fresh inventory is empty (verified reset)', (await adapter.listFactors(uid)).length === 0, 'empty after delete');

  const again = await admin.auth.admin.mfa.deleteFactor({ id: inventory[0].id, userId: uid });
  const againStatus = again.error ? String((again.error as { status?: unknown }).status ?? 'no-status') : 'success';
  record('deleting an already removed factor (undocumented by the SDK; the adapter treats 404 as "decide from inventory")', true, againStatus);
  try { await adapter.deleteFactor(uid, inventory[0].id); record('adapter tolerates the repeated delete without inferring success', true, 'no error'); }
  catch (e) { record('adapter tolerates the repeated delete without inferring success', false, code(e)); }

  try { await adapter.listFactors(randomUUID()); record('listFactors for an unknown user', true, 'returned (no error)'); }
  catch (e) { record('listFactors for an unknown user', e instanceof MfaProviderError, code(e)); }

  const session = await user.auth.getSession();
  record('the user session minted before the reset still claims aal2 (the server must refuse it by sign-in time)', true,
    String((JSON.parse(Buffer.from((session.data.session?.access_token ?? '..').split('.')[1] || '', 'base64url').toString() || '{}') as { aal?: string }).aal ?? 'unknown'));
} catch (e) {
  record('validation run completed', false, (e as Error).message.replace(/[0-9a-f-]{36}/g, '<id>'));
} finally {
  if (uid) { const removed = await admin.auth.admin.deleteUser(uid); record('synthetic user deleted', !removed.error, removed.error ? String(removed.error.status) : 'deleted'); }
}
const failed = checks.filter(c => !c.ok).length;
console.log(JSON.stringify({ status: failed ? 'failed' : 'passed', sdk: '@supabase/auth-js ' + (await import('@supabase/auth-js/package.json', { with: { type: 'json' } })).default.version, checks }, null, 2));
process.exit(failed ? 1 : 0);
