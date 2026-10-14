import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHealthRouter, type HealthProbes } from '../server/observability/health';
import { runtimeProbes } from '../server/observability/defaultProbes';

// Liveness / readiness / administrator diagnostics. Probes are synthetic; the secrets below are
// invented and must never appear in any response.
const SECRETS = ['https://abcdefghijklmnopqrst.supabase.co', 'synthetic-service-role-key-value', 'tenant-secret-id', 'postgresql://user:pw@db.example.test/postgres'];
let db: { state: any; schema: string } | 'throw' | 'hang' = { state: 'OK', schema: 'DATABASE_READY' };
let identity: any = 'OK';
const probes = (): HealthProbes => ({
  database: async () => { if (db === 'throw') throw new Error('connection lost ' + SECRETS[3]); if (db === 'hang') return new Promise(() => {}); return db; },
  identity: () => identity, storage: () => 'NOT_CONFIGURED',
  scanner: async () => ({ state: 'DISABLED' }), ai: () => ({ state: 'NOT_CONFIGURED', materialActions: 'BLOCKED', providerCommissioned: false }),
  securityEvents: () => ({ mode: 'MEMORY_ONLY' }), environment: () => ({ nodeEnv: 'test', deployment: 'unspecified', durableStore: false }),
});
let user: any = null;
let server: Server; let origin = '';
beforeAll(async () => {
  const app = express();
  app.use('/api/health', createHealthRouter({ probes, authenticate: (req: any, res, next) => { if (!user) return res.status(401).json({ code: 'AUTH_REQUIRED' }); req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
const get = (p: string) => fetch(origin + '/api/health' + p).then(async r => ({ status: r.status, text: await r.text(), cache: r.headers.get('cache-control') }));

describe('public liveness and readiness', () => {
  it('liveness says only that the process answers', async () => {
    expect(await get('/live')).toEqual({ status: 200, text: '{"status":"alive"}', cache: 'no-store' });
  });
  it('readiness is 200 only with a ready schema and identity, and never names a dependency', async () => {
    db = { state: 'OK', schema: 'DATABASE_READY' }; identity = 'OK';
    expect(await get('/ready')).toMatchObject({ status: 200, text: '{"status":"ready"}' });
    for (const [state, id] of [[{ state: 'OK', schema: 'DATABASE_MIGRATION_REQUIRED' }, 'OK'], [{ state: 'UNAVAILABLE', schema: 'DATABASE_UNAVAILABLE' }, 'OK'],
      [{ state: 'OK', schema: 'DATABASE_READY' }, 'NOT_CONFIGURED'], ['throw', 'OK']] as const) {
      db = state as any; identity = id;
      expect(await get('/ready')).toMatchObject({ status: 503, text: '{"status":"not_ready"}' });
    }
  });
  it('a hanging database probe times out to not_ready instead of hanging the endpoint', async () => {
    db = 'hang'; identity = 'OK';
    const t0 = Date.now();
    expect(await get('/ready')).toMatchObject({ status: 503, text: '{"status":"not_ready"}' });
    expect(Date.now() - t0).toBeLessThan(6000);
  }, 10000);
});

describe('administrator diagnostics', () => {
  it('requires authentication and an active administrator of a tenant', async () => {
    user = null; expect((await get('/diagnostics')).status).toBe(401);
    for (const u of [{ role: 'client', status: 'active', tenantId: 't' }, { role: 'accountant', status: 'active', tenantId: 't' }, { role: 'practice_manager', status: 'active', tenantId: 't' },
      { role: 'admin', status: 'suspended', tenantId: 't' }, { role: 'admin', status: 'active' }]) {
      user = u; expect((await get('/diagnostics')).status, JSON.stringify(u)).toBe(403);
    }
  });
  it('reports state codes per area — including a lost database connection — and no secrets', async () => {
    user = { id: 'adm', role: 'admin', status: 'active', tenantId: 't' };
    db = 'throw';
    const r = await get('/diagnostics');
    expect(r.status).toBe(200);
    const body = JSON.parse(r.text);
    expect(Object.keys(body).sort()).toEqual(['ai', 'checkedAt', 'database', 'environment', 'identity', 'process', 'scanner', 'securityEvents', 'storage']);
    expect(body.database).toEqual({ state: 'UNAVAILABLE', migrationReadiness: 'DATABASE_UNAVAILABLE' });
    expect(body.ai).toEqual({ state: 'NOT_CONFIGURED', materialActions: 'BLOCKED', providerCommissioned: false });
    for (const s of SECRETS) expect(r.text).not.toContain(s);
  });
});

describe('runtime probes', () => {
  it('report codes only, even with secrets configured in the environment', async () => {
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { SUPABASE_URL: SECRETS[0], SUPABASE_SERVICE_ROLE_KEY: SECRETS[1], TAXGUARD_TENANT_ID: SECRETS[2], DATABASE_URL: SECRETS[3],
        TAXGUARD_DEPLOYMENT_ENVIRONMENT: 'staging <script>', TAXGUARD_MALWARE_SCANNER: 'hosted-av' });
      const p = runtimeProbes();
      const out = JSON.stringify({ i: p.identity(), s: p.storage(), sc: await p.scanner(), ai: p.ai(), se: p.securityEvents(), env: p.environment() });
      for (const s of SECRETS) expect(out).not.toContain(s);
      expect(out).not.toContain('<script>');
      expect(await p.scanner()).toEqual({ state: 'SCANNER_PROVIDER_NOT_COMMISSIONED' });
      expect(p.environment().deployment).toBe('unspecified');
    } finally { for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k]; Object.assign(process.env, saved); }
  });
});
