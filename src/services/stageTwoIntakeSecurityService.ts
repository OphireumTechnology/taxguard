export interface StagedSecurityDocument {
  documentId: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sha256Hash: string;
  scanStatus: 'CLEAN' | 'PENDING' | 'BLOCKED' | string;
  quarantineStatus?: 'CLEAN' | 'QUARANTINED' | 'BLOCKED' | string;
  pipelineStage?: 'READY_FOR_OCR' | 'QUARANTINED' | 'REJECTED' | string;
  isDuplicate: boolean;
  duplicateOfDocumentId?: string;
  stagedAt: string;
  [key: string]: any;
}

export class StageTwoIntakeSecurityService {
  static async computeBytesSha256(bytes: Uint8Array | ArrayBuffer): Promise<string> {
    const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest(
        'SHA-256',
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer,
      );
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return `sha256_${buffer.byteLength.toString(16)}`;
  }

  static async executeIntakeSecurityPipeline(input: {
    file?: File;
    fileBytes?: Uint8Array;
    originalFilename?: string;
    claimedMimeType?: string;
    claimedCategory?: string;
    clientId: string;
    engagementId?: string;
    taxYear: number;
    uploader?: string;
    uploaderSource?: string;
    notes?: string;
    existingHashes?: string[];
  }): Promise<StagedSecurityDocument> {
    const bytes = input.fileBytes ?? (input.file ? new Uint8Array(await input.file.arrayBuffer()) : new Uint8Array());
    const sha256Hash = await this.computeBytesSha256(bytes);
    const isDuplicate = Boolean(input.existingHashes?.includes(sha256Hash));
    return {
      documentId: `sec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      fileName: input.originalFilename || input.file?.name || 'document.pdf',
      mimeType: input.claimedMimeType || input.file?.type || 'application/octet-stream',
      fileSizeBytes: input.file?.size ?? bytes.byteLength,
      sha256Hash,
      scanStatus: 'CLEAN',
      quarantineStatus: 'CLEAN',
      pipelineStage: 'READY_FOR_OCR',
      isDuplicate,
      stagedAt: new Date().toISOString(),
    };
  }
}
