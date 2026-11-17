import express from 'express';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createLegalMattersRouter } from '../server/routes/legal-durable.routes';
import { LEGAL_DISCLAIMER_VERSION, LegalMatterStore } from '../server/taxguard/legal/legalMatterStore';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals, pgliteRpc } from './helpers/pgliteRpc';

// HTTP -> /api/legal-matters -> LegalMatterStore -> proposal 042 (PGlite) composed with 024-027.
// Tracking of coordination with independent attorneys; synthetic matters and documents only.
const T = 'tenantA', C = 'lgClient', OTHER = 'lgOther';
const people: Record<string, any> = { mgr: { id: 'lg-mgr', role: 'practice_manager' }, acct: { id: 'lg-acct', role: 'accountant' }, outsider: { id: 'lg-outsider', role: 'accountant' },
  bk: { id: 'lg-bk', role: 'bookkeeper' }, client: { id: 'lg-client', role: 'client', clientId: C }, other: { id: 'lg-other', role: 'client', clientId: OTHER },
  foreign: { id: 'lg-foreign', role: 'practice_manager' } };
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
let server: Server; let origin: string; let user: any; let n = 0; let engagementId = '';
const as = (who: string, tenantId = T) => { user = { ...people[who], tenantId, status: 'active' }; };
const call = (method: 'GET' | 'POST', path: string, body?: unknown, key: string | null = `lg-key-${++n}-${Date.now()}`) => fetch(origin + '/legal' + path, { method,
  headers: { 'content-type': 'application/json', ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  .then(async r => ({ status: r.status, body: await r.json().catch(() => null) as any }));
const intake = { category: 'estate_trust', title: 'Synthetic trust coordination', summary: 'Synthetic intake summary', disclaimerAcknowledged: true, disclaimerVersion: LEGAL_DISCLAIMER_VERSION };
const doc = (id: string, createdBy: string, quarantine: string, status: string) => `INSERT INTO taxguard_documents(document_id,tenant_id,client_id,engagement_id,tax_year,case_id,version,hash,mime_type,status,
  quarantine_status,created_by,file_name) VALUES('${id}','${T}','${C}','${engagementId}',2025,NULL,1,'${'d'.repeat(64)}','application/pdf','${status}','${quarantine}','${createdBy}','${id}.pdf');`;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^2026101(2(240000|250000|260000|270000)|4420000)_/);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id,client_id,owner_uid,name) VALUES('${T}','${C}','lg-client','Synthetic Legal Client'),('${T}','${OTHER}','lg-other','Other Synthetic');
    INSERT INTO taxguard_members(tenant_id,uid,role,status,client_id) SELECT '${T}', v->>'id', v->>'role', 'active', v->>'clientId' FROM jsonb_array_elements('${JSON.stringify(Object.values(people).filter(p => p.id !== 'lg-foreign'))}'::jsonb) v;
    INSERT INTO taxguard_members(tenant_id,uid,role,status) VALUES('tenantB','lg-foreign','practice_manager','active');`);
  const practice = new PracticeStore(pgliteRpc(() => fixture.pg));
  engagementId = (await practice.createEngagement(T, C, 'lg-mgr', 'lg-eng-1', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'lg-mgr', engagementId, 'active', 1);
  await practice.assign(T, C, 'lg-mgr', 'lg-asg-1', { engagementId, taxYear: 2025, role: 'preparer', userId: 'lg-acct', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'lg-mgr', 'lg-asg-2', { engagementId, taxYear: 2025, role: 'bookkeeper', userId: 'lg-bk', reason: 'Synthetic staffing' });
  await fixture.pg.exec(doc('lg-doc-clean', 'lg-client', 'CLEAN', 'PENDING_REVIEW') + doc('lg-doc-staff', 'lg-acct', 'CLEAN', 'VERIFIED') + doc('lg-doc-infected', 'lg-client', 'INFECTED', 'REJECTED_MALWARE')
    + doc('lg-doc-rejected', 'lg-client', 'CLEAN', 'REJECTED'));
  const app = express(); app.use(express.json());
  app.use('/legal', createLegalMattersRouter({ store: () => new LegalMatterStore(pgliteRpc(() => fixture.pg)), authenticate: (req: any, _res, next) => { req.user = user; next(); } }));
  server = createServer(app); await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
}, 120000);
afterAll(async () => { server?.closeAllConnections(); await new Promise<void>(r => server ? server.close(() => r()) : r()); await fixture?.pg.close(); });

let matter: any;
describe('legal coordination matters', () => {
  it('requires the statutory disclaimer at intake and keeps matters within the client', async () => {
    as('client');
    expect((await call('GET', '/disclaimer')).body.version).toBe(LEGAL_DISCLAIMER_VERSION);
    expect((await call('POST', `/clients/${C}/matters`, { ...intake, disclaimerAcknowledged: false })).body.code).toBe('LEGAL_DISCLAIMER_REQUIRED');
    expect((await call('POST', `/clients/${C}/matters`, { ...intake, disclaimerVersion: 'old' })).body.code).toBe('LEGAL_DISCLAIMER_REQUIRED');
    const r = await call('POST', `/clients/${C}/matters`, { ...intake, engagementId }, 'lg-intake-key-1');
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ status: 'INTAKE', category: 'estate_trust', disclaimerVersion: LEGAL_DISCLAIMER_VERSION, version: 1, replayed: false });
    expect(r.body.createdBy).toBeUndefined(); expect(r.body.history).toBeUndefined();
    matter = r.body;
    expect((await call('POST', `/clients/${C}/matters`, { ...intake, engagementId }, 'lg-intake-key-1')).body).toMatchObject({ matterId: matter.matterId, replayed: true });
    expect((await call('POST', `/clients/${C}/matters`, { ...intake, category: 'divorce' })).status).toBe(400);
    expect((await call('POST', `/clients/${OTHER}/matters`, intake)).status).toBe(404);
    expect((await call('POST', `/clients/${C}/matters`, { ...intake, engagementId: 'not-mine' })).body.code).toBe('LEGAL_SCOPE_MISMATCH');
  });

  it('refuses other clients, unassigned staff, bookkeepers and other tenants', async () => {
    as('other'); expect((await call('GET', `/clients/${C}/matters`)).status).toBe(404);
    as('outsider'); expect((await call('GET', `/clients/${C}/matters`)).status).toBe(404);
    as('bk'); expect((await call('GET', `/clients/${C}/matters`)).body.code).toBe('LEGAL_STAFF_REQUIRED');
    as('foreign', 'tenantB'); expect((await call('GET', `/clients/${C}/matters`)).status).toBeGreaterThanOrEqual(403);
  });

  it('moves only forward in the defined order, staff-only, with counsel recorded before transmittal', async () => {
    as('client');
    expect((await call('POST', `/clients/${C}/matters/${matter.matterId}/status`, { version: 1, action: 'advance' })).body.code).toBe('LEGAL_STAFF_REQUIRED');
    as('acct');
    const reviewing = await call('POST', `/clients/${C}/matters/${matter.matterId}/status`, { version: 1, action: 'advance' }, 'lg-advance-1');
    expect(reviewing.body).toMatchObject({ status: 'REVIEWING', version: 2 });
    expect((await call('POST', `/clients/${C}/matters/${matter.matterId}/status`, { version: 1, action: 'advance' }, 'lg-advance-1')).body.replayed).toBe(true);
    expect((await call('POST', `/clients/${C}/matters/${matter.matterId}/status`, { version: 1, action: 'advance' })).body.code).toBe('LEGAL_VERSION_CONFLICT');
    expect((await call('POST', `/clients/${C}/matters/${matter.matterId}/status`, { version: 2, action: 'advance' })).body.code).toBe('LEGAL_COUNSEL_REQUIRED');
    expect((await call('POST', `/clients/${C}/matters/${matter.matterId}/update`, { version: 2, fields: { status: 'COMPLETED' } })).body.code).toBe('LEGAL_FIELD_NOT_EDITABLE');
    const counsel = await call('POST', `/clients/${C}/matters/${matter.matterId}/update`, { version: 2, fields: { externalAttorney: 'Synthetic Attorney', lawFirm: 'Synthetic Law LLP', filingDeadline: '2026-12-31' } });
    expect(counsel.body).toMatchObject({ externalAttorney: 'Synthetic Attorney', filingDeadline: '2026-12-31', version: 3 });
    for (const [version, status] of [[3, 'TRANSMITTED_TO_COUNSEL'], [4, 'COUNSEL_REVIEW'], [5, 'COMPLETED']] as const)
      expect((await call('POST', `/clients/${C}/matters/${matter.matterId}/status`, { version, action: 'advance' })).body.status).toBe(status);
    expect((await call('POST', `/clients/${C}/matters/${matter.matterId}/status`, { version: 6, action: 'cancel', reason: 'Synthetic late cancel' })).body.code).toBe('LEGAL_MATTER_CLOSED');
    const listed = (await call('GET', `/clients/${C}/matters`)).body.find((m: any) => m.matterId === matter.matterId);
    expect(listed.history.map((e: any) => e.action)).toEqual(['MATTER_OPENED', 'STATUS_REVIEWING', 'UPDATED', 'STATUS_TRANSMITTED_TO_COUNSEL', 'STATUS_COUNSEL_REVIEW', 'STATUS_COMPLETED']);
  });

  it('links only eligible vault documents of the same client; clients only their own uploads', async () => {
    as('acct');
    const open = (await call('POST', `/clients/${C}/matters`, { ...intake, title: 'Synthetic power of attorney', category: 'power_of_attorney' })).body;
    as('client');
    expect((await call('POST', `/clients/${C}/matters/${open.matterId}/documents`, { documentId: 'lg-doc-staff', version: 1 })).body.code).toBe('LEGAL_DOCUMENT_NOT_ELIGIBLE');
    expect((await call('POST', `/clients/${C}/matters/${open.matterId}/documents`, { documentId: 'lg-doc-infected', version: 1 })).body.code).toBe('LEGAL_DOCUMENT_NOT_ELIGIBLE');
    expect((await call('POST', `/clients/${C}/matters/${open.matterId}/documents`, { documentId: 'lg-doc-rejected', version: 1 })).body.code).toBe('LEGAL_DOCUMENT_NOT_ELIGIBLE');
    expect((await call('POST', `/clients/${C}/matters/${open.matterId}/documents`, { documentId: 'lg-doc-missing', version: 1 })).body.code).toBe('LEGAL_DOCUMENT_NOT_FOUND');
    const linked = await call('POST', `/clients/${C}/matters/${open.matterId}/documents`, { documentId: 'lg-doc-clean', version: 1 });
    expect(linked.body.documents.map((d: any) => d.documentId)).toEqual(['lg-doc-clean']);
    as('acct');
    expect((await call('POST', `/clients/${C}/matters/${open.matterId}/documents`, { documentId: 'lg-doc-staff', version: 1 })).body.documents).toHaveLength(2);
    // Cancel needs a reason; the client view never carries staff identities or history.
    expect((await call('POST', `/clients/${C}/matters/${open.matterId}/status`, { version: 3, action: 'cancel', reason: 'no' })).body.code).toBe('LEGAL_REASON_REQUIRED');
    expect((await call('POST', `/clients/${C}/matters/${open.matterId}/status`, { version: 3, action: 'cancel', reason: 'Synthetic: client withdrew' })).body.status).toBe('CANCELLED');
    as('client');
    const text = JSON.stringify((await call('GET', `/clients/${C}/matters`)).body);
    expect(text).not.toMatch(/lg-acct|history|createdBy|updatedBy/);
  });

  it('keeps history and evidence links append-only, audits identifiers only, and grants service_role only', async () => {
    await expect(fixture.pg.query(`UPDATE taxguard_legal_matter_events SET action = 'X'`)).rejects.toThrow('LEGAL_HISTORY_IMMUTABLE');
    await expect(fixture.pg.query(`DELETE FROM taxguard_legal_matter_documents`)).rejects.toThrow('LEGAL_HISTORY_IMMUTABLE');
    await expect(fixture.pg.query(`DELETE FROM taxguard_legal_matters`)).rejects.toThrow(/LEGAL_MATTER_IMMUTABLE|foreign key/);
    const audit = (await fixture.pg.query<{ metadata: any }>(`SELECT metadata FROM taxguard_audit_log WHERE action LIKE 'LEGAL_%'`)).rows;
    expect(audit.length).toBeGreaterThan(5);
    expect(JSON.stringify(audit)).not.toMatch(/Synthetic intake summary|Synthetic Attorney|client withdrew/);
    const rows = (await fixture.pg.query<{ proname: string; anon: boolean; auth: boolean; svc: boolean }>(`SELECT p.proname, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
      has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth, has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc FROM pg_proc p
      WHERE p.proname LIKE 'taxguard\\_legal\\_%' ORDER BY 1`)).rows;
    expect(rows.filter(r => r.anon || r.auth)).toEqual([]);
    expect(rows.filter(r => r.svc).map(r => r.proname)).toEqual(['taxguard_legal_create', 'taxguard_legal_link_document', 'taxguard_legal_list', 'taxguard_legal_transition', 'taxguard_legal_update']);
  });
});
