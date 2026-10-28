import express from 'express';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { expect, it } from 'vitest';
import { legacyRouteBoundary, RETIRED_LEGACY_ROUTES } from '../server/legacyRouteBoundary';

it('retires replaced legacy reads and writes while preserving durable and unfinished routes', async () => {
  const app = express(); app.use('/api', legacyRouteBoundary(() => true)); app.use((_req, res) => res.json({ reachable: true }));
  const server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    for (const path of RETIRED_LEGACY_ROUTES) for (const method of ['GET', 'POST']) {
      const result = await fetch(origin + '/api' + path + '/synthetic', { method });
      expect(result.status).toBe(410); expect(await result.json()).toEqual({ code: 'LEGACY_ROUTE_RETIRED' });
    }
    for (const path of ['/billing', '/vault', '/practice', '/scheduling', '/communications', '/legal-matters', '/careers', '/stage-two-three', '/admin/other']) {
      expect((await fetch(origin + '/api' + path)).status).toBe(200);
    }
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
