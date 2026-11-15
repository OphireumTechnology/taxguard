export const CONTROLLED_TAX_CATEGORIES = [
  'W-2 Wage Statements',
  '1099 Information Returns',
  'Schedule K-1 Pass-Through',
  'Bank & Brokerage Statements',
  'Bookkeeping & General Ledger',
  'Payroll & Tax Deposits',
  'Deductions & Credits',
  'Entity & Formation Records',
  'Prior Year Tax Returns',
  'IRS & State Notices',
  'Other Supporting Documents',
] as const;

export type TaxDocumentCategory = (typeof CONTROLLED_TAX_CATEGORIES)[number] | string;

export type HumanReviewAction = 'APPROVE' | 'REJECT' | 'RECLASSIFY' | 'REQUEST_REPLACEMENT' | string;

export interface ExtractedFieldProvenance {
  fieldName: string;
  value: string;
  confidence: number;
  pageNumber?: number;
  sourceMethod?: string;
  verified?: boolean;
  [key: string]: any;
}

export interface DocumentIntelligenceRecord {
  documentId: string;
  detectedCategory: TaxDocumentCategory;
  confidence: number;
  taxYear?: number;
  extractedFields: ExtractedFieldProvenance[];
  summary?: string;
  flags?: string[];
  [key: string]: any;
}

export interface HumanReviewQueueItem {
  id: string;
  documentId: string;
  fileName: string;
  category: TaxDocumentCategory;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  createdAt: string;
  [key: string]: any;
}
