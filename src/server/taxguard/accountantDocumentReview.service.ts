export interface ReviewItemDetails {
  documentId: string;
  clientId?: string;
  clientName?: string;
  fileName?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  sha256?: string;
  taxYear?: number;
  version?: number;
  extractedFields?: Array<{
    fieldId?: string;
    fieldName: string;
    fieldValue: string | number;
    confidenceScore?: number;
    status?: string;
    [key: string]: any;
  }>;
  status?: string;
  [key: string]: any;
}

export interface ClientCaseRequestRecord {
  id?: string;
  requestId?: string;
  title?: string;
  description?: string;
  status: 'OPEN' | 'CLIENT_RESPONDED' | 'RESOLVED' | 'WAIVED' | string;
  priority?: string;
  createdAt?: string;
  dueDate?: string;
  clientId?: string;
  taxYear?: number;
  [key: string]: any;
}

export const accountantDocumentReviewService = {
  getReviewQueue: async (_taxYear?: number) => ({ items: [] }),
  getRequests: async (_taxYear?: number) => ({ requests: [] })
};
