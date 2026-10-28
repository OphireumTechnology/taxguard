import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';

// Stage 03 (Validate) through the real case transition on PostgreSQL with every proposal applied (20261018180000):
// the reviewer's attestation is refused while an OCR proposal on a current document of the case's engagement year is
// undecided, and accepted once staff have decided it through the vault's own verification RPC. Synthetic data only.
const T = 'tenantCaseCx', C = 'cxdClient';
let db: TestDatabase; let caseId = ''; let engagementId = '';
const rpc = () => pgRpc(db.pool);
const cases = () => new CaseStore(rpc());
const call = async (fn: string, args: Record<string, unknown>) => { const r = await rpc().rpc(fn, args); if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message }); return r.data as any; };
const queued = async () => ((await call('taxguard_doc_review_queue', { p_tenant: T, p_actor: 'cxd-rev', p_limit: 50 })) as any[]).filter(d => d.documentId === 'cxd-doc-1');
const version = async () => (await cases().detail(T, caseId, 'cxd-mgr') as any).case.version as number;
const validate = async () => cases().advance(T, caseId, 'cxd-rev', 3, await version(),
  { confirmed: ['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved'], statement: 'Synthetic reviewer attestation for tests only.' })
  .then((r: any) => ({ ok: true, stage: r.activeStage as number }), (e: any) => ({ ok: false, code: e.code as string, detail: JSON.stringify(e) }));

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic extraction evidence practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'cxd-client', 'Synthetic Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'cxd-mgr', 'practice_manager', 'active'), ('${T}', 'cxd-acct', 'accountant', 'active'),
      ('${T}', 'cxd-rev', 'reviewer', 'active');`);
  const practice = new PracticeStore(rpc());
  engagementId = (await practice.createEngagement(T, C, 'cxd-mgr', 'cxd-engagement', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cxd-mgr', engagementId, 'active', 1);
  await practice.assign(T, C, 'cxd-mgr', 'cxd-assign-preparer', { engagementId, taxYear: 2025, role: 'preparer', userId: 'cxd-acct', reason: 'Initial staffing' });
  await practice.assign(T, C, 'cxd-mgr', 'cxd-assign-reviewer', { engagementId, taxYear: 2025, role: 'reviewer', userId: 'cxd-rev', reason: 'Initial staffing' });
  caseId = (await cases().create(T, C, 'cxd-mgr', 'cxd-case-key-1', { engagementId, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  // Fixture: stages 1-2 already completed (their own gates are covered elsewhere); the case is at Validate with one
  // scanned, reviewed document.
  await db.pool.query(`UPDATE taxguard_cases SET active_stage = 3 WHERE tenant_id = '${T}' AND case_id = '${caseId}';
    UPDATE taxguard_stage_states SET status = CASE WHEN stage_number < 3 THEN 'COMPLETED' WHEN stage_number = 3 THEN 'IN_PROGRESS' ELSE status END
      WHERE tenant_id = '${T}' AND case_id = '${caseId}';
    INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by)
      VALUES ('cxd-doc-1', '${T}', '${C}', '${engagementId}', 2025, '${caseId}', 1, repeat('a', 64), 'application/pdf', 'VERIFIED', 'CLEAN', 'cxd-client');`);
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('Stage 03 validation requires decided OCR proposals', () => {
  it('refuses Validate while a proposal is undecided, and accepts it once staff decide every proposal', async () => {
    expect(await call('taxguard_doc_propose_extraction', { p_tenant: T, p_client: C, p_document_id: 'cxd-doc-1', p_version: 1, p_provider: 'synthetic-ocr',
      p_fields: [{ fieldKey: 'w2.box1_wages', value: '100.00', confidence: 0.9 }, { fieldKey: 'w2.employer_name', value: 'Synthetic Employer', confidence: 0.4 }] })).toEqual({ proposed: 2 });
    // The reviewed document stays in the staff review queue while it has undecided proposals, with their count.
    expect((await queued()).map(d => [d.status, d.undecidedProposals])).toEqual([['VERIFIED', 2]]);
    const refused = await validate();
    expect(refused).toMatchObject({ ok: false, code: 'STAGE_GATE_NOT_MET' });
    expect((refused as any).detail).toContain('noUndecidedExtractionProposals');
    const ids = (await db.pool.query(`SELECT id, field_key FROM taxguard_extracted_data WHERE tenant_id = $1 AND document_id = 'cxd-doc-1' ORDER BY field_key`, [T])).rows;
    await call('taxguard_doc_verify_extraction', { p_tenant: T, p_client: C, p_actor: 'cxd-rev', p_field: ids.find(r => r.field_key === 'w2.box1_wages').id, p_decision: 'ACCEPTED', p_value: null });
    // One decision is not enough.
    expect((await queued()).map(d => d.undecidedProposals)).toEqual([1]);
    expect(await validate()).toMatchObject({ ok: false, code: 'STAGE_GATE_NOT_MET' });
    await call('taxguard_doc_verify_extraction', { p_tenant: T, p_client: C, p_actor: 'cxd-rev', p_field: ids.find(r => r.field_key === 'w2.employer_name').id, p_decision: 'REJECTED', p_value: null });
    expect(await queued()).toEqual([]);
    expect(await validate()).toEqual({ ok: true, stage: 4 });
  });
});
