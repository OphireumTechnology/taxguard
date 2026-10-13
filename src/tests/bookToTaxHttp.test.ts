import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createBookToTaxRouter } from '../server/routes/bookToTax.routes';
import { BookToTaxStore } from '../server/taxguard/bookkeeping/bookToTaxStore';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { generateStandardChartOfAccounts } from '../server/taxguard/bookkeeping/defaultAccounts';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/book-to-tax -> proposal 029 over real ledger postings (024). Synthetic data and firm-defined categories only.
const T = 'tenantA', C = 'b2tClient';
const people: Record<string, any> = { mgr: { id: 'b2t-mgr', role: 'practice_manager' }, acct: { id: 'b2t-acct', role: 'accountant' }, rev: { id: 'b2t-rev', role: 'senior_reviewer' },
  outsider: { id: 'b2t-out', role: 'accountant' }, client: { id: 'b2t-client', role: 'client', clientId: C } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let n = 0;
let acct: Record<string, string> = {};
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown) => fetch(origin + '/b2t' + path, { method,
  headers: { 'content-type': 'application/json', 'idempotency-key': `b2t-key-${++n}-${Date.now()}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  .then(async r => ({ status: r.status, body: await r.json() }));

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|250000|260000|270000|290000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','b2t-client','Synthetic B2T Client');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) VALUES('${T}','b2t-mgr','practice_manager','active',NULL),('${T}','b2t-acct','accountant','active',NULL),
      ('${T}','b2t-rev','senior_reviewer','active',NULL),('${T}','b2t-out','accountant','active',NULL),('${T}','b2t-client','client','active','${C}');
    INSERT INTO taxguard_staff_assignments(id,tenant_id,client_id,role,user_id,assigned_by,effective_from) VALUES('b2t-1','${T}','${C}','preparer','b2t-acct','seed',now()-interval '1 day'),
      ('b2t-2','${T}','${C}','reviewer','b2t-rev','seed',now()-interval '1 day');`);
  const ledger = new SqlLedgerStore(pgliteRpc(() => fixture.pg));
  const chart = generateStandardChartOfAccounts(T, C, '1040_SCHED_C', 'b2t-acct');
  await ledger.createAccounts({ tenantId: T, clientId: C }, 'b2t-acct', chart);
  acct = Object.fromEntries(chart.map(a => [a.accountNumber, a.id]));
  const post = (key: string, date: string, d: string, c: string, amt: number) => ledger.postEntry({ tenantId: T, clientId: C }, 'b2t-acct',
    { idempotencyKey: key, taxYear: 2025, postingDate: date, description: 'Synthetic ' + key, lines: [{ accountId: acct[d], debit: amt, credit: 0 }, { accountId: acct[c], debit: 0, credit: amt }] });
  await post('b2t-rev-1', '2025-02-01', '1010', '4010', 12000);
  await post('b2t-meal-1', '2025-03-01', '6080', '1010', 400);
  await post('b2t-sup-1', '2025-04-01', '6070', '1010', 250.55);
  const app = express();
  app.use('/b2t', createBookToTaxRouter({ store: () => new BookToTaxStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 60000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('durable book-to-tax', () => {
  let setId = ''; let workpaper = '';
  it('lets managers define firm categories; others cannot', async () => {
    as('acct');
    expect((await call('POST', '/categories', { returnFamily: '1040', categoryCode: 'GROSS_RECEIPTS', label: 'Gross receipts' })).body.code).toBe('B2T_MANAGER_REQUIRED');
    as('mgr');
    for (const [code, label] of [['GROSS_RECEIPTS', 'Gross receipts (firm grouping)'], ['MEALS', 'Business meals (firm grouping)'], ['SUPPLIES', 'Supplies (firm grouping)'], ['CASH', 'Cash (balance sheet)']])
      expect((await call('POST', '/categories', { returnFamily: '1040', categoryCode: code, label })).status).toBe(200);
    expect((await call('GET', '/categories/1040')).body.items.map((c: any) => c.categoryCode)).toEqual(['CASH', 'GROSS_RECEIPTS', 'MEALS', 'SUPPLIES']);
  });

  it('versions mappings and requires an independent reviewer to approve them', async () => {
    as('acct');
    const set = await call('POST', `/clients/${C}/2025/1040/mapping-sets`);
    expect(set.status).toBe(201); setId = set.body.setId; expect(set.body).toMatchObject({ version: 1, status: 'DRAFT' });
    for (const [num, cat] of [['1010', 'CASH'], ['4010', 'GROSS_RECEIPTS'], ['6080', 'MEALS']]) await call('POST', `/clients/${C}/mapping-sets/${setId}/mappings`, { accountId: acct[num], categoryCode: cat });
    expect((await call('POST', `/clients/${C}/mapping-sets/${setId}/mappings`, { accountId: acct['6070'], categoryCode: 'UNKNOWN' })).body.code).toBe('CATEGORY_NOT_FOUND');
    await call('POST', `/clients/${C}/mapping-sets/${setId}/submit`);
    expect((await call('POST', `/clients/${C}/mapping-sets/${setId}/mappings`, { accountId: acct['6070'], categoryCode: 'SUPPLIES' })).body.code).toBe('MAPPING_SET_NOT_EDITABLE');
    expect((await call('POST', `/clients/${C}/mapping-sets/${setId}/approve`)).body.code).toBe('B2T_REVIEWER_REQUIRED');
    as('rev');
    const approved = await call('POST', `/clients/${C}/mapping-sets/${setId}/approve`);
    expect(approved.body).toMatchObject({ status: 'APPROVED', reviewedBy: 'b2t-rev' });
    await expect(fixture.pg.query("DELETE FROM taxguard_b2t_mappings WHERE set_id = $1", [setId])).rejects.toThrow('MAPPING_SET_NOT_EDITABLE');
  });

  it('refuses to approve a workpaper with unmapped activity, then reconciles after a new mapping version', async () => {
    as('acct');
    let wp = await call('POST', `/clients/${C}/2025/1040/workpapers`);
    expect(wp.body).toMatchObject({ reconciled: true, unmappedAccounts: 1 });
    expect(wp.body.snapshot.unmapped.map((u: any) => [u.accountNumber, u.netCents])).toEqual([['6070', 25055]]);
    as('rev');
    expect((await call('POST', `/clients/${C}/workpapers/${wp.body.workpaperId}/approve`)).body.code).toBe('WORKPAPER_NOT_RECONCILED');
    as('acct');
    const v2 = (await call('POST', `/clients/${C}/2025/1040/mapping-sets`)).body;
    expect(v2).toMatchObject({ version: 2, status: 'DRAFT' }); expect(v2.mappings).toHaveLength(3);
    await call('POST', `/clients/${C}/mapping-sets/${v2.setId}/mappings`, { accountId: acct['6070'], categoryCode: 'SUPPLIES' });
    await call('POST', `/clients/${C}/mapping-sets/${v2.setId}/submit`);
    as('rev');
    await call('POST', `/clients/${C}/mapping-sets/${v2.setId}/approve`);
    expect((await call('POST', `/clients/${C}/workpapers/${wp.body.workpaperId}/reject`, { note: 'Superseded by mapping version 2' })).body.status).toBe('REJECTED');
    as('acct');
    wp = await call('POST', `/clients/${C}/2025/1040/workpapers`);
    expect(wp.body).toMatchObject({ reconciled: true, unmappedAccounts: 0 });
    expect(wp.body.snapshot.reconciliation).toEqual({ ledgerActivityCents: 0, mappedCents: 0, unmappedCents: 0, differenceCents: 0 });
    expect(wp.body.snapshot.categories.map((c: any) => [c.categoryCode, c.bookCents])).toEqual([['CASH', 1134945], ['GROSS_RECEIPTS', -1200000], ['MEALS', 40000], ['SUPPLIES', 25055]]);
    expect(wp.body.snapshot.notice).toMatch(/computes no tax/);
    workpaper = wp.body.workpaperId;
    const v1 = (await call('GET', `/clients/${C}/2025/1040`)).body.mappingSets.map((s: any) => [s.version, s.status]);
    expect(v1).toEqual([[2, 'APPROVED'], [1, 'SUPERSEDED']]);
  });

  it('applies only reviewed adjustments; evidence must be a verified document; generator cannot approve the workpaper', async () => {
    as('acct');
    expect((await call('POST', `/clients/${C}/adjustments`, { taxYear: 2025, returnFamily: '1040', categoryCode: 'MEALS', amount: -200, adjustmentType: 'PERMANENT',
      description: 'Firm-reviewed meals limitation (professional judgment)', evidenceDocumentId: 'doc_missing' })).body.code).toBe('EVIDENCE_DOCUMENT_NOT_VERIFIED');
    const adj = await call('POST', `/clients/${C}/adjustments`, { taxYear: 2025, returnFamily: '1040', categoryCode: 'MEALS', amount: '-200.00', adjustmentType: 'PERMANENT',
      description: 'Firm-reviewed meals limitation (professional judgment)' });
    expect(adj.status).toBe(201);
    expect((await call('POST', `/clients/${C}/adjustments/${adj.body.adjustmentId}/approve`)).body.code).toBe('B2T_REVIEWER_REQUIRED');
    let wp = await call('POST', `/clients/${C}/2025/1040/workpapers`);
    expect(wp.body.snapshot.categories.find((c: any) => c.categoryCode === 'MEALS')).toMatchObject({ bookCents: 40000, adjustmentCents: 0, taxBasisCents: 40000 });
    as('rev');
    await call('POST', `/clients/${C}/adjustments/${adj.body.adjustmentId}/approve`);
    as('acct');
    wp = await call('POST', `/clients/${C}/2025/1040/workpapers`);
    expect(wp.body.snapshot.categories.find((c: any) => c.categoryCode === 'MEALS')).toMatchObject({ bookCents: 40000, adjustmentCents: -20000, taxBasisCents: 20000 });
    expect((await call('POST', `/clients/${C}/workpapers/${wp.body.workpaperId}/approve`)).body.code).toBe('B2T_REVIEWER_REQUIRED');
    as('rev');
    expect((await call('POST', `/clients/${C}/workpapers/${wp.body.workpaperId}/approve`)).body.status).toBe('APPROVED');
    expect((await call('POST', `/clients/${C}/workpapers/${workpaper}/approve`)).body.status).toBe('APPROVED');
    const statuses = (await call('GET', `/clients/${C}/2025/1040`)).body.workpapers.filter((w: any) => ['APPROVED', 'SUPERSEDED'].includes(w.status)).map((w: any) => w.status);
    expect(statuses.filter((s: string) => s === 'APPROVED')).toHaveLength(1);
    await expect(fixture.pg.query("UPDATE taxguard_b2t_workpapers SET snapshot = '{}'::jsonb")).rejects.toThrow('WORKPAPER_IMMUTABLE');
  });

  it('does not let a reviewer approve a mapping set they prepared', async () => {
    as('rev');
    const own = (await call('POST', `/clients/${C}/2024/1040/mapping-sets`)).body;
    await call('POST', `/clients/${C}/mapping-sets/${own.setId}/submit`);
    expect((await call('POST', `/clients/${C}/mapping-sets/${own.setId}/approve`)).body.code).toBe('MAKER_CHECKER_VIOLATION');
  });

  it('refuses clients, unassigned staff and other tenants', async () => {
    as('client');
    expect((await call('GET', `/clients/${C}/2025/1040`)).status).toBe(403);
    as('outsider');
    expect((await call('GET', `/clients/${C}/2025/1040`)).body.code).toBe('LEDGER_ACCESS_DENIED');
    as('rev', 'tenantB');
    expect((await call('GET', `/clients/${C}/2025/1040`)).body.code).toBe('LEDGER_ACCESS_DENIED');
  });
});
