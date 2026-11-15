import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClientPortalRouter } from '../server/routes/client-portal.routes';
import { createReassignmentRouter } from '../server/routes/reassignment.routes';
import { createLegalMattersRouter } from '../server/routes/legal-durable.routes';
import { LEGAL_DISCLAIMER_VERSION, LegalMatterStore } from '../server/taxguard/legal/legalMatterStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Proposals 044 (client-portal reads, narrower client legal view) and 045 (reassignment requests)
// composed with 024-027 and 042 on PGlite. Synthetic records only.
const T = 'tenantA', C = 'cpClient', OTHER = 'cpOther';
const people: Record<string, any> = { mgr: { id: 'cp-mgr', role: 'practice_manager' }, acct: { id: 'cp-acct', role: 'accountant' }, outsider: { id: 'cp-outsider', role: 'accountant' },
  client: { id: 'cp-client', role: 'client', clientId: C }, other: { id: 'cp-other', role: 'client', clientId: OTHER }, foreign: { id: 'cp-foreign', role: 'practice_manager' } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let n = 0;
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown, key: string | null = `cp-key-${++n}-${Date.now()}`) => fetch(origin + path, { method,
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101(2(240000|250000|260000|270000)|4(420000|440000|450000))_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','cp-client','Synthetic Portal Client'),('${T}','${OTHER}','cp-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people).filter(p => p.id !== 'cp-foreign'))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','cp-foreign','practice_manager','active');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  const eng = (await practice.createEngagement(T, C, 'cp-mgr', 'cp-eng-0001', { title: 'Synthetic 2025 individual return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cp-mgr', eng, 'active', 1);
  await practice.createEngagement(T, C, 'cp-mgr', 'cp-eng-0002', { title: 'Synthetic draft planning', type: 'tax_planning', taxYears: [2026] }); // stays DRAFT
  await practice.assign(T, C, 'cp-mgr', 'cp-asg-0001', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'cp-acct', reason: 'Synthetic staffing' });
  const rpc = () => pgliteRpc(() => fixture.pg);
  const auth = (req: any, _res: any, next: any) => { req.user = user; next(); };
  const app = express(); app.use(express.json());
  app.use('/portal', createClientPortalRouter({ client: rpc, authenticate: auth }));
  app.use('/reassign', createReassignmentRouter({ client: rpc, authenticate: auth }));
  app.use('/legal', createLegalMattersRouter({ store: () => new LegalMatterStore(rpc()), authenticate: auth }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('client-portal engagement reads (044)', () => {
  it('shows the client their active engagements per tax year, never drafts, other clients or other tenants', async () => {
    as('client');
    const mine = (await call('GET', `/portal/clients/${C}/engagements`)).body.items;
    expect(mine.map((e: any) => [e.title, e.taxYear, e.engagementStatus])).toEqual([['Synthetic 2025 individual return', 2025, 'active']]);
    expect(JSON.stringify(mine)).not.toMatch(/cp-mgr|cp-acct|createdBy/);
    expect((await call('GET', `/portal/clients/${OTHER}/engagements`)).status).toBe(404);
    as('mgr'); expect((await call('GET', `/portal/clients/${C}/engagements`)).body.items.map((e: any) => e.engagementStatus).sort()).toEqual(['active', 'draft']);
    as('outsider'); expect((await call('GET', `/portal/clients/${C}/engagements`)).status).toBe(404);
    as('foreign', 'tenantB'); expect((await call('GET', `/portal/clients/${C}/engagements`)).status).toBeGreaterThanOrEqual(403);
  });
});

describe('client legal view (044 supersedes the 042 projection)', () => {
  it('hides recorded counsel from the client until the referral is recorded, and shows progress steps only', async () => {
    as('client');
    const m = (await call('POST', `/legal/clients/${C}/matters`, { category: 'estate_trust', title: 'Synthetic trust question', disclaimerAcknowledged: true, disclaimerVersion: LEGAL_DISCLAIMER_VERSION })).body;
    as('acct');
    await call('POST', `/legal/clients/${C}/matters/${m.matterId}/status`, { version: 1, action: 'advance' });
    await call('POST', `/legal/clients/${C}/matters/${m.matterId}/update`, { version: 2, fields: { externalAttorney: 'Synthetic Counsel', lawFirm: 'Synthetic Law LLP' } });
    as('client');
    let mine = (await call('GET', `/legal/clients/${C}/matters`)).body[0];
    expect(mine).toMatchObject({ status: 'REVIEWING', externalAttorney: null, lawFirm: null, attorneyBarNumber: null });
    expect(mine.progress.map((p: any) => p.step)).toEqual(['MATTER_OPENED', 'STATUS_REVIEWING']); // no UPDATED (internal) step
    expect(mine.history).toBeUndefined();
    as('acct');
    expect((await call('GET', `/legal/clients/${C}/matters`)).body[0]).toMatchObject({ externalAttorney: 'Synthetic Counsel' }); // staff unchanged
    await call('POST', `/legal/clients/${C}/matters/${m.matterId}/status`, { version: 3, action: 'advance' });
    as('client');
    mine = (await call('GET', `/legal/clients/${C}/matters`)).body[0];
    expect(mine).toMatchObject({ status: 'TRANSMITTED_TO_COUNSEL', externalAttorney: 'Synthetic Counsel', lawFirm: 'Synthetic Law LLP' });
    as('other'); expect((await call('GET', `/legal/clients/${C}/matters`)).status).toBe(404);
  });
});

describe('reassignment requests (045)', () => {
  let request: any;
  it('lets only the client ask, with the legacy 10-character reason rule, idempotently', async () => {
    as('acct'); expect((await call('POST', `/reassign/clients/${C}/requests`, { reason: 'Synthetic staff request' })).body.code).toBe('REASSIGNMENT_CLIENT_ONLY');
    as('client');
    expect((await call('POST', `/reassign/clients/${C}/requests`, { reason: 'too short' })).body.code).toBe('REASSIGNMENT_INPUT_INVALID');
    const r = await call('POST', `/reassign/clients/${C}/requests`, { reason: 'Synthetic: would prefer a bookkeeping specialist', preferredSpecialization: 'bookkeeping' }, 'cp-rar-key-1');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'PENDING', replayed: false }); expect(r.body.currentTeam).toBeUndefined();
    request = r.body;
    expect((await call('POST', `/reassign/clients/${C}/requests`, { reason: 'Synthetic: would prefer a bookkeeping specialist', preferredSpecialization: 'bookkeeping' }, 'cp-rar-key-1')).body.replayed).toBe(true);
    expect((await call('POST', `/reassign/clients/${OTHER}/requests`, { reason: 'Synthetic other client request' })).status).toBe(404);
  });
  it('is reviewed by practice leadership only; approval records a decision but does not reassign', async () => {
    as('acct'); expect((await call('GET', '/reassign/queue')).body.code).toBe('REASSIGNMENT_REVIEWER_REQUIRED');
    as('client'); expect((await call('POST', `/reassign/queue/${request.requestId}/review`, { version: 1, decision: 'approve' })).status).toBe(403);
    as('foreign', 'tenantB'); expect((await call('GET', '/reassign/queue')).body).toEqual([]);
    as('mgr');
    const queue = (await call('GET', '/reassign/queue?status=PENDING')).body;
    expect(queue[0]).toMatchObject({ requestId: request.requestId, clientName: 'Synthetic Portal Client', currentTeam: [{ role: 'preparer', userId: 'cp-acct' }] });
    expect((await call('POST', `/reassign/queue/${request.requestId}/review`, { version: 9, decision: 'approve' })).body.code).toBe('REASSIGNMENT_VERSION_CONFLICT');
    const ok = await call('POST', `/reassign/queue/${request.requestId}/review`, { version: 1, decision: 'approve', note: 'Synthetic: a specialist will be assigned' }, 'cp-rar-review-1');
    expect(ok.body).toMatchObject({ status: 'APPROVED', reviewedBy: 'cp-mgr' });
    expect((await call('POST', `/reassign/queue/${request.requestId}/review`, { version: 1, decision: 'approve' }, 'cp-rar-review-1')).body.replayed).toBe(true);
    expect((await call('POST', `/reassign/queue/${request.requestId}/review`, { version: 2, decision: 'reject' })).body.code).toBe('REASSIGNMENT_ALREADY_REVIEWED');
    const team = (await fixture.pg.query(`SELECT user_id FROM taxguard_staff_assignments WHERE tenant_id = $1 AND client_id = $2 AND status = 'ACTIVE'`, [T, C])).rows;
    expect(team.map((t: any) => t.user_id)).toEqual(['cp-acct']); // unchanged until a manager reassigns
    as('client');
    const mine = (await call('GET', `/reassign/clients/${C}/requests`)).body[0];
    expect(mine).toMatchObject({ status: 'APPROVED', reviewNote: 'Synthetic: a specialist will be assigned' });
    expect(mine.reviewedBy).toBeUndefined();
  });
  it('keeps requests immutable after review, audits without the reason and grants service_role only', async () => {
    await expect(fixture.pg.query(`UPDATE taxguard_reassignment_requests SET reason = 'changed reason here', version = version + 1`)).rejects.toThrow('REASSIGNMENT_IMMUTABLE');
    await expect(fixture.pg.query(`DELETE FROM taxguard_reassignment_request_events`)).rejects.toThrow('REASSIGNMENT_HISTORY_IMMUTABLE');
    const audit = (await fixture.pg.query<{ action: string; metadata: any }>(`SELECT action, metadata FROM taxguard_audit_log WHERE action LIKE 'REASSIGNMENT_%'`)).rows;
    expect(audit.map(a => a.action).sort()).toEqual(['REASSIGNMENT_APPROVED', 'REASSIGNMENT_REQUESTED']);
    expect(JSON.stringify(audit)).not.toMatch(/bookkeeping specialist|specialist will be assigned/);
    const rows = (await fixture.pg.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(`SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth, has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc FROM pg_proc p
      WHERE p.proname LIKE 'taxguard\\_rar\\_%' OR p.proname IN ('taxguard_portal_engagements', 'taxguard_legal_json') ORDER BY 1`)).rows;
    expect(rows.filter(r => r.anon || r.auth)).toEqual([]);
    expect(rows.filter(r => r.svc).map(r => r.proname)).toEqual(['taxguard_portal_engagements', 'taxguard_rar_create', 'taxguard_rar_list_client', 'taxguard_rar_queue', 'taxguard_rar_review']);
  });
});
