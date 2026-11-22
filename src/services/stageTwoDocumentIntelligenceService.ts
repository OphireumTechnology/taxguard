export const CONTROLLED_TAX_CATEGORIES = [
  'w2',
  '1099_nec',
  '1099_misc',
  '1099_int',
  '1099_div',
  '1099_b',
  'k1',
  '1098',
  'bank_statement',
  'financial_statement',
  'prior_return',
  'identity',
  'other',
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

export interface HumanReviewQueueItem {
  id: string;
  documentId: string;
  reason: string;
  status: string;
  createdAt?: string;
  [key: string]: any;
}

export type HumanReviewAction = 'approve' | 'correct' | 'reject' | 'escalate' | string;
