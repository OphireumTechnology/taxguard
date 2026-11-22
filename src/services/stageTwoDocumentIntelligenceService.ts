export const CONTROLLED_TAX_CATEGORIES = [
  'W-2 Wage & Tax Statement',
  '1099-NEC / 1099-MISC',
  '1099-INT / 1099-DIV / 1099-B',
  'Schedule K-1',
  '1098 Mortgage Interest',
  'Business Profit & Loss',
  'Business Balance Sheet',
  'Bank & Credit Card Statements',
  'Prior-Year Tax Return',
  'Identity & Entity Formation',
] as const;

export type TaxDocumentCategory = (typeof CONTROLLED_TAX_CATEGORIES)[number] | string;

export interface ExtractedFieldProvenance {
  field: string;
  value: any;
  confidence: number;
  page?: number;
  source?: string;
  [key: string]: any;
}

export interface DocumentIntelligenceRecord {
  id: string;
  documentId: string;
  category: TaxDocumentCategory;
  confidence: number;
  fields: ExtractedFieldProvenance[];
  status: string;
  [key: string]: any;
}

export type HumanReviewAction = 'approve' | 'reject' | 'override' | 'request_replacement' | string;

export interface HumanReviewQueueItem {
  id: string;
  documentId: string;
  fileName?: string;
  category: TaxDocumentCategory;
  status: string;
  record?: DocumentIntelligenceRecord;
  [key: string]: any;
}
