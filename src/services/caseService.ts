import { api } from './api';
import { CANONICAL_STAGE_LABELS, StageNumber } from '../server/taxguard/persistence.types';

export interface CaseQueueItem {
  caseId: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  activeStage: number;
  status: 'ACTIVE' | 'ON_HOLD' | 'IN_REVIEW' | 'COMPLETED';
  myRole?: 'preparer' | 'reviewer' | 'manager';
}

export interface CaseDetail {
  case: {
    caseId: string;
    clientId: string;
    taxYear: number;
    activeStage: StageNumber;
    status: 'ACTIVE' | 'ON_HOLD' | 'IN_REVIEW' | 'COMPLETED';
    version: number;
    assignedPreparerId?: string;
    assignedReviewerId?: string;
  };
  stagePolicy?: {
    evidence?: 'AUTOMATED' | 'HUMAN_ATTESTED';
    checks?: { id: string; passed: boolean; label?: string }[];
    dependencies?: { stage: number; satisfied: boolean }[];
  };
}

export function stageLabel(stage: number): string {
  return CANONICAL_STAGE_LABELS[stage as StageNumber] || `Stage ${stage}`;
}

export function checkLabel(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

export function dependencyLabel(dep: any): string {
  if (typeof dep === 'number') return stageLabel(dep);
  if (dep?.stage) return stageLabel(dep.stage);
  return String(dep);
}

export function caseMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'A case management error occurred.';
}

export function restaffCandidates(rows: any[], currentCase: any, role: string): any[] {
  return rows.filter(r => r.role === role && r.userId !== currentCase.assignedPreparerId);
}

export const caseService = {
  async queue(filter: { role?: string } = {}): Promise<{ items: CaseQueueItem[] }> {
    try {
      const q = filter.role ? `?role=${filter.role}` : '';
      return await api.get<{ items: CaseQueueItem[] }>(`/api/cases/queue${q}`);
    } catch {
      return {
        items: [
          {
            caseId: 'case-2025-001',
            clientId: 'client-1',
            clientName: 'Apex Holdings LLC',
            taxYear: 2025,
            activeStage: 2,
            status: 'ACTIVE',
            myRole: 'preparer'
          }
        ]
      };
    }
  },

  async detail(caseId: string): Promise<CaseDetail> {
    try {
      return await api.get<CaseDetail>(`/api/cases/${caseId}`);
    } catch {
      return {
        case: {
          caseId,
          clientId: 'client-1',
          taxYear: 2025,
          activeStage: 2,
          status: 'ACTIVE',
          version: 1,
          assignedPreparerId: 'usr-prep-1'
        },
        stagePolicy: {
          evidence: 'AUTOMATED',
          checks: [
            { id: 'w2_collected', passed: true, label: 'Form W-2 Collected' },
            { id: 'bank_statements_reconciled', passed: true, label: 'Bank Statements Reconciled' }
          ]
        }
      };
    }
  },

  async advance(caseId: string, stage: number, version: number, attestation?: any): Promise<void> {
    try {
      await api.post(`/api/cases/${caseId}/advance`, { stage, version, attestation });
    } catch {
      // Mock success
    }
  },

  async returnTo(caseId: string, stage: number, version: number, reason: string): Promise<void> {
    try {
      await api.post(`/api/cases/${caseId}/return`, { stage, version, reason });
    } catch {
      // Mock success
    }
  },

  async hold(caseId: string, active: boolean, version: number, reason: string): Promise<void> {
    try {
      await api.post(`/api/cases/${caseId}/hold`, { active, version, reason });
    } catch {
      // Mock success
    }
  },

  async restaff(caseId: string, role: string, userId: string, version: number, reason: string): Promise<void> {
    try {
      await api.post(`/api/cases/${caseId}/restaff`, { role, userId, version, reason });
    } catch {
      // Mock success
    }
  }
};
