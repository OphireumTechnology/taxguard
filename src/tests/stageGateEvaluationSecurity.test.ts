import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransactionalFirestore } from './helpers/transactionalFirestore';
import { casePath } from '../server/taxguard/authority.repository';

// Stage 02/03 gate evaluation security on the case-authority route (POST .../stages/:stage/evaluate): who may
// evaluate, in which tenant, in which environment, and what a fabricated browser verdict can and cannot achieve.
// Synthetic identities and an in-memory transactional store only.
const holder = vi.hoisted(() => ({ db: null as any }));
vi.mock('../server/taxguard/transactionalDatabase', async () => {
  const actual = await vi.importActual<any>('../server/taxguard/transactionalDatabase');
  return { ...actual, get globalAuthorityDatabase() { return holder.db; } };
});
// Session verification is tested separately; here the session is the synthetic actor and tenant in test headers.
vi.mock('../server/auth', async importOriginal => {
  const actual = await importOriginal<typeof import('../server/auth')>();
  return {
    ...actual,
    authenticateToken: (req: any, res: any, next: any) => {
      if (!req.headers['x-test-user']) return res.status(401).json({ error: 'AUTH_REQUIRED' });
      const role = req.headers['x-test-role'] || 'accountant';
      req.user = { id: req.headers['x-test-user'], role, tenantId: req.headers['x-test-tenant'] || 'tenantA', status: 'active', sessionAssuranceLevel: 'aal2',
        ...(req.headers['x-test-client'] ? { clientId: req.headers['x-test-client'] } : {}),
        authorizedClientIds: String(req.headers['x-test-authorized'] || '').split(',').filter(Boolean) };
      next();
    },
  };
});
import { caseAuthorityRouter } from '../server/routes/case-authority.routes';
import { db } from '../server/db';

const scopeA = { tenantId: 'tenantA', clientId: 'sec-001', engagementId: 'engA', taxYear: 2025 };
const scopeB = { tenantId: 'tenantB', clientId: 'sec-901', engagementId: 'engB', taxYear: 2025 };
// Two layers are exercised: the route's client-context guard (session tenant, a client's own clientId, staff client
// assignments) and the repository's case membership, case assignment and role checks.
const BINDINGS = [['sec-bind-a', 'sec-001', 'prepA'], ['sec-bind-a2', 'sec-001', 'revA'], ['sec-bind-b', 'sec-901', 'prepB'], ['sec-bind-o', 'sec-001', 'outsiderA']];
const FORGED: Record<number, object> = {
  2: { completenessPassed: true, unresolvedBlockingExceptions: 0, reconciliationPassed: true, professionalCertificationPassed: true, hardExitGatePassed: true },
  3: { validationComplete: true, provenanceComplete: true, unresolvedBlockingExceptions: 0, humanReviewRequired: false, humanReviewApproved: true, hardExitGatePassed: true },
};
let server: Server; let api = '';
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use('/api/case-authority', caseAuthorityRouter);
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  api = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/case-authority`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); });
afterEach(() => {
  vi.unstubAllEnvs();
  for (const [id] of BINDINGS) db.clientAccountantAssignments.delete(id);
  for (const id of ['ownerA', 'ownerB']) db.users.delete(id);
});

function seedCase(scope: typeof scopeA, people: { client: string; preparer: string; reviewer: string }, activeStage: number) {
  const root = casePath(scope);
  holder.db.records.set(root, { ...scope, revision: 1, clientUid: people.client, preparerUid: people.preparer, reviewerUid: people.reviewer, activeStage, openExceptions: 0, externalSubmissionEnabled: false });
  for (let s = 1; s <= 18; s++) holder.db.records.set(`${root}/stageStates/${s}`, { stage: s, status: s < activeStage ? 'COMPLETE' : s === activeStage ? 'IN_PROGRESS' : 'LOCKED', requirementsMet: s < activeStage, version: 1 });
  const assign = (uid: string, role: string) => holder.db.records.set(`${root}/assignments/${uid}`, { uid, role, active: true, assignedAt: '2026-10-03T00:00:00.000Z' });
  assign(people.client, 'client'); assign(people.preparer, 'preparer'); assign(people.reviewer, 'reviewer');
}
beforeEach(() => {
  holder.db = new TransactionalFirestore();
  const members = (tenant: string, rows: Array<[string, string, object?]>) => rows.forEach(([uid, role, extra]) =>
    holder.db.records.set(`taxguardTenants/${tenant}/members/${uid}`, { status: 'active', role, ...(extra || {}) }));
  members('tenantA', [['ownerA', 'client', { clientId: 'sec-001' }], ['prepA', 'accountant'], ['revA', 'reviewer', { credentialVerified: true }], ['outsiderA', 'accountant']]);
  members('tenantB', [['ownerB', 'client', { clientId: 'sec-901' }], ['prepB', 'accountant'], ['revB', 'reviewer', { credentialVerified: true }]]);
  // Every staff member below holds a current client assignment, so the repository's case checks are what decide.
  for (const [id, clientId, accountantId] of BINDINGS) db.clientAccountantAssignments.set(id, { id, clientId, accountantId, status: 'active', effective_from: '2026-01-01T00:00:00Z' } as any);
  db.users.set('ownerA', { id: 'ownerA', role: 'client', clientId: 'sec-001', tenantId: 'tenantA', status: 'active' } as any);
  db.users.set('ownerB', { id: 'ownerB', role: 'client', clientId: 'sec-901', tenantId: 'tenantB', status: 'active' } as any);
  seedCase(scopeA, { client: 'ownerA', preparer: 'prepA', reviewer: 'revA' }, 2);
  seedCase(scopeB, { client: 'ownerB', preparer: 'prepB', reviewer: 'revB' }, 2);
});

const url = (scope: typeof scopeA, path: string) => `${api}/${scope.tenantId}/${scope.clientId}/${scope.engagementId}/${scope.taxYear}${path}`;
const stage = (scope: typeof scopeA, n: number) => holder.db.records.get(`${casePath(scope)}/stageStates/${n}`);
type Actor = { user: string; role?: string; tenant?: string; client?: string; authorized?: string };
function headersFor(actor?: Actor) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (actor) {
    headers['x-test-user'] = actor.user;
    if (actor.role) headers['x-test-role'] = actor.role; if (actor.tenant) headers['x-test-tenant'] = actor.tenant;
    if (actor.client) headers['x-test-client'] = actor.client; if (actor.authorized) headers['x-test-authorized'] = actor.authorized;
  }
  return headers;
}
async function evaluate(scope: typeof scopeA, n: number, actor?: Actor, operationId = 'ev-' + n) {
  const headers = headersFor(actor);
  const r = await fetch(url(scope, `/stages/${n}/evaluate`), { method: 'POST', headers, body: JSON.stringify({ revision: 1, operationId, snapshot: FORGED[n] }) });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const untouched = (scope: typeof scopeA, n: number) => expect(stage(scope, n)).toMatchObject({ status: n === 2 ? 'IN_PROGRESS' : 'LOCKED', requirementsMet: false, version: 1 });

describe.each([2, 3])('Stage %i gate evaluation refusals', n => {
  const deny = async (scope: typeof scopeA, actor: Actor, status: number, code: string) => {
    const r = await evaluate(scope, n, actor);
    expect([r.status, r.body?.code], JSON.stringify(actor)).toEqual([status, code]);
  };
  it('an unauthenticated caller is refused before any evaluation', async () => {
    expect((await evaluate(scopeA, n)).status).toBe(401);
    untouched(scopeA, n);
  });
  it("the case's own client cannot submit a verdict, and cannot address another client's case", async () => {
    await deny(scopeA, { user: 'ownerA', role: 'client', client: 'sec-001' }, 403, 'PROFESSIONAL_REQUIRED');
    await deny(scopeA, { user: 'ownerA', role: 'client', client: 'sec-901' }, 403, 'CLIENT_ACCESS_DENIED');
    await deny(scopeA, { user: 'ownerA', role: 'client' }, 403, 'CLIENT_ACCESS_DENIED');
    untouched(scopeA, n);
  });
  it('staff without a client assignment, or with one but no case assignment, are refused', async () => {
    await deny(scopeA, { user: 'nobodyA' }, 403, 'CLIENT_ACCESS_DENIED');
    await deny(scopeA, { user: 'outsiderA' }, 403, 'CASE_ACCESS_DENIED');
    untouched(scopeA, n);
  });
  it("another tenant's preparer cannot reach this tenant's case, whatever tenant the session claims", async () => {
    await deny(scopeA, { user: 'prepB', tenant: 'tenantB' }, 403, 'CLIENT_CONTEXT_UNAVAILABLE');
    await deny(scopeA, { user: 'prepB', tenant: 'tenantA' }, 403, 'CLIENT_ACCESS_DENIED');
    // a path naming another tenant with this tenant's case identifiers does not reach either case
    await deny({ ...scopeA, tenantId: 'tenantB' }, { user: 'prepA' }, 403, 'CLIENT_CONTEXT_UNAVAILABLE');
    untouched(scopeA, n); untouched(scopeB, n);
  });
  it('production refuses the route outright while the authority store is process-local, even for the assigned preparer', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
    await deny(scopeA, { user: 'prepA', authorized: 'sec-001' }, 503, 'DURABLE_CASE_AUTHORITY_PROVIDER_REQUIRED');
    await deny(scopeA, { user: 'prepA' }, 403, 'CLIENT_ACCESS_DENIED');
    untouched(scopeA, n);
  });
});

describe('a fabricated browser verdict from the assigned preparer (development, process-local store)', () => {
  it("is recorded under the preparer's name but does not by itself advance the case: the reviewer decision stays separate", async () => {
    const r = await evaluate(scopeA, 2, { user: 'prepA' });
    expect(r.status).toBe(200);
    // OPEN FINDING (Issue #65 acceptance report): the gate inputs are the caller's snapshot, so this records
    // requirementsMet for state the server never checked. What still holds is asserted below.
    expect(stage(scopeA, 2)).toMatchObject({ requirementsMet: true, evaluatedBy: 'prepA' });
    expect(holder.db.records.get(casePath(scopeA)).activeStage).toBe(2);
    const post = (actor: Actor, body: object) => fetch(url(scopeA, '/stages/2/transition'), { method: 'POST', headers: headersFor(actor), body: JSON.stringify(body) });
    // the preparer can request the transition but cannot approve it, with or without a fabricated approval id
    expect((await post({ user: 'prepA' }, { revision: 2, operationId: 'tr-req' })).status).toBe(200);
    for (const approvalId of ['tr-req', 'fabricated-approval']) {
      const self = await post({ user: 'prepA' }, { revision: 3, operationId: 'tr-self-' + approvalId, approvalId });
      expect(self.status, approvalId).toBe(403);
    }
    // the assigned reviewer cannot approve with an approval record that does not exist
    const forgedApproval = await post({ user: 'revA' }, { revision: 3, operationId: 'tr-rev', approvalId: 'fabricated-approval' });
    expect(forgedApproval.status).toBe(403);
    expect(holder.db.records.get(casePath(scopeA)).activeStage).toBe(2);
    untouched(scopeB, 2);
  });
});
