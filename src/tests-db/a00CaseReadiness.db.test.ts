import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { PgGovernanceDatabase } from '../server/ai/governance/SqlGovernanceStore';
import { SqlCaseReadinessGate } from '../server/ai/orchestration/SqlCaseReadinessGate';
import { readCaseReadiness } from '../server/ai/orchestration/A00Orchestrator';

// A00's readiness gate on real PostgreSQL with the review-only diagnostics proposal applied: the AI governance case key
// (tenant_id, tax_case_id) is taxguard_cases.case_id within the tenant, which ai_validate_case_scope enforces for every
// AI record linked to case_record_id. The gate is read only. Synthetic data only.
const T = 'tenantA00Readiness', C = 'arClient';
let db: TestDatabase; let caseId = ''; let caseRecordId = '';
const gate = () => new SqlCaseReadinessGate(new PgGovernanceDatabase(db.pool));

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic A00 readiness practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'ar-client', 'Synthetic A00 Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'ar-mgr', 'practice_manager', 'active'), ('${T}', 'ar-prep', 'accountant', 'active'), ('${T}', 'ar-rev', 'reviewer', 'active');`);
  const practice = new PracticeStore(pgRpc(db.pool));
  const e = (await practice.createEngagement(T, C, 'ar-mgr', 'ar-engagement-1', { title: 'Synthetic return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'ar-mgr', e, 'active', 1);
  await practice.assign(T, C, 'ar-mgr', 'ar-assign-preparer', { engagementId: e, taxYear: 2025, role: 'preparer', userId: 'ar-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'ar-mgr', 'ar-assign-reviewer', { engagementId: e, taxYear: 2025, role: 'reviewer', userId: 'ar-rev', reason: 'Synthetic staffing' });
  caseId = (await new CaseStore(pgRpc(db.pool)).create(T, C, 'ar-mgr', 'ar-case-key-1', { engagementId: e, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  caseRecordId = (await db.pool.query(`SELECT id FROM taxguard_cases WHERE tenant_id = $1 AND case_id = $2`, [T, caseId])).rows[0].id;
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('A00 case readiness on PostgreSQL', () => {
  it('maps the AI case key to the case the diagnostics read, and refuses a mismatched AI record', async () => {
    const source = (taxCaseId: string) => db.pool.query(`INSERT INTO ai_evidence_sources(tenant_id, client_id, tax_case_id, tax_year, case_record_id, evidence_type, source_reference, source_hash)
      VALUES ($1, $2, $3, 2025, $4, 'RULE', 'Synthetic rule reference', repeat('c', 64))`, [T, C, taxCaseId, caseRecordId]);
    await expect(source('another-case')).rejects.toThrow('AI_CASE_SCOPE_MISMATCH');
    await expect(source(caseId)).resolves.toBeDefined();
  });

  it('reports a case never diagnosed as NOT_DIAGNOSED, then NOT_READY with the counts after a run, and changes nothing', async () => {
    expect(await readCaseReadiness(gate(), T, caseId)).toEqual({ status: 'NOT_DIAGNOSED', blocking: 0, errors: 0, diagnosed_at: null });
    await pgRpc(db.pool).rpc('taxguard_case_diagnostics_run', { p_tenant: T, p_actor: 'ar-prep', p_case: caseId });
    const before = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_case_diagnostics WHERE tenant_id = $1`, [T])).rows[0].n;
    const readiness = await readCaseReadiness(gate(), T, caseId);
    expect(readiness).toMatchObject({ status: 'NOT_READY', blocking: 1, errors: 1 });
    expect(Date.parse(readiness.diagnosed_at!)).not.toBeNaN();
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_case_diagnostics WHERE tenant_id = $1`, [T])).rows[0].n).toBe(before);
  });

  it('never reports another tenant\'s case as ready', async () => {
    expect(await readCaseReadiness(gate(), 'tenantOther', caseId)).toEqual({ status: 'NOT_DIAGNOSED', blocking: 0, errors: 0, diagnosed_at: null });
  });
});
