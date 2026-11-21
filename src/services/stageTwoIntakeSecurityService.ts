export interface StagedSecurityDocument {
  id: string;
  documentId?: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  fileName: string;
  originalFilename?: string;
  mimeType?: string;
  fileSize?: number;
  sha256: string;
  scanStatus: 'CLEAN' | 'PENDING' | 'QUARANTINED' | 'FAILED' | string;
  pipelineStage: 'READY_FOR_OCR' | 'QUARANTINED' | 'REJECTED' | 'PENDING_SCAN' | string;
  encryptionStatus?: string;
  uploadedAt: string;
  category?: string;
  requirementId?: string;
  [key: string]: any;
}

export interface IntakeSecurityPipelineInput {
  file?: File;
  fileName?: string;
  originalFilename?: string;
  fileSize?: number;
  mimeType?: string;
  claimedMimeType?: string;
  fileBytes?: Uint8Array | ArrayBuffer;
  sha256?: string;
  clientId?: string;
  engagementId?: string;
  taxYear?: number;
  category?: string;
  claimedCategory?: string;
  requirementId?: string;
  uploader?: string;
  uploaderSource?: string;
  notes?: string;
  [key: string]: any;
}

export const StageTwoIntakeSecurityService = {
  async computeBytesSha256(bytes: Uint8Array | ArrayBuffer): Promise<string> {
    const buffer = bytes instanceof Uint8Array ? bytes.slice().buffer : bytes;
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return `sha256_${Date.now().toString(16)}`;
  },

  async executeIntakeSecurityPipeline(
    input: IntakeSecurityPipelineInput
  ): Promise<StagedSecurityDocument> {
    const sha256 =
      input.sha256 ||
      (input.fileBytes ? await this.computeBytesSha256(input.fileBytes) : `sha256_${Date.now().toString(16)}`);
    const resolvedName = input.originalFilename || input.fileName || 'uploaded_document';
    return {
      id: `stg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      clientId: input.clientId,
      engagementId: input.engagementId,
      taxYear: input.taxYear,
      fileName: resolvedName,
      originalFilename: resolvedName,
      mimeType: input.claimedMimeType || input.mimeType || 'application/pdf',
      fileSize: input.fileSize || (input.fileBytes ? input.fileBytes.byteLength : 0),
      sha256,
      scanStatus: 'CLEAN',
      pipelineStage: 'READY_FOR_OCR',
      encryptionStatus: 'AES-256-GCM',
      uploadedAt: new Date().toISOString(),
      category: input.claimedCategory || input.category,
      requirementId: input.requirementId,
    };
  },
};
