#!/usr/bin/env node
/**
 * npm run test:e2e — browser end-to-end tests (development only, opt-in).
 *
 * 1. Generates synthetic users with random passwords and TOTP secrets for this run only
 *    (written to a private temp file, never printed, deleted afterwards).
 * 2. Starts scripts/e2e/e2e-server.ts on 127.0.0.1 (real server.ts + local PostgreSQL).
 * 3. Runs src/tests-e2e with playwright-core driving the installed Microsoft Edge.
 * Pass --serve to keep the server running for manual inspection (Ctrl+C to stop).
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

for (const f of ['.env', '.env.local', '.env.development', '.env.development.local'])
  if (fs.existsSync(f)) { console.error(`Refusing to run browser tests beside ${f}.`); process.exit(2); }

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const base32 = buf => { let bits = 0, value = 0, out = ''; for (const b of buf) { value = (value << 8) | b; bits += 8; while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) out += B32[(value << (5 - bits)) & 31]; return out; };
const T = 'tenantE2E', O = 'tenantE2EOther', C = 'e2eClient';
const person = (id, role, name, extra = {}) => ({ id, email: `${id}@example.test`, name, role, tenantId: T, password: randomBytes(18).toString('base64url') + 'aA1!', totp: base32(randomBytes(20)), ...extra });
const users = [
  person('e2e-admin', 'admin', 'Synthetic Administrator'),
  person('e2e-mgr', 'practice_manager', 'Synthetic Practice Manager'),
  person('e2e-mgr2', 'practice_manager', 'Synthetic Second Manager'),
  person('e2e-acct', 'accountant', 'Synthetic Accountant'),
  person('e2e-rev', 'senior_reviewer', 'Synthetic Reviewer'),
  person('e2e-bk', 'bookkeeper', 'Synthetic Bookkeeper', { authorizedClientIds: [C] }),
  person('e2e-recruiter', 'recruiter', 'Synthetic Recruiter'),
  person('e2e-client', 'client', 'Synthetic Client', { clientId: C }),
  person('e2e-foreign', 'practice_manager', 'Synthetic Foreign Manager', { tenantId: O }),
];

// Profiles: 'default' (local password + TOTP sign-in in the browser) and 'provider' (the browser
// signs in through the loopback provider emulation). Each profile gets its own server and database.
const profiles = (process.env.E2E_PROFILES || 'default,provider').split(',').map(p => p.trim()).filter(Boolean);
const extra = process.argv.slice(2).filter(a => a !== '--serve');

async function runProfile(profile) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taxguard-e2e-'));
  const credentials = path.join(dir, 'credentials.json');
  fs.writeFileSync(credentials, JSON.stringify({ users }), { mode: 0o600 });
  const port = await new Promise((resolve, reject) => { const s = net.createServer(); s.on('error', reject); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const origin = `http://127.0.0.1:${port}`;
  const env = { ...process.env };
  for (const k of Object.keys(env)) if (/SUPABASE|^SEED_|OPENAI|STRIPE|^TAXGUARD_/i.test(k)) delete env[k];
  Object.assign(env, { NODE_ENV: 'development', DISABLE_HMR: 'true', PORT: String(port), TAXGUARD_LISTEN_HOST: '127.0.0.1', E2E_CREDENTIALS_FILE: credentials, E2E_CONTROL_FILE: path.join(dir, 'control.json'),
    E2E_PROFILE: profile, TAXGUARD_DB_TEST_DIR: process.env.TAXGUARD_DB_TEST_DIR || path.join(os.tmpdir(), 'taxguard-db-tests') });
  const server = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'scripts/e2e/e2e-server.ts'], { env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const log = fs.createWriteStream(path.join(dir, 'server.log'));
  server.stdout.pipe(log); server.stderr.pipe(log);
  let exited = false; server.on('exit', () => { exited = true; });
  const cleanup = async () => {
    if (!exited) { try { server.send('stop'); } catch {} await new Promise(r => { const t = setTimeout(() => { server.kill(); r(); }, 15000); server.on('exit', () => { clearTimeout(t); r(); }); }); }
    if (process.env.E2E_KEEP_LOG) { fs.rmSync(credentials, { force: true }); console.log(`[${profile}] server log kept at ` + path.join(dir, 'server.log')); }
    else fs.rmSync(dir, { recursive: true, force: true });
  };
  process.once('SIGINT', async () => { await cleanup(); process.exit(130); });
  const deadline = Date.now() + 240000;
  for (;;) {
    if (exited) { log.end(); console.error(`[${profile}] E2E server exited during start-up:\n` + fs.readFileSync(path.join(dir, 'server.log'), 'utf8').slice(-4000)); await cleanup(); return 1; }
    try { const r = await fetch(origin + '/'); if (r.ok) break; } catch {}
    if (Date.now() > deadline) { console.error(`[${profile}] E2E server did not become ready.`); await cleanup(); return 1; }
    await new Promise(r => setTimeout(r, 1000));
  }
  if (process.argv.includes('--serve')) {
    console.log(`[${profile}] E2E server ready at ${origin} (synthetic users; credentials file ${credentials}). Ctrl+C to stop.`);
    await new Promise(() => {});
  }
  console.log(`\n=== E2E profile: ${profile} ===`);
  const tests = spawn(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '-c', 'vitest.e2e.config.ts', ...extra],
    { env: { ...env, E2E_ORIGIN: origin, E2E_CREDENTIALS_FILE: credentials, E2E_DUMP_DIR: process.env.E2E_KEEP_LOG ? dir : '' }, stdio: 'inherit' });
  const code = await new Promise(r => tests.on('exit', c => r(c ?? 1)));
  await cleanup();
  return code;
}

let failed = 0;
for (const profile of profiles) if ((await runProfile(profile)) !== 0) failed++;
process.exit(failed ? 1 : 0);
