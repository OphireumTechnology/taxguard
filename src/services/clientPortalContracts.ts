import { apiRequest } from './api';

export interface PortalEngagement {
  id: string;
  taxYear: number;
  status: string;
  stage?: string | number;
  serviceType?: string;
  [key: string]: any;
}

export interface CaseStages {
  currentStage: number;
  stages: Array<{ stage: number; status: string; label?: string; updatedAt?: string; completedAt?: string | null }>;
  [key: string]: any;
}

export interface ConsultationHistoryItem {
  id: string;
  category?: string;
  status: string;
  requestedAt?: string;
  scheduledAt?: string;
  notes?: string;
  [key: string]: any;
}

export interface SignaturePackageStatus {
  id: string;
  taxYear?: number;
  status: string;
  releasedAt?: string;
  signedAt?: string;
  documents?: any[];
  [key: string]: any;
}

export function portalErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Unable to load client portal information right now.';
}

export const clientPortalContracts: any = new Proxy(
  {
    getEngagements: () => apiRequest('/api/client-portal/engagements'),
    getCaseStages: (engagementId?: string) =>
      apiRequest(`/api/client-portal/case-stages${engagementId ? `?engagementId=${encodeURIComponent(engagementId)}` : ''}`),
    getConsultations: () => apiRequest('/api/client-portal/consultations'),
    getSignaturePackages: () => apiRequest('/api/client-signatures'),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/client-portal/${prop}`);
    },
  }
);
