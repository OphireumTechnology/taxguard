/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ReconciledRequirementCard {
  requirementId: string;
  requirementTitle: string;
  category: string;
  isFulfilled: boolean;
  matchedDocumentId?: string;
  matchedDocumentName?: string;
  confidence?: number;
}

export interface StageTwoAuthoritativeSnapshot {
  clientId: string;
  taxYear: number;
  isLocked: boolean;
  requirements: ReconciledRequirementCard[];
  lastReconciledAt: string;
}

export const StageTwoReconciliationService = {
  getSnapshot: async (clientId: string, taxYear: number): Promise<StageTwoAuthoritativeSnapshot> => {
    return {
      clientId,
      taxYear,
      isLocked: false,
      lastReconciledAt: new Date().toISOString(),
      requirements: [
        {
          requirementId: 'req_w2',
          requirementTitle: 'Form W-2 Wage and Tax Statement',
          category: 'Income',
          isFulfilled: true,
          matchedDocumentId: 'doc_w2_2025',
          matchedDocumentName: 'w2_perotti_2025.pdf',
          confidence: 0.98,
        }
      ]
    };
  }
};
