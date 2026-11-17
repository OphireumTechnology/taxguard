import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { createPracticeRouter } from '../server/routes/practice.routes';

// Block 88: durable practice search (proposal 20261019280000, review only) over HTTP through the durable practice
// router on real PostgreSQL with every proposal applied. Each record type is matched under the rule that already decides
// whether the actor may see it (owner decision 2026-10-19). SYNTHETIC data only.
const T = 'tenantPracticeSearch', C = 'psClient', C2 = 'psClientOther';
const roles: Record<string, string> = { 'ps-mgr': 'practice_manager', 'ps-prep1': 'accountant', 'ps-prep2': 'accountant', 'ps-rev1': 'reviewer', 'ps-rev2': 'reviewer',
  'ps-outsider': 'accountant', 'ps-client': 'client' };
let db: TestDatabase; let server: Server; let origin = ''; let user: any = null;
const caseIds: Record<string, string> = {};
const search = (uid: string, query: string) => { user = { id: uid, role: roles[uid], tenantId: T, status: 'active' };
  return fetch(origin + '/practice/search' + query).then(async r => ({ status: r.status, body: await r.json() as any })); };
const found = (body: any) => (body.matches as any[]).map(m => `${m.entityType}:${m.label}`).sort();

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic search practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'ps-client', 'Alpha Synthetic Client'), ('${T}', '${C2}', 'ps-client2', 'Beta Synthetic Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'ps-mgr', 'practice_manager', 'active', NULL), ('${T}', 'ps-prep1', 'accountant', 'active', NULL),
      ('${T}', 'ps-prep2', 'accountant', 'active', NULL), ('${T}', 'ps-rev1', 'reviewer', 'active', NULL), ('${T}', 'ps-rev2', 'reviewer', 'active', NULL),
      ('${T}', 'ps-outsider', 'accountant', 'active', NULL), ('${T}', 'ps-client', 'client', 'active', '${C}');`);
  const practice = new PracticeStore(pgRpc(db.pool)), cases = new CaseStore(pgRpc(db.pool));
  const engagement = async (client: string, key: string) => {
    const id = (await practice.createEngagement(T, client, 'ps-mgr', key, { title: 'Synthetic ' + key, type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, client, 'ps-mgr', id, 'active', 1);
    return id;
  };
  const E1 = await engagement(C, 'ps-engagement-1'), E2 = await engagement(C, 'ps-engagement-2'), E3 = await engagement(C2, 'ps-engagement-3');
  const staff: Array<[string, string, string, string]> = [[C, E1, 'preparer', 'ps-prep1'], [C, E1, 'reviewer', 'ps-rev1'], [C, E2, 'preparer', 'ps-prep2'],
    [C, E2, 'reviewer', 'ps-rev2'], [C2, E3, 'preparer', 'ps-outsider']];
  for (const [client, engagementId, role, userId] of staff)
    await practice.assign(T, client, 'ps-mgr', `ps-assign-${userId}-${client}`, { engagementId, taxYear: 2025, role, userId, reason: 'Synthetic staffing' });
  caseIds.E1 = (await cases.create(T, C, 'ps-mgr', 'ps-case-e1', { engagementId: E1, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  caseIds.E2 = (await cases.create(T, C, 'ps-mgr', 'ps-case-e2', { engagementId: E2, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const task = (key: string, title: string, body: Record<string, unknown>) => practice.createTask(T, C, 'ps-mgr', key, { title, ...body });
  await task('ps-task-e1', 'Alpha review E1', { engagementId: E1, taxYear: 2025 });
  await task('ps-task-e2', 'Alpha review E2', { engagementId: E2, taxYear: 2025 });
  await task('ps-task-handed', 'Alpha handed to prep2', { engagementId: E1, taxYear: 2025, assignedUserId: 'ps-prep2' });
  await task('ps-task-percent', 'Alpha 100% complete', { engagementId: E1, taxYear: 2025 });
  for (const [n, engagementId, title] of [[1, E1, 'Alpha W-2 E1'], [2, E2, 'Alpha 1099 E2']] as const)
    await db.pool.query(`INSERT INTO taxguard_doc_requests(tenant_id, client_id, request_id, engagement_id, tax_year, title, category, accepted_types, created_by)
      VALUES ($1, $2, $3, $4, 2025, $5, 'income', ARRAY['application/pdf'], 'ps-mgr')`, [T, C, 'req_' + String(n).repeat(32), engagementId, title]);
  const app = express(); app.use(express.json());
  app.use('/practice', createPracticeRouter({ store: () => practice, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}, 240_000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await db?.stop(); });

describe('practice search', () => {
  it('a manager finds every matching client, case, task and document request', async () => {
    const r = await search('ps-mgr', '?q=alpha');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(found(r.body)).toEqual(['case:Alpha Synthetic Client 2025', 'case:Alpha Synthetic Client 2025', 'client:Alpha Synthetic Client',
      'document_request:Alpha 1099 E2', 'document_request:Alpha W-2 E1', 'task:Alpha 100% complete', 'task:Alpha handed to prep2', 'task:Alpha review E1', 'task:Alpha review E2']);
    expect(r.body).toMatchObject({ query: 'alpha', totalMatches: 9, searched: ['client', 'case', 'task', 'document_request'] });
  });

  it('an engagement assignee finds only what is in scope, plus tasks assigned to them', async () => {
    const one = await search('ps-prep1', '?q=alpha');
    expect(found(one.body)).toEqual(['case:Alpha Synthetic Client 2025', 'client:Alpha Synthetic Client', 'document_request:Alpha W-2 E1',
      'task:Alpha 100% complete', 'task:Alpha handed to prep2', 'task:Alpha review E1']);
    expect(one.body.matches.find((m: any) => m.entityType === 'case').id).toBe(caseIds.E1);
    const two = await search('ps-prep2', '?q=alpha');
    expect(found(two.body)).toEqual(['case:Alpha Synthetic Client 2025', 'client:Alpha Synthetic Client', 'document_request:Alpha 1099 E2',
      'task:Alpha handed to prep2', 'task:Alpha review E2']);
    expect(found((await search('ps-outsider', '?q=alpha')).body)).toEqual([]);
    expect(found((await search('ps-outsider', '?q=synthetic client')).body)).toEqual(['client:Beta Synthetic Client']);
  });

  it('matches the query literally, so LIKE wildcards in it match only themselves', async () => {
    expect(found((await search('ps-mgr', '?q=al_ha')).body)).toEqual([]);
    expect(found((await search('ps-mgr', '?q=' + encodeURIComponent('100%'))).body)).toEqual(['task:Alpha 100% complete']);
    expect(found((await search('ps-mgr', '?q=' + encodeURIComponent('%%'))).body)).toEqual([]);
  });

  it('limits the matches and refuses bad queries and clients', async () => {
    const r = await search('ps-mgr', '?q=alpha&limit=2');
    expect(r.body.matches).toHaveLength(2);
    expect(r.body.totalMatches).toBe(9);
    expect(r.body.matches.map((m: any) => m.entityType)).toEqual(['client', 'case']);
    for (const query of ['?q=a', '', '?q=alpha&limit=0', '?q=alpha&limit=51', '?q=alpha&limit=x', '?q=' + 'x'.repeat(101)])
      expect(await search('ps-mgr', query), query).toEqual({ status: 400, body: { code: 'PRACTICE_INPUT_INVALID' } });
    expect((await search('ps-client', '?q=alpha')).body).toEqual({ code: 'PRACTICE_ACCESS_DENIED' });
  });
});
