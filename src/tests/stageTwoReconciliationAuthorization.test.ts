import express from 'express';
import { createServer, type Server } from 'node:http';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db';
import { StageTwoReconciliationService } from '../services/stageTwoReconciliationService';

const identity = vi.hoisted(() => ({ user: undefined as any }));
vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return { ...actual, authenticateToken: (req: any, res: any, next: any) => {
    if (!identity.user) return res.status(401).json({ code: 'AUTH_REQUIRED' });
    req.user = identity.user; next();
  } };
});
import { stageTwoThreeRouter } from '../server/routes/stage-two-three.routes';

// Only the provider identity boundary is replaced. Assignment and tenant resolution are real.
describe('Stage 02 snapshot/reconciliation authorization', () => {
  let server: Server;
  let origin: string;
  let reconcile: ReturnType<typeof vi.spyOn>;
  const clientA = 'reconcile-client-a', clientB = 'reconcile-client-b', foreign = 'reconcile-client-foreign';
  const assign = (clientId = clientA, status = 'active') => {
    db.clientAccountantAssignments.set('reconcile-assignment', {
      id: 'reconcile-assignment', clientId, accountantId: 'reconcile-staff', status,
      assignedAt: new Date(Date.now() - 60_000).toISOString(),
      effectiveDate: new Date(Date.now() - 60_000).toISOString()
    } as any);
  };
  const request = async (method: 'GET' | 'POST', year = '2025', selection?: unknown) => {
    const path = method === 'GET' ? 'snapshot' : 'reconcile';
    const query = method === 'GET' && selection !== undefined ? '?clientId=' + encodeURIComponent(String(selection)) : '';
    const response = await fetch(origin + '/' + path + '/' + year + query, {
      method, headers: { 'content-type': 'application/json' },
      ...(method === 'POST' ? { body: JSON.stringify(selection === undefined ? {} : { clientId: selection }) } : {})
    });
    return { status: response.status, body: await response.json() };
  };
  beforeAll(async () => {
    const app = express(); app.use(express.json()); app.use(stageTwoThreeRouter);
    server = createServer(app);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('Test server address unavailable');
    origin = 'http://127.0.0.1:' + address.port;
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test'); vi.stubEnv('TAXGUARD_TENANT_ID', 'reconcile-tenant');
    identity.user = { id: 'reconcile-staff', role: 'accountant', tenantId: 'reconcile-tenant', status: 'active' };
    for (const id of [clientA, clientB, foreign]) db.users.set(id, {
      id, clientId: id, role: 'client', tenantId: id === foreign ? 'foreign-tenant' : 'reconcile-tenant'
    } as any);
    reconcile = vi.spyOn(StageTwoReconciliationService, 'reconcileStageTwoCollection').mockReturnValue({ clientId: clientA, taxYear: 2025 } as any);
  });
  afterEach(() => {
    reconcile.mockRestore(); vi.unstubAllEnvs(); identity.user = undefined;
    for (const id of [clientA, clientB, foreign]) db.users.delete(id);
    db.clientAccountantAssignments.delete('reconcile-assignment');
  });
  describe.each(['GET', 'POST'] as const)('%s', method => {
    it('requires authentication before touching reconciliation state', async () => {
      identity.user = undefined;
      expect((await request(method)).status).toBe(401);
      expect(reconcile).not.toHaveBeenCalled();
    });
    it('allows only explicit actively assigned staff scope', async () => {
      expect((await request(method)).status).toBe(403);
      expect((await request(method, '2025', clientA)).status).toBe(403);
      assign(clientB);
      expect((await request(method, '2025', clientA)).status).toBe(403);
      assign(clientA, 'suspended');
      expect((await request(method, '2025', clientA)).status).toBe(403);
      expect(reconcile).not.toHaveBeenCalled();
      assign();
      expect((await request(method, '2025', clientA)).status).toBe(200);
      expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ clientId: clientA, tenantId: 'reconcile-tenant', taxYear: 2025 }));
    });
    it('uses the client binding and rejects another client selection', async () => {
      identity.user = { id: 'auth-client-a', clientId: clientA, tenantId: 'reconcile-tenant', role: 'client' };
      expect((await request(method, '2025', clientB)).status).toBe(403);
      expect(reconcile).not.toHaveBeenCalled();
      expect((await request(method)).status).toBe(200);
      expect(reconcile).toHaveBeenCalledWith(expect.objectContaining({ clientId: clientA }));
    });
    it('denies foreign-tenant selections even to an administrator', async () => {
      identity.user.role = 'administrator';
      expect((await request(method, '2025', foreign)).status).toBe(403);
      expect(reconcile).not.toHaveBeenCalled();
    });
    it('denies unsupported roles and a conflicting configured tenant', async () => {
      identity.user.role = 'recruiter'; assign();
      expect((await request(method, '2025', clientA)).status).toBe(403);
      identity.user.role = 'accountant'; identity.user.tenantId = 'other-tenant';
      expect((await request(method, '2025', clientA)).status).toBe(403);
      expect(reconcile).not.toHaveBeenCalled();
    });
    it.each(['abc', '2025.5', '0', '2021', '2201', '02025'])('rejects invalid year %s instead of silently choosing 2025', async year => {
      assign();
      expect((await request(method, year, clientA)).status).toBe(400);
      expect(reconcile).not.toHaveBeenCalled();
    });
    it('fails closed for authorized production sessions because snapshot reads also mutate volatile stores', async () => {
      vi.stubEnv('NODE_ENV', 'production'); identity.user.authorizedClientIds = [clientA];
      const result = await request(method, '2025', clientA);
      expect(result).toEqual({ status: 503, body: { code: 'DURABLE_RECONCILIATION_REQUIRED' } });
      expect(reconcile).not.toHaveBeenCalled();
    });
    it('returns a safe unavailable error without leaking service internals', async () => {
      assign(); reconcile.mockImplementation(() => { throw Error('sensitive internal details'); });
      expect(await request(method, '2025', clientA)).toEqual({ status: 503, body: { code: 'RECONCILIATION_UNAVAILABLE' } });
    });
  });
  it.each([null, 42, {}, [], ''])('rejects malformed mutation selection %j', async selection => {
    assign(); expect((await request('POST', '2025', selection)).status).toBe(400);
    expect(reconcile).not.toHaveBeenCalled();
  });
});
