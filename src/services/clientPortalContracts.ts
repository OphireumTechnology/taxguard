export interface PortalEngagement {
  engagementId: string;
  title: string;
  taxYear: number;
  status: string;
  engagementStatus?: string;
}

export interface StageCheckItem {
  code: string;
  passed: boolean;
}

export interface CaseStageItem {
  stageNumber: number;
  title: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'LOCKED';
  checks?: StageCheckItem[];
  evidenceAvailable?: boolean;
}

export interface CaseStages {
  caseStatus: string;
  currentStage: number;
  stages: CaseStageItem[];
}

export function portalErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'The client portal service encountered an unexpected error.';
}

export const clientPortalContracts = {
  async engagements(clientId: string, signal?: AbortSignal): Promise<{ items: PortalEngagement[] }> {
    return {
      items: [
        {
          engagementId: 'eng_2025_01',
          title: '2025 Form 1120-S & Comprehensive Planning',
          taxYear: 2025,
          status: 'ACTIVE',
          engagementStatus: 'active'
        },
        {
          engagementId: 'eng_2024_01',
          title: '2024 Corporate Tax Preparation',
          taxYear: 2024,
          status: 'COMPLETED',
          engagementStatus: 'completed'
        }
      ]
    };
  },

  async caseStages(clientId: string, engagementId: string, taxYear: number, signal?: AbortSignal): Promise<CaseStages> {
    return {
      caseStatus: 'ACTIVE',
      currentStage: 4,
      stages: [
        { stageNumber: 1, title: 'Client Onboarding & Identity Verification', status: 'COMPLETED', evidenceAvailable: true },
        { stageNumber: 2, title: 'Document Collection & Source Vault', status: 'COMPLETED', evidenceAvailable: true },
        { stageNumber: 3, title: 'Source Data Extraction & OCR Indexing', status: 'COMPLETED', evidenceAvailable: true },
        { stageNumber: 4, title: 'Ledger Reconstruction & Book-to-Tax', status: 'IN_PROGRESS', evidenceAvailable: true,
          checks: [
            { code: 'postedEntries', passed: true },
            { code: 'noEntriesAwaitingReview', passed: false },
            { code: 'ledgerBalanced', passed: true },
            { code: 'closedReconciliation', passed: true }
          ]
        },
        { stageNumber: 5, title: 'Tax Return Preparation & Model Verification', status: 'LOCKED' },
        { stageNumber: 6, title: 'Independent Senior Review & Audit Trail', status: 'LOCKED' },
        { stageNumber: 7, title: 'Client Authorization & Form 8879 Signature', status: 'LOCKED' },
        { stageNumber: 8, title: 'IRS / State E-File Transmission', status: 'LOCKED' }
      ]
    };
  },

  getStageContract: async (stageNumber: number) => ({ stage: stageNumber, title: `Stage ${stageNumber}`, canAdvance: true }),
  signDocument: async (docId: string) => ({ success: true })
};
