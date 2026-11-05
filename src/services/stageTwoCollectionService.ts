export interface StageTwoUploadedDocument {
  documentId: string;
  associatedRequirementId?: string;
  claimedCategory?: string;
  isVerified?: boolean;
  originalFileName: string;
  processingStatus: 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'VERIFIED' | 'REJECTED' | string;
  taxYear: number;
  uploadTimestamp: string;
  fileSizeBytes?: number;
  mimeType?: string;
  downloadUrl?: string;
  [key: string]: any;
}

export class StageTwoCollectionService {
  static inMemoryUploads: Map<string, StageTwoUploadedDocument[]> = new Map();
  private static inMemoryReqs: Map<string, any[]> = new Map();

  static getUploadedDocuments(clientId?: string, taxYear?: number): StageTwoUploadedDocument[] {
    const key = `${clientId || 'default'}_${taxYear || 2025}`;
    return this.inMemoryUploads.get(key) || [];
  }

  static getRequirements(clientId?: string, taxYear?: number): any[] {
    const key = `${clientId || 'default'}_${taxYear || 2025}`;
    return this.inMemoryReqs.get(key) || [];
  }

  static saveRequirements(clientId: string, taxYear: number, reqs: any[]): void {
    const key = `${clientId}_${taxYear}`;
    this.inMemoryReqs.set(key, reqs);
  }

  static async ingestDocumentUpload(data: any): Promise<StageTwoUploadedDocument> {
    const doc: StageTwoUploadedDocument = {
      documentId: 'doc_' + Date.now(),
      associatedRequirementId: data?.requirementId,
      claimedCategory: data?.category || 'general',
      isVerified: false,
      originalFileName: data?.file?.name || data?.fileName || 'document.pdf',
      processingStatus: 'UPLOADED',
      taxYear: data?.taxYear || 2025,
      uploadTimestamp: new Date().toISOString()
    };
    const key = `${data?.clientId || 'default'}_${doc.taxYear}`;
    const list = this.getUploadedDocuments(data?.clientId, doc.taxYear);
    list.push(doc);
    this.inMemoryUploads.set(key, list);
    return doc;
  }
}

export const stageTwoCollectionService = {
  getMissingDocuments: async (_clientId?: string) => [],
  getPendingRequests: async (_clientId?: string) => [],
  getUploadedDocuments: (clientId?: string, taxYear?: number) => StageTwoCollectionService.getUploadedDocuments(clientId, taxYear)
};
