import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCasesRouter } from '../server/routes/cases.routes';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { generateStandardChartOfAccounts } from '../server/taxguard/bookkeeping/defaultAccounts';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// Canonical LEGACY_18_V1 workflow over HTTP -> /api/cases -> proposal 026, with stage evidence
// computed from the durable practice (025) and ledger (024) records. Synthetic data only.
const T = 'tenantA', C = 'cwClient';
const roles: Record<string, string> = { 'cw-manager': 'practice_manager', 'cw-prep': 'accountant', 'cw-rev': 'senior_reviewer', 'cw-other': 'accountant' };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any;
let practice: PracticeStore; let ledger: SqlLedgerStore;
let n = 0;
const as = (uid: string, tenantId = T) => { user = { id: uid, role: roles[uid], tenantId, status: 'active' }; };
const call = async (method: 'GET' | 'POST', path: string, body?: unknown, key = `cw-key-${++n}-${Date.now()}`) => {
  const r = await fetch(origin + '/cases' + path, { method, headers: { 'content-type': 'application/json', 'idempotency-key': key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: r.status, body: await r.json().catch(() => null) };
};

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|250000|260000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','cw-owner','Synthetic Case Client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status) SELECT '${T}', k, v, 'active' FROM (VALUES ${Object.entries(roles).map(([k, v]) => `('${k}','${v}')`).join(',')}) x(k, v);`);
  practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  ledger = new SqlLedgerStore(pgliteRpc(() => fixture.pg));
  const store = new CaseStore(pgliteRpc(() => fixture.pg));
  const app = express(); app.use(express.json());
  app.use('/cases', createCasesRouter({ store: () => store, authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('durable 18-stage case workflow', () => {
  let caseId = ''; let version = 1; let engagementId = '';
  const advance = async (who: string, fromStage: number, attestation?: unknown) => { as(who); return call('POST', `/${caseId}/advance`, { fromStage, version, attestation }); };
  const attest = (confirmed: string[]) => ({ confirmed, statement: 'Synthetic reviewer attestation for development testing.' });

  it('creates a case only for an active engagement year with an independent preparer and reviewer', async () => {
    engagementId = (await practice.createEngagement(T, C, 'cw-manager', 'cw-engagement-1', { title: '2025 synthetic return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
    as('cw-manager');
    expect((await call('POST', '/', { clientId: C, engagementId, taxYear: 2025, returnFamily: '1040' })).body.code).toBe('ENGAGEMENT_NOT_ACTIVE');
    await practice.setEngagementStatus(T, C, 'cw-manager', engagementId, 'active', 1);
    expect((await call('POST', '/', { clientId: C, engagementId, taxYear: 2025, returnFamily: '1040' })).body.code).toBe('CASE_TEAM_INCOMPLETE');
    await practice.assign(T, C, 'cw-manager', 'cw-asg-prep', { engagementId, taxYear: 2025, role: 'preparer', userId: 'cw-prep', reason: 'Initial staffing' });
    await practice.assign(T, C, 'cw-manager', 'cw-asg-rev', { engagementId, taxYear: 2025, role: 'reviewer', userId: 'cw-rev', reason: 'Initial staffing' });
    expect((await call('POST', '/', { clientId: C, engagementId, taxYear: 2025, returnFamily: '1099' })).body.code).toBe('CASE_INPUT_INVALID');
    const created = await call('POST', '/', { clientId: C, engagementId, taxYear: 2025, returnFamily: '1040' }, 'cw-case-key-1');
    expect(created.status).toBe(201);
    caseId = created.body.caseId;
    expect((await call('POST', '/', { clientId: C, engagementId, taxYear: 2025, returnFamily: '1040' }, 'cw-case-key-1')).body).toEqual({ caseId, created: false });
    expect((await call('POST', '/', { clientId: C, engagementId, taxYear: 2025, returnFamily: '1040' }, 'cw-case-key-2')).body.code).toBe('CASE_ALREADY_EXISTS');
    const detail = (await call('GET', `/${caseId}`)).body;
    expect(detail.case).toMatchObject({ activeStage: 1, preparerUid: 'cw-prep', reviewerUid: 'cw-rev', returnFamily: '1040', status: 'ACTIVE' });
    expect(detail.stages).toHaveLength(18);
    expect(detail.stages.filter((s: any) => s.status === 'IN_PROGRESS').map((s: any) => s.stage)).toEqual([1]);
  });

  it('advances sequentially with system-verified and reviewer-attested evidence, recording history', async () => {
    let r = await advance('cw-prep', 2);
    expect(r.body.code).toBe('STAGE_SEQUENCE_INVALID');
    r = await advance('cw-prep', 1); expect(r.status).toBe(200); expect(r.body).toMatchObject({ activeStage: 2, evidenceType: 'SYSTEM_VERIFIED' }); version = r.body.version;

    r = await advance('cw-prep', 2, attest(['documents_received_or_waived', 'documents_in_private_storage']));
    expect(r.body.code).toBe('STAGE_ATTESTATION_REQUIRES_REVIEWER');
    r = await advance('cw-rev', 2, attest(['documents_received_or_waived']));
    expect(r.status).toBe(409); expect(r.body).toEqual({ code: 'STAGE_GATE_NOT_MET', failedChecks: ['documents_in_private_storage'] });
    r = await advance('cw-rev', 2, attest(['documents_received_or_waived', 'documents_in_private_storage'])); version = r.body.version;
    r = await advance('cw-rev', 3, attest(['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved'])); version = r.body.version;
    expect(r.body.activeStage).toBe(4);

    r = await advance('cw-prep', 4);
    expect(r.body.code).toBe('STAGE_GATE_NOT_MET'); expect(r.body.failedChecks).toContain('postedEntries');
    const chart = generateStandardChartOfAccounts(T, C, '1040_SCHED_C', 'cw-prep');
    await ledger.createAccounts({ tenantId: T, clientId: C }, 'cw-prep', chart);
    const id = (num: string) => chart.find(a => a.accountNumber === num)!.id;
    await ledger.postEntry({ tenantId: T, clientId: C }, 'cw-prep', { idempotencyKey: 'cw-ledger-1', taxYear: 2025, postingDate: '2025-03-01', description: 'Synthetic income',
      lines: [{ accountId: id('1010'), debit: 100, credit: 0 }, { accountId: id('4010'), debit: 0, credit: 100 }] });
    const pending = await ledger.postEntry({ tenantId: T, clientId: C }, 'cw-prep', { idempotencyKey: 'cw-ledger-2', taxYear: 2025, postingDate: '2025-03-02', description: 'Synthetic accrual',
      isAdjusting: true, source: 'ADJUSTING', lines: [{ accountId: id('6070'), debit: 5, credit: 0 }, { accountId: id('2010'), debit: 0, credit: 5 }] });
    r = await advance('cw-prep', 4); expect(r.body.failedChecks).toEqual(['noEntriesAwaitingReview']);
    await ledger.reviewEntry({ tenantId: T, clientId: C }, 'cw-rev', pending.id, 'approve', pending.version);
    r = await advance('cw-prep', 4); expect(r.body.activeStage).toBe(5); version = r.body.version;

    await ledger.ingestTransactions({ tenantId: T, clientId: C }, 'cw-prep', id('1010'), 'CSV_UPLOAD', 'cw-batch', [{ transactionDate: '2025-03-05', description: 'Synthetic fee', amount: -10 }]);
    r = await advance('cw-prep', 5); expect(r.body.failedChecks).toEqual(expect.arrayContaining(['closedReconciliation', 'allBankTransactionsPosted']));
    const txn = (await ledger.read({ tenantId: T, clientId: C }, 'cw-prep', 2025)).transactions[0];
    await ledger.categorizeTransaction({ tenantId: T, clientId: C }, 'cw-prep', txn.id, id('6070'), 2025);
    const recon = await ledger.startReconciliation({ tenantId: T, clientId: C }, 'cw-prep', { accountId: id('1010'), taxYear: 2025, statementStart: '2025-03-01', statementEnd: '2025-03-31', beginningBalance: 0, endingBalance: -10 });
    await ledger.setCleared({ tenantId: T, clientId: C }, 'cw-prep', recon, txn.id, true);
    await ledger.finalizeReconciliation({ tenantId: T, clientId: C }, 'cw-prep', recon);
    r = await advance('cw-prep', 5); expect(r.body.activeStage).toBe(6); version = r.body.version;

    r = await advance('cw-rev', 6, attest(['workpapers_reviewed', 'no_unresolved_blocking_exceptions'])); expect(r.body.activeStage).toBe(7); version = r.body.version;
    r = await advance('cw-rev', 7, attest(['reports_reviewed_for_release'])); version = r.body.version;
    r = await advance('cw-rev', 8, attest(['planning_considerations_documented'])); version = r.body.version;
    expect(r.body.activeStage).toBe(9);

    r = await advance('cw-rev', 9, attest([]));
    expect(r.status).toBe(409); expect(r.body.code).toBe('STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED');
    as('cw-manager');
    const detail = (await call('GET', `/${caseId}`)).body;
    expect(detail.events.map((e: any) => [e.action, e.toStage, e.evidenceType])).toEqual([['CREATED', 1, null], ['ADVANCED', 2, 'SYSTEM_VERIFIED'], ['ADVANCED', 3, 'HUMAN_ATTESTED'],
      ['ADVANCED', 4, 'HUMAN_ATTESTED'], ['ADVANCED', 5, 'SYSTEM_VERIFIED'], ['ADVANCED', 6, 'SYSTEM_VERIFIED'], ['ADVANCED', 7, 'HUMAN_ATTESTED'], ['ADVANCED', 8, 'HUMAN_ATTESTED'], ['ADVANCED', 9, 'HUMAN_ATTESTED']]);
    expect(detail.stages.filter((s: any) => s.status === 'COMPLETED')).toHaveLength(8);
    expect(detail.stagePolicy).toEqual({ evidence: 'BLOCKED', dependency: 'VERIFIED_TAX_ENGINE_REQUIRED' });
    await expect(fixture.pg.query('UPDATE taxguard_case_stage_events SET reason = $1', ['tamper'])).rejects.toThrow('CASE_HISTORY_IMMUTABLE');
  });

  it('lets only the reviewer return the case to an earlier stage, with a reason, and protects versions', async () => {
    as('cw-prep');
    expect((await call('POST', `/${caseId}/return`, { toStage: 6, version, reason: 'Preparer attempting to reopen' })).body.code).toBe('STAGE_RETURN_REQUIRES_REVIEWER');
    as('cw-rev');
    expect((await call('POST', `/${caseId}/return`, { toStage: 6, version: version - 1, reason: 'Stale version attempt' })).body.code).toBe('CASE_VERSION_CONFLICT');
    expect((await call('POST', `/${caseId}/return`, { toStage: 9, version, reason: 'Cannot return forward' })).body.code).toBe('STAGE_SEQUENCE_INVALID');
    const back = await call('POST', `/${caseId}/return`, { toStage: 6, version, reason: 'Workpaper reference missing for synthetic expense' });
    expect(back.body.activeStage).toBe(6); version = back.body.version;
    const detail = (await call('GET', `/${caseId}`)).body;
    expect(detail.stages.filter((s: any) => s.stage >= 6 && s.status !== 'LOCKED').map((s: any) => [s.stage, s.status])).toEqual([[6, 'IN_PROGRESS']]);
  });

  it('refuses transitions while on hold and requires a reason to hold or resume', async () => {
    as('cw-prep');
    expect((await call('POST', `/${caseId}/hold`, { hold: true, version, reason: 'no' })).body.code).toBe('STATUS_REASON_REQUIRED');
    const held = await call('POST', `/${caseId}/hold`, { hold: true, version, reason: 'Waiting on synthetic client response' }); version = held.body.version;
    as('cw-rev');
    expect((await call('POST', `/${caseId}/advance`, { fromStage: 6, version, attestation: attest(['workpapers_reviewed', 'no_unresolved_blocking_exceptions']) })).body.code).toBe('CASE_NOT_ACTIVE');
    const resumed = await call('POST', `/${caseId}/hold`, { hold: false, version, reason: 'Client responded' }); version = resumed.body.version;
    expect(resumed.body.status).toBe('ACTIVE');
  });

  it('hides the case from unassigned staff and other tenants, and filters the work queue by role', async () => {
    as('cw-other');
    expect((await call('GET', `/${caseId}`)).body.code).toBe('CASE_NOT_FOUND');
    expect((await call('POST', `/${caseId}/advance`, { fromStage: 6, version })).body.code).toBe('CASE_NOT_FOUND');
    expect((await call('GET', '/')).body.items).toEqual([]);
    as('cw-manager', 'tenantB');
    expect((await call('GET', '/')).status).toBe(403);
    as('cw-rev');
    const queue = (await call('GET', '/?role=reviewer')).body.items;
    expect(queue.map((c: any) => [c.caseId, c.activeStage, c.myRole, c.awaitingReviewer])).toEqual([[caseId, 6, 'reviewer', true]]);
    expect((await call('GET', '/?role=preparer')).body.items).toEqual([]);
    as('cw-manager');
    // Managers see every tenant case, including the shared fixture case at stage 3.
    expect((await call('GET', '/report')).body).toEqual({ byStage: { '3': 1, '6': 1 }, byStatus: { ACTIVE: 2 } });
    as('cw-rev');
    expect((await call('GET', '/report')).body).toEqual({ byStage: { '6': 1 }, byStatus: { ACTIVE: 1 } });
    as('cw-manager');
    expect((await call('POST', `/${caseId}/notes`, { body: 'Synthetic case note' })).status).toBe(201);
    expect((await call('GET', `/${caseId}`)).body.notes[0].body).toBe('Synthetic case note');
  });
});
