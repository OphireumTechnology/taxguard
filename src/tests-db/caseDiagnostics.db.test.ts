import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';
import { SqlLedgerStore } from '../server/taxguard/bookkeeping/sqlLedgerStore';
import { generateStandardChartOfAccounts } from '../server/taxguard/bookkeeping/defaultAccounts';

// Case readiness diagnostics (proposal 20261018160000, review only): deterministic checks over a case's durable records,
// with severity from the governed rule table, persisted history, waiver only for INFO and WARNING, and access through
// the case's live assignment. Synthetic data only.
const T = 'tenantCaseDiagnostics', T2 = 'tenantCaseDiagnosticsOther', C = 'cdClient';
let db: TestDatabase; let practice: PracticeStore; let cases: CaseStore; let caseId = '';
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const runDiagnostics = (actor: string, tenant = T) => rpc('taxguard_case_diagnostics_run', { p_tenant: tenant, p_actor: actor, p_case: caseId });
const open = (result: any) => (result.diagnostics as any[]).map(d => `${d.severity}:${d.rule_code}`).sort();

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic diagnostics practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'cd-client', 'Synthetic Diagnostics Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'cd-mgr', 'practice_manager', 'active'), ('${T}', 'cd-prep', 'accountant', 'active'),
      ('${T}', 'cd-rev', 'reviewer', 'active'), ('${T}', 'cd-out', 'accountant', 'active'), ('${T2}', 'cd-foreign', 'practice_manager', 'active');`);
  practice = new PracticeStore(pgRpc(db.pool)); cases = new CaseStore(pgRpc(db.pool));
  const e = (await practice.createEngagement(T, C, 'cd-mgr', 'cd-engagement-1', { title: 'Synthetic return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, C, 'cd-mgr', e, 'active', 1);
  await practice.assign(T, C, 'cd-mgr', 'cd-assign-preparer', { engagementId: e, taxYear: 2025, role: 'preparer', userId: 'cd-prep', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'cd-mgr', 'cd-assign-reviewer', { engagementId: e, taxYear: 2025, role: 'reviewer', userId: 'cd-rev', reason: 'Synthetic staffing' });
  caseId = (await cases.create(T, C, 'cd-mgr', 'cd-case-key-1', { engagementId: e, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('case readiness diagnostics', () => {
  it('detects the missing approvals of a new case with severities from the rule table, and is not ready', async () => {
    const result = await runDiagnostics('cd-prep');
    expect(open(result)).toEqual(['BLOCKING:CALC_NO_APPROVED_RUN', 'ERROR:B2T_NO_APPROVED_WORKPAPER']);
    expect(result).toMatchObject({ blocking: 1, errors: 1, ready: false, returnUse: 'BLOCKED' });
    const d = result.diagnostics.find((x: any) => x.rule_code === 'CALC_NO_APPROVED_RUN');
    expect(d).toMatchObject({ rule_version: 1, status: 'OPEN', affected_type: 'CASE', affected_id: caseId, client_id: C, tax_year: 2025 });
  });

  it('detects unreviewed journal entries and draft research, and clears them when the data changes', async () => {
    const ledger = new SqlLedgerStore(pgRpc(db.pool));
    const chart = generateStandardChartOfAccounts(T, C, '1040_SCHED_C', 'cd-prep');
    await ledger.createAccounts({ tenantId: T, clientId: C }, 'cd-prep', chart);
    const acct = Object.fromEntries(chart.map(a => [a.accountNumber, a.id]));
    const entry = await ledger.postEntry({ tenantId: T, clientId: C }, 'cd-prep', { idempotencyKey: 'cd-entry-1', taxYear: 2025, postingDate: '2025-03-01',
      description: 'Synthetic adjusting entry', isAdjusting: true, adjustingType: 'ACCRUAL', lines: [{ accountId: acct['6070'], debit: 50, credit: 0 }, { accountId: acct['1010'], debit: 0, credit: 50 }] });
    expect(entry.status).toBe('PREPARED');
    const memo = await rpc('taxguard_tax_research_open', { p_tenant: T, p_actor: 'cd-prep', p_case: caseId, p_question: 'Synthetic research question for diagnostics.' });
    const withFindings = await runDiagnostics('cd-prep');
    expect(open(withFindings)).toEqual(['BLOCKING:CALC_NO_APPROVED_RUN', 'ERROR:B2T_NO_APPROVED_WORKPAPER', 'ERROR:LEDGER_ENTRIES_UNREVIEWED', 'INFO:RESEARCH_DRAFT_OPEN']);
    // The entry is reviewed and posted: the ledger finding clears on the next run, and its history stays.
    await ledger.reviewEntry({ tenantId: T, clientId: C }, 'cd-rev', entry.id, 'approve', entry.version);
    const after = await runDiagnostics('cd-rev');
    expect(open(after)).toEqual(['BLOCKING:CALC_NO_APPROVED_RUN', 'ERROR:B2T_NO_APPROVED_WORKPAPER', 'INFO:RESEARCH_DRAFT_OPEN']);
    const history = (await db.pool.query(`SELECT status, cleared_run IS NOT NULL AS cleared FROM taxguard_case_diagnostics WHERE tenant_id = $1 AND rule_code = 'LEDGER_ENTRIES_UNREVIEWED'`, [T])).rows;
    expect(history).toEqual([{ status: 'CLEARED', cleared: true }]);
    expect(memo.status).toBe('DRAFT');
  });

  it('lets the case reviewer acknowledge only INFO and WARNING findings, with a note; ERROR and BLOCKING are not waivable', async () => {
    const list = await rpc('taxguard_case_diagnostics_list', { p_tenant: T, p_actor: 'cd-rev', p_case: caseId });
    const info = list.diagnostics.find((d: any) => d.severity === 'INFO');
    const blocking = list.diagnostics.find((d: any) => d.severity === 'BLOCKING');
    const ack = (actor: string, id: string, note = 'Synthetic acknowledgement with reasons.') => rpc('taxguard_case_diagnostic_acknowledge', { p_tenant: T, p_actor: actor, p_diagnostic: id, p_note: note });
    expect(await code(ack('cd-rev', blocking.diagnostic_id))).toBe('DIAGNOSTIC_NOT_WAIVABLE');
    expect(await code(ack('cd-prep', info.diagnostic_id))).toBe('DIAGNOSTIC_REVIEWER_REQUIRED');
    expect(await code(ack('cd-rev', info.diagnostic_id, 'short'))).toBe('DIAGNOSTIC_INPUT_INVALID');
    const acknowledged = await ack('cd-rev', info.diagnostic_id);
    expect(acknowledged.diagnostics.find((d: any) => d.diagnostic_id === info.diagnostic_id)).toMatchObject({ status: 'ACKNOWLEDGED', acknowledged_by: 'cd-rev' });
    // Acknowledging changes nothing about readiness: the blocking finding still stands.
    expect(acknowledged).toMatchObject({ ready: false, blocking: 1 });
    expect(await rpc('taxguard_case_diagnostics_gate', { p_tenant: T, p_case: caseId })).toMatchObject({ blocking: 1, errors: 1, ready: false });
  });

  it('a hold is a blocking finding', async () => {
    await db.pool.query(`UPDATE taxguard_cases SET status = 'ON_HOLD', hold_reason = 'Synthetic hold' WHERE tenant_id = $1 AND case_id = $2`, [T, caseId]);
    const result = await runDiagnostics('cd-rev');
    expect(open(result)).toContain('BLOCKING:CASE_ON_HOLD');
    expect(result.blocking).toBe(2);
    await db.pool.query(`UPDATE taxguard_cases SET status = 'ACTIVE', hold_reason = NULL WHERE tenant_id = $1 AND case_id = $2`, [T, caseId]);
  });

  it('follows the case access rule and keeps history immutable, also to the database owner', async () => {
    expect(await code(runDiagnostics('cd-out'))).toBe('CASE_NOT_FOUND');
    expect(await code(runDiagnostics('cd-foreign', T2))).toBe('CASE_NOT_FOUND');
    expect(await code(rpc('taxguard_case_diagnostics_list', { p_tenant: T, p_actor: 'cd-out', p_case: caseId }))).toBe('CASE_NOT_FOUND');
    await expect(db.pool.query(`DELETE FROM taxguard_case_diagnostics WHERE tenant_id = $1`, [T])).rejects.toThrow('DIAGNOSTIC_HISTORY_IMMUTABLE');
    await expect(db.pool.query(`UPDATE taxguard_case_diagnostics SET severity = 'INFO' WHERE tenant_id = $1 AND rule_code = 'CALC_NO_APPROVED_RUN'`, [T])).rejects.toThrow('DIAGNOSTIC_HISTORY_IMMUTABLE');
    await expect(db.pool.query(`DELETE FROM taxguard_case_diagnostic_runs WHERE tenant_id = $1`, [T])).rejects.toThrow('DIAGNOSTIC_HISTORY_IMMUTABLE');
    const audits = (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'CASE_DIAGNOSTICS_RUN'`, [T])).rows[0].n;
    expect(audits).toBeGreaterThanOrEqual(4);
  });
});
