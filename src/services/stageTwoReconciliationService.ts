export interface ReconciledRequirementCard {
  id: string;
  name: string;
  category: string;
  status: string;
  required: boolean;
  documents: any[];
  [key: string]: any;
}

export interface StageTwoAuthoritativeSnapshot {
  clientId: string;
  taxYear: number;
  cards: ReconciledRequirementCard[];
  summary: {
    total: number;
    completed: number;
    missing: number;
    inReview: number;
  };
  [key: string]: any;
}

export const StageTwoReconciliationService: any = {
  reconcile(clientId: string, taxYear = 2025): StageTwoAuthoritativeSnapshot {
    return {
      clientId,
      taxYear,
      cards: [],
      summary: { total: 0, completed: 0, missing: 0, inReview: 0 },
    };
  },
};
