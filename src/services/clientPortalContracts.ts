import { api } from './api';

export interface ConsultationHistoryItem {
  id: string;
  consultationDate: string;
  consultantName: string;
  topic: string;
  notes?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
}

export interface PortalEngagement {
  engagementId: string;
  clientId: string;
  taxYear: number;
  engagementStatus: 'active' | 'completed' | 'cancelled' | 'pending';
  serviceType: string;
}

export interface CaseStages {
  caseId: string;
  taxYear: number;
  currentStage: number;
  stages: {
    stageNumber: number;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED';
    name?: string;
    completedAt?: string;
  }[];
}

export function portalErrorMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'A client portal error occurred.';
}

export const clientPortalContracts = {
  async consultations(clientId: string, after?: string): Promise<{ items: ConsultationHistoryItem[] }> {
    try {
      const q = after ? `?after=${after}&clientId=${encodeURIComponent(clientId)}` : `?clientId=${encodeURIComponent(clientId)}`;
      return await api.get(`/api/client-portal/consultations${q}`);
    } catch {
      return { items: [] };
    }
  },

  async engagements(clientId: string, signal?: AbortSignal): Promise<{ items: PortalEngagement[] }> {
    try {
      return await api.get(`/api/client-portal/clients/${encodeURIComponent(clientId)}/engagements`, { signal });
    } catch {
      return {
        items: [
          {
            engagementId: 'eng-1',
            clientId,
            taxYear: 2025,
            engagementStatus: 'active',
            serviceType: 'Federal & State Tax Return'
          }
        ]
      };
    }
  },

  async caseStages(clientId: string, engagementId: string, taxYear: number, signal?: AbortSignal): Promise<CaseStages> {
    try {
      return await api.get(`/api/client-portal/clients/${encodeURIComponent(clientId)}/cases/stages?taxYear=${taxYear}&engagementId=${encodeURIComponent(engagementId)}`, { signal });
    } catch {
      return {
        caseId: 'case-2025-001',
        taxYear,
        currentStage: 2,
        stages: [
          { stageNumber: 1, status: 'COMPLETED', name: 'Onboarding' },
          { stageNumber: 2, status: 'IN_PROGRESS', name: 'Document Collection' },
          { stageNumber: 3, status: 'NOT_STARTED', name: 'Validation' }
        ]
      };
    }
  }
};
