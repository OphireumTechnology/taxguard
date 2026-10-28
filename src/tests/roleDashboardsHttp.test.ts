import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPracticeRouter } from '../server/routes/practice.routes';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { generateStandardChartOfAccounts } from '../server/taxguard/bookkeeping/defaultAccounts';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/practice/my-work and /summary -> proposal 032 over the durable records of 024-031.
// Every expected figure below is derived from the synthetic rows this test inserts.
const T = 'tenantA', C = 'rdClient', U = 'rdUnassigned';
const roles: Record<string, string> = { 'rd-mgr': 'practice_manager', 'rd-prep': 'accountant', 'rd-rev': 'senior_reviewer', 'rd-bk': 'bookkeeper', 'rd-other': 'accountant' };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any;
let caseId = '', engagementId = '';
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid] ?? 'practice_manager', tenantId, status: 'active' }; };
const get = (path: string) => fetch(origin + '/practice' + path).then(async r => ({ status: r.status, body: await r.json() as any }));

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|250000|260000|270000|280000|290000|310000|320000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','rd-client','Synthetic Dashboard Client'),('${T}','${U}','rd-x','Synthetic Unassigned');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) SELECT '${T}', k, v, 'active' FROM (VALUES ${Object.entries(roles).map(([k, v]) => `('${k}','${v}')`).join(',')}) x(k, v);
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','rd-foreign','practice_manager','active');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  engagementId = (await practice.createEngagement(T, C, 'rd-mgr', 'rd-engagement-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'rd-mgr', engagementId, 'active', 1);
  for (const [role, uid] of [['preparer', 'rd-prep'], ['reviewer', 'rd-rev'], ['bookkeeper', 'rd-bk']])
    await practice.assign(T, C, 'rd-mgr', 'rd-assign-' + role, { engagementId, taxYear: 2025, role, userId: uid, reason: 'Synthetic staffing' });
  caseId = (await new CaseStore(pgliteRpc(() => fixture.pg)).create(T, C, 'rd-mgr', 'rd-case-key-1', { engagementId, taxYear: 2025, returnFamily: '1040' })).caseId;
  // Ledger: one prepared entry by the bookkeeper, one returned to the preparer.
  const ledger = new SqlLedgerStore(pgliteRpc(() => fixture.pg));
  const chart = generateStandardChartOfAccounts(T, C, '1040_SCHED_C', 'rd-prep');
  await ledger.createAccounts({ tenantId: T, clientId: C }, 'rd-prep', chart);
  const id = (n: string) => chart.find(a => a.accountNumber === n)!.id;
  const line = (d: string, c: string) => [{ accountId: id(d), debit: 10, credit: 0 }, { accountId: id(c), debit: 0, credit: 10 }];
  await ledger.postEntry({ tenantId: T, clientId: C }, 'rd-bk', { idempotencyKey: 'rd-entry-1', taxYear: 2025, postingDate: '2025-02-01', description: 'Synthetic bookkeeper entry', lines: line('6070', '1010') } as any);
  const mine = await ledger.postEntry({ tenantId: T, clientId: C }, 'rd-prep', { idempotencyKey: 'rd-entry-2', taxYear: 2025, postingDate: '2025-02-02', description: 'Synthetic accrual', isAdjusting: true, source: 'ADJUSTING', lines: line('6070', '2010') } as any);
  await ledger.reviewEntry({ tenantId: T, clientId: C }, 'rd-rev', mine.id, 'request_correction', mine.version, 'Use a different synthetic account');
  // Documents, requests, deadlines, tasks, invoices: direct synthetic rows.
  await fixture.pg.exec(`
    INSERT INTO taxguard_documents(id,document_id,tenant_id,client_id,engagement_id,tax_year,hash,mime_type,created_by,status,quarantine_status,file_name,category,version)
      VALUES (gen_random_uuid(),'rd-doc-1','${T}','${C}','${engagementId}',2025,repeat('a',64),'application/pdf','rd-client','PENDING_REVIEW','CLEAN','client-w2.pdf','income',1),
             (gen_random_uuid(),'rd-doc-2','${T}','${C}','${engagementId}',2025,repeat('b',64),'application/pdf','rd-prep','PENDING_REVIEW','CLEAN','staff-upload.pdf','income',1),
             (gen_random_uuid(),'rd-doc-3','${T}','${C}','${engagementId}',2025,repeat('c',64),'application/pdf','rd-client','SCAN_PENDING','QUARANTINED','pending.pdf','income',1),
             (gen_random_uuid(),'rd-doc-4','${T}','${U}','e-x',2025,repeat('d',64),'application/pdf','rd-x','PENDING_REVIEW','CLEAN','unassigned.pdf','income',1);
    INSERT INTO taxguard_doc_requests(tenant_id,client_id,request_id,engagement_id,tax_year,title,category,accepted_types,required,due_date,created_by)
      VALUES ('${T}','${C}','req_${'1'.repeat(32)}','${engagementId}',2025,'Synthetic wage statements','income',ARRAY['application/pdf'],true,current_date - 2,'rd-prep'),
             ('${T}','${C}','req_${'2'.repeat(32)}','${engagementId}',2025,'Synthetic receipts','deductions',ARRAY['application/pdf'],false,NULL,'rd-prep');
    INSERT INTO taxguard_deadlines(id,tenant_id,client_id,tax_year,category,title,due_date,authority_type,status,provenance)
      VALUES ('rd-dl-1','${T}','${C}',2025,'CLIENT_COMMITMENT','Synthetic due soon',current_date + 3,'INTERNAL','PENDING','{}'),
             ('rd-dl-2','${T}','${C}',2025,'CLIENT_COMMITMENT','Synthetic overdue',current_date - 1,'INTERNAL','PENDING','{}'),
             ('rd-dl-3','${T}','${C}',2025,'CLIENT_COMMITMENT','Synthetic met',current_date - 1,'INTERNAL','MET','{}');
    INSERT INTO taxguard_invoices(id,tenant_id,client_id,invoice_number,status,subtotal,total,amount_paid,balance_due,due_date,created_by)
      VALUES (gen_random_uuid(),'${T}','${C}','SYN-1','ISSUED',100.10,100.10,0,100.10,current_date - 5,'rd-mgr'),
             (gen_random_uuid(),'${T}','${C}','SYN-2','PARTIALLY_PAID',50.00,50.00,20.00,30.00,current_date + 5,'rd-mgr'),
             (gen_random_uuid(),'${T}','${C}','SYN-3','PAID',10.00,10.00,10.00,0,current_date,'rd-mgr');`);
  const app = express(); app.use(express.json());
  app.use('/practice', createPracticeRouter({ store: () => new PracticeStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('my work (preparer and reviewer)', () => {
  it('shows the preparer their case (stage 1 is theirs), outstanding requests, returned entries and only reviewable documents', async () => {
    as('rd-prep');
    const w = (await get('/my-work')).body;
    expect(w.cases).toEqual([expect.objectContaining({ caseId, activeStage: 1, myRole: 'preparer', awaitingMe: true, evidence: 'SYSTEM_VERIFIED' })]);
    expect(w.documentsToReview.map((d: any) => d.fileName)).toEqual(['client-w2.pdf']); // not their own upload, not the unassigned client, not quarantined
    expect(w.requestsOutstanding.map((q: any) => [q.title, q.overdue])).toEqual([['Synthetic wage statements', true], ['Synthetic receipts', false]]);
    expect(w.entriesReturnedToMe.map((e: any) => e.description)).toEqual(['Synthetic accrual']);
    expect(w.entriesAwaitingMyReview).toEqual([]);
    expect(Object.keys(w.definitions)).toHaveLength(6);
  });
  it('shows the reviewer the entries awaiting their review; the case step is not theirs at stage 1', async () => {
    as('rd-rev');
    const w = (await get('/my-work')).body;
    expect(w.cases).toEqual([expect.objectContaining({ caseId, myRole: 'reviewer', awaitingMe: false })]);
    expect(w.entriesAwaitingMyReview.map((e: any) => e.description)).toEqual(['Synthetic bookkeeper entry']);
    expect(w.documentsToReview.map((d: any) => d.fileName).sort()).toEqual(['client-w2.pdf', 'staff-upload.pdf']);
  });
  it('shows unassigned staff nothing and refuses bookkeepers and other tenants', async () => {
    as('rd-other');
    const w = (await get('/my-work')).body;
    expect([w.cases, w.documentsToReview, w.requestsOutstanding, w.entriesAwaitingMyReview]).toEqual([[], [], [], []]);
    as('rd-bk'); expect((await get('/my-work')).body.code).toBe('DASHBOARD_ROLE_NOT_SUPPORTED');
    as('rd-foreign', 'tenantB'); expect((await get('/my-work')).body.cases).toEqual([]);
  });
});

describe('practice summary (managers)', () => {
  it('reports recorded counts and balances with definitions, and nothing invented', async () => {
    as('rd-mgr');
    const s = (await get('/summary?taxYear=2025')).body
    // The shared fixture already holds one synthetic case at stage 3 (preparer / reviewer members).
    expect(s.casesByStage).toEqual([{ stage: 1, active: 1, onHold: 0 }, { stage: 3, active: 1, onHold: 0 }]);
    expect(s.deadlines).toEqual({ dueThisWeek: 1, overdue: 1 });
    expect(s.documentRequests).toEqual({ open: 2, submitted: 0, overdue: 1, requiredOutstanding: 1 });
    expect(s.documentsAwaitingReview).toBe(3); expect(s.documentsAwaitingScan).toBe(1);
    expect(s.receivables).toEqual({ openInvoices: 2, balanceDue: '130.10', pastDue: 1, awaitingApproval: 0 });
    expect(s.staffCaseCounts).toEqual([{ userId: 'preparer', asPreparer: 1, asReviewer: 0 }, { userId: 'rd-prep', asPreparer: 1, asReviewer: 0 },
      { userId: 'rd-rev', asPreparer: 0, asReviewer: 1 }, { userId: 'reviewer', asPreparer: 0, asReviewer: 1 }]);
    const figureKeys = JSON.stringify({ ...s, definitions: undefined }).match(/"[A-Za-z]+":/g)!.join(' ');
    expect(figureKeys).not.toMatch(/capacity|sla|productivity|forecast|score|utilization/i);
    expect(Object.keys(s.definitions).sort()).toEqual(['casesByStage', 'deadlines', 'documentRequests', 'documentsAwaitingReview', 'documentsAwaitingScan', 'receivables', 'staffCaseCounts', 'tasks']);
    expect((await get('/summary?taxYear=2024')).body.casesByStage).toEqual([]);
    expect((await get('/summary?taxYear=1999')).status).toBe(400);
  });
  it('is for managers only and never crosses tenants', async () => {
    as('rd-prep'); expect((await get('/summary')).body.code).toBe('DASHBOARD_MANAGER_REQUIRED');
    as('rd-foreign', 'tenantB');
    const s = (await get('/summary')).body;
    expect([s.casesByStage, s.receivables.openInvoices, s.documentsAwaitingReview, s.staffCaseCounts]).toEqual([[], 0, 0, []]);
  });
  it('grants only the service role', async () => {
    const rows = (await fixture.pg.query<{ proname: string; svc: boolean; anon: boolean; auth: boolean }>(`SELECT proname, has_function_privilege('service_role', oid, 'EXECUTE') svc,
      has_function_privilege('anon', oid, 'EXECUTE') anon, has_function_privilege('authenticated', oid, 'EXECUTE') auth FROM pg_proc WHERE proname LIKE 'taxguard\\_dash\\_%' ORDER BY proname`)).rows;
    expect(rows).toEqual([{ proname: 'taxguard_dash_my_work', svc: true, anon: false, auth: false }, { proname: 'taxguard_dash_practice_summary', svc: true, anon: false, auth: false }]);
  });
});
