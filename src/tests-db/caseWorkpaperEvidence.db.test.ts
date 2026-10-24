import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';

// Stage 06 (Review) is attested by the independent reviewer ("workpapers reviewed"). The attestation must refer
// to a recorded book-to-tax workpaper that was itself approved under maker-checker for this client, tax year and
// return family; it cannot stand in for a workpaper that does not exist. Synthetic data only.
const T = 'tenantCaseWp', OTHER_CLIENT = 'cwOther';
let db: TestDatabase; let client = ''; let caseId = '';
const rpc = () => pgRpc(db.pool);
const cases = () => new CaseStore(rpc());
const version = async () => (await cases().detail(T, caseId, 'cw-mgr') as any).case.version as number;
const attestReview = async () => cases().advance(T, caseId, 'cw-rev', 6, await version(),
  { confirmed: ['workpapers_reviewed', 'no_unresolved_blocking_exceptions'], statement: 'Synthetic reviewer attestation for tests only.' })
  .then((): { ok: boolean; code?: string; detail?: string } => ({ ok: true }), (e: any) => ({ ok: false, code: e.code, detail: JSON.stringify(e) }));
async function workpaper(clientId: string, year: number, family: string, status: string) {
  // One approved mapping set per client, year and return family (schema rule): reuse it when present.
  const existing = (await db.pool.query(`SELECT set_id FROM taxguard_b2t_mapping_sets WHERE tenant_id = $1 AND client_id = $2 AND tax_year = $3 AND return_family = $4`,
    [T, clientId, year, family])).rows[0]?.set_id;
  const set = existing ?? (await db.pool.query(`INSERT INTO taxguard_b2t_mapping_sets(tenant_id, client_id, tax_year, return_family, version, status, prepared_by, reviewed_by)
    VALUES ($1::text, $2::text, $3::integer, $4::text, (SELECT COALESCE(max(version), 0) + 1 FROM taxguard_b2t_mapping_sets
      WHERE tenant_id = $1::text AND client_id = $2::text AND tax_year = $3::integer AND return_family = $4::text),
      'APPROVED', 'cw-acct', 'cw-rev') RETURNING set_id`, [T, clientId, year, family])).rows[0].set_id;
  await db.pool.query(`INSERT INTO taxguard_b2t_workpapers(tenant_id, client_id, tax_year, return_family, set_id, snapshot, snapshot_sha256, reconciled, unmapped_accounts, status, generated_by, reviewed_by)
    VALUES ($1::text, $2::text, $3::integer, $4::text, $5::uuid, '{}'::jsonb, repeat('c', 64), true, 0, $6::text, 'cw-acct', $7::text)`, [T, clientId, year, family, set, status, status === 'DRAFT' ? null : 'cw-rev']);
}

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic workpaper evidence practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', 'cwClient', 'cw-client', 'Synthetic Client'), ('${T}', '${OTHER_CLIENT}', 'cw-other', 'Other Synthetic Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status, client_id) VALUES ('${T}', 'cw-mgr', 'practice_manager', 'active', NULL), ('${T}', 'cw-acct', 'accountant', 'active', NULL),
      ('${T}', 'cw-rev', 'reviewer', 'active', NULL);`);
  client = 'cwClient';
  const practice = new PracticeStore(rpc());
  const eng = (await practice.createEngagement(T, client, 'cw-mgr', 'cw-engagement', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, client, 'cw-mgr', eng, 'active', 1);
  await practice.assign(T, client, 'cw-mgr', 'cw-assign-preparer', { engagementId: eng, taxYear: 2025, role: 'preparer', userId: 'cw-acct', reason: 'Initial staffing' });
  await practice.assign(T, client, 'cw-mgr', 'cw-assign-reviewer', { engagementId: eng, taxYear: 2025, role: 'reviewer', userId: 'cw-rev', reason: 'Initial staffing' });
  caseId = (await cases().create(T, client, 'cw-mgr', 'cw-case-key-1', { engagementId: eng, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  // Fixture: stages 1-5 already completed (their own gates are covered elsewhere); the case is at Review.
  await db.pool.query(`UPDATE taxguard_cases SET active_stage = 6 WHERE tenant_id = $1 AND case_id = $2;
    UPDATE taxguard_stage_states SET status = CASE WHEN stage_number < 6 THEN 'COMPLETED' WHEN stage_number = 6 THEN 'IN_PROGRESS' ELSE status END
      WHERE tenant_id = $1 AND case_id = $2`.replace(/\$1/g, `'${T}'`).replace(/\$2/g, `'${caseId}'`));
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('Stage 06 attestation requires an approved workpaper', () => {
  it('refuses the attestation when no workpaper is recorded', async () => {
    const r = await attestReview();
    expect(r.ok).toBe(false);
    expect(r.code).toBe('STAGE_GATE_NOT_MET');
    expect(r.detail).toContain('approvedWorkpaperRecorded');
  });

  it('does not accept draft or rejected workpapers, or approved ones for another year, return family or client', async () => {
    await workpaper(client, 2025, '1040', 'DRAFT');
    await workpaper(client, 2025, '1040', 'REJECTED');
    await workpaper(client, 2024, '1040', 'APPROVED');
    await workpaper(client, 2025, '1065', 'APPROVED');
    await workpaper(OTHER_CLIENT, 2025, '1040', 'APPROVED');
    const r = await attestReview();
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('approvedWorkpaperRecorded');
    expect((await cases().detail(T, caseId, 'cw-mgr') as any).case.activeStage).toBe(6);
  });

  it('accepts the reviewer\'s attestation once an approved workpaper for this client, year and return family exists', async () => {
    await workpaper(client, 2025, '1040', 'APPROVED');
    const r = await attestReview();
    expect(r.ok, r.detail).toBe(true);
    expect((await cases().detail(T, caseId, 'cw-mgr') as any).case.activeStage).toBe(7);
    const event = (await db.pool.query(`SELECT evidence FROM taxguard_case_stage_events WHERE tenant_id = $1 AND case_id = $2 AND from_stage = 6`, [T, caseId])).rows[0];
    expect(event.evidence.checks).toMatchObject({ approvedWorkpaperRecorded: true, workpapers_reviewed: true, noEntriesAwaitingReview: true });
  });
});
