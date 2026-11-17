import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';

// Continuity between durable Stage 01 onboarding (proposal 20261018030000) and the case workflow: a case's
// "Onboard" stage must not complete for a client whose onboarding the practice has not approved, even though
// every staffing check passes. Synthetic data only; the consent version is SYNTHETIC test data.
const T = 'tenantCaseOnb';
let db: TestDatabase; let client = ''; let caseId = ''; let engagementId = '';
const rpc = () => pgRpc(db.pool);
const call = async (fn: string, args: Record<string, unknown>) => {
  const r = await rpc().rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message, detail: (r.error as any).details });
  return r.data as any;
};

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic case onboarding practice');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'co-mgr', 'practice_manager', 'active'), ('${T}', 'co-acct', 'accountant', 'active'), ('${T}', 'co-rev', 'reviewer', 'active');
    INSERT INTO taxguard_onb_consent_versions(tenant_id, version, consent_text, approved_by, approved_at, status)
      VALUES ('${T}', 'SYNTHETIC-TEST-1', repeat('Synthetic test consent wording only, not legal text. ', 3), 'Synthetic test fixture', now(), 'APPROVED');`);
  const provisioned = await rpc().rpc('taxguard_provision_client_identity', { p_tenant: T, p_uid: 'co-client', p_email: 'co-client@example.test', p_name: 'Synthetic Client' });
  expect(provisioned.error).toBeNull();
  client = provisioned.data.clientId;
  const practice = new PracticeStore(rpc());
  engagementId = (await practice.createEngagement(T, client, 'co-mgr', 'co-engagement', { title: 'Synthetic 2025 return', type: 'tax_preparation', taxYears: [2025] })).engagementId;
  await practice.setEngagementStatus(T, client, 'co-mgr', engagementId, 'active', 1);
  await practice.assign(T, client, 'co-mgr', 'co-assign-preparer', { engagementId, taxYear: 2025, role: 'preparer', userId: 'co-acct', reason: 'Initial staffing' });
  await practice.assign(T, client, 'co-mgr', 'co-assign-reviewer', { engagementId, taxYear: 2025, role: 'reviewer', userId: 'co-rev', reason: 'Initial staffing' });
  caseId = (await new CaseStore(rpc()).create(T, client, 'co-mgr', 'co-case-key-1', { engagementId, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
}, 240_000);
afterAll(async () => { await db?.stop(); });

const version = async () => (await new CaseStore(rpc()).detail(T, caseId, 'co-mgr') as any).case.version as number;
type Outcome = { ok: boolean; code?: string; e?: unknown };
const advanceStageOne = async (): Promise<Outcome> => new CaseStore(rpc()).advance(T, caseId, 'co-acct', 1, await version())
  .then((): Outcome => ({ ok: true }), (e: any): Outcome => ({ ok: false, code: e.code, e }));

describe('case Stage 1 requires server-recorded onboarding completion', () => {
  it('refuses Stage 1 for a fully staffed case while the client\'s onboarding is not approved', async () => {
    const outcome = await advanceStageOne();
    expect(outcome.ok).toBe(false);
    expect(outcome.code).toBe('STAGE_GATE_NOT_MET');
    expect(JSON.stringify(outcome.e)).toContain('clientOnboardingCompleted');
    expect((await new CaseStore(rpc()).detail(T, caseId, 'co-mgr') as any).case.activeStage).toBe(1);
  });

  it('a submitted but not yet approved onboarding still blocks; approval opens Stage 1', async () => {
    let v = await call('taxguard_onb_save', { p_tenant: T, p_client: client, p_actor: 'co-client', p_revision: 0, p_fields: {
      taxpayerType: 'individual', legalName: 'Synthetic Case Client', street: '1 Synthetic Way', city: 'Columbia', state: 'SC', postalCode: '29201', tinType: 'SSN', tinLast4: '2468' } });
    v = await call('taxguard_onb_submit', { p_tenant: T, p_client: client, p_actor: 'co-client', p_revision: v.revision, p_consent_version: 'SYNTHETIC-TEST-1', p_signer: 'Synthetic Case Client' });
    expect((await advanceStageOne()).ok).toBe(false);
    await db.pool.query(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, version, hash, mime_type, status, category, created_by)
      VALUES ('co-id-doc', $1, $2, $3, 2025, 1, repeat('b', 64), 'application/pdf', 'VERIFIED', 'identity', 'co-seed')`, [T, client, engagementId]);
    await call('taxguard_onb_decide', { p_tenant: T, p_client: client, p_actor: 'co-mgr', p_revision: v.revision, p_decision: 'approve', p_client_reason: null, p_internal_note: null, p_duplicate_override: false });
    const outcome = await advanceStageOne();
    expect(outcome.ok, String(outcome.code)).toBe(true);
    expect((await new CaseStore(rpc()).detail(T, caseId, 'co-mgr') as any).case.activeStage).toBe(2);
  });
});
