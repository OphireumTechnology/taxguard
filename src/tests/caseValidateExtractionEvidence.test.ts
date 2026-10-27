import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals } from './helpers/pgliteRpc';

// Proposal 20261018180000: Stage 03 (Validate) requires every OCR proposal on the current version of a usable document
// for the case's client, engagement and year to be decided by staff. Synthetic rows, inserted directly so each boundary
// can be isolated.
const T = 'tenantA', C = 'cxClient', OTHER = 'cxOther';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const q = async <R = any>(sql: string, p: unknown[] = []) => (await fixture.pg.query<R>(sql, p)).rows;
const checks = async (caseId = 'cx-case') => (await q<{ c: Record<string, boolean> }>(`SELECT public.taxguard_case_evidence_checks(c) AS c FROM taxguard_cases c WHERE case_id = $1`, [caseId]))[0].c;
const doc = (id: string, version: number, status: string, scope: { client?: string; engagement?: string; year?: number } = {}) =>
  q(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by)
     VALUES ($1, $2, $3, $4, $5, 'cx-case', $6, repeat('a', 64), 'application/pdf', $7, 'CLEAN', 'cx-client-user')`,
    [id, T, scope.client ?? C, scope.engagement ?? 'cx-eng', scope.year ?? 2025, version, status]);
const proposal = (id: string, version: number, decision: string | null = null, client = C) =>
  q(`INSERT INTO taxguard_extracted_data(document_id, case_id, tenant_id, client_id, document_version, field_key, field_value, confidence, provenance, is_ai_proposed_only, ocr_provider, decision)
     VALUES ($1, 'cx-case', $2, $3, $4, 'w2.box1_wages', '"100.00"', 0.9, '{"provider":"synthetic"}', $5, 'synthetic', $6)`,
    [id, T, client, version, decision === null || decision === 'REJECTED', decision]);
const undecided = async () => (await checks()).noUndecidedExtractionProposals;

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|250000|260000|270000|290000|310000)_|^20261014500000_|^20261015050000_|^20261018(000000|050000|180000)_/);
}, 90000);
afterAll(async () => { await fixture?.pg.close(); });
beforeEach(async () => {
  await fixture.pg.exec(`DELETE FROM taxguard_extracted_data WHERE tenant_id = '${T}' AND client_id IN ('${C}','${OTHER}');
    DELETE FROM taxguard_documents WHERE tenant_id = '${T}' AND client_id IN ('${C}','${OTHER}');
    DELETE FROM taxguard_cases WHERE tenant_id = '${T}' AND case_id LIKE 'cx-%';`);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}','${C}','cx-client-user','Synthetic CX'),('${T}','${OTHER}','cx-other','Other CX')
    ON CONFLICT DO NOTHING;
    INSERT INTO taxguard_cases(case_id, tenant_id, client_id, engagement_id, tax_year, active_stage, client_uid, preparer_uid, reviewer_uid, created_by, updated_by)
      VALUES ('cx-case', '${T}', '${C}', 'cx-eng', 2025, 3, 'cx-client-user', 'cx-prep', 'cx-rev', 'cx-mgr', 'cx-mgr');`);
});

describe('stage 03 extraction evidence', () => {
  it('blocks Validate while a proposal on a reviewed document is undecided, and clears once each is decided', async () => {
    await doc('d1', 1, 'VERIFIED');
    await proposal('d1', 1);
    await proposal('d1', 1, 'ACCEPTED');
    expect(await checks()).toMatchObject({ noUndecidedExtractionProposals: false, noDocumentsAwaitingReview: true, noDocumentsAwaitingScan: true });
    await q(`UPDATE taxguard_extracted_data SET decision = 'CORRECTED', is_ai_proposed_only = false, verified_value = '"101.00"' WHERE document_id = 'd1' AND decision IS NULL`);
    expect(Object.values(await checks()).every(Boolean)).toBe(true);
  });

  it('a rejected proposal settles it as much as an accepted one', async () => {
    await doc('d1', 1, 'VERIFIED');
    await proposal('d1', 1, 'REJECTED');
    expect(await undecided()).toBe(true);
  });

  it('ignores proposals on superseded versions and on rejected documents, but not on the current version', async () => {
    await doc('d1', 1, 'SUPERSEDED'); await proposal('d1', 1);
    await doc('d1', 2, 'VERIFIED');
    await doc('d2', 1, 'REJECTED'); await proposal('d2', 1);
    expect(await undecided()).toBe(true);
    await proposal('d1', 2);
    expect(await undecided()).toBe(false);
  });

  it('is not blocked by another client, engagement or tax year, nor unlocked by a decision there', async () => {
    await doc('x1', 1, 'VERIFIED', { client: OTHER }); await proposal('x1', 1, null, OTHER);
    await doc('x2', 1, 'VERIFIED', { engagement: 'cx-eng-2' }); await proposal('x2', 1);
    await doc('x3', 1, 'VERIFIED', { year: 2024 }); await proposal('x3', 1);
    expect(await undecided()).toBe(true);
    // A decision recorded on another client's document does not settle this client's undecided proposal.
    await doc('d1', 1, 'VERIFIED'); await proposal('d1', 1);
    await proposal('x1', 1, 'ACCEPTED', OTHER);
    expect(await undecided()).toBe(false);
  });

  it('adds the check only at Validate: Collect, Review and other stages are unchanged', async () => {
    await doc('d1', 1, 'VERIFIED'); await proposal('d1', 1);
    await q(`UPDATE taxguard_cases SET active_stage = 2 WHERE case_id = 'cx-case'`);
    expect(Object.keys(await checks()).sort()).toEqual(['noDocumentsAwaitingScan', 'requiredDocumentRequestsResolved']);
    await q(`UPDATE taxguard_cases SET active_stage = 6 WHERE case_id = 'cx-case'`);
    expect(Object.keys(await checks())).toEqual(['approvedWorkpaperRecorded']);
    await q(`UPDATE taxguard_cases SET active_stage = 4 WHERE case_id = 'cx-case'`);
    expect(await checks()).toEqual({});
    await q(`UPDATE taxguard_cases SET active_stage = 3 WHERE case_id = 'cx-case'`);
    expect(Object.keys(await checks()).sort()).toEqual(['noDocumentsAwaitingReview', 'noDocumentsAwaitingScan', 'noOutstandingReplacementRequests',
      'noUndecidedExtractionProposals', 'requiredDocumentRequestsResolved']);
  });

  it('cannot be called through the API roles', async () => {
    for (const role of ['service_role', 'anon', 'authenticated'])
      expect((await q<{ ok: boolean }>(`SELECT has_function_privilege($1, 'public.taxguard_case_evidence_checks(public.taxguard_cases)', 'EXECUTE') AS ok`, [role]))[0].ok).toBe(false);
  });
});
