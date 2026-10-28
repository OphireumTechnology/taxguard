export interface TaxGuardDocumentRecord {
  id: string;
  clientId: string;
  taxYear: number;
  fileName: string;
  contentType?: string;
  size?: number;
  uploadedAt?: string;
  status?: string;
}

export interface TaxGuardDocumentUploadRequest {
  clientId: string;
  taxYear: number;
  fileName: string;
  contentType?: string;
  size?: number;
}

export interface TaxGuardDocumentService {
  listDocuments(
    clientId: string,
    taxYear: number
  ): Promise<TaxGuardDocumentRecord[]>;

  uploadDocument(
    request: TaxGuardDocumentUploadRequest
  ): Promise<TaxGuardDocumentRecord>;

  deleteDocument(
    clientId: string,
    documentId: string
  ): Promise<void>;
}
