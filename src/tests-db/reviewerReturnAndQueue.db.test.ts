import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';

// The durable replacement for the legacy case-authority reviewer routes (production-route-inventory.json groups
// case-authority-review-decisions and case-authority-review-queue): return for correction is taxguard_case_return and the
// reviewer queue is taxguard_case_queue with role=reviewer. Every refusal must leave the case, its stage states, its
// stage events and the audit trail unchanged. Real PostgreSQL, synthetic data only.
const T = 'tenantRevRet', T2 = 'tenantRevRet2', C = 'rrClient', C2 = 'rrClient2';
let db: TestDatabase; let caseId = ''; let caseOther = '';
const rpc = () => pgRpc(db.pool);
const cases = () => new CaseStore(rpc());
type Outcome = { ok: true; activeStage: number } | { ok: false; code: string };
const run = (p: Promise<any>): Promise<Outcome> => p.then(r => ({ ok: true as const, activeStage: r.activeStage }), (e: any) => ({ ok: false as const, code: e.code }));
const version = async (id = caseId) => Number((await db.pool.query(`SELECT version FROM taxguard_cases WHERE tenant_id = $1 AND case_id = $2`, [T, id])).rows[0].version);
const REASON = 'Synthetic correction: the Schedule C totals do not match the workpaper.';
const giveBack = async (actor: string, toStage: number, reason: unknown = REASON, v?: number, tenant = T, id = caseId) =>
  run(cases().returnTo(tenant, id, actor, toStage, v ?? await version(id), reason as string));

async function stateOf(id = caseId) {
  const q = async (sql: string) => (await db.pool.query(sql, [T, id])).rows;
  return {
    case: await q(`SELECT active_stage, version, status FROM taxguard_cases WHERE tenant_id = $1 AND case_id = $2`),
    stages: await q(`SELECT stage_number, status, version, approved_by FROM taxguard_stage_states WHERE tenant_id = $1 AND case_id = $2 ORDER BY stage_number`),
    events: await q(`SELECT count(*)::int AS n FROM taxguard_case_stage_events WHERE tenant_id = $1 AND case_id = $2`),
    audit: (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1`, [T])).rows,
  };
}
/** Fixture only (database owner): put the case at a stage with the earlier stages completed and approved. */
async function atStage(stage: number, id = caseId) {
  await db.pool.query(`UPDATE taxguard_cases SET active_stage = $3, status = 'ACTIVE' WHERE tenant_id = $1 AND case_id = $2`, [T, id, stage]);
  await db.pool.query(`UPDATE taxguard_stage_states SET status = CASE WHEN stage_number < $3 THEN 'COMPLETED' WHEN stage_number = $3 THEN 'IN_PROGRESS' ELSE 'LOCKED' END,
      approved_by = CASE WHEN stage_number < $3 THEN 'rr-rev' ELSE NULL END, approved_at = CASE WHEN stage_number < $3 THEN now() ELSE NULL END
    WHERE tenant_id = $1 AND case_id = $2`, [T, id, stage]);
}
async function refusedAndUnchanged(attempt: () => Promise<Outcome>, code: string | RegExp, id = caseId) {
  const before = await stateOf(id);
  const r = await attempt();
  expect(r.ok, JSON.stringify(r)).toBe(false);
  const refused = r as Extract<Outcome, { ok: false }>;
  if (typeof code === 'string') expect(refused.code).toBe(code); else expect(refused.code).toMatch(code);
  expect(await stateOf(id)).toEqual(before);
}

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic reviewer practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'rr-client', 'Synthetic Client'), ('${T}', '${C2}', 'rr-client2', 'Second Synthetic Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES
      ('${T}', 'rr-mgr', 'practice_manager', 'active', NULL), ('${T}', 'rr-admin', 'admin', 'active', NULL),
      ('${T}', 'rr-prep', 'accountant', 'active', NULL), ('${T}', 'rr-rev', 'reviewer', 'active', NULL),
      ('${T}', 'rr-rev2', 'reviewer', 'active', NULL), ('${T}', 'rr-outsider', 'accountant', 'active', NULL),
      ('${T}', 'rr-client', 'client', 'active', '${C}'),
      ('${T2}', 'rr-foreign', 'practice_manager', 'active', NULL);`);
  const practice = new PracticeStore(rpc());
  const staff = async (client: string, key: string, prep: string, rev: string) => {
    const eng = (await practice.createEngagement(T, client, 'rr-mgr', key, { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, client, 'rr-mgr', eng, 'active', 1);
    await practice.assign(T, client, 'rr-mgr', key + '-p', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: prep, reason: 'Initial staffing' });
    await practice.assign(T, client, 'rr-mgr', key + '-r', { engagementId: eng, taxYear: 2025, role: 'reviewer', userId: rev, reason: 'Initial staffing' });
    return (await cases().create(T, client, 'rr-mgr', key + '-case', { engagementId: eng, taxYear: 2025, returnFamily: '1040' }) as any).caseId as string;
  };
  caseId = await staff(C, 'rr-eng-1', 'rr-prep', 'rr-rev');
  caseOther = await staff(C2, 'rr-eng-2', 'rr-prep', 'rr-rev2');
}, 240_000);
afterAll(async () => { await db?.stop(); });
beforeEach(async () => { await atStage(7); await atStage(3, caseOther); });

describe('who may return a case for correction', () => {
  it('the preparer cannot return their own case (maker-checker)', async () => {
    await refusedAndUnchanged(() => giveBack('rr-prep', 6), 'STAGE_RETURN_REQUIRES_REVIEWER');
  });
  it('a manager or administrator who is also the preparer is still refused', async () => {
    await db.pool.query(`UPDATE taxguard_cases SET preparer_uid = 'rr-mgr' WHERE tenant_id = $1 AND case_id = $2`, [T, caseId]);
    try { await refusedAndUnchanged(() => giveBack('rr-mgr', 6), 'STAGE_RETURN_REQUIRES_REVIEWER'); }
    finally { await db.pool.query(`UPDATE taxguard_cases SET preparer_uid = 'rr-prep' WHERE tenant_id = $1 AND case_id = $2`, [T, caseId]); }
  });
  it('the reviewer of another case, an unassigned accountant, the client and another tenant are refused', async () => {
    await refusedAndUnchanged(() => giveBack('rr-rev2', 6), /^(STAGE_RETURN_REQUIRES_REVIEWER|PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND)$/);
    await refusedAndUnchanged(() => giveBack('rr-outsider', 6), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND)$/);
    await refusedAndUnchanged(() => giveBack('rr-client', 6), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND)$/);
    await refusedAndUnchanged(() => giveBack('rr-foreign', 6, REASON, undefined, T2), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND)$/);
  });
  it('a reviewer of one client cannot return another client case of the same preparer', async () => {
    await refusedAndUnchanged(() => giveBack('rr-rev', 2, REASON, undefined, T, caseOther), /^(STAGE_RETURN_REQUIRES_REVIEWER|PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND)$/, caseOther);
  });
});

describe('what a return requires', () => {
  it('a meaningful reason is required', async () => {
    // null, not undefined: undefined would select the helper's default reason.
    for (const reason of [null, '', '   ', 'too short', 'x'.repeat(501)]) await refusedAndUnchanged(() => giveBack('rr-rev', 6, reason), 'RETURN_REASON_REQUIRED');
  });
  it('the target must be an earlier stage; a stale version is refused', async () => {
    for (const to of [7, 8, 0, -1]) await refusedAndUnchanged(() => giveBack('rr-rev', to), 'STAGE_SEQUENCE_INVALID');
    await refusedAndUnchanged(async () => giveBack('rr-rev', 6, REASON, (await version()) - 1), 'CASE_VERSION_CONFLICT');
  });
});

describe('a return for correction', () => {
  it('by the independent reviewer reopens the target stage, relocks the later ones, clears their approvals and is recorded and audited', async () => {
    const before = await stateOf();
    const r = await giveBack('rr-rev', 4);
    expect(r).toEqual({ ok: true, activeStage: 4 });
    const after = await stateOf();
    expect(after.case[0]).toMatchObject({ active_stage: 4, version: before.case[0].version + 1 });
    const byStage = Object.fromEntries(after.stages.map((s: any) => [s.stage_number, s]));
    expect(byStage[4]).toMatchObject({ status: 'IN_PROGRESS', approved_by: null });
    for (const s of [5, 6, 7]) expect(byStage[s]).toMatchObject({ status: 'LOCKED', approved_by: null });
    for (const s of [1, 2, 3]) expect(byStage[s]).toMatchObject({ status: 'COMPLETED', approved_by: 'rr-rev' });
    const events = (await db.pool.query(`SELECT action, from_stage, to_stage, reason, actor_uid, actor_role FROM taxguard_case_stage_events
      WHERE tenant_id = $1 AND case_id = $2 AND action = 'RETURNED'`, [T, caseId])).rows;
    expect(events).toEqual([{ action: 'RETURNED', from_stage: 7, to_stage: 4, reason: REASON, actor_uid: 'rr-rev', actor_role: 'reviewer' }]);
    expect(after.events[0].n).toBe(before.events[0].n + 1);
    expect(after.audit[0].n).toBe(before.audit[0].n + 1);
    expect((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND action = 'CASE_STAGE_RETURNED'`, [T])).rows[0].n).toBe(1);
  });
  it('by an administrator (a manager role) is allowed when they are not the preparer', async () => {
    expect(await giveBack('rr-admin', 6)).toEqual({ ok: true, activeStage: 6 });
  });
  it('by a practice manager is allowed; a repeat with the old version is refused, so a double submission returns once', async () => {
    const v = await version();
    expect(await giveBack('rr-mgr', 5, REASON, v)).toEqual({ ok: true, activeStage: 5 });
    await refusedAndUnchanged(() => giveBack('rr-mgr', 5, REASON, v), 'CASE_VERSION_CONFLICT');
  });
});

describe('the reviewer queue', () => {
  it('role=reviewer lists only the cases the actor reviews, flagged when a reviewer attestation is awaited', async () => {
    const mine = await cases().queue(T, 'rr-rev', { role: 'reviewer' }) as any;
    const rows = mine.items ?? mine;
    expect(rows.map((r: any) => r.caseId)).toEqual([caseId]);
    expect(rows[0]).toMatchObject({ myRole: 'reviewer', activeStage: 7, awaitingReviewer: true });
    const other = await cases().queue(T, 'rr-rev2', { role: 'reviewer' }) as any;
    expect((other.items ?? other).map((r: any) => r.caseId)).toEqual([caseOther]);
  });
  it('the preparer has no reviewer queue rows, and an unknown role filter is refused', async () => {
    const prep = await cases().queue(T, 'rr-prep', { role: 'reviewer' }) as any;
    expect(prep.items ?? prep).toEqual([]);
    expect(await cases().queue(T, 'rr-rev', { role: 'approver' }).then(() => 'ok', (e: any) => e.code)).toBe('CASE_INPUT_INVALID');
  });
  it('a client and another tenant get no reviewer queue', async () => {
    for (const [tenant, actor] of [[T, 'rr-client'], [T2, 'rr-foreign']] as const) {
      const r = await cases().queue(tenant, actor, { role: 'reviewer' }).then((x: any) => (x.items ?? x).map((y: any) => y.caseId), (e: any) => e.code);
      expect(Array.isArray(r) ? r.filter((id: string) => [caseId, caseOther].includes(id)) : r).toEqual(Array.isArray(r) ? [] : r);
    }
  });
});
