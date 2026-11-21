import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
vi.mock('../server/supabase', async importOriginal => ({ ...(await importOriginal<typeof import('../server/supabase')>()), isSupabaseServerConfigured: () => false }));
import { createCasesRouter } from '../server/routes/cases.routes';

// The durable stage gate engine needs its database. Without a configured store the cases API refuses every stage
// move (503) instead of answering from any other source, and an ended session is refused before that. Synthetic.
let server: Server; let origin = ''; let session: any = null;
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use('/cases', createCasesRouter({ authenticate: (req: any, res: any, next: any) => { if (!session) return res.status(401).json({ code: 'AUTH_REQUIRED' }); req.user = session; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/cases`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
const post = (path: string, body: object) => fetch(origin + path, { method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'synthetic-' + Math.random() }, body: JSON.stringify(body) });

describe('stage moves without a configured case store', () => {
  it('with a configured store, an ended or missing session is refused (401) before the store is used', async () => {
    const touched: string[] = [];
    const fake: any = new Proxy({}, { get: (_t, k) => () => { touched.push(String(k)); throw new Error('store must not be reached'); } });
    const app = express(); app.use(express.json());
    app.use('/cases', createCasesRouter({ store: () => fake, authenticate: (_req: any, res: any) => res.status(401).json({ code: 'AUTH_REQUIRED' }) }));
    const s2 = createServer(app); await new Promise<void>(r => s2.listen(0, '127.0.0.1', r));
    try {
      const r = await fetch(`http://127.0.0.1:${(s2.address() as AddressInfo).port}/cases/case-1/advance`, { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fromStage: 2, version: 1, attestation: { confirmed: [], statement: 'Synthetic statement.' } }) });
      expect(r.status).toBe(401);
      expect(touched).toEqual([]);
    } finally { s2.closeAllConnections(); await new Promise<void>(r => s2.close(() => r())); }
  });
  it('without a configured store, even an unauthenticated request is refused with 503 and nothing is processed', async () => {
    session = null;
    const r = await post('/case-1/advance', { fromStage: 2, version: 1 });
    expect([r.status, (await r.json()).code]).toEqual([503, 'CASE_STORE_UNAVAILABLE']);
  });
  it.each(['advance', 'return', 'hold'])('%s answers 503 CASE_STORE_UNAVAILABLE for every role, even with a fabricated verdict', async action => {
    for (const role of ['reviewer', 'senior_reviewer', 'practice_manager', 'admin', 'accountant']) {
      session = { id: 'synthetic-' + role, role, tenantId: 'tenantA', status: 'active' };
      const r = await post(`/case-1/${action}`, { fromStage: 2, toStage: 1, version: 1, hold: true, reason: 'Synthetic reason text.',
        attestation: { confirmed: ['documents_received_or_waived', 'documents_in_private_storage'], statement: 'Synthetic statement.' }, passed: true, requirementsMet: true });
      expect([r.status, (await r.json()).code], `${action} ${role}`).toEqual([503, 'CASE_STORE_UNAVAILABLE']);
    }
  });
});
