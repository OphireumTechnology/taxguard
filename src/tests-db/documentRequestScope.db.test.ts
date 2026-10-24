import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

// Engagement / tax-year scope of document requests at the database boundary (owner decision 2026-10-19): staff stay
// within their assigned client, engagement and year unless independently authorized (client-wide assignment, practice
// manager or administrator); clients see only their own requests, through the client projection. Synthetic data only.
const T = 'tenantDocReq', T2 = 'tenantDocReqOther', C = 'drClient', C2 = 'drClient2';
let E1 = '', E2 = '', E3 = ''; // engagement ids are derived by the practice store from the idempotency key
let db: TestDatabase;
const call = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e.code ?? String(e));
const hex = (n: number) => 'req_' + n.toString(16).padStart(32, '0');
const req = { a: hex(0xa1), b: hex(0xb1), c: hex(0xc1), d: hex(0xd1) }; // E1/2025, E2/2025, E1/2024, E2/2025 optional
const create = (actor: string, id: string, engagementId: string, taxYear: number, extra: Record<string, unknown> = {}) => call('taxguard_docreq_create',
  { p_tenant: T, p_client: C, p_actor: actor, p_id: id, p_request: { engagementId, taxYear, title: 'Synthetic wage statement', category: 'income', ...extra } });
const list = async (actor: string, client = C, tenant = T, year: number | null = null) =>
  (await call('taxguard_docreq_list', { p_tenant: tenant, p_client: client, p_actor: actor, p_engagement: null, p_year: year })) as any[];
const ids = async (actor: string, year: number | null = null) => (await list(actor, C, T, year)).map(q => q.requestId).sort();
const rowVersion = async (id: string) => (await db.pool.query('SELECT row_version FROM taxguard_doc_requests WHERE tenant_id = $1 AND request_id = $2', [T, id])).rows[0].row_version;
const resolve = async (actor: string, id: string, action: string) => call('taxguard_docreq_resolve', { p_tenant: T, p_client: C, p_actor: actor, p_request: id, p_action: action,
  p_reason: 'Synthetic resolution reason', p_row_version: await rowVersion(id) });
const remind = (actor: string, id: string) => call('taxguard_docreq_remind', { p_tenant: T, p_client: C, p_actor: actor, p_request: id });
const link = (actor: string, id: string, documentId: string) => call('taxguard_docreq_link', { p_tenant: T, p_client: C, p_actor: actor, p_request: id, p_document_id: documentId, p_version: 1 });
const apply = (actor: string, engagement: string, year: number) => call('taxguard_docreq_apply_template',
  { p_tenant: T, p_client: C, p_actor: actor, p_template: 'dr-checklist', p_engagement: engagement, p_year: year, p_due: null });
async function doc(id: string, engagement: string, year: number, status: string, createdBy: string) {
  await db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, version, hash, mime_type, status, quarantine_status, category, created_by, storage_path, file_name)
    VALUES ($1::text, $2::text, $3::text, $4::text, $5::integer, 1, repeat('d', 64), 'application/pdf', $6::text, 'CLEAN', 'income', $7::text, 'vault/' || $1::text, $1::text || '.pdf')`,
    [id, T, C, engagement, year, status, createdBy]);
}

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic request practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'dr-client', 'Synthetic Request Client'), ('${T}', '${C2}', 'dr-client2', 'Other Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'dr-mgr', 'practice_manager', 'active', NULL), ('${T}', 'dr-prep', 'accountant', 'active', NULL),
      ('${T}', 'dr-wide', 'accountant', 'active', NULL), ('${T}', 'dr-stale', 'accountant', 'active', NULL), ('${T}', 'dr-revoked', 'accountant', 'active', NULL),
      ('${T}', 'dr-other', 'accountant', 'active', NULL), ('${T}', 'dr-client', 'client', 'active', '${C}'), ('${T}', 'dr-client2', 'client', 'active', '${C2}'),
      ('${T2}', 'dr-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const created: string[] = [];
  for (const [key, years] of [['dr-engagement-1', [2025, 2024]], ['dr-engagement-2', [2025]]] as const) {
    const id = (await practice.createEngagement(T, C, 'dr-mgr', key, { title: 'Synthetic ' + key, type: 'tax_preparation', taxYears: [...years] })).engagementId;
    await practice.setEngagementStatus(T, C, 'dr-mgr', id, 'active', 1);
    created.push(id);
  }
  [E1, E2] = created;
  E3 = (await practice.createEngagement(T, C2, 'dr-mgr', 'dr-c2-engagement', { title: 'Synthetic other', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.assign(T, C, 'dr-mgr', 'dr-assign-prep', { engagementId: E1, taxYear: 2025, role: 'preparer', userId: 'dr-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C2, 'dr-mgr', 'dr-assign-other', { engagementId: E3, taxYear: 2025, role: 'preparer', userId: 'dr-other', reason: 'Synthetic staffing' });
  await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from, effective_to) VALUES
      ('dr-wide-1', '${T}', '${C}', NULL, NULL, 'reviewer', 'dr-wide', 'dr-mgr', 'ACTIVE', now() - interval '1 day', NULL),
      ('dr-stale-1', '${T}', '${C}', '${E1}', 2025, 'bookkeeper', 'dr-stale', 'dr-mgr', 'ACTIVE', now() - interval '10 days', now() - interval '1 day'),
      ('dr-revoked-1', '${T}', '${C}', '${E1}', 2025, 'reviewer', 'dr-revoked', 'dr-mgr', 'REVOKED', now() - interval '10 days', NULL);`);
  await create('dr-mgr', req.a, E1, 2025); await create('dr-mgr', req.b, E2, 2025); await create('dr-mgr', req.c, E1, 2024);
  await create('dr-mgr', req.d, E2, 2025, { required: false, title: 'Synthetic optional statement' });
  await call('taxguard_docreq_template_upsert', { p_tenant: T, p_actor: 'dr-mgr', p_template: { templateId: 'dr-checklist', name: 'Synthetic checklist',
    items: [{ title: 'Synthetic brokerage statement', category: 'income' }] } });
  await apply('dr-mgr', E1, 2024);
  await doc('dr-doc-a', E1, 2025, 'PENDING_REVIEW', 'dr-client'); await doc('dr-doc-b', E2, 2025, 'PENDING_REVIEW', 'dr-client');
  await link('dr-client', req.a, 'dr-doc-a'); await link('dr-client', req.b, 'dr-doc-b');
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('document requests: an engagement-year assignee reaches only that engagement and year', () => {
  it('lists only its engagement-year requests; whole-client staff, managers and the client see all of the client', async () => {
    expect(await ids('dr-prep')).toEqual([req.a]);
    expect(await ids('dr-prep', 2024)).toEqual([]);
    const all = await ids('dr-mgr');
    expect(all).toHaveLength(5);
    expect(await ids('dr-wide')).toEqual(all);
    expect(await ids('dr-client')).toEqual(all);
  });

  it('creates only in its engagement year, and never replays a request from outside it', async () => {
    expect(await code(create('dr-prep', hex(0xe1), E2, 2025))).toBe('ENGAGEMENT_YEAR_NOT_OPEN');
    expect(await code(create('dr-prep', hex(0xe2), E1, 2024))).toBe('ENGAGEMENT_YEAR_NOT_OPEN');
    // Reusing an existing out-of-scope request id must not return that request.
    expect(await code(create('dr-prep', req.b, E1, 2025))).toBe('ENGAGEMENT_YEAR_NOT_OPEN');
    expect((await create('dr-prep', hex(0xe3), E1, 2025)).created).toBe(true);
    // Template request ids are deterministic; applying the template to another year must not replay that year's requests.
    expect(await code(apply('dr-prep', E1, 2024))).toBe('ENGAGEMENT_YEAR_NOT_OPEN');
    expect((await apply('dr-prep', E1, 2025)).created).toBe(1);
    expect((await apply('dr-wide', E2, 2025)).created).toBe(1);
  });

  it('attaches, waives, cancels and reminds only in scope, with the same answer as a missing request', async () => {
    await doc('dr-doc-b2', E2, 2025, 'PENDING_REVIEW', 'dr-prep');
    expect(await code(link('dr-prep', req.b, 'dr-doc-b2'))).toBe('DOC_REQUEST_NOT_FOUND');
    expect(await code(resolve('dr-prep', req.d, 'waive'))).toBe('DOC_REQUEST_NOT_FOUND');
    expect(await code(remind('dr-prep', req.b))).toBe('DOC_REQUEST_NOT_FOUND');
    expect((await db.pool.query(`SELECT status, last_reminded_at FROM taxguard_doc_requests WHERE request_id = $1`, [req.d])).rows[0]).toEqual({ status: 'OPEN', last_reminded_at: null });
    expect((await remind('dr-prep', req.a)).delivery).toBe('IN_APP_ONLY');
    expect((await resolve('dr-wide', req.d, 'waive')).status).toBe('WAIVED');
    expect((await resolve('dr-mgr', req.c, 'cancel')).status).toBe('CANCELLED');
  });

  it('missing-documents and review queues hold only engagement years in scope', async () => {
    const missing = await call('taxguard_docreq_missing', { p_tenant: T, p_actor: 'dr-prep', p_filter: {} });
    expect(new Set(missing.items.map((i: any) => `${i.engagementId}/${i.taxYear}`))).toEqual(new Set([`${E1}/2025`]));
    expect(missing.summary.map((s: any) => `${s.engagementId}/${s.taxYear}`)).toEqual([`${E1}/2025`]);
    const queue = ((await call('taxguard_docreq_review_queue', { p_tenant: T, p_actor: 'dr-prep', p_limit: 50 })) as any[]).map(d => d.documentId);
    expect(queue).toEqual(['dr-doc-a']);
    const wide = ((await call('taxguard_docreq_review_queue', { p_tenant: T, p_actor: 'dr-wide', p_limit: 50 })) as any[]).map(d => d.documentId).sort();
    expect(wide).toEqual(['dr-doc-a', 'dr-doc-b']);
  });

  it('stale, revoked, other-client and other-tenant staff reach nothing; revocation ends access at once', async () => {
    for (const actor of ['dr-stale', 'dr-revoked', 'dr-other']) expect(await code(list(actor)), actor).toBe('DOCUMENT_NOT_FOUND');
    expect(await code(list('dr-foreign', C, T2))).not.toBe('OK');
    expect(await code(list('dr-foreign'))).not.toBe('OK');
    await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
      VALUES ('dr-temp-1', '${T}', '${C}', '${E2}', 2025, 'preparer', 'dr-revoked', 'dr-mgr', 'ACTIVE', now() - interval '1 hour')`);
    expect((await list('dr-revoked')).every(q => q.engagementId === E2 && q.taxYear === 2025)).toBe(true);
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE id = 'dr-temp-1'`);
    expect(await code(list('dr-revoked'))).toBe('DOCUMENT_NOT_FOUND');
  });
});

describe('document requests: clients see only their own, through the client projection', () => {
  it('a client of another client is refused; cancelled requests and staff fields never reach a client', async () => {
    expect(await code(list('dr-client2'))).toBe('DOCUMENT_NOT_FOUND');
    const mine = await list('dr-client');
    expect(mine.map(q => q.requestId)).not.toContain(req.c);
    for (const q of mine) for (const k of ['createdBy', 'templateId', 'resolutionReason', 'resolvedBy', 'lastRemindedAt']) expect(q, k).not.toHaveProperty(k);
    expect((await list('dr-mgr')).find(q => q.requestId === req.c)).toMatchObject({ status: 'CANCELLED', createdBy: 'dr-mgr' });
  });

  it('a staff-uploaded document later rejected as malware is not shown to the client, as in the vault', async () => {
    await doc('dr-doc-a2', E1, 2025, 'PENDING_REVIEW', 'dr-prep');
    await link('dr-prep', req.a, 'dr-doc-a2');
    await db.pool.query(`UPDATE taxguard_documents SET status = 'REJECTED_MALWARE', quarantine_status = 'INFECTED' WHERE document_id = 'dr-doc-a2'`);
    const forClient = (await list('dr-client')).find(q => q.requestId === req.a)!.documents.map((d: any) => d.documentId);
    expect(forClient).toEqual(['dr-doc-a']);
    const forStaff = (await list('dr-prep')).find(q => q.requestId === req.a)!.documents.map((d: any) => d.documentId);
    expect(forStaff).toEqual(['dr-doc-a', 'dr-doc-a2']);
  });
});
