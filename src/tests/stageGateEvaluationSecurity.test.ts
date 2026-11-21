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

const RETIRED = 'STAGE_VERDICT_ROUTE_RETIRED';
const snapshotOf = () => new Map(holder.db.records);

describe.each([2, 3])('Stage %i: no browser verdict is evaluated, stored or turned into a transition', n => {
  const expectOutcome = async (scope: typeof scopeA, actor: Actor | undefined, status: number, code?: string, path = 'evaluate') => {
    const before = snapshotOf();
    const r = path === 'evaluate' ? await evaluate(scope, n, actor)
      : await fetch(url(scope, `/stages/${n}/transition`), { method: 'POST', headers: headersFor(actor), body: JSON.stringify({ revision: 1, operationId: 'tr-' + n, approvalId: 'fabricated-approval', toStage: n + 1 }) })
        .then(async x => ({ status: x.status, body: await x.json().catch(() => null) }));
    expect([r.status, r.body?.code], `${path} ${JSON.stringify(actor)}`).toEqual([status, code]);
    expect(holder.db.records, 'nothing recorded').toEqual(before);
  };
  it.each(['evaluate', 'transition'])('%s: unauthenticated callers are refused first (401)', async path => {
    await expectOutcome(scopeA, undefined, 401, undefined, path);
  });
  it.each(['evaluate', 'transition'])('%s: every caller that reaches the route gets 410, including the assigned preparer and reviewer', async path => {
    for (const actor of [{ user: 'prepA' }, { user: 'revA', role: 'reviewer' }, { user: 'outsiderA' }, { user: 'ownerA', role: 'client', client: 'sec-001' }])
      await expectOutcome(scopeA, actor, 410, RETIRED, path);
    untouched(scopeA, n);
  });
  it.each(['evaluate', 'transition'])('%s: other clients, unassigned staff and other tenants are refused by the client guard before the route', async path => {
    await expectOutcome(scopeA, { user: 'ownerA', role: 'client', client: 'sec-901' }, 403, 'CLIENT_ACCESS_DENIED', path);
    await expectOutcome(scopeA, { user: 'nobodyA' }, 403, 'CLIENT_ACCESS_DENIED', path);
    await expectOutcome(scopeA, { user: 'prepB', tenant: 'tenantB' }, 403, 'CLIENT_CONTEXT_UNAVAILABLE', path);
    await expectOutcome(scopeA, { user: 'prepB', tenant: 'tenantA' }, 403, 'CLIENT_ACCESS_DENIED', path);
    await expectOutcome({ ...scopeA, tenantId: 'tenantB' }, { user: 'prepA' }, 403, 'CLIENT_CONTEXT_UNAVAILABLE', path);
    untouched(scopeA, n); untouched(scopeB, n);
  });
  it.each(['evaluate', 'transition'])('%s: the same refusal in production (410, not a provider error)', async path => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('TAXGUARD_TENANT_ID', 'tenantA');
    await expectOutcome(scopeA, { user: 'prepA', authorized: 'sec-001' }, 410, RETIRED, path);
    await expectOutcome(scopeA, { user: 'prepA' }, 403, 'CLIENT_ACCESS_DENIED', path);
  });
});

describe('a fabricated all-passed verdict from the assigned preparer', () => {
  it('is not evaluated or stored, opens no transition, and the case stays at its stage', async () => {
    const before = snapshotOf();
    const r = await evaluate(scopeA, 2, { user: 'prepA' });
    expect(r.status).toBe(410);
    expect(r.body).toMatchObject({ code: RETIRED, replacement: '/api/cases/:caseId/advance', requiresHumanReview: true, externalSubmissionAllowed: false });
    expect(r.body).not.toHaveProperty('decision');
    const post = (actor: Actor, body: object) => fetch(url(scopeA, '/stages/2/transition'), { method: 'POST', headers: headersFor(actor), body: JSON.stringify(body) });
    for (const [actor, body] of [[{ user: 'prepA' }, { revision: 1, operationId: 'tr-req' }], [{ user: 'prepA' }, { revision: 1, operationId: 'tr-self', approvalId: 'tr-req' }],
      [{ user: 'revA', role: 'reviewer' }, { revision: 1, operationId: 'tr-rev', approvalId: 'fabricated-approval' }]] as Array<[Actor, object]>)
      expect((await post(actor, body)).status).toBe(410);
    expect(holder.db.records).toEqual(before);
    expect(stage(scopeA, 2)).toMatchObject({ requirementsMet: false, status: 'IN_PROGRESS' });
    expect(holder.db.records.get(casePath(scopeA)).activeStage).toBe(2);
  });
  it('no application code calls the retired routes', async () => {
    const { readdirSync, readFileSync, statSync } = await import('node:fs');
    const { join } = await import('node:path');
    const walk = (d: string): string[] => readdirSync(d).flatMap(x => { const p = join(d, x); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(x) ? [p] : []; });
    const app = walk('src').filter(f => !/[\\/](server|tests|tests-db|tests-e2e)[\\/]/.test(f));
    expect(app.filter(f => /stages\/\$\{[^}]+\}\/(evaluate|transition)|\/stages\/[^'"`]*\/(evaluate|transition)/.test(readFileSync(f, 'utf8')))).toEqual([]);
  });
});
