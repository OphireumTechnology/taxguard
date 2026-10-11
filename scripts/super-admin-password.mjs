#!/usr/bin/env node
/**
 * Local super administrator password tool (non-production only). Offline: it never contacts
 * the server, so checking does not count as a failed login or affect lockout.
 *
 *   node scripts/super-admin-password.mjs --check   compare a typed password with the stored hash
 *   node scripts/super-admin-password.mjs --reset   store a new hash (password typed twice)
 *   options: --env <file>   (default .env.superadmin.local)
 *
 * --check also detects hashes created by the earlier provisioning prompt, which could store
 * Enter / newline characters as part of the password. Nothing is printed except the verdict.
 * --reset replaces only TAXGUARD_SUPER_ADMIN_PASSWORD_HASH; e-mail, tenant, name and the
 * authenticator secret are kept byte-for-byte. Restart the local server afterwards.
 */
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { askHidden, passwordProblems } from './lib/hiddenInput.mjs';

// Must match src/server/auth.ts (hashPassword / verifyPassword).
const SALT_LENGTH = 16, KEY_LENGTH = 64, ITERATIONS = 10000, DIGEST = 'sha512';
const HASH_KEY = 'TAXGUARD_SUPER_ADMIN_PASSWORD_HASH';
/** Suffixes the earlier prompt could have captured from Enter / paste. */
const LEGACY_SUFFIXES = ['\r', '\n', '\r\n', '\r\r', '\r\n\r', '\n\r'];

export function hashMatches(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** 'match' | 'legacy_newline' | 'no_match' */
export function diagnosePassword(password, stored) {
  if (hashMatches(password, stored)) return 'match';
  if (LEGACY_SUFFIXES.some(suffix => hashMatches(password + suffix, stored))) return 'legacy_newline';
  return 'no_match';
}

export function hashPassword(password) {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  return `${salt}:${pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')}`;
}

/** Replaces only the hash line; returns the new file text. */
export function replaceHashLine(text, newHash) {
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  const indexes = lines.map((l, i) => (l.startsWith(`${HASH_KEY}=`) ? i : -1)).filter(i => i >= 0);
  if (indexes.length !== 1) throw new Error(`Expected exactly one ${HASH_KEY} line; found ${indexes.length}.`);
  lines[indexes[0]] = `${HASH_KEY}=${newHash}`;
  return lines.join(eol);
}

function readEnv(path) {
  const text = readFileSync(path, 'utf8');
  const get = key => (text.split(/\r?\n/).find(l => l.startsWith(`${key}=`)) || '').slice(key.length + 1).trim();
  return { text, email: get('TAXGUARD_SUPER_ADMIN_EMAIL'), hash: get(HASH_KEY) };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--reset') ? 'reset' : args.includes('--check') ? 'check' : null;
  const envIndex = args.indexOf('--env');
  const envPath = resolve(envIndex >= 0 ? args[envIndex + 1] : '.env.superadmin.local');
  const fail = message => { console.error(message); process.exit(1); };
  if (!mode) fail('Usage: node scripts/super-admin-password.mjs --check | --reset [--env <file>]');
  if (process.env.NODE_ENV === 'production') fail('Refusing to run with NODE_ENV=production.');
  if (!existsSync(envPath)) fail(`${basename(envPath)} not found. Provision first: node scripts/provision-super-admin.mjs`);
  const { text, email, hash } = readEnv(envPath);
  if (!/^[0-9a-f]{32}:[0-9a-f]{128}$/.test(hash)) fail(`${HASH_KEY} is missing or malformed in ${basename(envPath)}.`);

  if (mode === 'check') {
    const verdict = diagnosePassword(await askHidden('Password to check (hidden): '), hash);
    if (verdict === 'match') console.log('MATCH: this password matches the stored hash. If sign-in still fails, restart the server so it loads this file, and check the e-mail address.');
    else if (verdict === 'legacy_newline') console.log('MISMATCH (known cause): the stored hash includes an Enter / newline character captured by the earlier provisioning prompt, so the browser can never send it. Fix: node scripts/super-admin-password.mjs --reset  (you may type the same password).');
    else console.log('NO MATCH: this is not the password that was provisioned. Use --reset to set a new password.');
    return;
  }

  const password = await askHidden('New password (hidden; the same password is allowed): ');
  const problems = passwordProblems(password, email);
  if (problems.length) fail(`Password rejected; it needs: ${problems.join(', ')}. Nothing changed.`);
  if ((await askHidden('Confirm password (hidden): ')) !== password) fail('Passwords do not match. Nothing changed.');
  const updated = replaceHashLine(text, hashPassword(password));
  const temp = join(dirname(envPath), `.${basename(envPath)}.${process.pid}.tmp`);
  try { writeFileSync(temp, updated, { encoding: 'utf8', mode: 0o600 }); renameSync(temp, envPath); }
  catch (err) { try { unlinkSync(temp); } catch { /* ignore */ } fail(`Could not update ${basename(envPath)}: ${err.message}. Nothing changed.`); }
  console.log(`Password hash updated in ${basename(envPath)}. E-mail, tenant and authenticator secret are unchanged.`);
  console.log('Restart the local server so it loads the new hash.');
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main().catch(err => { console.error(err.message); process.exit(1); });
