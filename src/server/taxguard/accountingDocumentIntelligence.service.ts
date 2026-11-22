export class AccountingDocumentIntelligenceService {
  static processDocument(input: Record<string, unknown>) {
    return {
      id: `doc_intel_${Date.now()}`,
      status: 'PENDING_REVIEW',
      advisoryOnly: true,
      input,
      extractedFields: [],
    };
  }

  static createBatchJob(input: Record<string, unknown>) {
    return {
      batchId: `batch_${Date.now()}`,
      status: 'QUEUED',
      items: [],
      documentsFound: 0,
      accountingRelevant: 0,
      needsReview: 0,
      duplicates: 0,
      notAccountingRelated: 0,
      ...input,
    };
  }

  static getBatchJob(_batchId: string): any {
    return null;
  }

  static getReviewQueue(_clientId: string): any[] {
    return [];
  }

  static resolveReviewItem(input: Record<string, unknown>): any {
    return { resolved: true, ...input };
  }
}
