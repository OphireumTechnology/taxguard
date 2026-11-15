export const CONTROLLED_TAX_CATEGORIES = [
  'W-2',
  '1099-INT',
  '1099-DIV',
  '1099-B',
  '1099-NEC',
  '1099-MISC',
  '1099-R',
  '1099-K',
  '1098',
  '1098-T',
  '1095-A',
  'Schedule K-1',
  'Form 1040 (Prior Year)',
  'Form 1120-S',
  'Form 1065',
  'Bank Statement',
  'Profit & Loss Statement',
  'Balance Sheet',
  'Other Supporting Schedule',
] as const;

export type TaxDocumentCategory = (typeof CONTROLLED_TAX_CATEGORIES)[number];

export type HumanReviewAction =
  | 'ACCEPT'
  | 'CORRECT'
  | 'RECLASSIFY'
  | 'MARK_DUPLICATE'
  | 'MARK_SUPERSEDED'
  | 'REQUEST_REPLACEMENT'
  | 'ESCALATE'
  | 'REJECT';

export interface ExtractedFieldProvenance {
  fieldKey?: string;
  fieldLabel?: string;
  extractedValue?: unknown;
  confidence: number;
  confidenceTier: 'HIGH_CONFIDENCE' | 'REVIEW_REQUIRED' | 'LOW_CONFIDENCE' | string;
  isMaterialField?: boolean;
  sourceReference?: string;
}

export interface DocumentIntelligenceRecord {
  documentId: string;
  ocrState: 'PENDING_OCR' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  ocrArtifact?: { pageCount: number };
  aiDetectedCategory: TaxDocumentCategory | string;
  classificationConfidence: number;
  classificationConflict: boolean;
  humanReviewRequired: boolean;
  duplicateDetection: {
    isDuplicate: boolean;
    duplicateType?: string;
    matchedDocumentId?: string;
  };
  versionIntelligence: {
    relationship: 'ORIGINAL' | 'CORRECTED' | 'SUPERSEDED' | string;
    versionNumber: number;
    requiresDownstreamRevalidation?: boolean;
  };
  extractedData?: Record<string, ExtractedFieldProvenance | unknown>;
}

export interface HumanReviewQueueItem {
  reviewItemId: string;
  documentId: string;
  clientId: string;
  taxYear: number;
  filename: string;
  originalFileName: string;
  clientClaimedCategory: string;
  claimedCategory: string;
  aiDetectedCategory: TaxDocumentCategory;
  reviewReasons: string[];
  flaggedFields: ExtractedFieldProvenance[];
  reason: string;
  confidence: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | string;
  status: 'PENDING' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'REVIEWED' | 'COMPLETED' | string;
  intelligenceRecord?: DocumentIntelligenceRecord;
}
