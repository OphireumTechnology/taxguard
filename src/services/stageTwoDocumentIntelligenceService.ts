
export type TaxDocumentCategory =
  | "W2"
  | "FORM_1099_NEC"
  | "FORM_1099_MISC"
  | "FORM_1099_INT"
  | "FORM_1099_DIV"
  | "FORM_1099_B"
  | "FORM_1098"
  | "SCHEDULE_K1"
  | "BANK_STATEMENT"
  | "PROFIT_LOSS"
  | "BALANCE_SHEET"
  | "PRIOR_YEAR_RETURN"
  | "OTHER";

export const CONTROLLED_TAX_CATEGORIES: TaxDocumentCategory[] = [
  "W2", "FORM_1099_NEC", "FORM_1099_MISC", "FORM_1099_INT", "FORM_1099_DIV",
  "FORM_1099_B", "FORM_1098", "SCHEDULE_K1", "BANK_STATEMENT", "PROFIT_LOSS", "BALANCE_SHEET"
];

export interface ExtractedFieldProvenance {
  confidence: number;
  sourceBoundingBox?: any;
  method: "AI" | "OCR" | "MANUAL";
  reviewedBy?: string;
  reviewedAt?: string;
}

export interface DocumentIntelligenceRecord {
  recordId: string;
  documentId: string;
  category: TaxDocumentCategory;
  confidence: number;
  extractedFields: {
    key: string;
    value: string;
    provenance: ExtractedFieldProvenance;
  }[];
}

export interface HumanReviewQueueItem {
  reviewId: string;
  documentId: string;
  clientId: string;
  taxYear: number;
  category: TaxDocumentCategory;
  status: "PENDING" | "CLAIMED" | "RESOLVED";
  assignedTo?: string;
}

export type HumanReviewAction = "CLAIM" | "ACCEPT" | "CORRECT" | "REJECT";
