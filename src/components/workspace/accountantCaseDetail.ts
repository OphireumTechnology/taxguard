import { caseService, type CaseDetail } from '../../services/caseService';
import { taxEngineService, type ReturnVersion } from '../../services/taxEngineService';
import type { AccountantCase } from './accountantDashboardModel';

// Block 102: the accountant case detail reads the durable case record and its return versions by the case's own id
// (the cases and tax-engine routers). A record is kept only when it matches the selected case; a failed or mismatched
// read is reported as unavailable, never filled in.
export interface CaseDetailPart<T> { rows: T[]; error: string }
export interface DurableCaseDetail { stages: CaseDetailPart<CaseDetail['stages'][number]>; returns: CaseDetailPart<ReturnVersion> }
export interface CaseDetailSources { detail: (caseId: string) => Promise<CaseDetail>; returns: (caseId: string) => Promise<ReturnVersion[]> }
const DEFAULT_SOURCES: CaseDetailSources = { detail: caseService.detail, returns: taxEngineService.caseReturns };

export const CASE_NOT_IDENTIFIED = 'The durable case is not identified for this row.';
export const CASE_MISMATCH = 'The case record does not match this case.';
export const STAGES_UNAVAILABLE = 'Case stage service unavailable for this case.';
export const RETURNS_UNAVAILABLE = 'Draft return service unavailable for this case.';

export async function loadDurableCaseDetail(item: Pick<AccountantCase, 'caseId' | 'authorityClientId' | 'engagementId' | 'taxYear'>,
  sources: CaseDetailSources = DEFAULT_SOURCES): Promise<DurableCaseDetail> {
  const caseId = item.caseId;
  if (!caseId) return { stages: { rows: [], error: CASE_NOT_IDENTIFIED }, returns: { rows: [], error: CASE_NOT_IDENTIFIED } };
  const [detail, returns] = await Promise.allSettled([sources.detail(caseId), sources.returns(caseId)]);
  let stages: DurableCaseDetail['stages'] = { rows: [], error: STAGES_UNAVAILABLE };
  if (detail.status === 'fulfilled') {
    const c = detail.value.case;
    const owns = c.caseId === caseId && c.clientId === item.authorityClientId && c.engagementId === item.engagementId && c.taxYear === item.taxYear;
    stages = owns ? { rows: detail.value.stages, error: '' } : { rows: [], error: CASE_MISMATCH };
  }
  return {
    stages,
    returns: returns.status === 'fulfilled'
      ? { rows: returns.value.filter(r => r.caseId === caseId && r.taxYear === item.taxYear), error: '' }
      : { rows: [], error: RETURNS_UNAVAILABLE },
  };
}
