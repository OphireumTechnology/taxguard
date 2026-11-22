#!/usr/bin/env node
/**
 * Change classification for multi-agent integration records.
 *
 * Lists every added, modified, deleted and renamed file between --base and --head, assigns each a functional area and
 * a risk level, and decides whether the update is FRONTEND_ONLY (eligible for automatic integration once every check
 * passes) or REQUIRES_OWNER_REVIEW (protected backend, database, authentication, workflow, dependency or deletion).
 *
 * Usage: node scripts/classify-changes.mjs --base <ref> --head <ref> [--json out.json] [--markdown out.md]
 * Exit status is 0 in both cases; the integration workflow reads `decision` from the JSON.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => {
  if (value.startsWith('--')) pairs.push([value.slice(2), all[index + 1]]);
  return pairs;
}, []));
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const base = git('rev-parse', `${args.base}^{commit}`).trim();
const head = git('rev-parse', `${args.head || 'HEAD'}^{commit}`).trim();

// Ordered: the first matching rule wins.
export const AREAS = [
  { area: 'database', risk: 'high', test: f => /^(supabase\/|docs\/proposed-migrations\/)/.test(f) || f === 'docs/development/migration-execution-order.json' },
  { area: 'ci-cd', risk: 'high', test: f => f.startsWith('.github/') || f === 'scripts/integration-guard.mjs' || f === 'scripts/stamp-release.mjs' || f === 'scripts/classify-changes.mjs' },
  { area: 'dependencies', risk: 'high', test: f => /^(package\.json|package-lock\.json|bun\.lock|yarn\.lock|pnpm-lock\.yaml)$/.test(f) },
  { area: 'backend', risk: 'high', test: f => f.startsWith('src/server/') || f === 'server.ts' },
  { area: 'authentication', risk: 'high', test: f => f.startsWith('src/supabase/') || /^src\/(config\/authRecoveryPolicy|config\/apiEndpoint|services\/api)\.ts$/.test(f) },
  { area: 'tax-workflow', risk: 'high', test: f => /^src\/(taxguard|taxForms)\//.test(f) || /^src\/services\/(stage|tax|vault|billing|bookkeeping|bookToTax|job|collection|clientPortal|documentRequest|staff)/.test(f) },
  { area: 'types-and-contracts', risk: 'high', test: f => f.startsWith('src/types/') || f === 'src/types.ts' },
  { area: 'tests-and-evidence', risk: 'high', test: f => /^(src\/tests|src\/tests-db|src\/tests-e2e|tests)\//.test(f) || f === 'docs/taxguard-master-traceability.json' || f === 'vitest.config.ts' },
  { area: 'build-config', risk: 'medium', test: f => /^(vite\.config\.ts|tsconfig[^/]*\.json|CNAME|public\/CNAME)$/.test(f) },
  { area: 'tooling', risk: 'medium', test: f => f.startsWith('scripts/') || f.startsWith('docs/') },
  { area: 'frontend-services', risk: 'medium', test: f => f.startsWith('src/services/') || f.startsWith('src/context/') || f.startsWith('src/hooks/') },
  { area: 'branding-and-assets', risk: 'low', test: f => f.startsWith('public/') || f.startsWith('src/assets/') || f === 'index.html' || /^src\/(config\/(companyBranding|aiBranding)|utils\/assets)\.ts$/.test(f) },
  { area: 'frontend-ui', risk: 'low', test: f => /^src\/(components|public-v2|demo|pages|styles|utils|data|config)\//.test(f) || /^src\/[^/]+\.(tsx|css)$/.test(f) },
];
const classify = file => AREAS.find(rule => rule.test(file)) ?? { area: 'other', risk: 'high' };

const changes = git('diff', '--name-status', '-M', base, head).split('\n').filter(Boolean).map(line => {
  const [status, ...paths] = line.split('\t');
  const file = paths[paths.length - 1];
  const { area, risk } = classify(file);
  return { status: status[0], file, from: paths.length > 1 ? paths[0] : undefined, area, risk };
});
const deletions = changes.filter(c => c.status === 'D' || c.status === 'R');
const highRisk = changes.filter(c => c.risk !== 'low');
const decision = changes.length && !highRisk.length && !deletions.length ? 'FRONTEND_ONLY' : 'REQUIRES_OWNER_REVIEW';
const byArea = {};
for (const c of changes) byArea[c.area] = (byArea[c.area] || 0) + 1;
const record = { base, head, decision, counts: { total: changes.length, added: changes.filter(c => c.status === 'A').length,
  modified: changes.filter(c => c.status === 'M').length, deleted: changes.filter(c => c.status === 'D').length, renamed: changes.filter(c => c.status === 'R').length },
  byArea, reasons: [...new Set([...highRisk.map(c => `${c.area} (${c.risk})`), ...(deletions.length ? ['deletions or renames'] : [])])], changes };

if (args.json) fs.writeFileSync(args.json, JSON.stringify(record, null, 2) + '\n');
const md = [
  `### Change record ${base.slice(0, 12)}..${head.slice(0, 12)}`,
  '',
  `**Decision: ${decision}**${record.reasons.length ? ` (${record.reasons.join(', ')})` : ''}`,
  '',
  `Files: ${record.counts.total} (${record.counts.added} added, ${record.counts.modified} modified, ${record.counts.deleted} deleted, ${record.counts.renamed} renamed)`,
  '',
  '| Area | Files |', '|---|---|', ...Object.entries(byArea).sort().map(([a, n]) => `| ${a} | ${n} |`),
  '',
  '<details><summary>Files</summary>', '', '| Status | File | Area | Risk |', '|---|---|---|---|',
  ...changes.slice(0, 500).map(c => `| ${c.status} | \`${c.file}\` | ${c.area} | ${c.risk} |`), '', '</details>',
].join('\n');
if (args.markdown) fs.writeFileSync(args.markdown, md + '\n');
console.log(`classify-changes: ${decision}; ${changes.length} files; ${Object.entries(byArea).map(([a, n]) => `${a}=${n}`).join(' ')}`);
