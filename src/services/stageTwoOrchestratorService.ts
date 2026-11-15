export interface StageTwoCollectionSummaryReport {
  generatedAt: string;
  clientId: string;
  clientName: string;
  taxYear: number;
  returnType: string;
  filingStatus: string;
  engagementId: string;
  jurisdictions: string[];
  isReadyForExitGate: boolean;
  collectionProgressPercent: number;
  processingProgressPercent: number;
  collectionReviewPercent: number;
  totalRequired: number;
  receivedCount: number;
  collectionAcceptedCount: number;
  missingCount: number;
  processingCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  waivedCount: number;
  notApplicableCount: number;
  incomeSummary: {
    employmentCount: number;
    interestCount: number;
    dividendsCount: number;
    brokerageCount: number;
    businessCount: number;
  };
  outstandingRequirements: Array<{
    requirementId: string;
    title: string;
    reason: string;
    status: string;
    requestStatus: string;
  }>;
  exceptions: Array<{
    id: string;
    title: string;
    severity: string;
    category: string;
    description: string;
  }>;
}

export class StageTwoOrchestratorService {
  static generateCollectionReport(clientId: string, taxYear: number): StageTwoCollectionSummaryReport {
    return {
      generatedAt: new Date().toISOString(),
      clientId,
      clientName: 'Client Taxpayer',
      taxYear,
      returnType: 'Form 1040 / Business',
      filingStatus: 'Active Engagement',
      engagementId: `eng_${clientId}_${taxYear}`,
      jurisdictions: ['US', 'SC'],
      isReadyForExitGate: false,
      collectionProgressPercent: 60,
      processingProgressPercent: 50,
      collectionReviewPercent: 50,
      totalRequired: 5,
      receivedCount: 3,
      collectionAcceptedCount: 3,
      missingCount: 2,
      processingCount: 0,
      needsReviewCount: 0,
      rejectedCount: 0,
      waivedCount: 0,
      notApplicableCount: 0,
      incomeSummary: {
        employmentCount: 1,
        interestCount: 1,
        dividendsCount: 0,
        brokerageCount: 0,
        businessCount: 1,
      },
      outstandingRequirements: [],
      exceptions: [],
    };
  }
}
