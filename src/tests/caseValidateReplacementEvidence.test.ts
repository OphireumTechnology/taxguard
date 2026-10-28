import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { capabilityFixture } from './aiCapabilities.fixture';
import { applyProposals } from './helpers/pgliteRpc';

// Proposal 20261018000000: stage 03 (Validate) evidence, computed only from durable document versions.
// Synthetic rows, inserted directly so each boundary can be isolated.
const T = 'tenantA', C = 'cvClient', OTHER = 'cvOther';
let fixture: Awaited<ReturnType<typeof capabilityFixture>>;
const q = async <R = any>(sql: string, p: unknown[] = []) => (await fixture.pg.query<R>(sql, p)).rows;
const checks = async (caseId = 'cv-case') => (await q<{ c: Record<string, boolean> }>(`SELECT public.taxguard_case_evidence_checks(c) AS c FROM taxguard_cases c WHERE case_id = $1`, [caseId]))[0].c;
const doc = (id: string, version: number, status: string, scope: { client?: string; engagement?: string; year?: number; caseId?: string } = {}) =>
  q(`INSERT INTO taxguard_documents(document_id, tenant_id, client_id, engagement_id, tax_year, case_id, version, hash, mime_type, status, quarantine_status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, repeat('a', 64), 'application/pdf', $8, $9, 'cv-client-user')`,
    [id, T, scope.client ?? C, scope.engagement ?? 'cv-eng', scope.year ?? 2025, scope.caseId ?? 'cv-case', version, status,
      ['UPLOAD_PENDING', 'SCAN_PENDING'].includes(status) ? 'QUARANTINED' : 'CLEAN']);
const caseRow = (caseId: string, client: string, engagement: string, year: number, stage: number) =>
  q(`INSERT INTO taxguard_cases(case_id, tenant_id, client_id, engagement_id, tax_year, active_stage, client_uid, preparer_uid, reviewer_uid, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, 'cv-client-user', 'cv-prep', 'cv-rev', 'cv-mgr', 'cv-mgr')`, [caseId, T, client, engagement, year, stage]);

beforeAll(async () => {
  fixture = await capabilityFixture();
  await applyProposals(fixture.pg, /^20261012(240000|250000|260000|270000|310000)_|^20261014500000_|^20261015050000_|^20261018000000_/);
}, 90000);
afterAll(async () => { await fixture?.pg.close(); });
beforeEach(async () => {
  await fixture.pg.exec(`DELETE FROM taxguard_documents WHERE tenant_id = '${T}' AND client_id IN ('${C}','${OTHER}');
    DELETE FROM taxguard_cases WHERE tenant_id = '${T}' AND case_id LIKE 'cv-%';`);
  await fixture.pg.exec(`INSERT INTO taxguard_clients(tenant_id, client_id, owner_uid, name) VALUES ('${T}','${C}','cv-client-user','Synthetic CV'),('${T}','${OTHER}','cv-other','Other CV')
    ON CONFLICT DO NOTHING;`);
  await caseRow('cv-case', C, 'cv-eng', 2025, 3);
  for (const [id, client, eng, year] of [['cv-other-client', OTHER, 'cv-eng', 2025], ['cv-other-eng', C, 'cv-eng-2', 2025], ['cv-other-year', C, 'cv-eng', 2024]] as const)
    await caseRow(id, client, eng, year, 1);
});

describe('stage 03 replacement evidence', () => {
  it('blocks Validate while the latest version of a document awaits a requested replacement', async () => {
    await doc('d1', 1, 'REPLACEMENT_REQUESTED');
    expect(await checks()).toMatchObject({ noOutstandingReplacementRequests: false, noDocumentsAwaitingReview: true, noDocumentsAwaitingScan: true });
  });

  it('an uploaded replacement alone does not clear Validate: it must be scanned and then reviewed', async () => {
    await doc('d1', 1, 'REPLACEMENT_REQUESTED');
    await doc('d1', 2, 'SCAN_PENDING');
    expect(await checks()).toMatchObject({ noOutstandingReplacementRequests: true, noDocumentsAwaitingScan: false });
    await q(`UPDATE taxguard_documents SET status = 'PENDING_REVIEW', quarantine_status = 'CLEAN' WHERE document_id = 'd1' AND version = 2`);
    expect(await checks()).toMatchObject({ noDocumentsAwaitingScan: true, noDocumentsAwaitingReview: false });
    await q(`UPDATE taxguard_documents SET status = 'REPLACEMENT_REQUESTED' WHERE document_id = 'd1' AND version = 2`);
    expect((await checks()).noOutstandingReplacementRequests).toBe(false); // the replacement itself was refused
    await q(`UPDATE taxguard_documents SET status = 'VERIFIED' WHERE document_id = 'd1' AND version = 2`);
    expect(Object.values(await checks()).every(Boolean)).toBe(true);
  });

  it('ignores historical versions that are already superseded and final rejections', async () => {
    await doc('d1', 1, 'REPLACEMENT_REQUESTED'); await doc('d1', 2, 'REPLACEMENT_REQUESTED'); await doc('d1', 3, 'VERIFIED');
    await doc('d2', 1, 'REJECTED');
    expect(Object.values(await checks()).every(Boolean)).toBe(true);
  });

  it('is not blocked or unlocked by another client, engagement or tax year', async () => {
    await doc('x1', 1, 'REPLACEMENT_REQUESTED', { client: OTHER, caseId: 'cv-other-client' });
    await doc('x2', 1, 'REPLACEMENT_REQUESTED', { engagement: 'cv-eng-2', caseId: 'cv-other-eng' });
    await doc('x3', 1, 'REPLACEMENT_REQUESTED', { year: 2024, caseId: 'cv-other-year' });
    expect((await checks()).noOutstandingReplacementRequests).toBe(true);
    // A later version under a different client with the same document ID does not satisfy this client's request.
    await doc('d1', 1, 'REPLACEMENT_REQUESTED');
    await doc('d1', 2, 'VERIFIED', { client: OTHER, caseId: 'cv-other-client' });
    expect((await checks()).noOutstandingReplacementRequests).toBe(false);
  });

  it('adds nothing outside stages 2 and 3, and stage 2 keeps its previous checks', async () => {
    await doc('d1', 1, 'REPLACEMENT_REQUESTED');
    await q(`UPDATE taxguard_cases SET active_stage = 4 WHERE case_id = 'cv-case'`);
    expect(await checks()).toEqual({});
    await q(`UPDATE taxguard_cases SET active_stage = 2 WHERE case_id = 'cv-case'`);
    expect(Object.keys(await checks()).sort()).toEqual(['noDocumentsAwaitingScan', 'requiredDocumentRequestsResolved']);
  });

  it('cannot be called through the API roles', async () => {
    for (const role of ['service_role', 'anon', 'authenticated'])
      expect((await q<{ ok: boolean }>(`SELECT has_function_privilege($1, 'public.taxguard_case_evidence_checks(public.taxguard_cases)', 'EXECUTE') AS ok`, [role]))[0].ok).toBe(false);
  });
});
