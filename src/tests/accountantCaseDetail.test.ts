import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  CASE_MISMATCH, CASE_NOT_IDENTIFIED, loadDurableCaseDetail, RETURNS_UNAVAILABLE, STAGES_UNAVAILABLE, type CaseDetailSources,
} from '../components/workspace/accountantCaseDetail';

// Block 102: the accountant case detail reads the durable case and its return versions by case id, keeps only records
// of the selected case, and reports a failed read as unavailable. Synthetic data.
const item = { caseId: 'case-1', authorityClientId: 'client-1', engagementId: 'eng-1', taxYear: 2025 };
const stage = (n: number) => ({ stage: n, status: n < 3 ? 'APPROVED' : 'PENDING', approvedBy: null, approvedAt: null, evidenceType: null });
const detail = (over: Partial<{ caseId: string; clientId: string; engagementId: string; taxYear: number }> = {}) => ({
  case: { caseId: 'case-1', clientId: 'client-1', engagementId: 'eng-1', taxYear: 2025, returnFamily: '1040', status: 'ACTIVE', holdReason: null, activeStage: 3,
    preparerUid: 'p', reviewerUid: 'r', version: 1, ...over },
  stagePolicy: { evidence: 'HUMAN_ATTESTED' as const }, pendingChecks: null, stages: [stage(1), stage(2), stage(10)], events: [], notes: [],
});
const version = (over: Record<string, unknown> = {}) => ({ returnVersionId: 'rv-1', caseId: 'case-1', taxYear: 2025, version: 1, status: 'DRAFT', forms: [], stale: [], ...over }) as any;
const sources = (over: Partial<CaseDetailSources> = {}): CaseDetailSources => ({
  detail: vi.fn(async () => detail()), returns: vi.fn(async () => [version()]), ...over,
});

describe('durable accountant case detail', () => {
  it('reads the case stages and return versions by the case id', async () => {
    const s = sources();
    const out = await loadDurableCaseDetail(item, s);
    expect(s.detail).toHaveBeenCalledWith('case-1');
    expect(s.returns).toHaveBeenCalledWith('case-1');
    expect(out.stages).toEqual({ rows: [stage(1), stage(2), stage(10)], error: '' });
    expect(out.returns.rows.map(r => r.returnVersionId)).toEqual(['rv-1']);
  });

  it('makes no read and reports the case unidentified when the row carries no case id', async () => {
    const s = sources();
    const out = await loadDurableCaseDetail({ ...item, caseId: undefined }, s);
    expect(s.detail).not.toHaveBeenCalled();
    expect(s.returns).not.toHaveBeenCalled();
    expect(out).toEqual({ stages: { rows: [], error: CASE_NOT_IDENTIFIED }, returns: { rows: [], error: CASE_NOT_IDENTIFIED } });
  });

  it.each([{ caseId: 'case-2' }, { clientId: 'client-2' }, { engagementId: 'eng-2' }, { taxYear: 2024 }])('shows no stages from a case record that does not match (%o)', async over => {
    const out = await loadDurableCaseDetail(item, sources({ detail: async () => detail(over) }));
    expect(out.stages).toEqual({ rows: [], error: CASE_MISMATCH });
  });

  it('keeps only return versions of this case and tax year', async () => {
    const out = await loadDurableCaseDetail(item, sources({ returns: async () => [version(), version({ returnVersionId: 'rv-x', caseId: 'case-2' }), version({ returnVersionId: 'rv-y', taxYear: 2024 })] }));
    expect(out.returns.rows.map(r => r.returnVersionId)).toEqual(['rv-1']);
  });

  it('reports each failed read as unavailable without affecting the other', async () => {
    const down = async () => { throw new Error('503'); };
    expect(await loadDurableCaseDetail(item, sources({ detail: down }))).toMatchObject({ stages: { rows: [], error: STAGES_UNAVAILABLE }, returns: { error: '' } });
    expect(await loadDurableCaseDetail(item, sources({ returns: down }))).toMatchObject({ stages: { error: '' }, returns: { rows: [], error: RETURNS_UNAVAILABLE } });
  });

  it('the dashboard no longer reads case detail from the in-memory case authority', () => {
    const src = fs.readFileSync('src/components/workspace/AccountantDashboard.tsx', 'utf8');
    expect(src).not.toMatch(/caseAuthority\.(listWorkpapers|getStages|listDraftReturns)/);
    expect(src).toContain('loadDurableCaseDetail(item)');
  });
});
