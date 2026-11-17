import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../server/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('../server/supabase')>()), isSupabaseServerConfigured: () => true }));
import { createProductionApp, CUTOVER_ROUTER_FACTORIES } from '../server/productionApp';
import { ROUTE_CUTOVER_CATALOG } from '../server/routeCutover';
// @ts-ignore -- plain ESM script without type declarations
import { reachableFiles } from '../../scripts/frontend/reachability-audit.mjs';

// Block 101: the frontend-to-production route contract. Every /api path the reachable frontend (traced from
// src/main.tsx) names must be one the production app registers, either always or once its durable router is cut
// over. A path no production router serves answers 503 API_NOT_RELEASED in production: the screen calling it cannot work there,
// whatever the development server does. Each such call is listed, with its file, in
// docs/development/frontend-production-route-contract.json and reviewed; a new one fails this test, and so does a
// listed one that has since been fixed (so the list only shrinks). Offline: reads source and builds the app in memory.
// Request methods are not compared; the path alone decides.
const CONTRACT = 'docs/development/frontend-production-route-contract.json';
const INVENTORY = JSON.parse(fs.readFileSync('docs/development/production-route-inventory.json', 'utf8')) as { groups: { id: string; kind: string; routes: string[] }[] };

const ROOT_MOUNT = '^\\/?(?=\\/|$)';
const mountPath = (re: RegExp) => re.source === ROOT_MOUNT ? '' : re.source.split('|^')[0].replace(/^\^/, '').replace('\\/?(?=\\/|$)', '').split('\\/').join('/');
function routesOf(stack: any[], prefix: string, out = new Set<string>()): Set<string> {
  for (const layer of stack) {
    if (layer.route) for (const p of [layer.route.path].flat()) out.add(prefix + p);
    else if (layer.handle?.stack) routesOf(layer.handle.stack, prefix + mountPath(layer.regexp), out);
  }
  return out;
}
const pattern = (route: string) => new RegExp('^' + route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z_]+/g, '[^/]+') + '$');

type Served = { route: string; re: RegExp; source: string };
type Call = { file: string; line: number; path: string; prefix: boolean };
type Classified = Call & { sources: string[] };
let served: Served[] = [];
let calls: Classified[] = [];

/** The /api paths named in a file: string and template literals, with ${...} read as one path segment. */
export function apiCalls(file: string): Call[] {
  const out: Call[] = [];
  fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach((text, i) => {
    for (const m of text.matchAll(/(['"`])(\/api(?:\/[^'"`\s?#]*)?)/g)) {
      // A nested template (`...${a ? `&b=${c}` : ''}`) ends the match inside its value; keep the path before it.
      const nested = /\$\{[^}]*$/.test(m[2]);
      const raw = m[2].replace(/\$\{[^}]*$/, '').replace(/\$\{[^}]*\}/g, ':p');
      // A literal that ends in "/" or in a bare template value is completed by concatenation: compare it as a prefix.
      const prefix = nested || /\/$/.test(raw) || /[^/]:p$/.test(raw);
      const p = raw.replace(/[^/]:p$/, c => c[0]).replace(/\/+$/, '');
      out.push({ file, line: i + 1, path: p, prefix });
    }
  });
  return out;
}
/** Segment-wise comparison: a parameter on either side (":name", or a template value in the call) matches one segment. */
function matches(call: string, route: string, prefix: boolean) {
  const a = call.split('/'), b = route.split('/');
  if (prefix ? a.length > b.length : a.length !== b.length) return false;
  return a.every((seg, i) => seg === b[i] || seg.startsWith(':') || b[i].startsWith(':') || (/:p/.test(seg) && new RegExp('^' + seg.split(':p').map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/]+') + '$').test(b[i])));
}
function sourcesFor(call: Call) {
  const hits = served.filter(s => matches(call.path, s.route, call.prefix));
  // A base path that is only ever extended (for example a const BASE = '/api/practice') counts by the routes under it.
  const under = hits.length ? hits : served.filter(s => matches(call.path, s.route, true));
  return [...new Set(under.map(s => s.source))].sort();
}

beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TAXGUARD_TENANT_ID', 'tenant-route-contract');
  const kindOf = new Map<string, string>();
  for (const g of INVENTORY.groups) for (const r of g.routes) kindOf.set(r.split(' ')[1], g.kind);
  const app = createProductionApp() as any;
  for (const route of routesOf(app._router.stack, '')) if (route.startsWith('/api')) served.push({ route, re: pattern(route), source: kindOf.get(route) ?? 'UNINVENTORIED' });
  for (const entry of ROUTE_CUTOVER_CATALOG) {
    const router = CUTOVER_ROUTER_FACTORIES[entry.key]() as any;
    for (const route of routesOf(router.stack, entry.path)) served.push({ route, re: pattern(route), source: 'CUTOVER:' + entry.key });
  }
  const files = (reachableFiles() as string[]).filter(f => f.startsWith('src/') && !/\/tests?\//.test(f) && !/^src\/server\//.test(f));
  calls = files.flatMap(apiCalls).map(c => ({ ...c, sources: sourcesFor(c) }));
  if (process.env.TG_ROUTE_CONTRACT_DUMP) fs.writeFileSync(process.env.TG_ROUTE_CONTRACT_DUMP, JSON.stringify({ served: served.map(({ route, source }) => ({ route, source })), calls }, null, 1));
});
afterAll(() => { vi.unstubAllEnvs(); });

const unserved = () => [...new Set(calls.filter(c => c.sources.length === 0).map(c => `${c.file} ${c.path}`))].sort();

describe('frontend to production route contract', () => {
  it('reads the production routes, the cut-over routers and the reachable frontend calls', () => {
    expect(served.length).toBeGreaterThan(222);
    expect(calls.length).toBeGreaterThan(100);
    expect(served.filter(s => s.source === 'UNINVENTORIED').map(s => s.route)).toEqual([]);
  });

  it('every reachable frontend call that no production router serves is listed and reviewed', () => {
    const listed = (JSON.parse(fs.readFileSync(CONTRACT, 'utf8')) as { unserved: { file: string; path: string }[] }).unserved.map(u => `${u.file} ${u.path}`).sort();
    expect(unserved()).toEqual(listed);
  });

  it('classifies template values as path segments and concatenation as a prefix', () => {
    const tmp = 'src/tests/.route-contract-sample.tmp';
    fs.writeFileSync(tmp, "fetch(`/api/practice/clients/${id}/tasks`); fetch('/api/vault/' + id); fetch('/api/nowhere/x');\n");
    try {
      const sample = apiCalls(tmp).map(c => ({ ...c, sources: sourcesFor(c) }));
      expect(sample.map(c => [c.path, c.prefix])).toEqual([['/api/practice/clients/:p/tasks', false], ['/api/vault', true], ['/api/nowhere/x', false]]);
      expect(sample[0].sources).toEqual(['CUTOVER:practice']);
      expect(sample[1].sources.length).toBeGreaterThan(0);
      expect(sample[2].sources).toEqual([]);
    } finally { fs.rmSync(tmp); }
  });
});
