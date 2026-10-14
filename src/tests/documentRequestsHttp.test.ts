import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createVaultRouter } from '../server/routes/vault.routes';
import { DocumentVaultStore } from '../server/taxguard/documents/documentVaultStore';
import { DocumentRequestStore } from '../server/taxguard/documents/documentRequestStore';
import type { MalwareScanner, VaultStorage } from '../server/taxguard/documents/vaultIntegrations';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/vault request routes -> DocumentRequestStore -> proposal 031 (PGlite) composed with
// 024-027. Synthetic clients, documents and requests only.
const T = 'tenantA', C = 'drClient', OTHER = 'drOther';
const people: Record<string, any> = { mgr: { id: 'dr-mgr', role: 'practice_manager' }, acct: { id: 'dr-acct', role: 'accountant' }, rev: { id: 'dr-rev', role: 'senior_reviewer' },
  bk: { id: 'dr-bk', role: 'bookkeeper' }, outsider: { id: 'dr-outsider', role: 'accountant' }, client: { id: 'dr-client', role: 'client', clientId: C },
  other: { id: 'dr-other', role: 'client', clientId: OTHER }, foreign: { id: 'dr-foreign', role: 'practice_manager' } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let n = 0;
let engagementId = '', engagement2024 = '', otherEngagement = '';
let cases: CaseStore;
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown, key: string | null = `dr-key-${++n}-${Date.now()}`) => fetch(origin + '/vault' + path, { method,
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const upload = (eng: string, year: number, category: string, type = 'application/pdf', body = Buffer.from('%PDF-1.4\nsynthetic\n%%EOF')) =>
  fetch(origin + `/vault/clients/${C}/documents?` + new URLSearchParams({ engagementId: eng, taxYear: String(year), category, fileName: `synthetic-${category}.pdf` }),
    { method: 'POST', headers: { 'content-type': type, 'idempotency-key': `dr-up-${++n}-${Date.now()}` }, body }).then(async r => ({ status: r.status, body: await r.json() as any }));
const audits = async (action: string) => (await fixture.pg.query<{ metadata: any }>(`SELECT metadata FROM taxguard_audit_log WHERE action = $1`, [action])).rows;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|250000|260000|270000|310000)_|^20261014500000_|^20261015050000_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','dr-client','Synthetic Request Client'),('${T}','${OTHER}','dr-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people).filter(p => p.id !== 'dr-foreign'))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','dr-foreign','practice_manager','active');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  engagementId = (await practice.createEngagement(T, C, 'dr-mgr', 'dr-eng-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  engagement2024 = (await practice.createEngagement(T, C, 'dr-mgr', 'dr-eng-0', { title: 'Synthetic 2024 return', type: 'tax_preparation', taxYears: [2024] })).engagementId;
  otherEngagement = (await practice.createEngagement(T, OTHER, 'dr-mgr', 'dr-eng-2', { title: 'Other 2025', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  for (const e of [engagementId, engagement2024]) await practice.setEngagementStatus(T, C, 'dr-mgr', e, 'active', 1);
  await practice.assign(T, C, 'dr-mgr', 'dr-asg-1', { engagementId, taxYear: 2025, role: 'preparer', userId: 'dr-acct', reason: 'Initial staffing' });
  await practice.assign(T, C, 'dr-mgr', 'dr-asg-2', { engagementId, taxYear: 2025, role: 'reviewer', userId: 'dr-rev', reason: 'Initial staffing' });
  await practice.assign(T, C, 'dr-mgr', 'dr-asg-3', { engagementId, taxYear: 2025, role: 'bookkeeper', userId: 'dr-bk', reason: 'Initial staffing' });
  void otherEngagement;
  cases = new CaseStore(pgliteRpc(() => fixture.pg));
  const objects = new Map<string, Buffer>();
  const storage: VaultStorage = { async put(p, b) { objects.set(p, b); }, async signedUrl(p) { return 'https://storage.invalid/' + encodeURIComponent(p); } };
  const scanner: MalwareScanner = { name: 'synthetic-clean', async scan() { return 'CLEAN'; } };
  const app = express();
  app.use('/vault', createVaultRouter({ store: () => new DocumentVaultStore(pgliteRpc(() => fixture.pg), storage, scanner), requests: () => new DocumentRequestStore(pgliteRpc(() => fixture.pg)),
    authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 90000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

describe('checklist templates and engagement-year requests', () => {
  it('lets only managers define firm checklists, and applies them idempotently to one engagement year', async () => {
    const template = { templateId: 'individual-basic', name: 'Individual return basics (firm-defined)', items: [
      { title: 'Wage statements', category: 'income', required: true }, { title: 'Prior-year return', category: 'prior_return', required: false },
      { title: 'Photo identification', category: 'identity', required: true, acceptedTypes: ['image/jpeg', 'image/png', 'application/pdf'] }] };
    as('acct'); expect((await call('POST', '/request-templates', template)).body.code).toBe('DOC_REQUEST_MANAGER_REQUIRED');
    as('mgr'); expect((await call('POST', '/request-templates', template)).body).toMatchObject({ templateId: 'individual-basic', version: 1 });
    expect((await call('POST', '/request-templates', { ...template, items: [{ title: 'x', category: 'income' }] })).body.code).toBe('DOC_REQUEST_INPUT_INVALID');
    as('acct');
    const applied = await call('POST', `/clients/${C}/requests/apply-template`, { templateId: 'individual-basic', engagementId, taxYear: 2025, dueDate: '2026-03-01' });
    expect(applied.body.created).toBe(3);
    expect((await call('POST', `/clients/${C}/requests/apply-template`, { templateId: 'individual-basic', engagementId, taxYear: 2025 })).body.created).toBe(0);
    expect((await call('POST', `/clients/${C}/requests/apply-template`, { templateId: 'individual-basic', engagementId, taxYear: 2023 })).body.code).toBe('ENGAGEMENT_YEAR_NOT_OPEN');
    const list = (await call('GET', `/clients/${C}/requests?taxYear=2025`)).body.items;
    expect(list.map((r: any) => [r.title, r.required, r.status, r.dueDate])).toEqual([['Wage statements', true, 'OPEN', '2026-03-01'],
      ['Photo identification', true, 'OPEN', '2026-03-01'], ['Prior-year return', false, 'OPEN', '2026-03-01']]);
    expect((await audits('DOC_REQUEST_CREATED')).every(a => a.metadata.clientId === C)).toBe(true);
  });

  it('creates ad-hoc requests with upload requirements; clients, bookkeepers and outsiders cannot', async () => {
    as('acct');
    const r = await call('POST', `/clients/${C}/requests`, { engagementId, taxYear: 2025, title: 'Brokerage statement', category: 'income', acceptedTypes: ['application/pdf'], minDocuments: 2,
      instructions: 'Upload both synthetic statements.' }, 'dr-adhoc-1');
    expect(r.status).toBe(201); expect(r.body).toMatchObject({ created: true, minDocuments: 2, acceptedTypes: ['application/pdf'] });
    expect((await call('POST', `/clients/${C}/requests`, { engagementId, taxYear: 2025, title: 'Brokerage statement', category: 'income' }, 'dr-adhoc-1')).body.created).toBe(false);
    expect((await call('POST', `/clients/${C}/requests`, { engagementId, taxYear: 2025, title: 'Bad type', category: 'income', acceptedTypes: ['application/x-msdownload'] })).body.code).toBe('DOC_REQUEST_INPUT_INVALID');
    for (const who of ['client', 'bk', 'outsider']) {
      as(who); const denied = await call('POST', `/clients/${C}/requests`, { engagementId, taxYear: 2025, title: 'Attempt', category: 'income' });
      expect(denied.status, who).toBeGreaterThanOrEqual(403);
    }
    as('foreign', 'tenantB'); expect((await call('GET', `/clients/${C}/requests`)).status).toBeGreaterThanOrEqual(403);
    as('other'); expect((await call('GET', `/clients/${C}/requests`)).status).toBe(404);
    as('client');
    const own = (await call('GET', `/clients/${C}/requests`)).body.items;
    expect(own).toHaveLength(4); expect(JSON.stringify(own)).not.toMatch(/createdBy|resolutionReason|dr-acct/);
  });
});

describe('fulfilment through uploads and staff review', () => {
  const req = async (title: string) => { as('acct'); return (await call('GET', `/clients/${C}/requests?taxYear=2025`)).body.items.find((r: any) => r.title === title); };
  it('links a client upload, enforces scope and requirements, and fulfils only after independent review', async () => {
    as('client');
    const wages = await req('Wage statements'); as('client');
    const w2 = (await upload(engagementId, 2025, 'income')).body;
    const wrongCategory = (await upload(engagementId, 2025, 'deductions')).body;
    const wrongYear = (await upload(engagement2024, 2024, 'income')).body;
    expect((await call('POST', `/clients/${C}/requests/${wages.requestId}/link`, { documentId: wrongCategory.documentId, version: 1 })).body.code).toBe('DOC_REQUEST_REQUIREMENT_NOT_MET');
    expect((await call('POST', `/clients/${C}/requests/${wages.requestId}/link`, { documentId: wrongYear.documentId, version: 1 })).body.code).toBe('DOC_REQUEST_SCOPE_MISMATCH');
    const linked = await call('POST', `/clients/${C}/requests/${wages.requestId}/link`, { documentId: w2.documentId, version: 1 });
    expect(linked.body).toMatchObject({ status: 'SUBMITTED', documents: [{ documentId: w2.documentId, status: 'PENDING_REVIEW' }] });
    as('other'); expect((await call('POST', `/clients/${C}/requests/${wages.requestId}/link`, { documentId: w2.documentId, version: 1 })).status).toBe(404);
    as('rev');
    const queue = (await call('GET', '/requests/review-queue')).body.items;
    expect(queue.map((d: any) => [d.documentId, d.requestTitle, d.requestRequired])).toEqual([[w2.documentId, 'Wage statements', true]]);
    as('bk'); expect((await call('GET', '/requests/review-queue')).status).toBe(403);
    as('rev');
    expect((await call('POST', `/clients/${C}/documents/${w2.documentId}/versions/1/review`, { decision: 'approve', rowVersion: 3 })).body.status).toBe('VERIFIED');
    expect((await req('Wage statements')).status).toBe('FULFILLED');
    expect((await audits('DOC_REQUEST_STATUS_CHANGED')).map(a => a.metadata.to)).toEqual(['SUBMITTED', 'FULFILLED']);
    // A fulfilled request accepts no further links.
    as('client'); expect((await call('POST', `/clients/${C}/requests/${wages.requestId}/link`, { documentId: wrongCategory.documentId, version: 1 })).body.code).toBe('DOC_REQUEST_CLOSED');
  });

  it('reopens a request when staff ask for a replacement, and notifies the client in-app', async () => {
    const id = await req('Photo identification'); as('client');
    const doc = (await upload(engagementId, 2025, 'identity')).body;
    await call('POST', `/clients/${C}/requests/${id.requestId}/link`, { documentId: doc.documentId, version: 1 });
    as('rev');
    expect((await call('POST', `/clients/${C}/documents/${doc.documentId}/versions/1/review`, { decision: 'request_replacement', rowVersion: 3, note: 'Image is not legible' })).body.status)
      .toBe('REPLACEMENT_REQUESTED');
    expect((await req('Photo identification')).status).toBe('OPEN');
    as('client');
    const notes = (await call('GET', `/clients/${C}/notifications`)).body;
    expect(notes.items.map((x: any) => x.kind)).toEqual(expect.arrayContaining(['REQUEST_CREATED', 'REQUEST_FULFILLED', 'REPLACEMENT_REQUESTED']));
    expect(notes.items.every((x: any) => x.deliveryStatus === 'NOT_CONFIGURED' && x.channel === 'IN_APP')).toBe(true);
    expect(JSON.stringify(notes)).not.toMatch(/Image is not legible|%PDF/);
    const first = notes.items[0];
    expect((await call('POST', `/clients/${C}/notifications/${first.notificationId}/read`)).body.read).toBe(true);
    expect((await call('GET', `/clients/${C}/notifications?unreadOnly=true`)).body.unread).toBe(notes.unread - 1);
    as('acct'); expect((await call('POST', `/clients/${C}/notifications/${first.notificationId}/read`)).body.code).toBe('NOTIFICATION_CLIENT_ONLY');
    as('other'); expect((await call('GET', `/clients/${C}/notifications`)).status).toBe(404);
    await expect(fixture.pg.query(`UPDATE taxguard_client_notifications SET title = 'tampered' WHERE client_id = $1`, [C])).rejects.toThrow('NOTIFICATION_IMMUTABLE');
    await expect(fixture.pg.query(`DELETE FROM taxguard_doc_request_links WHERE client_id = $1`, [C])).rejects.toThrow('DOC_REQUEST_LINK_IMMUTABLE');
  });
});

describe('waivers, reminders and missing-document tracking', () => {
  it('lets only the reviewer or a manager waive a required request, with a reason and current version', async () => {
    as('acct');
    const items = (await call('GET', `/clients/${C}/requests?taxYear=2025`)).body.items;
    const id = items.find((r: any) => r.title === 'Photo identification');
    const prior = items.find((r: any) => r.title === 'Prior-year return');
    expect((await call('POST', `/clients/${C}/requests/${id.requestId}/waive`, { reason: 'Identity already verified in person', rowVersion: id.rowVersion })).body.code).toBe('DOC_REQUEST_WAIVER_REQUIRES_REVIEWER');
    expect((await call('POST', `/clients/${C}/requests/${prior.requestId}/waive`, { reason: 'Client is a new filer this year', rowVersion: prior.rowVersion })).body.status).toBe('WAIVED');
    as('rev');
    expect((await call('POST', `/clients/${C}/requests/${id.requestId}/waive`, { reason: 'short', rowVersion: id.rowVersion })).body.code).toBe('DOC_REQUEST_INPUT_INVALID');
    expect((await call('POST', `/clients/${C}/requests/${id.requestId}/waive`, { reason: 'Identity already verified in person', rowVersion: id.rowVersion - 1 })).body.code).toBe('DOC_REQUEST_VERSION_CONFLICT');
    expect((await call('POST', `/clients/${C}/requests/${id.requestId}/cancel`, { reason: 'Identity already verified in person', rowVersion: id.rowVersion })).body.code).toBe('DOC_REQUEST_MANAGER_REQUIRED');
    const waived = await call('POST', `/clients/${C}/requests/${id.requestId}/waive`, { reason: 'Identity already verified in person', rowVersion: id.rowVersion });
    expect(waived.body).toMatchObject({ status: 'WAIVED', resolvedBy: 'dr-rev', resolutionReason: 'Identity already verified in person' });
    as('client');
    const seen = (await call('GET', `/clients/${C}/requests?taxYear=2025`)).body.items.find((r: any) => r.requestId === id.requestId);
    expect(seen.status).toBe('WAIVED'); expect(seen.resolutionReason).toBeUndefined();
  });

  it('records reminders in-app at most once a day and tracks missing documents for visible clients only', async () => {
    as('acct');
    const brokerage = (await call('GET', `/clients/${C}/requests?taxYear=2025`)).body.items.find((r: any) => r.title === 'Brokerage statement');
    expect((await call('POST', `/clients/${C}/requests/${brokerage.requestId}/remind`)).body).toMatchObject({ delivery: 'IN_APP_ONLY' });
    expect((await call('POST', `/clients/${C}/requests/${brokerage.requestId}/remind`)).status).toBe(429);
    await fixture.pg.query(`UPDATE taxguard_doc_requests SET due_date = current_date - 3 WHERE request_id = $1`, [brokerage.requestId]);
    const missing = (await call('GET', '/requests/missing?taxYear=2025')).body;
    expect(missing.items.map((r: any) => [r.title, r.overdue])).toEqual([['Brokerage statement', true]]);
    expect(missing.summary).toEqual([{ clientId: C, engagementId, taxYear: 2025, open: 1, submitted: 0, overdue: 1, requiredOutstanding: 1 }]);
    expect((await call('GET', '/requests/missing?overdueOnly=true')).body.items).toHaveLength(1);
    as('outsider'); expect((await call('GET', '/requests/missing')).body.items).toEqual([]);
    as('bk'); expect((await call('GET', '/requests/missing')).status).toBe(403);
    as('client'); expect((await call('GET', '/requests/missing')).status).toBe(403);
  });
});

describe('case stage 2 and 3 integration', () => {
  it('blocks the stage 2 attestation while a required request is outstanding and stage 3 while documents await review', async () => {
    const created = await cases.create(T, C, 'dr-mgr', 'dr-case-1', { engagementId, taxYear: 2025, returnFamily: '1040' });
    let detail = await cases.detail(T, created.caseId, 'dr-mgr');
    let version = detail.case.version;
    version = (await cases.advance(T, created.caseId, 'dr-acct', 1, version)).version;
    const attest2 = { confirmed: ['documents_received_or_waived', 'documents_in_private_storage'], statement: 'Synthetic reviewer attestation for testing.' };
    await expect(cases.advance(T, created.caseId, 'dr-rev', 2, version, attest2)).rejects.toMatchObject({ code: 'STAGE_GATE_NOT_MET', failedChecks: ['requiredDocumentRequestsResolved'] });
    as('rev');
    const brokerage = (await call('GET', `/clients/${C}/requests?taxYear=2025`)).body.items.find((r: any) => r.title === 'Brokerage statement');
    await call('POST', `/clients/${C}/requests/${brokerage.requestId}/waive`, { reason: 'Account closed before the tax year', rowVersion: brokerage.rowVersion });
    version = (await cases.advance(T, created.caseId, 'dr-rev', 2, version, attest2)).version;
    as('client'); await upload(engagementId, 2025, 'correspondence');
    const attest3 = { confirmed: ['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved'], statement: 'Synthetic reviewer attestation for testing.' };
    await expect(cases.advance(T, created.caseId, 'dr-rev', 3, version, attest3)).rejects.toMatchObject({ code: 'STAGE_GATE_NOT_MET', failedChecks: ['noDocumentsAwaitingReview'] });
    const pending = (await fixture.pg.query<{ document_id: string; row_version: number }>(`SELECT document_id, row_version FROM taxguard_documents WHERE client_id = $1 AND status = 'PENDING_REVIEW'`, [C])).rows;
    as('rev');
    for (const d of pending) await call('POST', `/clients/${C}/documents/${d.document_id}/versions/1/review`, { decision: 'approve', rowVersion: d.row_version });
    expect((await cases.advance(T, created.caseId, 'dr-rev', 3, version, attest3)).activeStage).toBe(4);
    detail = await cases.detail(T, created.caseId, 'dr-mgr');
    const stage2 = detail.events.find((e: any) => e.toStage === 3);
    expect(stage2.evidence.checks).toMatchObject({ requiredDocumentRequestsResolved: true, noDocumentsAwaitingScan: true });
  });
});

describe('database security', () => {
  it('exposes only service RPCs to the service role and nothing to anon or authenticated', async () => {
    const rows = (await fixture.pg.query<{ proname: string; svc: boolean; anon: boolean; auth: boolean }>(`SELECT p.proname, has_function_privilege('service_role', p.oid, 'EXECUTE') svc,
      has_function_privilege('anon', p.oid, 'EXECUTE') anon, has_function_privilege('authenticated', p.oid, 'EXECUTE') auth FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND (p.proname LIKE 'taxguard\\_docreq\\_%' OR p.proname LIKE 'taxguard\\_client\\_notification%' OR p.proname = 'taxguard_case_evidence_checks')`)).rows;
    expect(rows.filter(r => r.anon || r.auth)).toEqual([]);
    expect(rows.filter(r => r.svc).map(r => r.proname).sort()).toEqual(['taxguard_client_notification_mark_read', 'taxguard_client_notifications_list', 'taxguard_docreq_apply_template',
      'taxguard_docreq_create', 'taxguard_docreq_link', 'taxguard_docreq_list', 'taxguard_docreq_missing', 'taxguard_docreq_remind', 'taxguard_docreq_resolve',
      'taxguard_docreq_review_queue', 'taxguard_docreq_template_list', 'taxguard_docreq_template_upsert']);
    for (const table of ['taxguard_doc_requests', 'taxguard_doc_request_links', 'taxguard_client_notifications', 'taxguard_docreq_templates'])
      expect((await fixture.pg.query<{ ok: boolean }>(`SELECT has_table_privilege('authenticated', 'public.${table}', 'SELECT') ok`)).rows[0].ok, table).toBe(false);
  });
});
