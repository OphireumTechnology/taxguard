export interface ReconciledRequirementCard {
  requirementId: string;
  title: string;
  formNumber: string;
  category: string;
  status: string;
  matchedDocumentsCount: number;
  verifiedDocumentsCount: number;
  pendingReviewCount: number;
  rejectedCount: number;
}

export interface StageTwoAuthoritativeSnapshot {
  clientId: string;
  taxYear: number;
  generatedAt: string;
  isReadyForStageThree: boolean;
  progressPercent: number;
  requirements: ReconciledRequirementCard[];
  openExceptionsCount: number;
  openRequestsCount: number;
}

export class StageTwoReconciliationService {
  static buildAuthoritativeSnapshot(
    clientId: string,
    taxYear: number
  ): StageTwoAuthoritativeSnapshot {
    return {
      clientId,
      taxYear,
      generatedAt: new Date().toISOString(),
      isReadyForStageThree: false,
      progressPercent: 0,
      requirements: [],
      openExceptionsCount: 0,
      openRequestsCount: 0,
    };
  }
}
