// Frontend reachability and evidence audit (Phase 12B). Traces static and lazy imports from
// src/main.tsx, then scans ONLY reachable browser files for evidence patterns: calls to retired or
// legacy in-memory APIs, fabricated or hardcoded operational values, browser dialogs, simulated
// latency, mojibake, buttons without handlers, and missing accessible names. Offline; reads source only.
//   node scripts/frontend/reachability-audit.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'src';
const ENTRY = 'src/main.tsx';
const EXT = ['.tsx', '.ts', '/index.tsx', '/index.ts'];

function resolve(from, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  for (const candidate of [base, ...EXT.map(e => base.replace(/\.(tsx?|jsx?)$/, '') + e)]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile() && /\.(tsx?)$/.test(candidate)) return candidate;
  }
  return null;
}

export function reachableFiles(entry = ENTRY) {
  const seen = new Set(), queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = fs.readFileSync(file, 'utf8');
    const specs = [...text.matchAll(/(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s*['"]([^'"]+)['"]/gm)].map(m => m[1] || m[2] || m[3]);
    for (const spec of specs) { const r = resolve(file, spec); if (r && !seen.has(r)) queue.push(r); }
  }
  return [...seen].sort();
}

/** Evidence patterns. Each match is a lead to review, not by itself a defect. */
export const PATTERNS = [
  ['RETIRED_API', /['"`]\/api\/(engagements|appointments|payments|messages|legal|assignments)(?![A-Za-z0-9-])/],
  ['LEGACY_IN_MEMORY_API', /['"`]\/api\/(documents|calendar|intake|onboarding|consultation-rooms|admin|super-admin|security|integrations|careers)(?![A-Za-z0-9-])/],
  ['BROWSER_DIALOG', /\b(window\.)?(alert|confirm|prompt)\(/],
  ['SIMULATED_LATENCY', /setTimeout\([^)]*,\s*\d{3,}\)/],
  ['RANDOM_VALUE', /Math\.random\(\)/],
  ['MOJIBAKE', /�|Ã.|â€|\? \{get[A-Z]/],
  ['HARDCODED_PERSON', /Desmond Hinds|John Doe|Jane Doe|Sarah (Chen|Johnson)/],
  ['HARDCODED_STATUS_CLAIM', /(Cleared &amp; Certified|HARD EXIT GATE PASSED|E-?File Accepted|IRS Accepted|Return Filed Successfully|Signature Complete)/i],
  ['BUTTON_WITHOUT_HANDLER', /<button(?![^>]*\b(onClick|type=["']submit["']|disabled|aria-disabled)\b)[^>]*>/],
  ['ICON_BUTTON_NO_LABEL', /<button(?![^>]*aria-label)[^>]*>\s*<[A-Z][A-Za-z]+\s[^>]*\/>\s*<\/button>/],
  ['CONSOLE', /console\.(log|debug)\(/],
];

export function audit() {
  const files = reachableFiles().filter(f => f.startsWith(ROOT + '/') && !/\/tests?\//.test(f));
  const findings = [];
  for (const file of files) {
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => { for (const [code, re] of PATTERNS) if (re.test(line)) findings.push({ code, file, line: i + 1 }); });
  }
  const all = fs.readdirSync(ROOT, { recursive: true }).map(f => path.posix.join(ROOT, String(f).replace(/\\/g, '/')))
    .filter(f => /\.tsx$/.test(f) && f.startsWith('src/components/') && !/\/tests?\//.test(f));
  const unreachableComponents = all.filter(f => !files.includes(f)).sort();
  return { reachable: files.length, unreachableComponents, findings };
}

if (process.argv[1]?.endsWith('reachability-audit.mjs')) {
  const r = audit();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }
  const by = {};
  for (const f of r.findings) (by[f.code] ??= []).push(`${f.file}:${f.line}`);
  console.log(`reachable files: ${r.reachable}; unreachable components: ${r.unreachableComponents.length}`);
  for (const [code, list] of Object.entries(by)) console.log(`\n${code} (${list.length})\n  ` + list.slice(0, 40).join('\n  '));
  console.log('\nUNREACHABLE COMPONENTS\n  ' + r.unreachableComponents.join('\n  '));
}
