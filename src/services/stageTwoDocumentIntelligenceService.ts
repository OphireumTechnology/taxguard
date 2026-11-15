export type TaxDocumentCategory =
  | 'W2'
  | 'W-2'
  | '1099'
  | '1098'
  | 'K1'
  | 'BANK_STATEMENT'
  | 'LEDGER'
  | 'IDENTITY'
  | 'ENTITY_ORG'
  | 'OTHER'
  | string;

export const CONTROLLED_TAX_CATEGORIES: TaxDocumentCategory[] = [
  'W2',
  '1099',
  '1098',
  'K1',
  'BANK_STATEMENT',
  'LEDGER',
  'IDENTITY',
  'ENTITY_ORG',
  'OTHER',
];

export interface ExtractedFieldProvenance {
  fieldKey: string;
  label: string;
  fieldLabel?: string;
  value: string;
  extractedValue?: unknown;
  confidence: number;
  sourcePage?: number;
  verifiedByHuman?: boolean;
  isMaterialField?: boolean;
  [key: string]: any;
}

export interface DocumentIntelligenceRecord {
  documentId: string;
  category: TaxDocumentCategory;
  confidence: number;
  fields: ExtractedFieldProvenance[];
  [key: string]: any;
}

export type HumanReviewAction =
  | 'ACCEPT'
  | 'CORRECT'
  | 'RECLASSIFY'
  | 'MARK_DUPLICATE'
  | 'MARK_SUPERSEDED'
  | 'REQUEST_REPLACEMENT'
  | 'ESCALATE'
  | 'REJECT'
  | string;

export interface HumanReviewQueueItem {
  id: string;
  documentId: string;
  filename: string;
  category: TaxDocumentCategory;
  aiDetectedCategory: TaxDocumentCategory;
  status: string;
  reason?: string;
  reviewReasons: string[];
  flaggedFields: ExtractedFieldProvenance[];
  [key: string]: any;
}
