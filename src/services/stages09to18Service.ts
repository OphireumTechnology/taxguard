/**
 * Typed Browser API Client for /api/stages-09-18
 * Relays authenticated requests only; all authorization, calculations, and
 * provider fail-closed gates remain strictly server-authoritative.
 */

import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export interface StageScopePayload {
  tenantId: string;
  clientId: string;
  engagementId: string;
  caseId: string;
  taxYear: number;
}

export class Stages09To18ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'Stages09To18ApiError';
  }
}

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const token = getStoredToken();
  if (!token) {
    throw new Stages09To18ApiError(401, 'AUTH_REQUIRED', 'An active authenticated session is required.');
  }

  const res = await fetch(apiEndpoint(`/api/stages-09-18${path}`), {
    method,
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Stages09To18ApiError(
      res.status,
      typeof data?.code === 'string' ? data.code : 'REQUEST_FAILED',
      typeof data?.error === 'string' ? data.error : 'Server refused this operation.',
      data?.details
    );
  }
  return data as T;
}

function scopeQuery(scope: StageScopePayload): string {
  const params = new URLSearchParams({
    tenantId: scope.tenantId,
    clientId: scope.clientId,
    engagementId: scope.engagementId,
    caseId: scope.caseId,
    taxYear: String(scope.taxYear),
  });
  return `?${params.toString()}`;
}

export const stages09To18Service = {
  getScorecard: () => request<any>('GET', '/readiness-scorecard'),
  getSnapshot: (scope: StageScopePayload) => request<any>('GET', `/snapshot${scopeQuery(scope)}`),
  getFormsRegistry: (taxYear: number) => request<any>('GET', `/stage-09/forms?taxYear=${taxYear}`),
  advanceStage: (scope: StageScopePayload, targetStage: number) =>
    request<any>('POST', '/advance-stage', { ...scope, targetStage }),

  // Stage 09
  upsertProfile: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-09/profile', { ...scope, ...payload }),
  draftRulePack: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-09/rule-packs', { ...scope, ...payload }),
  approveRulePack: (scope: StageScopePayload, rulePackId: string) =>
    request<any>('POST', `/stage-09/rule-packs/${encodeURIComponent(rulePackId)}/approve`, scope),
  recordEvidence: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-09/evidence', { ...scope, ...payload }),
  recordAdjustment: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-09/book-to-tax/adjustments', { ...scope, ...payload }),
  reconcileBookToTax: (scope: StageScopePayload, bookNetIncome: string, targetTaxableIncome?: string) =>
    request<any>('POST', '/stage-09/book-to-tax/reconcile', { ...scope, bookNetIncome, targetTaxableIncome }),
  runCalculation: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-09/calculate', { ...scope, ...payload }),
  assembleReturn: (scope: StageScopePayload, calculationRunId: string) =>
    request<any>('POST', '/stage-09/returns', { ...scope, calculationRunId }),
  submitReturn: (scope: StageScopePayload, returnVersionId: string, expectedOptimisticVersion?: number) =>
    request<any>('POST', `/stage-09/returns/${encodeURIComponent(returnVersionId)}/submit`, {
      ...scope,
      expectedOptimisticVersion,
    }),
  requestAdvisory: (scope: StageScopePayload, prompt: string) =>
    request<any>('POST', '/stage-09/advisory', { ...scope, prompt }),

  // Stage 10
  recordQcGates: (scope: StageScopePayload, returnVersionId: string, checks: Array<{ category: string; passed: boolean; notes: string }>) =>
    request<any>('POST', '/stage-10/qc-gates', { ...scope, returnVersionId, checks }),
  approveReturn: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-10/approve', { ...scope, ...payload }),
  returnForCorrection: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-10/return-for-correction', { ...scope, ...payload }),

  // Stage 11
  createSignatureEnvelope: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-11/envelopes', { ...scope, ...payload }),
  dispatchSignatureEnvelope: (scope: StageScopePayload, envelopeId: string) =>
    request<any>('POST', `/stage-11/envelopes/${encodeURIComponent(envelopeId)}/dispatch`, scope),

  // Stage 12
  evaluateFilingReadiness: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-12/readiness', { ...scope, ...payload }),
  transmitFiling: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-12/transmit', { ...scope, ...payload }),

  // Stage 13
  registerNotice: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-13/notices', { ...scope, ...payload }),
  requestTranscript: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-13/transcripts', { ...scope, ...payload }),

  // Stage 14
  openResolution: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-14/resolutions', { ...scope, ...payload }),
  transitionResolution: (scope: StageScopePayload, resolutionId: string, payload: Record<string, unknown>) =>
    request<any>('POST', `/stage-14/resolutions/${encodeURIComponent(resolutionId)}/transition`, { ...scope, ...payload }),
  createAmendment: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-14/amendments', { ...scope, ...payload }),

  // Stage 15
  scheduleObligation: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-15/obligations', { ...scope, ...payload }),
  enqueueNotification: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-15/notifications', { ...scope, ...payload }),

  // Stage 16
  defineRetentionPolicy: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-16/retention-policies', { ...scope, ...payload }),
  sealArchive: (scope: StageScopePayload, retentionPolicyId: string) =>
    request<any>('POST', '/stage-16/archives', { ...scope, retentionPolicyId }),
  placeLegalHold: (scope: StageScopePayload, archiveId: string, reason: string) =>
    request<any>('POST', '/stage-16/legal-holds', { ...scope, archiveId, reason }),

  // Stage 17
  createRenewal: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-17/renewals', { ...scope, ...payload }),
  activateRenewal: (scope: StageScopePayload, renewalId: string) =>
    request<any>('POST', `/stage-17/renewals/${encodeURIComponent(renewalId)}/activate`, scope),

  // Stage 18
  registerCarryforward: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-18/carryforwards', { ...scope, ...payload }),
  reviewCarryforward: (scope: StageScopePayload, carryforwardId: string, decision: 'REVIEWED_APPROVED' | 'REJECTED') =>
    request<any>('POST', `/stage-18/carryforwards/${encodeURIComponent(carryforwardId)}/review`, { ...scope, decision }),
  generateNextCycle: (scope: StageScopePayload, payload: Record<string, unknown>) =>
    request<any>('POST', '/stage-18/generate-next-cycle', { ...scope, ...payload }),
};
