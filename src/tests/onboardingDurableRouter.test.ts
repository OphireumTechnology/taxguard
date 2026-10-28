import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createOnboardingRouter } from '../server/routes/onboarding-durable.routes';
import { createDurableCollectionRouter } from '../server/routes/collection-durable.routes';
import { OnboardingError, OnboardingStore } from '../server/taxguard/onboarding/onboardingStore';

// Stage 01 API boundary and the Stage 02 gate, with the database replaced by recording fakes (the database
// rules are covered by tests-db/clientOnboarding.db). Synthetic identities only.
type U = { id: string; role: string; tenantId: string; status: string; clientId?: string };
const users: Record<string, U> = {
  client: { id: 'u-client', role: 'client', tenantId: 'tA', status: 'active', clientId: '001' },
  manager: { id: 'u-mgr', role: 'practice_manager', tenantId: 'tA', status: 'active' },
  suspended: { id: 'u-sus', role: 'client', tenantId: 'tA', status: 'suspended', clientId: '002' },
};
let server: Server; let origin = ''; let calls: Array<[string, unknown[]]> = []; let ready = false; let readyThrows = false;
const fakeStore = () => new Proxy({} as OnboardingStore, { get: (_t, name: string) => async (...args: unknown[]) => {
  calls.push([name, args]);
  if (name === 'decide' && args[4] === 'approve') throw new OnboardingError('ONBOARDING_IDENTITY_DOCUMENT_REQUIRED', 422);
  return { ok: name };
} });
async function start() {
  const app = express(); app.use(express.json());
  const authenticate = (req: any, res: any, next: any) => { const u = users[String(req.headers['x-test-user'])]; if (!u) return res.status(401).json({ code: 'AUTH' }); req.user = u; next(); };
  app.use('/api/stage-one', createOnboardingRouter({ store: fakeStore, enabled: () => true, authenticate }));
  const collection = { get: vi.fn(async () => ({ tenantId: 'tA', clientId: '001', taxYear: 2025, engagementId: 'e1', requirements: [] })) };
  app.use('/api/stage-two-three', authenticate, createDurableCollectionRouter({ enabled: () => true, store: () => collection as any,
    onboardingReady: async () => { if (readyThrows) throw new Error('down'); return ready; } }));
  server = createServer(app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return collection;
}
const req = (who: string, method: string, path: string, body?: unknown) => fetch(origin + path, { method, headers: { 'content-type': 'application/json', 'x-test-user': who }, body: body ? JSON.stringify(body) : undefined })
  .then(async r => ({ status: r.status, body: await r.json() as any, cache: r.headers.get('cache-control') }));

let collection: Awaited<ReturnType<typeof start>>;
beforeEach(async () => { calls = []; ready = false; readyThrows = false; collection = await start(); });
afterEach(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });

describe('Stage 01 API', () => {
  it('a client always acts on its own record and cannot address another or decide', async () => {
    expect((await req('client', 'GET', '/api/stage-one/me')).cache).toBe('no-store');
    await req('client', 'POST', '/api/stage-one/me', { revision: 2, fields: { legalName: 'Synthetic' } });
    await req('client', 'POST', '/api/stage-one/me/submit', { revision: 3, consentVersion: 'v1', signer: 'Synthetic Signer' });
    expect(calls.map(([n, a]) => [n, a.slice(0, 3)])).toEqual([['get', ['tA', '001', 'u-client']], ['save', ['tA', '001', 'u-client']], ['submit', ['tA', '001', 'u-client']]]);
    expect((await req('client', 'GET', '/api/stage-one/clients/999')).status).toBe(403);
    expect((await req('client', 'POST', '/api/stage-one/clients/001/decision', { decision: 'approve', revision: 1 })).body.code).toBe('ONBOARDING_ACCESS_DENIED');
    expect((await req('client', 'GET', '/api/stage-one/queue')).status).toBe(403);
    expect(calls.filter(([n]) => n === 'decide' || n === 'queue')).toEqual([]);
  });
  it('staff address a client explicitly; store refusals keep their code and status', async () => {
    await req('manager', 'GET', '/api/stage-one/clients/001');
    expect(calls.at(-1)).toEqual(['get', ['tA', '001', 'u-mgr']]);
    const refused = await req('manager', 'POST', '/api/stage-one/clients/001/decision', { decision: 'approve', revision: 4 });
    expect([refused.status, refused.body.code]).toEqual([422, 'ONBOARDING_IDENTITY_DOCUMENT_REQUIRED']);
    expect((await req('manager', 'GET', '/api/stage-one/clients/bad%20id')).status).toBe(400);
    expect((await req('manager', 'GET', '/api/stage-one/me')).status).toBe(400); // staff have no own onboarding record
  });
  it('refuses inactive and unauthenticated callers, and reports an unavailable store', async () => {
    expect((await req('suspended', 'GET', '/api/stage-one/me')).status).toBe(403);
    expect((await req('nobody', 'GET', '/api/stage-one/me')).status).toBe(401);
    const app = express(); app.use('/x', createOnboardingRouter({ enabled: () => false }));
    const s = createServer(app); await new Promise<void>(r => s.listen(0, '127.0.0.1', r));
    const r = await fetch(`http://127.0.0.1:${(s.address() as AddressInfo).port}/x/me`);
    expect([r.status, (await r.json() as any).code]).toEqual([503, 'ONBOARDING_STORE_UNAVAILABLE']);
    s.closeAllConnections(); await new Promise<void>(res => s.close(() => res()));
  });
  it('the store refuses a non-object field set and an unknown decision before calling the database', () => {
    const rpc = { rpc: vi.fn() };
    const store = new OnboardingStore(rpc as any);
    expect(() => store.save('t', 'c', 'u', 0, 'tinValid=true')).toThrow('ONBOARDING_INPUT_INVALID');
    expect(() => store.decide('t', 'c', 'u', 0, 'force_approve', {})).toThrow('ONBOARDING_INPUT_INVALID');
    expect(rpc.rpc).not.toHaveBeenCalled();
  });
});

describe('Stage 02 gate', () => {
  it('keeps a client out of Stage 02 collection until the server records Stage 01 as completed', async () => {
    const refused = await req('client', 'GET', '/api/stage-two-three/questionnaire/2025');
    expect([refused.status, refused.body.code]).toEqual([403, 'STAGE_01_NOT_APPROVED']);
    expect(collection.get).not.toHaveBeenCalled();
    readyThrows = true;
    expect((await req('client', 'GET', '/api/stage-two-three/questionnaire/2025')).status).toBe(503);
    readyThrows = false; ready = true;
    expect((await req('client', 'GET', '/api/stage-two-three/questionnaire/2025')).status).toBe(200);
    expect(collection.get).toHaveBeenCalledTimes(1);
  });
  it('does not apply the client gate to staff', async () => {
    const staff = await req('manager', 'GET', '/api/stage-two-three/questionnaire/2025?clientId=001');
    expect(staff.status).toBe(200);
  });
});
