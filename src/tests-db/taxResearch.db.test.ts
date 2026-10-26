import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pgRpc, startDatabase, type TestDatabase } from './harness';
import { PracticeStore } from '../server/taxguard/practice/practiceStore';
import { CaseStore } from '../server/taxguard/practice/caseStore';

// Tax research memos (proposal 20261018150000, review only). Research is professional support for one case. It is
// reachable only through the case's access rule, every citation states its authority level, AI inference never
// supports an approval, and approval by the case's independent reviewer changes no return. Synthetic data only.
const T = 'tenantTaxResearch', T2 = 'tenantTaxResearchOther', C = 'trClient', C2 = 'trClientOther';
let db: TestDatabase; let practice: PracticeStore; let cases: CaseStore; let caseId = ''; let otherCaseId = ''; let year2026CaseId = '';
const code = (p: Promise<unknown>) => p.then(() => 'OK', (e: any) => e?.code ?? String(e));
const rpc = async (fn: string, args: Record<string, unknown>) => {
  const r = await pgRpc(db.pool).rpc(fn, args);
  if (r.error) throw Object.assign(new Error(r.error.message), { code: r.error.message });
  return r.data as any;
};
const open = (actor: string, kase = caseId, tenant = T) => rpc('taxguard_tax_research_open', { p_tenant: tenant, p_actor: actor, p_case: kase,
  p_question: 'Is the synthetic home-office expense deductible for this engagement year?' });
const cite = (actor: string, memo: string, citation: Record<string, unknown>) => rpc('taxguard_tax_research_cite', { p_tenant: T, p_actor: actor, p_memo: memo, p_citation: citation });
const submit = (actor: string, memo: string, version: number) => rpc('taxguard_tax_research_submit', { p_tenant: T, p_actor: actor, p_memo: memo,
  p_conclusion: 'Synthetic conclusion: deductible subject to the cited exclusive-use test.', p_version: version });
const review = (actor: string, memo: string, decision: string, version: number) => rpc('taxguard_tax_research_review', { p_tenant: T, p_actor: actor, p_memo: memo,
  p_decision: decision, p_note: 'Synthetic independent review of the cited authority.', p_version: version });
const audits = async (action: string) => Number((await db.pool.query(`SELECT count(*)::int AS n FROM taxguard_audit_log WHERE tenant_id = $1 AND action = $2`, [T, action])).rows[0].n);

beforeAll(async () => {
  db = await startDatabase();
  await db.pool.query(`INSERT INTO taxguard_tenants(id, name) VALUES ('${T}', 'Synthetic research practice'), ('${T2}', 'Other synthetic practice');
    INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}', '${C}', 'tr-client', 'Synthetic Research Client'), ('${T}', '${C2}', 'tr-client2', 'Other Synthetic Client');
    INSERT INTO taxguard_members(tenant_id, uid, role, status) VALUES ('${T}', 'tr-mgr', 'practice_manager', 'active'), ('${T}', 'tr-prep', 'accountant', 'active'),
      ('${T}', 'tr-rev', 'reviewer', 'active'), ('${T}', 'tr-out', 'accountant', 'active'), ('${T}', 'tr-rev-other', 'reviewer', 'active'), ('${T2}', 'tr-foreign', 'practice_manager', 'active');
    INSERT INTO taxguard_tax_sources(tenant_id, source_id, jurisdiction, jurisdiction_code, authority_type, title, issuer, citation, tax_years, document_sha256, status, registered_by, verified_by, verified_at) VALUES
      ('${T}', 'syn.irc.280a', 'federal', 'US', 'statute', 'Synthetic business use of home', 'Synthetic issuer', 'Synthetic IRC 280A', ARRAY[2025], '${'c'.repeat(64)}', 'VERIFIED', 'tr-mgr', 'tr-rev', now()),
      ('${T}', 'syn.unverified', 'federal', 'US', 'publication', 'Synthetic unverified publication', 'Synthetic issuer', 'Synthetic Pub 1', ARRAY[2025], NULL, 'PROPOSED', 'tr-mgr', NULL, NULL),
      ('${T}', 'syn.irc.2024only', 'federal', 'US', 'statute', 'Synthetic prior-year provision', 'Synthetic issuer', 'Synthetic IRC 1', ARRAY[2024], '${'d'.repeat(64)}', 'VERIFIED', 'tr-mgr', 'tr-rev', now());`);
  practice = new PracticeStore(pgRpc(db.pool)); cases = new CaseStore(pgRpc(db.pool));
  const staff = async (client: string, key: string, years: number[], preparer: string, reviewer: string) => {
    const e = (await practice.createEngagement(T, client, 'tr-mgr', key, { title: 'Synthetic return', type: 'tax_preparation', taxYears: years })).engagementId;
    await practice.setEngagementStatus(T, client, 'tr-mgr', e, 'active', 1);
    for (const y of years) {
      await practice.assign(T, client, 'tr-mgr', `${key}-p-${y}`, { engagementId: e, taxYear: y, role: 'preparer', userId: preparer, reason: 'Synthetic staffing' });
      await practice.assign(T, client, 'tr-mgr', `${key}-r-${y}`, { engagementId: e, taxYear: y, role: 'reviewer', userId: reviewer, reason: 'Synthetic staffing' });
    }
    return e;
  };
  const e = await staff(C, 'tr-engagement-a', [2025], 'tr-prep', 'tr-rev');
  caseId = (await cases.create(T, C, 'tr-mgr', 'tr-case-1', { engagementId: e, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const e2 = await staff(C2, 'tr-engagement-b', [2025], 'tr-out', 'tr-rev-other');
  otherCaseId = (await cases.create(T, C2, 'tr-mgr', 'tr-case-2', { engagementId: e2, taxYear: 2025, returnFamily: '1040' }) as any).caseId;
  const e3 = await practice.createEngagement(T, C, 'tr-mgr', 'tr-eng-2026', { title: 'Synthetic 2026 return', type: 'tax_preparation', taxYears: [2026] });
  await practice.setEngagementStatus(T, C, 'tr-mgr', e3.engagementId, 'active', 1);
  await practice.assign(T, C, 'tr-mgr', 'tr-eng-2026-p', { engagementId: e3.engagementId, taxYear: 2026, role: 'preparer', userId: 'tr-out', reason: 'Synthetic staffing' });
  await practice.assign(T, C, 'tr-mgr', 'tr-eng-2026-r', { engagementId: e3.engagementId, taxYear: 2026, role: 'reviewer', userId: 'tr-rev-other', reason: 'Synthetic staffing' });
  year2026CaseId = (await cases.create(T, C, 'tr-mgr', 'tr-case-2026', { engagementId: e3.engagementId, taxYear: 2026, returnFamily: '1040' }) as any).caseId;
}, 240_000);
afterAll(async () => { await db?.stop(); });

describe('tax research memos', () => {
  it('a reviewer approves a memo with verified authoritative support; it changes no return and is audited', async () => {
    const memo = await open('tr-prep');
    expect(memo).toMatchObject({ status: 'DRAFT', case_id: caseId, client_id: C, tax_year: 2025, prepared_by: 'tr-prep', returnUse: 'BLOCKED' });
    await cite('tr-prep', memo.memo_id, { authorityLevel: 'AUTHORITATIVE', sourceId: 'syn.irc.280a', note: 'Exclusive and regular use test.' });
    await cite('tr-prep', memo.memo_id, { authorityLevel: 'SECONDARY', reference: 'Synthetic treatise section 4', note: 'Practitioner commentary.' });
    const withAi = await cite('tr-prep', memo.memo_id, { authorityLevel: 'AI_INFERENCE', note: 'Assistant suggested the simplified method.' });
    expect(withAi.citations.map((c: any) => c.authority_level)).toEqual(['AUTHORITATIVE', 'SECONDARY', 'AI_INFERENCE']);
    const submitted = await submit('tr-prep', memo.memo_id, withAi.version);
    const approved = await review('tr-rev', memo.memo_id, 'approve', submitted.version);
    expect(approved).toMatchObject({ status: 'APPROVED', reviewed_by: 'tr-rev', returnUse: 'BLOCKED' });
    expect(await audits('TAX_RESEARCH_APPROVED')).toBe(1);
  });

  it('refuses approval without verified authority for the case year: AI inference and secondary support never suffice', async () => {
    const memo = await open('tr-prep');
    await cite('tr-prep', memo.memo_id, { authorityLevel: 'AI_INFERENCE', note: 'Assistant inference only.' });
    const v = await cite('tr-prep', memo.memo_id, { authorityLevel: 'SECONDARY', reference: 'Synthetic article', note: 'Secondary commentary only.' });
    const submitted = await submit('tr-prep', memo.memo_id, v.version);
    expect(await code(review('tr-rev', memo.memo_id, 'approve', submitted.version))).toBe('RESEARCH_AUTHORITY_REQUIRED');
    // A rejection with a recorded reason is still possible.
    expect((await review('tr-rev', memo.memo_id, 'reject', submitted.version)).status).toBe('REJECTED');
  });

  it('accepts as authoritative only a verified source that covers the case year', async () => {
    const memo = await open('tr-prep');
    expect(await code(cite('tr-prep', memo.memo_id, { authorityLevel: 'AUTHORITATIVE', sourceId: 'syn.unverified', note: 'Not yet verified.' }))).toBe('RESEARCH_SOURCE_NOT_VERIFIED');
    expect(await code(cite('tr-prep', memo.memo_id, { authorityLevel: 'AUTHORITATIVE', sourceId: 'syn.irc.2024only', note: 'Prior year only.' }))).toBe('RESEARCH_SOURCE_NOT_VERIFIED');
    expect(await code(cite('tr-prep', memo.memo_id, { authorityLevel: 'AI_INFERENCE', sourceId: 'syn.irc.280a', note: 'AI cannot cite a source.' }))).toBe('RESEARCH_INPUT_INVALID');
    expect(await code(cite('tr-prep', memo.memo_id, { authorityLevel: 'AI_INFERENCE', reference: 'Some reference', note: 'AI cannot cite a reference.' }))).toBe('RESEARCH_INPUT_INVALID');
    expect(await code(cite('tr-prep', memo.memo_id, { authorityLevel: 'SECONDARY', note: 'Secondary without a reference.' }))).toBe('RESEARCH_INPUT_INVALID');
    expect((await rpc('taxguard_tax_research_list', { p_tenant: T, p_actor: 'tr-prep', p_case: caseId })).find((m: any) => m.memo_id === memo.memo_id).citations).toEqual([]);
  });

  it('enforces maker-checker and the case reviewer', async () => {
    const memo = await open('tr-rev');
    const v = await cite('tr-rev', memo.memo_id, { authorityLevel: 'AUTHORITATIVE', sourceId: 'syn.irc.280a', note: 'Prepared by the reviewer.' });
    const submitted = await submit('tr-rev', memo.memo_id, v.version);
    expect(await code(review('tr-rev', memo.memo_id, 'approve', submitted.version))).toBe('MAKER_CHECKER_VIOLATION');
    const other = await open('tr-prep');
    const ov = await cite('tr-prep', other.memo_id, { authorityLevel: 'AUTHORITATIVE', sourceId: 'syn.irc.280a', note: 'Prepared by the preparer.' });
    const os = await submit('tr-prep', other.memo_id, ov.version);
    for (const who of ['tr-prep', 'tr-mgr', 'tr-rev-other']) expect(await code(review(who, other.memo_id, 'approve', os.version)), who).toBe(who === 'tr-rev-other' ? 'RESEARCH_MEMO_NOT_FOUND' : 'RESEARCH_REVIEWER_REQUIRED');
    expect(await code(review('tr-rev', other.memo_id, 'approve', os.version - 1))).toBe('RESEARCH_VERSION_CONFLICT');
  });

  it('keeps research inside its case: other clients, years and tenants read as not found', async () => {
    const memo = await open('tr-prep');
    // Unassigned staff of the same tenant, a member staffed only on another client, on another year, and another tenant.
    for (const who of ['tr-out', 'tr-rev-other']) expect(await code(cite(who, memo.memo_id, { authorityLevel: 'AI_INFERENCE', note: 'Out-of-scope attempt.' })), who).toBe('RESEARCH_MEMO_NOT_FOUND');
    expect(await code(rpc('taxguard_tax_research_list', { p_tenant: T, p_actor: 'tr-out', p_case: caseId }))).toBe('CASE_NOT_FOUND');
    expect(await code(rpc('taxguard_tax_research_list', { p_tenant: T2, p_actor: 'tr-foreign', p_case: caseId }))).toBe('CASE_NOT_FOUND');
    expect(await code(open('tr-prep', otherCaseId))).toBe('CASE_NOT_FOUND');
    expect(await code(open('tr-prep', year2026CaseId))).toBe('CASE_NOT_FOUND');
    const mine = await rpc('taxguard_tax_research_list', { p_tenant: T, p_actor: 'tr-prep', p_case: caseId });
    expect(mine.every((m: any) => m.client_id === C && m.case_id === caseId && m.tax_year === 2025)).toBe(true);
    // The other client's preparer sees only that client's research.
    expect(await rpc('taxguard_tax_research_list', { p_tenant: T, p_actor: 'tr-out', p_case: otherCaseId })).toEqual([]);
  });

  it('makes decided memos and their citations immutable, also to the database owner', async () => {
    const memo = await open('tr-prep');
    const v = await cite('tr-prep', memo.memo_id, { authorityLevel: 'AUTHORITATIVE', sourceId: 'syn.irc.280a', note: 'Support.' });
    const s = await submit('tr-prep', memo.memo_id, v.version);
    await review('tr-rev', memo.memo_id, 'approve', s.version);
    await expect(db.pool.query(`UPDATE taxguard_tax_research_memos SET conclusion = 'Changed after approval' WHERE memo_id = $1`, [memo.memo_id])).rejects.toThrow('RESEARCH_MEMO_IMMUTABLE');
    await expect(db.pool.query(`DELETE FROM taxguard_tax_research_citations WHERE memo_id = $1`, [memo.memo_id])).rejects.toThrow('RESEARCH_MEMO_IMMUTABLE');
    expect(await code(cite('tr-prep', memo.memo_id, { authorityLevel: 'SECONDARY', reference: 'Late add', note: 'Too late.' }))).toBe('RESEARCH_MEMO_NOT_EDITABLE');
  });

  it('ends access when the live assignment ends: a revoked preparer can no longer read or extend the memo', async () => {
    // Runs last: it revokes tr-prep's 2025 preparer assignment for this client.
    const memo = await open('tr-prep');
    const assignment = (await db.pool.query(`SELECT id FROM taxguard_staff_assignments WHERE tenant_id = $1 AND client_id = $2 AND user_id = 'tr-prep'
      AND role = 'preparer' AND status = 'ACTIVE'`, [T, C])).rows[0].id;
    await practice.unassign(T, C, 'tr-mgr', assignment, 'Synthetic revocation of the preparer');
    expect(await code(cite('tr-prep', memo.memo_id, { authorityLevel: 'AI_INFERENCE', note: 'After revocation.' }))).toBe('RESEARCH_MEMO_NOT_FOUND');
    expect(await code(rpc('taxguard_tax_research_list', { p_tenant: T, p_actor: 'tr-prep', p_case: caseId }))).toBe('CASE_NOT_FOUND');
    expect(await code(open('tr-prep'))).toBe('CASE_NOT_FOUND');
    // The record is intact and still reachable by the case's live reviewer.
    const asReviewer = await rpc('taxguard_tax_research_list', { p_tenant: T, p_actor: 'tr-rev', p_case: caseId });
    expect(asReviewer.find((m: any) => m.memo_id === memo.memo_id)).toMatchObject({ status: 'DRAFT', prepared_by: 'tr-prep', citations: [] });
  });

});
