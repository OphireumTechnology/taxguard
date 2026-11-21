import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';

// Server-authoritative stage gate engine (LEGACY_18_V1, proposal 026: taxguard_case_advance) on a real PostgreSQL
// server. Every refusal below must leave the case, its stage states, its stage events and its audit trail unchanged.
// The browser can only request an advance; the database computes or checks every requirement. Synthetic data only.
const T = 'tenantGateEng', T2 = 'tenantGateEng2', C = 'geClient', C2 = 'geClient2';
let db: TestDatabase; let caseId = ''; let caseOther = '';
const rpc = () => pgRpc(db.pool);
const cases = () => new CaseStore(rpc());
type Outcome = { ok: true; activeStage: number } | { ok: false; code: string; failed: string[] };
const run = (p: Promise<any>): Promise<Outcome> => p.then(r => ({ ok: true as const, activeStage: r.activeStage }), (e: any) => ({ ok: false as const, code: e.code, failed: e.failedChecks ?? [] }));
const version = async (id = caseId) => Number((await db.pool.query(`SELECT version FROM taxguard_cases WHERE tenant_id = $1 AND case_id = $2`, [T, id])).rows[0].version);
const ATTEST: Record<number, string[]> = {
  2: ['documents_received_or_waived', 'documents_in_private_storage'],
  3: ['documents_reviewed_for_completeness', 'discrepancies_recorded_or_resolved'],
  7: ['reports_reviewed_for_release'], 8: ['planning_considerations_documented'],
};
const attestation = (stage: number, extra: Record<string, unknown> = {}) => ({ confirmed: ATTEST[stage] ?? [], statement: 'Synthetic reviewer attestation for tests only.', ...extra });
const advance = async (actor: string, from: number, att?: unknown, v?: number, tenant = T, id = caseId) =>
  run(cases().advance(tenant, id, actor, from, v ?? await version(id), att as any));

/** Everything a stage move could change, for an exact before/after comparison. */
async function stateOf(id = caseId) {
  const q = async (sql: string) => (await db.pool.query(sql, [T, id])).rows;
  return {
    case: await q(`SELECT active_stage, version, status FROM taxguard_cases WHERE tenant_id = $1 AND case_id = $2`),
    stages: await q(`SELECT stage_number, status, version, approved_by, gate_evidence FROM taxguard_stage_states WHERE tenant_id = $1 AND case_id = $2 ORDER BY stage_number`),
    events: await q(`SELECT count(*)::int AS n FROM taxguard_case_stage_events WHERE tenant_id = $1 AND case_id = $2`),
    audit: (await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1`, [T])).rows,
  };
}
/** Fixture only (database owner): put the case at a stage with the earlier stages completed. */
async function atStage(stage: number, id = caseId) {
  await db.pool.query(`UPDATE taxguard_cases SET active_stage = $3, status = 'ACTIVE' WHERE tenant_id = $1 AND case_id = $2`, [T, id, stage]);
  await db.pool.query(`UPDATE taxguard_stage_states SET status = CASE WHEN stage_number < $3 THEN 'COMPLETED' WHEN stage_number = $3 THEN 'IN_PROGRESS' ELSE 'LOCKED' END
    WHERE tenant_id = $1 AND case_id = $2`, [T, id, stage]);
}
type Refused = Extract<Outcome, { ok: false }>;
async function refusedAndUnchanged(attempt: () => Promise<Outcome>, code: string | RegExp, id = caseId): Promise<Refused> {
  const before = await stateOf(id);
  const r = await attempt();
  expect(r.ok, JSON.stringify(r)).toBe(false);
  const refused = r as Refused;
  if (typeof code === 'string') expect(refused.code).toBe(code); else expect(refused.code).toMatch(code);
  expect(await stateOf(id)).toEqual(before);
  return refused;
}

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic gate engine practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'ge-client', 'Synthetic Client'), ('${T}', '${C2}', 'ge-client2', 'Second Synthetic Client'),
      ('${T2}', 'geForeign', 'ge-foreign-client', 'Foreign Synthetic Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES
      ('${T}', 'ge-mgr', 'practice_manager', 'active', NULL), ('${T}', 'ge-admin', 'admin', 'active', NULL),
      ('${T}', 'ge-prep', 'accountant', 'active', NULL), ('${T}', 'ge-rev', 'reviewer', 'active', NULL),
      ('${T}', 'ge-outsider', 'accountant', 'active', NULL), ('${T}', 'ge-rev2', 'reviewer', 'active', NULL),
      ('${T}', 'ge-client', 'client', 'active', '${C}'),
      ('${T2}', 'ge-foreign-prep', 'accountant', 'active', NULL), ('${T2}', 'ge-rev', 'reviewer', 'active', NULL);`);
  const practice = new PracticeStore(rpc());
  const staff = async (client: string, key: string, prep: string, rev: string) => {
    const eng = (await practice.createEngagement(T, client, 'ge-mgr', key, { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
    await practice.setEngagementStatus(T, client, 'ge-mgr', eng, 'active', 1);
    await practice.assign(T, client, 'ge-mgr', key + '-p', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: prep, reason: 'Initial staffing' });
    await practice.assign(T, client, 'ge-mgr', key + '-r', { engagementId: eng, taxYear: 2025, role: 'reviewer', userId: rev, reason: 'Initial staffing' });
    return (await cases().create(T, client, 'ge-mgr', key + '-case', { engagementId: eng, taxYear: 2025, returnFamily: '1040' }) as any).caseId as string;
  };
  caseId = await staff(C, 'ge-eng-1', 'ge-prep', 'ge-rev');
  caseOther = await staff(C2, 'ge-eng-2', 'ge-prep', 'ge-rev2');
}, 240_000);
afterAll(async () => { await db?.stop(); });
beforeEach(async () => { await atStage(2); await atStage(2, caseOther); });

describe('fabricated browser verdicts and missing evidence', () => {
  it('a caller-supplied verdict inside the attestation is ignored: system-verified checks are computed from records', async () => {
    await atStage(4); // Record: posted entries, none awaiting review, balanced ledger; this case has no ledger at all
    const forged = attestation(4, { passed: true, requirementsMet: true, checks: { postedEntries: true, ledgerBalanced: true }, gateResult: { passed: true } });
    for (const actor of ['ge-prep', 'ge-rev', 'ge-mgr']) {
      const r = await refusedAndUnchanged(() => advance(actor, 4, forged), 'STAGE_GATE_NOT_MET');
      expect(r.failed).toContain('postedEntries');
    }
  });
  it('a human-attested stage fails when a checklist item is not confirmed, whatever else the request claims', async () => {
    await refusedAndUnchanged(() => advance('ge-rev', 2, { confirmed: [ATTEST[2][0]], statement: 'Synthetic partial attestation.', checks: { documents_in_private_storage: true } }), 'STAGE_GATE_NOT_MET');
    await refusedAndUnchanged(() => advance('ge-rev', 2, { confirmed: ATTEST[2], statement: 'short' }), 'STAGE_ATTESTATION_INCOMPLETE');
    await refusedAndUnchanged(() => advance('ge-rev', 2, undefined), 'STAGE_ATTESTATION_INCOMPLETE');
    await refusedAndUnchanged(() => advance('ge-rev', 2, { confirmed: 'all', statement: 'Synthetic attestation with a string list.' }), 'STAGE_ATTESTATION_INCOMPLETE');
  });
  it('Review (06) needs an approved workpaper record, not a statement', async () => {
    await atStage(6);
    const r = await refusedAndUnchanged(() => advance('ge-rev', 6, { confirmed: ['workpapers_reviewed', 'no_unresolved_blocking_exceptions'], statement: 'Synthetic reviewer attestation for tests only.' }), 'STAGE_GATE_NOT_MET');
    expect(r.failed).toContain('approvedWorkpaperRecorded');
  });
});

describe('who may advance', () => {
  it('the preparer cannot attest a human-attested stage (maker-checker), and neither can a manager or administrator', async () => {
    for (const actor of ['ge-prep', 'ge-mgr', 'ge-admin']) await refusedAndUnchanged(() => advance(actor, 2, attestation(2)), 'STAGE_ATTESTATION_REQUIRES_REVIEWER');
  });
  it('a reviewer of another case, an unassigned accountant and the client are refused', async () => {
    await refusedAndUnchanged(() => advance('ge-rev2', 2, attestation(2)), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND|STAGE_ATTESTATION_REQUIRES_REVIEWER)$/);
    await refusedAndUnchanged(() => advance('ge-outsider', 2, attestation(2)), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND)$/);
    await refusedAndUnchanged(() => advance('ge-client', 2, attestation(2)), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND)$/);
  });
  it('another tenant cannot reach the case: neither its staff, nor this case reviewer acting through the other tenant', async () => {
    await refusedAndUnchanged(() => advance('ge-foreign-prep', 2, attestation(2), undefined, T), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND)$/);
    const before = await stateOf();
    const viaOtherTenant = await run(cases().advance(T2, caseId, 'ge-rev', 2, await version(), attestation(2) as any));
    expect(viaOtherTenant.ok).toBe(false);
    expect(await stateOf()).toEqual(before);
  });
  it('the reviewer of one client cannot advance another client case of the same preparer', async () => {
    await refusedAndUnchanged(() => advance('ge-rev', 2, attestation(2), undefined, T, caseOther), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_NOT_FOUND|STAGE_ATTESTATION_REQUIRES_REVIEWER)$/, caseOther);
  });
  it('a suspended member is refused at once (session or membership ended), and restored membership works again', async () => {
    await db.pool.query(`UPDATE taxguard_members SET status = 'suspended' WHERE tenant_id = $1 AND uid = 'ge-rev'`, [T]);
    try { await refusedAndUnchanged(() => advance('ge-rev', 2, attestation(2)), /^(PRACTICE_ACCESS_DENIED|CASE_ACCESS_DENIED|CASE_ACTOR_INACTIVE|CASE_NOT_FOUND|MEMBER_NOT_ACTIVE)$/); }
    finally { await db.pool.query(`UPDATE taxguard_members SET status = 'active' WHERE tenant_id = $1 AND uid = 'ge-rev'`, [T]); }
    expect(await advance('ge-rev', 2, attestation(2))).toMatchObject({ ok: true, activeStage: 3 });
  });
});

describe('sequence, revisions, duplicates and concurrency', () => {
  it('a stale case version is refused; skipping a stage is refused', async () => {
    const v = await version();
    await refusedAndUnchanged(() => advance('ge-rev', 2, attestation(2), v - 1), 'CASE_VERSION_CONFLICT');
    await refusedAndUnchanged(() => advance('ge-rev', 3, attestation(3), v), 'STAGE_SEQUENCE_INVALID');
    await refusedAndUnchanged(() => advance('ge-rev', 1, attestation(2), v), 'STAGE_SEQUENCE_INVALID');
  });
  it('a duplicate of a completed transition does not advance twice', async () => {
    const v = await version();
    expect(await advance('ge-rev', 2, attestation(2), v)).toMatchObject({ ok: true, activeStage: 3 });
    await refusedAndUnchanged(() => advance('ge-rev', 2, attestation(2), v), 'CASE_VERSION_CONFLICT');
    await refusedAndUnchanged(() => advance('ge-rev', 2, attestation(2)), 'STAGE_SEQUENCE_INVALID');
    expect((await stateOf()).case[0].active_stage).toBe(3);
  });
  it('of eight simultaneous identical requests exactly one advances the case, with one stage event', async () => {
    const v = await version();
    const eventsBefore = (await stateOf()).events[0].n;
    const results = await Promise.all(Array.from({ length: 8 }, () => run(cases().advance(T, caseId, 'ge-rev', 2, v, attestation(2) as any))));
    expect(results.filter(r => r.ok)).toHaveLength(1);
    for (const r of results.filter(x => !x.ok)) expect((r as any).code).toMatch(/^(CASE_VERSION_CONFLICT|CASE_BUSY|STAGE_SEQUENCE_INVALID)$/);
    const after = await stateOf();
    expect(after.case[0]).toMatchObject({ active_stage: 3, version: v + 1 });
    expect(after.events[0].n).toBe(eventsBefore + 1);
  });
});

describe('blocked stages, overrides and rollback', () => {
  it.each([[9, 'STAGE_BLOCKED_VERIFIED_TAX_ENGINE_REQUIRED'], [10, 'STAGE_BLOCKED_UPSTREAM_STAGES_BLOCKED'], [11, 'STAGE_BLOCKED_E_SIGNATURE_INTEGRATION_REQUIRED'],
    [12, 'STAGE_BLOCKED_FILING_NOT_AUTHORIZED'], [13, 'STAGE_BLOCKED_UPSTREAM_STAGES_BLOCKED'], [17, 'STAGE_BLOCKED_UPSTREAM_STAGES_BLOCKED']] as const)
  ('stage %i is blocked for everyone, with any attestation (%s)', async (stage, code) => {
    await atStage(stage);
    for (const actor of ['ge-rev', 'ge-mgr', 'ge-admin', 'ge-prep']) await refusedAndUnchanged(() => advance(actor, stage, attestation(2, { passed: true })), code);
  });
  it('API roles cannot write stage state or call the gate engine directly (no manual override)', async () => {
    const before = await stateOf();
    for (const role of ['anon', 'authenticated']) {
      const c = await db.pool.connect();
      try {
        await c.query('BEGIN'); await c.query(`SET LOCAL ROLE ${role}`);
        await expect(c.query(`UPDATE taxguard_stage_states SET status = 'COMPLETED' WHERE tenant_id = $1 AND case_id = $2`, [T, caseId])).rejects.toThrow();
        await c.query('ROLLBACK'); await c.query('BEGIN'); await c.query(`SET LOCAL ROLE ${role}`);
        await expect(c.query(`UPDATE taxguard_cases SET active_stage = 9 WHERE tenant_id = $1 AND case_id = $2`, [T, caseId])).rejects.toThrow();
        await c.query('ROLLBACK'); await c.query('BEGIN'); await c.query(`SET LOCAL ROLE ${role}`);
        await expect(c.query(`SELECT public.taxguard_case_advance($1, $2, 'ge-rev', 2, 1, '{}'::jsonb)`, [T, caseId])).rejects.toThrow(/permission denied/);
        await c.query('ROLLBACK'); await c.query('BEGIN'); await c.query(`SET LOCAL ROLE ${role}`);
        await expect(c.query(`INSERT INTO taxguard_case_stage_events(tenant_id, case_id, action, from_stage, to_stage, evidence_type, evidence, actor_uid, actor_role)
          VALUES ($1, $2, 'ADVANCED', 2, 3, 'HUMAN_ATTESTED', '{}'::jsonb, 'ge-rev', 'reviewer')`, [T, caseId])).rejects.toThrow();
      } finally { await c.query('ROLLBACK').catch(() => undefined); c.release(); }
    }
    expect(await stateOf()).toEqual(before);
  });
  it('the stage event history is append-only, even for the database owner', async () => {
    expect(await advance('ge-rev', 2, attestation(2))).toMatchObject({ ok: true });
    await expect(db.pool.query(`UPDATE taxguard_case_stage_events SET to_stage = 9 WHERE tenant_id = $1 AND case_id = $2`, [T, caseId])).rejects.toThrow();
    await expect(db.pool.query(`DELETE FROM taxguard_case_stage_events WHERE tenant_id = $1 AND case_id = $2`, [T, caseId])).rejects.toThrow();
  });
  it('a failure after the stage updates rolls the whole transaction back', async () => {
    // Fault injection (test only): the event insert, which follows the stage-state and case updates, fails.
    await db.pool.query(`CREATE FUNCTION pg_temp_fail_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_FAULT'; END $$;
      CREATE TRIGGER zz_synthetic_fault BEFORE INSERT ON taxguard_case_stage_events FOR EACH ROW EXECUTE FUNCTION pg_temp_fail_event();`);
    try {
      const before = await stateOf();
      const r = await advance('ge-rev', 2, attestation(2));
      expect(r.ok).toBe(false);
      expect(await stateOf()).toEqual(before);
    } finally {
      await db.pool.query(`DROP TRIGGER zz_synthetic_fault ON taxguard_case_stage_events; DROP FUNCTION pg_temp_fail_event();`);
    }
    expect(await advance('ge-rev', 2, attestation(2))).toMatchObject({ ok: true, activeStage: 3 });
  });
  it('a case on hold cannot advance', async () => {
    await db.pool.query(`UPDATE taxguard_cases SET status = 'ON_HOLD' WHERE tenant_id = $1 AND case_id = $2`, [T, caseId]);
    await refusedAndUnchanged(() => advance('ge-rev', 2, attestation(2)), 'CASE_NOT_ACTIVE');
  });
});
