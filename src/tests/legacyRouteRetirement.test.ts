import express from 'express';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mountRetiredLegacyRoutes, RETIRED_LEGACY_ROUTES } from '../server/routes/retiredLegacyRoutes';

// Phase 10 legacy-route retirement: superseded in-memory routes answer 410 with the durable
// replacement, and no application code still calls them.
let server: Server; let origin = '';
beforeAll(async () => {
  const app = express();
  mountRetiredLegacyRoutes(app);
  app.use('/api/legal-matters', (_req, res) => res.status(200).json({ ok: true }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
});
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });

const files = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = path.join(dir, n); return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(n) ? [p] : []; });

describe('retired legacy routes', () => {
  it.each(RETIRED_LEGACY_ROUTES.map(r => [r.path, r.replacement]))('%s answers 410 for every method and names %s', async (route, replacement) => {
    for (const [method, sub] of [['GET', ''], ['POST', '/charge'], ['PATCH', '/x'], ['DELETE', '/x/y']] as const) {
      const r = await fetch(origin + route + sub, { method, headers: { 'content-type': 'application/json' }, body: method === 'GET' ? undefined : '{"amount":1}' });
      expect(r.status).toBe(410);
      expect(await r.json()).toEqual({ code: 'LEGACY_ROUTE_RETIRED', replacement });
      expect(r.headers.get('cache-control')).toBe('no-store');
    }
  });
  it('does not shadow durable routes that share a prefix', async () => {
    expect((await fetch(origin + '/api/legal-matters/clients/c1')).status).toBe(200);
  });
  it('no application code calls a retired route', () => {
    const app = files('src').filter(f => !/[\\/](server|tests|tests-db)[\\/]/.test(f));
    for (const { path: route } of RETIRED_LEGACY_ROUTES) {
      const pattern = new RegExp(route.replace(/\//g, '\\/') + '(?![A-Za-z0-9-])');
      expect(app.filter(f => pattern.test(readFileSync(f, 'utf8'))), route).toEqual([]);
    }
  });
  it('the development server mounts the retirement and no longer imports the retired routers', () => {
    const source = readFileSync('server.ts', 'utf8');
    expect(source).toContain('mountRetiredLegacyRoutes(app);');
    for (const name of ['engagements', 'appointments', 'payments', 'messages', 'legal', 'assignments'])
      expect(source).not.toContain(`./src/server/routes/${name}.routes'`);
  });
});
