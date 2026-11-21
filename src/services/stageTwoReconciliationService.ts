export interface ReconciledRequirementCard {
  requirementId: string;
  title: string;
  category: string;
  status: string;
  required: boolean;
  matchedDocumentIds: string[];
  notes?: string;
  [key: string]: any;
}

export interface StageTwoAuthoritativeSnapshot {
  clientId: string;
  taxYear: number;
  reconciledAt: string;
  cards: ReconciledRequirementCard[];
  missingCount: number;
  satisfiedCount: number;
  readinessPercent: number;
  [key: string]: any;
}

export const StageTwoReconciliationService = {
  reconcile(clientId: string, taxYear: number): StageTwoAuthoritativeSnapshot {
    return {
      clientId,
      taxYear,
      reconciledAt: new Date().toISOString(),
      cards: [],
      missingCount: 0,
      satisfiedCount: 0,
      readinessPercent: 0,
    };
  },
};
