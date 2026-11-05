/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AccountingDocumentClassification {
  id: string;
  category: string;
  confidence: number;
  label: string;
}

export interface CanonicalAccountingExtractionEnvelope {
  id: string;
  documentId: string;
  extractedData: Record<string, any>;
  confidence: number;
}

export interface AccountingReviewQueueItem {
  id: string;
  documentTitle: string;
  status: string;
  receivedAt: string;
  priority: string;
}
