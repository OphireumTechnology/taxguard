import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ROUTE_CUTOVER_CATALOG } from '../server/routeCutover';

// Block 97: a route cutover entry must require every proposal that holds the current definition of a database function
// its router can call. Static reading of the source: the router factory's own code (only its function body when a file
// defines several routers) and the store modules it imports with value imports under src/server/taxguard, followed
// transitively. Type-only imports and imports of error classes only carry no database calls and are not followed. The
// current definition of a function is its last CREATE in docs/development/migration-execution-order.json; definitions in
// supabase/migrations (the baseline) need no proposal. Offline; reads files only.
const ROOT = process.cwd();
const ORDER = (JSON.parse(fs.readFileSync('docs/development/migration-execution-order.json', 'utf8')).entries as { file: string }[]).map(e => e.file);
const APP = fs.readFileSync('src/server/productionApp.ts', 'utf8');

const current = new Map<string, string>();
for (const file of ORDER) for (const m of fs.readFileSync(file, 'utf8').matchAll(/CREATE OR REPLACE FUNCTION public\.(taxguard_[a-z0-9_]+)\s*\(/g)) current.set(m[1], file);

const importsOf = (src: string, from: string) => [...src.matchAll(/^import\s+(?!type\b)([^;]*?)from\s+'(\.[^']+)'/gms)].flatMap(m => {
  const names = m[1].trim();
  const list = /^\{([^}]*)\}$/.test(names) ? names.slice(1, -1).split(',').map(n => n.trim()).filter(Boolean) : [names];
  if (list.every(n => n.startsWith('type ') || /Error$/.test(n))) return [];
  const base = path.resolve(path.dirname(from), m[2]);
  return [base + '.ts', path.join(base, 'index.ts')].filter(f => {
    if (!fs.existsSync(f) || !f.includes(path.join('src', 'server', 'taxguard'))) return false;
    // A module that defines a store class is followed only when that class is imported; its helpers make no database call.
    const stores = [...fs.readFileSync(f, 'utf8').matchAll(/export class (\w+Store)\b/g)].map(c => c[1]);
    return stores.length === 0 || list.some(n => stores.includes(n.replace(/^type\s+/, '')));
  });
});
function storeFiles(file: string, seen = new Set<string>()): Set<string> {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const f of importsOf(fs.readFileSync(file, 'utf8'), file)) storeFiles(f, seen);
  return seen;
}
/** The factory's own source: from its declaration to the next exported function of the file. */
function factorySource(src: string, name: string) {
  const start = src.indexOf(`export function ${name}(`);
  if (start < 0) return src;
  const next = src.indexOf('\nexport function ', start + 1);
  return src.slice(start, next < 0 ? undefined : next);
}
const rpcsIn = (src: string) => [...src.matchAll(/'(taxguard_[a-z0-9_]+)'/g)].map(m => m[1]).filter(r => current.has(r));

function dependencies(key: string) {
  const factory = new RegExp(`'?${key}'?: \\(\\) => (create\\w+)\\(`).exec(APP)?.[1];
  const imp = factory && new RegExp(`import \\{[^}]*\\b${factory}\\b[^}]*\\} from '(\\.[^']+)'`).exec(APP);
  if (!factory || !imp) throw new Error('router factory not found for ' + key);
  const routerFile = path.resolve(ROOT, 'src/server', imp[1]) + '.ts';
  const routerSrc = fs.readFileSync(routerFile, 'utf8');
  const rpcs = new Set(rpcsIn(factorySource(routerSrc, factory)));
  const stores = new Set<string>();
  for (const f of importsOf(routerSrc, routerFile)) storeFiles(f, stores);
  for (const f of stores) for (const r of rpcsIn(fs.readFileSync(f, 'utf8'))) rpcs.add(r);
  return [...rpcs].map(r => ({ rpc: r, file: current.get(r)! }));
}

describe('route cutover dependencies', () => {
  it('reads every cutover router and finds the database functions it can call', () => {
    for (const route of ROUTE_CUTOVER_CATALOG) expect(dependencies(route.key).length, route.key).toBeGreaterThan(0);
  });

  it('each cutover entry requires every proposal holding the current definition of a function its router can call', () => {
    const missing: string[] = [];
    for (const route of ROUTE_CUTOVER_CATALOG)
      for (const { rpc, file } of dependencies(route.key)) {
        if (!file.startsWith('docs/proposed-migrations/')) continue;
        const version = path.basename(file).slice(0, 14);
        if (!route.proposals.includes(version)) missing.push(`${route.key}: ${version} (${rpc})`);
      }
    expect([...new Set(missing)].sort()).toEqual([]);
  });

  it('the factory slice keeps routers that share a file apart', () => {
    expect(dependencies('client-signatures').map(d => d.rpc)).toEqual(['taxguard_portal_signature_packages']);
    expect(dependencies('client-portal').map(d => d.rpc).sort()).toEqual(['taxguard_portal_case_stages', 'taxguard_portal_consultations', 'taxguard_portal_engagements']);
  });
});
