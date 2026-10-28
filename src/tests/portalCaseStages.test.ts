import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClientPortalRouter } from '../server/routes/client-portal.routes';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { DocumentRequestStore } from '../server/taxguard/documents/documentRequestStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Contract C3: client-facing read of stages 01-08 (proposal 20261016000000) over the real case
// workflow (026), vault (027) and document requests (031). Synthetic records only.
const T = 'tenantA', C = 'csClient', OTHER = 'csOther';
const people: Record<string, any> = { mgr: { id: 'cs-mgr', role: 'practice_manager' }, prep: { id: 'cs-prep', role: 'accountant' }, rev: { id: 'cs-rev', role: 'senior_reviewer' },
  outsider: { id: 'cs-outsider', role: 'accountant' }, client: { id: 'cs-client', role: 'client', clientId: C }, other: { id: 'cs-other', role: 'client', clientId: OTHER },
  recruiter: { id: 'cs-recruiter', role: 'recruiter' } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin = ''; let user: any; let engagement = ''; let draft = ''; let caseId = '';
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const read = (client = C, eng = engagement, year = '2025') => fetch(`${origin}/portal/clients/${client}/case-stages?engagementId=${encodeURIComponent(eng)}&taxYear=${year}`)
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const STAFF_FIELDS = /approvedBy|preparerUid|reviewerUid|actorUid|holdReason|reason|notes|events|tasks|statement|cs-prep|cs-rev|cs-mgr|Synthetic hold explanation|Cents|amount/i;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101(2(240000|250000|260000|270000|310000)|6000000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','cs-client','Synthetic Stage Client'),('${T}','${OTHER}','cs-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','cs-foreign','practice_manager','active');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg)), cases = new CaseStore(pgliteRpc(() => fixture.pg));
  engagement = (await practice.createEngagement(T, C, 'cs-mgr', 'cs-eng-0001', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cs-mgr', engagement, 'active', 1);
  draft = (await practice.createEngagement(T, C, 'cs-mgr', 'cs-eng-0002', { title: 'Synthetic draft', type: 'tax_planning', taxYears: [2025] })).engagementId;
  await practice.assign(T, C, 'cs-mgr', 'cs-asg-0001', { engagementId: engagement, taxYear: 2025, role: 'preparer', userId: 'cs-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'cs-mgr', 'cs-asg-0002', { engagementId: engagement, taxYear: 2025, role: 'reviewer', userId: 'cs-rev', reason: 'Synthetic staffing' });
  caseId = (await cases.create(T, C, 'cs-mgr', 'cs-case-0001', { engagementId: engagement, taxYear: 2025, returnFamily: '1040' })).caseId;
  let d: any = await cases.detail(T, caseId, 'cs-mgr');
  await cases.advance(T, caseId, 'cs-prep', 1, d.case.version);
  d = await cases.detail(T, caseId, 'cs-mgr');
  await cases.advance(T, caseId, 'cs-rev', 2, d.case.version, { confirmed: ['documents_received_or_waived', 'documents_in_private_storage'], statement: 'Synthetic attestation statement for stage two.' });
  await new DocumentRequestStore(pgliteRpc(() => fixture.pg)).create(T, C, 'cs-prep', 'cs-request-0001', { engagementId: engagement, taxYear: 2025, title: 'Synthetic W-2', category: 'income', required: true } as any);
  const app = express();
  app.use('/portal', createClientPortalRouter({ client: () => pgliteRpc(() => fixture.pg), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('client stage read (C3)', () => {
  it('returns the server stage state for stages 01-08 only, without staff identities or attestation text', async () => {
    as('client');
    const r = await read();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ caseExists: true, caseStatus: 'ACTIVE', activeStage: 3, activeStagePolicy: { evidence: 'HUMAN_ATTESTED', checklist: ['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved'] } });
    expect(r.body.stages.map((s: any) => [s.stage, s.status])).toEqual([[1, 'COMPLETED'], [2, 'COMPLETED'], [3, 'IN_PROGRESS'], [4, 'LOCKED'], [5, 'LOCKED'], [6, 'LOCKED'], [7, 'LOCKED'], [8, 'LOCKED']]);
    expect(r.body.stages[0].completedAt).toEqual(expect.any(String));
    expect(r.body.stages[3].completedAt).toBeNull();
    expect(r.body.evidence).toEqual({ verifiedDocuments: 0, documentsInReview: 0, documentsNeedingAction: 0, openDocumentRequests: 1 });
    expect(r.body.team).toEqual({ preparerAssigned: true, reviewerAssigned: true, independentReview: true });
    expect(JSON.stringify(r.body)).not.toMatch(STAFF_FIELDS);
  });
  it('reports a hold without its internal reason', async () => {
    const cases = new CaseStore(pgliteRpc(() => fixture.pg));
    const d: any = await cases.detail(T, caseId, 'cs-mgr');
    await cases.setHold(T, caseId, 'cs-mgr', true, d.case.version, 'Synthetic hold explanation');
    as('client');
    const r = await read();
    expect(r.body.caseStatus).toBe('ON_HOLD');
    expect(JSON.stringify(r.body)).not.toMatch(STAFF_FIELDS);
    const after: any = await cases.detail(T, caseId, 'cs-mgr');
    await cases.setHold(T, caseId, 'cs-mgr', false, after.case.version, 'Synthetic resume explanation');
  });
  it('reports a missing case truthfully', async () => {
    await fixture.pg.query(`UPDATE taxguard_engagements SET status = 'active' WHERE engagement_id = $1`, [draft]);
    as('client');
    expect((await read(C, draft)).body).toEqual({ engagementId: draft, taxYear: 2025, caseExists: false });
    await fixture.pg.query(`UPDATE taxguard_engagements SET status = 'draft' WHERE engagement_id = $1`, [draft]);
  });
  it.each([
    ['another client', 'other', T, C, 404], ['the right client but another client id', 'client', T, OTHER, 404], ['another tenant', 'client', 'tenantB', C, 404],
    ['an unassigned accountant', 'outsider', T, C, 404], ['a recruiter', 'recruiter', T, C, 403],
  ])('refuses %s', async (_l, who, tenant, client, status) => {
    as(who, tenant);
    const r = await read(client);
    expect(r.status).toBe(status);
    expect(JSON.stringify(r.body)).not.toMatch(/IN_PROGRESS|COMPLETED|stages/);
  });
  it('hides draft engagements from clients and rejects malformed input', async () => {
    as('client');
    expect((await read(C, draft)).status).toBe(404);
    expect((await read(C, "x' OR 1=1")).status).toBe(400);
    expect((await read(C, engagement, '20x5')).status).toBe(400);
    expect((await read(C, 'eng-guess-0001')).status).toBe(404);
  });
  it('lets assigned staff read the same projection', async () => {
    as('prep');
    expect((await read()).body.activeStage).toBe(3);
  });
  it('is executable by the service role only', async () => {
    for (const role of ['anon', 'authenticated'])
      expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_function_privilege('${role}', 'public.taxguard_portal_case_stages(text,text,text,text,integer)', 'EXECUTE') AS ok`)).rows[0].ok).toBe(false);
  });
});
