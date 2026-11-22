export interface ClientCaseRequestRecord {
  id: string;
  clientId: string;
  taxYear?: number;
  title: string;
  category?: string;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface ReviewItemDetails {
  id: string;
  documentId?: string;
  fileName?: string;
  category?: string;
  status: string;
  extractedFields?: Record<string, any>;
  issues?: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  [key: string]: any;
}
