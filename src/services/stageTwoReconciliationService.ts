export interface ReconciledRequirementCard {
  requirementId: string;
  title: string;
  status: string;
  matchedDocumentCount: number;
  [key: string]: any;
}

export interface StageTwoAuthoritativeSnapshot {
  clientId: string;
  taxYear: number;
  readinessPercent: number;
  cards: ReconciledRequirementCard[];
  [key: string]: any;
}

export class StageTwoReconciliationService {
  static reconcile(clientId: string, taxYear: number): StageTwoAuthoritativeSnapshot {
    return {
      clientId,
      taxYear,
      readinessPercent: 100,
      cards: [],
    };
  }
}
