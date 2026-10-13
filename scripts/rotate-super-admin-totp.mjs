#!/usr/bin/env node
/**
 * Rotate the LOCAL super administrator TOTP secret (non-production only).
 *
 *   node scripts/rotate-super-admin-totp.mjs [--env .env.superadmin.local]
 *
 * - Replaces only TAXGUARD_SUPER_ADMIN_TOTP_SECRET. E-mail, password hash, tenant and name
 *   lines are kept byte-for-byte.
 * - The new secret is shown only on this interactive terminal (output to a pipe, file or log
 *   is refused), is never written anywhere except the git-ignored env file, and the screen and
 *   scrollback are cleared afterwards.
 * - The file is changed only after you prove enrolment by entering a code from your
 *   authenticator app; otherwise nothing changes.
 * - No network access; no Supabase or production system is contacted.
 *
 * Restart the local server afterwards: the running server keeps the old secret until restart.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, basename, join, resolve } from 'node:path';
import readline from 'node:readline';

const args = process.argv.slice(2);
const envIndex = args.indexOf('--env');
const envPath = resolve(envIndex >= 0 ? args[envIndex + 1] : '.env.superadmin.local');
const KEY = 'TAXGUARD_SUPER_ADMIN_TOTP_SECRET';
const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MAX_ATTEMPTS = 3;

const fail = message => { console.error(message); process.exit(1); };
const clearScreen = () => { if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[3J\x1b[H'); };

function base32Encode(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += BASE32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(text) {
  let bits = 0, value = 0; const out = [];
  for (const ch of text) {
    value = (value << 5) | BASE32.indexOf(ch); bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

// Same algorithm as src/server/totp.ts (RFC 6238, SHA-1, 30 s, 6 digits).
function totp(key, step) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac('sha1', key).update(counter).digest();
  const offset = h[h.length - 1] & 0x0f;
  return String((h.readUInt32BE(offset) & 0x7fffffff) % 1e6).padStart(6, '0');
}

function codeMatches(key, code) {
  if (!/^\d{6}$/.test(code)) return false;
  const now = Math.floor(Date.now() / 30000);
  let ok = false;
  for (let step = now - 1; step <= now + 1; step++) {
    if (timingSafeEqual(Buffer.from(totp(key, step)), Buffer.from(code))) ok = true;
  }
  return ok;
}

function cancel() {
  clearScreen();
  console.log('Cancelled. Nothing changed. Remove the unconfirmed entry from your authenticator app if you added one.');
  process.exit(130);
}

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  // readline consumes Ctrl+C itself; clear the secret from the screen before exiting.
  rl.on('SIGINT', cancel);
  rl.on('close', () => { if (!answered) cancel(); });
  let answered = false;
  return new Promise(res => rl.question(question, answer => { answered = true; rl.close(); res(answer.trim()); }));
}

async function main() {
  if (process.env.NODE_ENV === 'production') fail('Refusing to run with NODE_ENV=production.');
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    fail('Run this in an interactive terminal. Output to a pipe, file or log is refused so the secret cannot be captured.');
  }
  if (!existsSync(envPath)) fail(`${envPath} not found. Provision first: node scripts/provision-super-admin.mjs`);

  const original = readFileSync(envPath, 'utf8');
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original.split(/\r?\n/);
  const secretLines = lines.map((l, i) => (l.startsWith(`${KEY}=`) ? i : -1)).filter(i => i >= 0);
  if (secretLines.length !== 1) fail(`Expected exactly one ${KEY} line in ${basename(envPath)}; found ${secretLines.length}. Nothing changed.`);
  for (const required of ['TAXGUARD_SUPER_ADMIN_EMAIL', 'TAXGUARD_SUPER_ADMIN_PASSWORD_HASH', 'TAXGUARD_SUPER_ADMIN_TENANT_ID']) {
    if (!lines.some(l => l.startsWith(`${required}=`) && l.length > required.length + 1)) fail(`${required} is missing from ${basename(envPath)}. Nothing changed.`);
  }
  const email = lines.find(l => l.startsWith('TAXGUARD_SUPER_ADMIN_EMAIL=')).slice('TAXGUARD_SUPER_ADMIN_EMAIL='.length).trim();

  const newSecret = base32Encode(randomBytes(20));
  const key = base32Decode(newSecret);
  const issuer = 'TaxGuard AI (local)';
  const uri = `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${newSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

  process.on('SIGINT', cancel);

  clearScreen();
  console.log('TaxGuard local super administrator: authenticator rotation');
  console.log(`Account: ${email}   (password and tenant are not changed)\n`);
  console.log('1. In your authenticator app, add a NEW entry using this secret (manual / "enter a setup key"):\n');
  console.log(`     ${newSecret.match(/.{1,4}/g).join(' ')}\n`);
  console.log(`   Or open this link on a device whose app handles otpauth links:\n     ${uri}\n`);
  console.log('2. Enter the 6-digit code the NEW entry shows to confirm. The file is changed only after a correct code.\n');

  let verified = false;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !verified; attempt++) {
    const code = (await ask(`Code from the new entry (attempt ${attempt}/${MAX_ATTEMPTS}): `)).replace(/\s/g, '');
    verified = codeMatches(key, code);
    if (!verified) console.log('That code does not match the new secret.');
  }
  clearScreen();
  if (!verified) fail('Not verified. Nothing changed; the previous secret is still configured. Remove the unconfirmed entry from your app and run again.');

  lines[secretLines[0]] = `${KEY}=${newSecret}`;
  const temp = join(dirname(envPath), `.${basename(envPath)}.${process.pid}.tmp`);
  try {
    writeFileSync(temp, lines.join(eol), { encoding: 'utf8', mode: 0o600 });
    renameSync(temp, envPath);
  } catch (err) {
    try { unlinkSync(temp); } catch { /* ignore */ }
    fail(`Could not update ${basename(envPath)}: ${err.message}. Nothing changed.`);
  }

  console.log(`Authenticator secret rotated in ${basename(envPath)} (screen cleared; the secret is not shown again).`);
  console.log('Next:');
  console.log('  1. Restart the local server now. The running server still accepts the OLD secret until it restarts.');
  console.log('  2. Sign in with the NEW authenticator entry, then delete the old entry from your app.');
  process.exit(0);
}

main().catch(err => { clearScreen(); console.error(err.message); process.exit(1); });
