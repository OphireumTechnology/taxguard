export type TaxDocumentCategory =
  | 'W2'
  | '1099_NEC'
  | '1099_INT'
  | '1099_DIV'
  | '1099_B'
  | '1099_R'
  | '1099_MISC'
  | '1098'
  | 'K1'
  | 'BANK_STATEMENT'
  | 'PROFIT_LOSS'
  | 'BALANCE_SHEET'
  | 'PAYROLL'
  | 'PRIOR_RETURN'
  | 'IDENTITY'
  | 'OTHER'
  | string;

export const CONTROLLED_TAX_CATEGORIES: readonly TaxDocumentCategory[] = [
  'W2',
  '1099_NEC',
  '1099_INT',
  '1099_DIV',
  '1099_B',
  '1099_R',
  '1099_MISC',
  '1098',
  'K1',
  'BANK_STATEMENT',
  'PROFIT_LOSS',
  'BALANCE_SHEET',
  'PAYROLL',
  'PRIOR_RETURN',
  'IDENTITY',
  'OTHER',
] as const;

export interface ExtractedFieldProvenance {
  fieldName: string;
  value: string | number | null;
  confidence?: number;
  pageNumber?: number;
  boundingBox?: number[];
  verified?: boolean;
  verifiedBy?: string;
  [key: string]: any;
}

export interface DocumentIntelligenceRecord {
  id: string;
  documentId: string;
  fileName?: string;
  category: TaxDocumentCategory;
  taxYear?: number;
  confidence?: number;
  status: string;
  extractedFields: ExtractedFieldProvenance[];
  warnings?: string[];
  createdAt?: string;
  [key: string]: any;
}

export type HumanReviewAction = 'APPROVE' | 'REJECT' | 'RECLASSIFY' | 'REQUEST_REPLACEMENT' | string;

export interface HumanReviewQueueItem {
  id: string;
  documentId: string;
  fileName: string;
  category: TaxDocumentCategory;
  reason?: string;
  severity?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED' | string;
  createdAt?: string;
  [key: string]: any;
}
