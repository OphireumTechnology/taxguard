import { TaxDocumentRequirementEngine } from './taxDocumentRequirementEngine';
import { StageTwoCollectionService } from './stageTwoCollectionService';

export interface StageTwoCollectionSummaryReport {
  generatedAt: string;
  clientName: string;
  clientId: string;
  taxYear: number;
  returnType: string;
  filingStatus: string;
  engagementId: string;
  jurisdictions: string[];
  isReadyForExitGate: boolean;
  missingCount: number;
  collectionProgressPercent: number;
  collectionAcceptedCount: number;
  collectionReviewPercent: number;
  processingProgressPercent: number;
  totalRequired: number;
  receivedCount: number;
  processingCount: number;
  needsReviewCount: number;
  rejectedCount: number;
  notApplicableCount: number;
  waivedCount: number;
  exceptions: Array<{
    id: string;
    title: string;
    category: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'BLOCKING' | string;
    description: string;
  }>;
  outstandingRequirements: Array<{
    requirementId: string;
    title: string;
    reason: string;
    status: string;
    requestStatus: string;
  }>;
  incomeSummary: {
    employmentCount: number;
    interestCount: number;
    dividendsCount: number;
    brokerageCount: number;
    businessCount: number;
  };
}

export class StageTwoOrchestratorService {
  static generateCollectionReport(
    clientId: string,
    taxYear: number
  ): StageTwoCollectionSummaryReport {
    const questionnaire = TaxDocumentRequirementEngine.getQuestionnaire(clientId, taxYear);
    const uploads = StageTwoCollectionService.getUploadedDocuments(clientId, taxYear);
    const evalResult = TaxDocumentRequirementEngine.evaluateMissingDocuments({
      clientId,
      taxYear,
      uploadedDocs: uploads.map(d => ({
        id: d.documentId,
        associatedRequirementId: d.associatedRequirementId,
        claimedCategory: d.claimedCategory,
        status: d.processingStatus,
        isVerified: d.isVerified,
      })),
    });

    const totalRequired = evalResult.totalRequirements;
    const receivedCount = evalResult.receivedCount;
    const missingCount = evalResult.missingCount;
    const acceptedCount = uploads.filter(d => d.isVerified || d.processingStatus === 'VERIFIED').length;
    const processingCount = uploads.filter(d => d.processingStatus === 'PROCESSING').length;
    const rejectedCount = uploads.filter(d => d.processingStatus === 'REJECTED').length;
    const needsReviewCount = uploads.filter(d => d.processingStatus === 'UPLOADED' || d.processingStatus === 'EXTRACTED').length;

    const progressPercent = totalRequired > 0 ? Math.round((receivedCount / totalRequired) * 100) : 100;
    const reviewPercent = uploads.length > 0 ? Math.round((acceptedCount / uploads.length) * 100) : 0;

    return {
      generatedAt: new Date().toISOString(),
      clientName: clientId || 'Client Taxpayer',
      clientId: clientId || 'client_default',
      taxYear,
      returnType: 'Form 1040',
      filingStatus: questionnaire.filingStatus,
      engagementId: `ENG-${taxYear}-001`,
      jurisdictions: ['Federal', questionnaire.residentState || 'SC'],
      isReadyForExitGate: missingCount === 0 && rejectedCount === 0,
      missingCount,
      collectionProgressPercent: progressPercent,
      collectionAcceptedCount: acceptedCount,
      collectionReviewPercent: reviewPercent,
      processingProgressPercent: progressPercent,
      totalRequired,
      receivedCount,
      processingCount,
      needsReviewCount,
      rejectedCount,
      notApplicableCount: 0,
      waivedCount: 0,
      exceptions: [],
      outstandingRequirements: evalResult.items
        .filter(i => i.status === 'Missing')
        .map(i => ({
          requirementId: i.requirementId,
          title: i.title,
          reason: i.whyDoWeNeedIt,
          status: i.status,
          requestStatus: 'OPEN',
        })),
      incomeSummary: {
        employmentCount: questionnaire.hasW2Employment ? 1 : 0,
        interestCount: questionnaire.hasBankInterest ? 1 : 0,
        dividendsCount: questionnaire.hasDividends ? 1 : 0,
        brokerageCount: questionnaire.hasStockSalesBrokerage ? 1 : 0,
        businessCount: questionnaire.hasSelfEmployment ? 1 : 0,
      },
    };
  }
}
