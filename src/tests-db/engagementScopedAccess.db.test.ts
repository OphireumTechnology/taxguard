import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';

// Engagement / tax-year scoped staff access at the database boundary (owner decision 2026-10-19): a staff member
// assigned to one engagement and tax year reaches that client's records for that engagement and year only, unless
// independently authorized (client-wide assignment, practice manager or administrator). Synthetic data only.
const T = 'tenantScope', T2 = 'tenantScopeOther', C = 'scClient', C2 = 'scClient2';
let E1 = '', E2 = ''; // engagement ids are derived by the practice store from the idempotency key
let db: TestDatabase;
const call = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e.code ?? String(e));
const docs = async (actor: string, year: number | null, client = C, tenant = T) =>
  ((await call('taxguard_doc_list', { p_tenant: tenant, p_client: client, p_actor: actor, p_tax_year: year })) as any[]).map(d => d.documentId).sort();
const detail = (actor: string, id: string) => call('taxguard_doc_detail', { p_tenant: T, p_client: C, p_actor: actor, p_document_id: id });
const download = (actor: string, id: string) => call('taxguard_doc_authorize_download', { p_tenant: T, p_client: C, p_actor: actor, p_document_id: id, p_version: 1 });
const rowVersion = async (id: string) => (await db.pool.query('SELECT row_version FROM taxguard_documents WHERE tenant_id = $1 AND document_id = $2', [T, id])).rows[0].row_version;
const review = async (actor: string, id: string) => call('taxguard_doc_review_with_reason', { p_tenant: T, p_client: C, p_actor: actor, p_document_id: id, p_version: 1,
  p_decision: 'approve', p_note: null, p_row_version: await rowVersion(id), p_client_reason: null });
const collection = (actor: string, year: number, engagement: string) => call('taxguard_collection_get', { p_tenant: T, p_client: C, p_actor: actor, p_year: year, p_engagement: engagement });
async function doc(id: string, engagement: string, year: number, status: string, client = C) {
  await db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, version, hash, mime_type, status, quarantine_status, category, created_by, storage_path, file_name)
    VALUES ($1::text, $2::text, $3::text, $4::text, $5::integer, 1, repeat('d', 64), 'application/pdf', $6::text, 'CLEAN', 'income', 'sc-client', 'vault/' || $1::text, $1::text || '.pdf')`,
    [id, T, client, engagement, year, status]);
}

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic scope practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'sc-client', 'Synthetic Scope Client'), ('${T}', '${C2}', 'sc-client2', 'Other Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'sc-mgr', 'practice_manager', 'active', NULL), ('${T}', 'sc-prep', 'accountant', 'active', NULL),
      ('${T}', 'sc-wide', 'accountant', 'active', NULL), ('${T}', 'sc-stale', 'accountant', 'active', NULL), ('${T}', 'sc-revoked', 'accountant', 'active', NULL),
      ('${T}', 'sc-other', 'accountant', 'active', NULL), ('${T}', 'sc-client', 'client', 'active', '${C}'), ('${T2}', 'sc-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const created: string[] = [];
  for (const [key, years] of [['sc-engagement-1', [2025, 2024]], ['sc-engagement-2', [2025]]] as const) {
    const id = (await practice.createEngagement(T, C, 'sc-mgr', key, { title: 'Synthetic ' + key, type: 'tax_preparation', taxYears: [...years] })).engagementId;
    await practice.setEngagementStatus(T, C, 'sc-mgr', id, 'active', 1);
    created.push(id);
  }
  [E1, E2] = created;
  const c2 = (await practice.createEngagement(T, C2, 'sc-mgr', 'sc-c2-engagement', { title: 'Synthetic other', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.assign(T, C, 'sc-mgr', 'sc-assign-prep', { engagementId: E1, taxYear: 2025, role: 'preparer', userId: 'sc-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C2, 'sc-mgr', 'sc-assign-other', { engagementId: c2, taxYear: 2025, role: 'preparer', userId: 'sc-other', reason: 'Synthetic staffing' });
  // One ACTIVE assignment per client, engagement, year and role (schema rule), so the fixtures use distinct roles.
  await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from, effective_to) VALUES
      ('sc-wide-1', '${T}', '${C}', NULL, NULL, 'reviewer', 'sc-wide', 'sc-mgr', 'ACTIVE', now() - interval '1 day', NULL),
      ('sc-stale-1', '${T}', '${C}', '${E1}', 2025, 'bookkeeper', 'sc-stale', 'sc-mgr', 'ACTIVE', now() - interval '10 days', now() - interval '1 day'),
      ('sc-revoked-1', '${T}', '${C}', '${E1}', 2025, 'reviewer', 'sc-revoked', 'sc-mgr', 'REVOKED', now() - interval '10 days', NULL);`);
  await doc('sc-d1', E1, 2025, 'VERIFIED'); await doc('sc-d2', E2, 2025, 'VERIFIED'); await doc('sc-d3', E1, 2024, 'VERIFIED');
  await doc('sc-p1', E1, 2025, 'PENDING_REVIEW'); await doc('sc-p2', E2, 2025, 'PENDING_REVIEW');
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('documents: an engagement-year assignee reaches only that engagement and year', () => {
  it('lists only its engagement-year documents; whole-client staff and managers see all', async () => {
    expect(await docs('sc-prep', 2025)).toEqual(['sc-d1', 'sc-p1']);
    expect(await docs('sc-prep', null)).toEqual(['sc-d1', 'sc-p1']);
    expect(await docs('sc-prep', 2024)).toEqual([]);
    const all = ['sc-d1', 'sc-d2', 'sc-d3', 'sc-p1', 'sc-p2'];
    expect(await docs('sc-wide', null)).toEqual(all);
    expect(await docs('sc-mgr', null)).toEqual(all);
  });

  it('refuses detail and download outside its engagement and year, with the same answer as a missing document', async () => {
    expect((await detail('sc-prep', 'sc-d1')).versions).toHaveLength(1);
    for (const id of ['sc-d2', 'sc-d3']) {
      expect(await code(detail('sc-prep', id))).toBe('DOCUMENT_NOT_FOUND');
      expect(await code(download('sc-prep', id))).toBe('DOCUMENT_NOT_FOUND');
    }
    expect((await download('sc-prep', 'sc-d1')).fileName).toBe('sc-d1.pdf');
    expect((await download('sc-wide', 'sc-d2')).fileName).toBe('sc-d2.pdf');
    const audit = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND actor_uid = 'sc-prep' AND action = 'DOCUMENT_DOWNLOAD_AUTHORIZED' AND metadata->>'documentId' IN ('sc-d2','sc-d3')`, [T])).rows[0].n;
    expect(audit).toBe(0);
  });

  it('reviews and queues only in scope; upload targets offer only its engagement year', async () => {
    expect(await code(review('sc-prep', 'sc-p2'))).toBe('DOCUMENT_NOT_FOUND');
    expect((await db.pool.query(`SELECT status FROM taxguard_documents WHERE document_id = 'sc-p2'`)).rows[0].status).toBe('PENDING_REVIEW');
    const queue = ((await call('taxguard_doc_review_queue', { p_tenant: T, p_actor: 'sc-prep', p_limit: 50 })) as any[]).map(d => d.documentId).sort();
    expect(queue).toEqual(['sc-p1']);
    expect((await review('sc-prep', 'sc-p1')).status).toBe('VERIFIED');
    const targets = (await call('taxguard_doc_upload_targets', { p_tenant: T, p_client: C, p_actor: 'sc-prep' })) as any[];
    expect(targets.map(t => [t.engagementId, t.taxYear])).toEqual([[E1, 2025]]);
    expect(((await call('taxguard_doc_upload_targets', { p_tenant: T, p_client: C, p_actor: 'sc-wide' })) as any[])).toHaveLength(3);
  });

  it('stale, revoked, other-client and other-tenant staff reach nothing', async () => {
    for (const actor of ['sc-stale', 'sc-revoked', 'sc-other']) expect(await code(docs(actor, null)), actor).toBe('DOCUMENT_NOT_FOUND');
    expect(await code(docs('sc-foreign', null, C, T2))).not.toBe('OK');
    expect(await code(docs('sc-foreign', null))).not.toBe('OK');
  });

  it('revoking the assignment ends access at once', async () => {
    await db.pool.query(`INSERT INTO taxguard_staff_assignments(id, tenant_id, client_id, engagement_id, tax_year, role, user_id, assigned_by, status, effective_from)
      VALUES ('sc-temp-1', '${T}', '${C}', '${E2}', 2025, 'preparer', 'sc-revoked', 'sc-mgr', 'ACTIVE', now() - interval '1 hour')`);
    expect(await docs('sc-revoked', null)).toEqual(['sc-d2', 'sc-p2']);
    await db.pool.query(`UPDATE taxguard_staff_assignments SET status = 'REVOKED', effective_to = now() WHERE id = 'sc-temp-1'`);
    expect(await code(docs('sc-revoked', null))).toBe('DOCUMENT_NOT_FOUND');
  });
});

describe('Stage 02 collection: engagement-year scope', () => {
  it('opens only the assigned engagement and year to an engagement-year assignee', async () => {
    expect((await collection('sc-prep', 2025, E1)).engagementId).toBe(E1);
    expect(await code(collection('sc-prep', 2025, E2))).toBe('COLLECTION_ACCESS_DENIED');
    expect(await code(collection('sc-prep', 2024, E1))).toBe('COLLECTION_ACCESS_DENIED');
    expect((await collection('sc-wide', 2024, E1)).engagementId).toBe(E1);
    expect((await collection('sc-mgr', 2025, E2)).engagementId).toBe(E2);
  });
});
