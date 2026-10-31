import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../server/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('../server/supabase')>()), isSupabaseServerConfigured: () => true }));
import { setSupabaseAdmin } from '../server/supabase';
import { createProductionApp, CUTOVER_ROUTER_FACTORIES } from '../server/productionApp';
import { ROUTE_CUTOVER_CATALOG } from '../server/routeCutover';

// Production route inventory (CONTROL-DURABILITY). Walks every /api route the real production app registers and calls
// each one, in production mode, as an anonymous caller and as an active, assigned, AAL2 session of every role. Every
// route must be listed in docs/development/production-route-inventory.json, in one group. A REFUSED group's routes
// must answer only 401/403 or its exact refusal code (so a route backed by process-local state can never answer
// success, or validate and act, in production); a group that answers carries a reviewed reason. The session store is
// a synthetic stand-in with no database functions, so durable routes report their provider unavailable here.
// Synthetic identities only.
const INVENTORY = 'docs/development/production-route-inventory.json';
const REFUSED: Record<string, number> = { VOLATILE_REFUSED: 503, DURABLE_GATED: 503, PROVIDER_REFUSED: 503, RETIRED: 410 };
const ANSWERING = ['DURABLE', 'STATELESS', 'DIAGNOSTIC'];
const TENANT = 'tenant-route-inventory';
const CLIENT = 'cl-route-inventory';
const ROLES = ['client', 'prospective_client', 'accountant', 'reviewer', 'senior_reviewer', 'bookkeeper', 'operations', 'practice_manager', 'admin', 'super_admin'];
// A complete reviewer decision (and, below, a valid search term), so a route that validates its input before
// refusing reaches its refusal.
const BODY = { clientId: CLIENT, taxYear: 2025, confirmed: true, decision: 'APPROVE', reason: 'Synthetic route inventory reason text.', rationale: 'Synthetic route inventory reason text.' };

type Row = Record<string, any>;
const tables: Record<string, Row[]> = { taxguard_sessions: [], taxguard_identities: [], taxguard_members: [], taxguard_staff_assignments: [], taxguard_clients: [] };
function syntheticStore() {
  return {
    auth: { admin: { mfa: { listFactors: async () => ({ data: { factors: [{ status: 'verified' }] }, error: null }) } } },
    rpc: async () => ({ data: null, error: { code: '42883', message: 'synthetic store has no database functions' } }),
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      const rows = () => (tables[table] ?? []).filter(r => filters.every(f => f(r)));
      const builder: any = new Proxy({}, { get: (_t, key) => {
        if (key === 'eq') return (c: string, v: unknown) => { filters.push(r => r[c] === v); return builder; };
        if (key === 'in') return (c: string, vs: unknown[]) => { filters.push(r => vs.includes(r[c])); return builder; };
        if (key === 'maybeSingle' || key === 'single') return async () => ({ data: rows()[0] ?? null, error: null });
        if (key === 'then') return (resolve: any, reject: any) => Promise.resolve({ data: rows(), error: null }).then(resolve, reject);
        return () => builder;
      } });
      return builder;
    },
  } as any;
}

const ROOT_MOUNT = '^\\/?(?=\\/|$)';
const mountPath = (re: RegExp) => re.source === ROOT_MOUNT ? '' : re.source.split('|^')[0].replace(/^\^/, '').replace('\\/?(?=\\/|$)', '').split('\\/').join('/');
function routesOf(stack: any[], prefix: string, out = new Set<string>()): Set<string> {
  for (const layer of stack) {
    if (layer.route) for (const m of Object.keys(layer.route.methods)) for (const p of [layer.route.path].flat()) out.add(`${m.toUpperCase()} ${prefix}${p}`);
    else if (layer.handle?.stack) routesOf(layer.handle.stack, prefix + mountPath(layer.regexp), out);
  }
  return out;
}
const registeredRoutes = (app: any) => [...routesOf(app._router.stack, '')].filter(r => r.split(' ')[1].startsWith('/api/')).sort();

const tokens: Record<string, string> = {};
let server: Server, origin: string, routes: string[] = [];
beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TAXGUARD_TENANT_ID', TENANT);
  vi.stubEnv('TAXGUARD_LEDGER_STORE', '');
  for (const role of ROLES) {
    const uid = 'inv-' + role;
    const client = role.endsWith('client') ? CLIENT : '';
    tables.taxguard_identities.push({ uid, tenant_id: TENANT, user_data: { id: uid, email: uid + '@example.invalid', name: uid, role, status: 'active' } });
    tables.taxguard_members.push({ tenant_id: TENANT, uid, role, status: 'active', client_id: client });
    if (client) tables.taxguard_clients.push({ tenant_id: TENANT, client_id: client, owner_uid: uid });
    else tables.taxguard_staff_assignments.push({ tenant_id: TENANT, client_id: CLIENT, user_id: uid, status: 'ACTIVE', engagement_id: null, tax_year: null, effective_from: '2020-01-01T00:00:00Z', effective_to: null });
    const token = 'tg_live_' + randomBytes(32).toString('hex');
    tables.taxguard_sessions.push({ session_token_hash: createHash('sha256').update(token).digest('hex'), uid, tenant_id: TENANT, revoked: false,
      expires_at: Date.now() + 3_600_000, auth_time: Math.floor(Date.now() / 1000), aal: 'aal2' });
    tokens[role] = token;
  }
  setSupabaseAdmin(syntheticStore());
  const app = createProductionApp();
  routes = registeredRoutes(app);
  server = createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  if (process.env.TG_ROUTE_DUMP) {
    const dump: Record<string, { default: string[]; ledger: string[] }> = {};
    for (const route of routes) dump[route] = { default: [...await outcomes(route)], ledger: [] };
    vi.stubEnv('TAXGUARD_LEDGER_STORE', 'durable');
    for (const route of routes.filter(r => r.includes('/api/bookkeeping/'))) dump[route].ledger = [...await outcomes(route)];
    vi.stubEnv('TAXGUARD_LEDGER_STORE', '');
    fs.writeFileSync(process.env.TG_ROUTE_DUMP, JSON.stringify(dump, null, 1));
  }
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); vi.unstubAllEnvs(); });

/** The non-authentication outcomes ("status" or "status:CODE") of one route across every caller. */
async function outcomes(route: string): Promise<Set<string>> {
  const [method, path] = route.split(' ');
  const url = path.replace(/:tenantId/g, TENANT).replace(/:clientId/g, CLIENT).replace(/:taxYear/g, '2025').replace(/:[A-Za-z]+/g, 'inventory-1');
  const seen = new Set<string>();
  for (const role of ['anonymous', ...ROLES]) {
    const r = await fetch(origin + url + (method === 'GET' ? `?clientId=${CLIENT}&taxYear=2025&q=inventory` : ''), { method,
      headers: { 'content-type': 'application/json', ...(tokens[role] ? { authorization: 'Bearer ' + tokens[role] } : {}) },
      body: method === 'GET' ? undefined : JSON.stringify(BODY) });
    const body = await r.json().catch(() => null) as { code?: string } | null;
    if (r.status !== 401 && r.status !== 403) seen.add(body?.code ? `${r.status}:${body.code}` : String(r.status));
  }
  return seen;
}

type Group = { id: string; kind: string; code?: string; ledgerCode?: string; coverage?: string; replacementRoutes?: string[]; gap?: string; reason: string; routes: string[] };
const inventory = () => JSON.parse(fs.readFileSync(INVENTORY, 'utf8')) as { kinds: Record<string, string>; groups: Group[] };

describe('production route inventory', () => {
  it('lists every registered /api route exactly once, with a known kind and a reviewed reason', () => {
    const { kinds, groups } = inventory();
    const listed = groups.flatMap(g => g.routes);
    expect(listed.filter((r, i) => listed.indexOf(r) !== i), 'listed twice').toEqual([]);
    expect(routes.filter(r => !listed.includes(r)), 'registered but not listed').toEqual([]);
    expect(listed.filter(r => !routes.includes(r)), 'listed but not registered').toEqual([]);
    for (const g of groups) {
      expect(Object.keys(kinds), g.id).toContain(g.kind);
      expect([...Object.keys(REFUSED), ...ANSWERING], g.id).toContain(g.kind);
      expect(g.reason.length, g.id).toBeGreaterThanOrEqual(40);
      expect(Boolean(g.code), g.id).toBe(g.kind in REFUSED);
    }
    expect(routes.length).toBeGreaterThan(200);
  });

  it('records the durable coverage of every refused in-memory group, naming only routes that exist', () => {
    // Every route of every cutover router, under its catalog path, plus the routes production already serves.
    const cutoverRoutes = ROUTE_CUTOVER_CATALOG.flatMap(c => [...routesOf((CUTOVER_ROUTER_FACTORIES[c.key]() as any).stack, c.path)]);
    expect(cutoverRoutes.length).toBeGreaterThan(100);
    const known = new Set([...routes, ...cutoverRoutes]);
    for (const g of inventory().groups) {
      if (!['VOLATILE_REFUSED', 'PROVIDER_REFUSED'].includes(g.kind)) { expect(g.coverage, g.id).toBeUndefined(); continue; }
      expect(['REPLACED', 'PARTIAL', 'NONE'], g.id).toContain(g.coverage);
      const replacements = g.replacementRoutes ?? [];
      expect(replacements.length > 0, g.id).toBe(g.coverage !== 'NONE');
      expect((g.gap ?? '').length >= 20, g.id).toBe(g.coverage !== 'REPLACED');
      expect(replacements.filter(r => !known.has(r)), `${g.id}: replacement routes that do not exist`).toEqual([]);
      expect(replacements.filter(r => g.routes.includes(r) || inventory().groups.some(o => o.kind in REFUSED && o.routes.includes(r))),
        `${g.id}: a replacement must not itself be refused`).toEqual([]);
    }
  });

  it('a refused route answers only authentication denials or its exact refusal code, for every role', async () => {
    const wrong: string[] = [];
    for (const g of inventory().groups.filter(x => x.kind in REFUSED)) {
      for (const route of g.routes) {
        const seen = [...await outcomes(route)];
        const expected = `${REFUSED[g.kind]}:${g.code}`;
        if (seen.length === 0 || seen.some(s => s !== expected)) wrong.push(`${route} (${g.id}): ${seen.join(', ') || 'only 401/403'}`);
      }
    }
    expect(wrong).toEqual([]);
  }, 240_000);

  it('with the durable ledger selected, ledger routes reach it and the rest refuse with their ledger code', async () => {
    vi.stubEnv('TAXGUARD_LEDGER_STORE', 'durable');
    try {
      const wrong: string[] = [];
      for (const g of inventory().groups.filter(x => x.kind === 'DURABLE_GATED' || x.ledgerCode)) {
        for (const route of g.routes) {
          const seen = [...await outcomes(route)];
          if (g.ledgerCode ? seen.length === 0 || seen.some(s => s !== `503:${g.ledgerCode}`)
            : seen.some(s => s.startsWith('2') || s.includes(g.code!) || s.includes('DURABLE_FEATURE_NOT_AVAILABLE'))) wrong.push(`${route} (${g.id}): ${seen.join(', ')}`);
        }
      }
      expect(wrong).toEqual([]);
    } finally { vi.stubEnv('TAXGUARD_LEDGER_STORE', ''); }
  }, 120_000);
});
