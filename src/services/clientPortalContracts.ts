/**
 * Phase 13A client-portal contracts (C1 consultation history, C3 case stages). Every value is the
 * server's: the browser validates shape and session continuity but never infers progression.
 */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class PortalContractError extends Error {
  constructor(public readonly status: number, public readonly code: string) { super(code); }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new PortalContractError(401, 'AUTH_REQUIRED');
  let response: Response;
  try { response = await fetch(apiEndpoint(path), { cache: 'no-store', credentials: 'omit', signal, headers: { Authorization: `Bearer ${token}` } }); }
  catch (e) { if ((e as Error)?.name === 'AbortError') throw e; throw new PortalContractError(0, 'NETWORK_UNAVAILABLE'); }
  const data = await response.json().catch(() => null);
  // A response that arrives after a sign-out or account switch belongs to another session.
  if (getStoredToken() !== token) throw new PortalContractError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new PortalContractError(response.status, typeof data?.code === 'string' ? data.code : 'PORTAL_REQUEST_FAILED');
  return data as T;
}

export type StageRow = { stage: number; status: 'LOCKED' | 'IN_PROGRESS' | 'COMPLETED' | string; completedAt: string | null };
export type CaseStages =
  | { engagementId: string; taxYear: number; caseExists: false }
  | { engagementId: string; taxYear: number; caseExists: true; caseStatus: string; activeStage: number; updatedAt: string;
      activeStagePolicy: { evidence: 'SYSTEM_VERIFIED' | 'HUMAN_ATTESTED' | 'BLOCKED'; checklist: string[] } | null;
      activeStageChecks: Record<string, boolean> | null; stages: StageRow[];
      evidence: { verifiedDocuments: number; documentsInReview: number; documentsNeedingAction: number; openDocumentRequests: number };
      team: { preparerAssigned: boolean; reviewerAssigned: boolean; independentReview: boolean } };

export type PortalEngagement = { engagementId: string; title: string; type: string; engagementStatus: string; taxYear: number; yearStatus: string; caseStatus: string | null; activeStage: number | null };

export type ConsultationHistoryItem = { requestId: string; topic: string; status: string; createdAt: string; preferredWindows: unknown;
  appointment: null | { appointmentId: string; status: string; startsAt: string; endsAt: string; timezone: string; mode: string } };

function validStages(d: any): d is CaseStages {
  if (!d || typeof d.engagementId !== 'string' || !Number.isInteger(d.taxYear) || typeof d.caseExists !== 'boolean') return false;
  if (!d.caseExists) return true;
  return Number.isInteger(d.activeStage) && Array.isArray(d.stages) && d.stages.every((s: any) => Number.isInteger(s?.stage) && s.stage >= 1 && s.stage <= 8 && typeof s.status === 'string')
    && d.evidence && typeof d.team === 'object';
}

/** A return released to this client for signature (Stage 11, proposal 20261019190000): status only, no figures or forms. */
export type SignaturePackageStatus = { packageId: string; taxYear: number; releasedAt: string; status: 'AWAITING_SIGNATURE'; signature: 'NOT_AVAILABLE' };

export const clientPortalContracts = {
  engagements: (clientId: string, signal?: AbortSignal) => get<{ items: PortalEngagement[] }>(`/api/client-portal/clients/${encodeURIComponent(clientId)}/engagements`, signal),
  async caseStages(clientId: string, engagementId: string, taxYear: number, signal?: AbortSignal): Promise<CaseStages> {
    const d = await get<unknown>(`/api/client-portal/clients/${encodeURIComponent(clientId)}/case-stages?engagementId=${encodeURIComponent(engagementId)}&taxYear=${taxYear}`, signal);
    if (!validStages(d)) throw new PortalContractError(502, 'INVALID_PORTAL_RESPONSE');
    return d;
  },
  async consultations(clientId: string, after?: string, signal?: AbortSignal) {
    const d = await get<any>(`/api/client-portal/clients/${encodeURIComponent(clientId)}/consultations${after ? '?after=' + encodeURIComponent(after) : ''}`, signal);
    if (!d || !Array.isArray(d.items) || d.items.some((i: any) => typeof i?.requestId !== 'string' || typeof i.status !== 'string' || typeof i.createdAt !== 'string'))
      throw new PortalContractError(502, 'INVALID_PORTAL_RESPONSE');
    return d as { items: ConsultationHistoryItem[]; nextCursor: string | null };
  },
  async signaturePackages(clientId: string, signal?: AbortSignal): Promise<SignaturePackageStatus[]> {
    const d = await get<any>(`/api/client-signatures/clients/${encodeURIComponent(clientId)}/signature-packages`, signal);
    if (!d || d.signature !== 'NOT_AVAILABLE' || !Array.isArray(d.items) || d.items.some((i: any) => typeof i?.packageId !== 'string' || !Number.isInteger(i.taxYear)
      || i.status !== 'AWAITING_SIGNATURE' || i.signature !== 'NOT_AVAILABLE' || typeof i.releasedAt !== 'string'))
      throw new PortalContractError(502, 'INVALID_PORTAL_RESPONSE');
    return d.items as SignaturePackageStatus[];
  },
};

export function portalErrorMessage(e: unknown): string {
  if (e instanceof PortalContractError) {
    if (e.status === 401 || e.code === 'SESSION_CHANGED') return 'Your session has ended or changed. Sign in again.';
    if (e.status === 403 || e.status === 404) return 'This information is not available for your account.';
    if (e.code === 'PORTAL_STORE_UNAVAILABLE') return 'This information is not enabled in this environment.';
  }
  return 'The portal could not load this information. Try again.';
}
