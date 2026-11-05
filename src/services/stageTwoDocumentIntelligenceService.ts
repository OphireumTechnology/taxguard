/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const CONTROLLED_TAX_CATEGORIES = [
  'W2',
  '1099_NEC',
  '1099_MISC',
  '1099_INT',
  '1099_DIV',
  '1099_B',
  '1098_MORTGAGE',
  'K1',
  'RECEIPT',
  'BANK_STATEMENT',
  'OTHER'
] as const;

export type TaxDocumentCategory = typeof CONTROLLED_TAX_CATEGORIES[number] | (string & {});

export interface ExtractedFieldProvenance {
  fieldKey: string;
  fieldLabel: string;
  rawValue: string;
  normalizedValue: string | number;
  confidence: number;
  boundingBox?: [number, number, number, number];
  pageNumber: number;
}

export interface DocumentIntelligenceRecord {
  id: string;
  documentId: string;
  clientId: string;
  taxYear: number;
  detectedCategory: TaxDocumentCategory;
  confidence: number;
  status: 'PENDING' | 'EXTRACTED' | 'REVIEWED' | 'ERROR';
  fields: Record<string, ExtractedFieldProvenance>;
  processedAt: string;
}

export interface HumanReviewQueueItem {
  id: string;
  intelligenceRecordId: string;
  documentTitle: string;
  clientName: string;
  detectedCategory: TaxDocumentCategory;
  flagReason: string;
  confidence: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'QUEUED' | 'IN_REVIEW' | 'RESOLVED';
  createdAt: string;
}

export interface HumanReviewAction {
  action: 'APPROVE' | 'CORRECT' | 'REJECT' | 'RECLASSIFY';
  corrections?: Record<string, string>;
  notes?: string;
}
