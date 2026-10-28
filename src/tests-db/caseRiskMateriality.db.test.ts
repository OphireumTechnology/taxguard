import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';

// Risk and materiality, and the confidence + evidence + risk gate (proposal 20261018170000, review only). Thresholds
// come only from an approved practice policy; without one a person reviews. AI confidence can add a reason, never remove
// one. Synthetic data only; the readiness state of a case is arranged as the database owner where noted.
const T = 'tenantCaseRisk', T2 = 'tenantCaseRiskOther', C = 'crClient';
let db: TestDatabase; let caseId = '';
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const assess = (signals: Record<string, unknown>, actor = 'cr-rev', tenant = T) => rpc('taxguard_case_risk_assess', { p_tenant: tenant, p_actor: actor, p_case: caseId, p_signals: signals });
// A diagnosed case with no open finding (owner-arranged readiness), so the policy alone decides.
const markDiagnosedClean = () => db.pool.query(`INSERT INTO taxguard_case_diagnostic_runs(tenant_id, case_id, client_id, tax_year, run_by, detected) VALUES ($1, $2, $3, 2025, 'cr-rev', 0)`, [T, caseId, C]);
const policy = (version: number, allow: boolean, status = 'APPROVED', approvedBy: string | null = 'cr-admin') => db.pool.query(
  `INSERT INTO taxguard_materiality_policies(tenant_id, policy_version, material_amount_cents, high_risk_amount_cents, minimum_ai_confidence, allow_automated_continuation,
     rationale, status, created_by, approved_by, approved_at) VALUES ($1, $2, 100000, 1000000, 0.800, $3, 'Synthetic practice materiality policy for tests', $4, 'cr-mgr', $5::varchar,
     CASE WHEN $5::varchar IS NULL THEN NULL ELSE now() END)`, [T, version, allow, status, approvedBy]);

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic risk practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'cr-client', 'Synthetic Risk Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'cr-mgr', 'practice_manager', 'active'), ('${T}', 'cr-admin', 'admin', 'active'),
      ('${T}', 'cr-prep', 'accountant', 'active'), ('${T}', 'cr-rev', 'reviewer', 'active'), ('${T}', 'cr-out', 'accountant', 'active'), ('${T2}', 'cr-foreign', 'practice_manager', 'active');`);
  const practice = new PracticeStore(pgRpc(db.pool)); const cases = new CaseStore(pgRpc(db.pool));
  const e = (await practice.createEngagement(T, C, 'cr-mgr', 'cr-engagement-1', { title: 'Synthetic return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cr-mgr', e, 'active', 1);
  await practice.assign(T, C, 'cr-mgr', 'cr-assign-preparer', { engagementId: e, taxYear: 2025, role: 'preparer', userId: 'cr-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'cr-mgr', 'cr-assign-reviewer', { engagementId: e, taxYear: 2025, role: 'reviewer', userId: 'cr-rev', reason: 'Synthetic staffing' });
  caseId = (await cases.create(T, C, 'cr-mgr', 'cr-case-key-1', { engagementId: e, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('risk and materiality gate', () => {
  it('without diagnostics or an approved policy, a person reviews, however confident the AI is', async () => {
    const r = await assess({ amountCents: 500, aiConfidence: 0.99 });
    expect(r).toMatchObject({ outcome: 'HUMAN_REVIEW_REQUIRED', materiality: 'UNKNOWN', risk_level: 'UNKNOWN', policy_version: null, returnUse: 'BLOCKED' });
    expect(r.reason_codes).toEqual(['DIAGNOSTICS_NOT_RUN', 'NO_APPROVED_MATERIALITY_POLICY']);
  });

  it('a blocking diagnostic blocks, and nothing about the amount or confidence lifts it', async () => {
    await rpc('taxguard_case_diagnostics_run', { p_tenant: T, p_actor: 'cr-rev', p_case: caseId });
    const r = await assess({ amountCents: 1, aiConfidence: 1 });
    expect(r.outcome).toBe('BLOCKED');
    expect(r.reason_codes).toEqual(expect.arrayContaining(['DIAGNOSTIC_BLOCKING', 'DIAGNOSTIC_ERRORS', 'NO_APPROVED_MATERIALITY_POLICY']));
  });

  it('ignores draft or self-approved policies', async () => {
    await policy(1, true, 'DRAFT', null);
    await expect(policy(2, true, 'APPROVED', 'cr-mgr')).rejects.toThrow(/check/i);
    await markDiagnosedClean();
    // Clear the findings recorded by the earlier run: a later clean run is what the gate reads.
    await db.pool.query(`UPDATE taxguard_case_diagnostics SET status = 'CLEARED', cleared_run = last_detected_run, cleared_at = now() WHERE tenant_id = $1 AND case_id = $2`, [T, caseId]);
    expect((await assess({ amountCents: 500 })).reason_codes).toEqual(['NO_APPROVED_MATERIALITY_POLICY']);
  });

  it('with an approved policy: material amounts, low confidence and unsupported positions go to a person; continuation needs the policy to allow it', async () => {
    await policy(3, false);
    expect(await assess({ amountCents: 500, aiConfidence: 0.95 })).toMatchObject({ outcome: 'HUMAN_REVIEW_REQUIRED', materiality: 'IMMATERIAL', risk_level: 'LOW',
      policy_version: 3, reason_codes: ['POLICY_REQUIRES_HUMAN_REVIEW'] });
    await db.pool.query(`UPDATE taxguard_materiality_policies SET status = 'RETIRED' WHERE tenant_id = $1 AND policy_version = 3`, [T]);
    await policy(4, true);
    expect(await assess({ amountCents: 500, aiConfidence: 0.95 })).toMatchObject({ outcome: 'CONTINUE', reason_codes: [], policy_version: 4, materiality: 'IMMATERIAL' });
    expect(await assess({ amountCents: 250000 })).toMatchObject({ outcome: 'HUMAN_REVIEW_REQUIRED', materiality: 'MATERIAL', risk_level: 'MEDIUM', reason_codes: ['AMOUNT_MATERIAL'] });
    expect(await assess({ amountCents: 2000000 })).toMatchObject({ risk_level: 'HIGH', reason_codes: ['AMOUNT_MATERIAL'] });
    expect(await assess({ amountCents: 500, aiConfidence: 0.5 })).toMatchObject({ outcome: 'HUMAN_REVIEW_REQUIRED', reason_codes: ['AI_CONFIDENCE_BELOW_POLICY'] });
    expect(await assess({ amountCents: 500, unsupportedPosition: true, aiConfidence: 1 })).toMatchObject({ outcome: 'HUMAN_REVIEW_REQUIRED', risk_level: 'HIGH', reason_codes: ['UNSUPPORTED_POSITION'] });
  });

  it('refuses malformed signals, out-of-scope members and other tenants', async () => {
    for (const s of [{}, { amountCents: -1 }, { amountCents: 1.5 }, { amountCents: '100' }, { amountCents: 1, aiConfidence: 2 }, { amountCents: 1, unsupportedPosition: 'yes' }])
      expect(await code(assess(s)), JSON.stringify(s)).toBe('RISK_INPUT_INVALID');
    expect(await code(assess({ amountCents: 1 }, 'cr-out'))).toBe('CASE_NOT_FOUND');
    expect(await code(assess({ amountCents: 1 }, 'cr-foreign', T2))).toBe('CASE_NOT_FOUND');
  });

  it('keeps assessments and approved policies immutable, also to the database owner, and audits each assessment', async () => {
    await expect(db.pool.query(`UPDATE taxguard_case_risk_assessments SET outcome = 'CONTINUE', reason_codes = '{}' WHERE tenant_id = $1`, [T])).rejects.toThrow('RISK_ASSESSMENT_IMMUTABLE');
    await expect(db.pool.query(`DELETE FROM taxguard_case_risk_assessments WHERE tenant_id = $1`, [T])).rejects.toThrow('RISK_ASSESSMENT_IMMUTABLE');
    await expect(db.pool.query(`UPDATE taxguard_materiality_policies SET material_amount_cents = 1 WHERE tenant_id = $1 AND policy_version = 4`, [T])).rejects.toThrow('MATERIALITY_POLICY_IMMUTABLE');
    const listed = await rpc('taxguard_case_risk_list', { p_tenant: T, p_actor: 'cr-prep', p_case: caseId });
    const audits = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'CASE_RISK_ASSESSED'`, [T])).rows[0].n;
    expect(audits).toBe(listed.length);
  });
});
