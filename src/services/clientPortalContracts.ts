import { api } from './api';

export interface PortalEngagement {
  id: string;
  clientId: string;
  taxYear: number;
  status: string;
  activeStage?: number;
  [key: string]: any;
}

export interface CaseStages {
  engagementId?: string;
  taxYear?: number;
  currentStage: number;
  stages: Array<{ stage: number; label?: string; status: string; updatedAt?: string; completedAt?: string | null }>;
  [key: string]: any;
}

export interface ConsultationHistoryItem {
  id: string;
  serviceType?: string;
  status: string;
  preferredDate?: string;
  createdAt: string;
  [key: string]: any;
}

export interface SignaturePackageStatus {
  id: string;
  taxYear: number;
  status: string;
  formType?: string;
  signedAt?: string | null;
  releasedAt?: string | null;
  [key: string]: any;
}

export function portalErrorMessage(err: unknown, fallback = 'Client portal service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const clientPortalContracts: any = {
  getEngagements: (signal?: AbortSignal) => api.request('/api/client-portal/engagements', { signal }),
  getCaseStages: (taxYear?: number, signal?: AbortSignal) =>
    api.request('/api/client-portal/stages', { query: { taxYear }, signal }),
  getConsultations: (signal?: AbortSignal) =>
    api.request('/api/client-portal/consultations', { signal }),
  getSignaturePackages: (taxYear?: number, signal?: AbortSignal) =>
    api.request('/api/client-signatures', { query: { taxYear }, signal }),
};
