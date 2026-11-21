#!/usr/bin/env node
/**
 * Integration guard for multi-agent development (Google AI Studio, Claude Code, ChatGPT).
 *
 * Compares an update (--head) with its base (--base) and fails when it would damage recovered TaxGuard functionality:
 *   1. MIGRATION_IMMUTABLE: an existing file under supabase/migrations/ is modified, renamed or deleted. Applied
 *      migration bytes never change; corrections are new migrations.
 *   2. PROTECTED_DELETION: a file under a protected path is deleted (server, services, Supabase clients, workflow
 *      gates, types, migrations, proposals, tests, scripts, workflows, development docs) and the exact path is not
 *      listed in docs/development/approved-deletions.json (a reviewed file; see multi-agent-integration.md).
 *   3. SERVICE_STUBBED: a protected browser service client or server route that called the API or the database at the
 *      base no longer contains any such call (the pattern of replacing a real service with a local mock).
 *
 * Usage: node scripts/integration-guard.mjs --base <sha> [--head <sha|HEAD>]
 * With no usable base (first push of a branch, or an all-zero base) the guard checks the head commit alone.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const exists = rev => { try { git('cat-file', '-e', `${rev}^{commit}`); return true; } catch { return false; } };

const head = String(args.head || 'HEAD');
let base = String(args.base || '').trim();
// Any commit reference resolves (a SHA, HEAD~1, origin/main); an empty or all-zero base (a branch's first push) or an
// unknown one falls back to the head's parent.
if (!base || /^0+$/.test(base) || !exists(base)) base = exists(`${head}~1`) ? `${head}~1` : '';
if (base) base = git('rev-parse', `${base}^{commit}`).trim();
if (!base) { console.log('integration-guard: no base commit; nothing to compare.'); process.exit(0); }

export const PROTECTED_PREFIXES = [
  'supabase/', 'docs/proposed-migrations/', 'docs/development/', 'src/server/', 'src/services/', 'src/supabase/',
  'src/taxguard/', 'src/types/', 'src/tests/', 'src/tests-db/', 'src/tests-e2e/', 'tests/', 'scripts/', '.github/workflows/',
];
const isProtected = file => PROTECTED_PREFIXES.some(p => file.startsWith(p)) || file === 'server.ts' || file === 'docs/taxguard-master-traceability.json';
const SERVICE_PREFIXES = ['src/services/', 'src/supabase/', 'src/server/routes/'];
const CALLS = /\bfetch\(|apiEndpoint\(|\brequest\s*<|\brequest\(|\.rpc\(|\.from\(|getSupabaseAdmin\(|createClient\(|\bpool\.query\(/;

const approvedFile = 'docs/development/approved-deletions.json';
let approved = new Set();
try {
  const doc = JSON.parse(git('show', `${head}:${approvedFile}`));
  approved = new Set((doc.paths || []).map(entry => (typeof entry === 'string' ? entry : entry.path)));
} catch { /* no approvals recorded */ }

const changes = git('diff', '--name-status', '-M', `${base}`, `${head}`).split('\n').filter(Boolean).map(line => {
  const [status, ...paths] = line.split('\t');
  return { status: status[0], from: paths[0], to: paths[paths.length - 1] };
});

const violations = [];
for (const c of changes) {
  if (c.from.startsWith('supabase/migrations/') && ['M', 'D', 'R'].includes(c.status))
    violations.push(`MIGRATION_IMMUTABLE ${c.status} ${c.from}`);
  if ((c.status === 'D' || c.status === 'R') && isProtected(c.from) && !approved.has(c.from) && !(c.status === 'R' && isProtected(c.to)))
    violations.push(`PROTECTED_DELETION ${c.status} ${c.from}`);
  if (c.status === 'M' && SERVICE_PREFIXES.some(p => c.from.startsWith(p)) && /\.(ts|tsx)$/.test(c.from)) {
    const before = git('show', `${base}:${c.from}`);
    const after = git('show', `${head}:${c.to}`);
    if (CALLS.test(before) && !CALLS.test(after)) violations.push(`SERVICE_STUBBED ${c.from}`);
  }
}

console.log(`integration-guard: ${changes.length} changed paths between ${base.slice(0, 12)} and ${git('rev-parse', head).trim().slice(0, 12)}.`);
if (violations.length) {
  for (const v of violations.slice(0, 200)) console.error(`::error::${v}`);
  if (violations.length > 200) console.error(`::error::... ${violations.length - 200} more`);
  console.error(`integration-guard: ${violations.length} violation(s). See docs/development/multi-agent-integration.md.`);
  process.exit(1);
}
console.log('integration-guard: PASS');
