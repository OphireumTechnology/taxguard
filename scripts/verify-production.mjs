#!/usr/bin/env node
/**
 * Local, non-deploying TaxGuard validation runner.
 * Does not commit, push, migrate databases, or touch production credentials.
 *
 * Usage:
 *   npm run verify:production
 *   npm run verify:production -- --full
 *
 * --full runs the existing identity, traceability, security and synthetic
 * browser checks in addition to the default TypeScript/unit/build checks.
 * Disposable DB integration is deliberately separate (npm run test:db)
 * and must be run only against an explicitly verified local test database.
 */
import { spawnSync } from 'node:child_process';

const flags = new Set(process.argv.slice(2));
const allowed = new Set(['--full']);
const unknown = [...flags].filter(flag => !allowed.has(flag));
if (unknown.length) {
  console.error(`Unknown argument(s): ${unknown.join(', ')}. Supported: --full`);
  process.exit(2);
}

const full = flags.has('--full');
const steps = [
  ['TypeScript', 'npm', ['run', 'typecheck']],
  ['Unit tests', 'npm', ['run', 'test', '--', '--run']],
  ['Production bundle build', 'npm', ['run', 'build']],
];
if (full) {
  steps.push(
    ['Identity and tenant isolation', 'npm', ['run', 'test:identity']],
    ['Traceability integrity', 'node', ['scripts/verify-local-traceability.mjs']],
    ['Secrets scan', 'npm', ['run', 'security:secrets']],
    ['White-label bundle scan', 'npm', ['run', 'security:white-label']],
    ['Synthetic browser journey', 'npm', ['run', 'qa:browser']],
  );
}

const results = [];
for (const [name, command, args] of steps) {
  console.log(`\n========== ${name} ==========\n`);
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, CI: process.env.CI || 'true' },
  });
  const code = result.error ? 1 : (result.status ?? 1);
  if (result.error) console.error(result.error.message);
  results.push({ name, code, seconds: Math.round((Date.now() - started) / 1000) });
  // Fail fast to avoid wasting CI time on a broken prerequisite.
  if (code !== 0) break;
}

console.log('\n========== TAXGUARD VERIFICATION SUMMARY ==========');
for (const item of results) {
  console.log(`${item.code === 0 ? 'PASS' : 'FAIL'}  ${item.name} (${item.seconds}s)`);
}
const passed = results.length === steps.length && results.every(item => item.code === 0);
console.log(passed ? 'VALIDATION PASSED (not production certification)' : 'VALIDATION FAILED — DO NOT DEPLOY');
process.exitCode = passed ? 0 : 1;
