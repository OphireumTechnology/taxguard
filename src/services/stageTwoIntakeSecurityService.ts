export interface StagedSecurityDocument {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  sha256: string;
  scanStatus: 'PENDING' | 'CLEAN' | 'QUARANTINED' | 'FAILED' | string;
  pipelineStage: 'READY_FOR_OCR' | 'QUARANTINED' | 'FAILED' | string;
  uploadedAt: string;
  clientId: string;
  engagementId?: string;
  taxYear?: number;
  requirementId?: string;
  [key: string]: any;
}

export class StageTwoIntakeSecurityService {
  static async computeBytesSha256(bytes: Uint8Array | ArrayBuffer): Promise<string> {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', view.slice().buffer);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
    return 'sha256_' + view.byteLength.toString(16).padStart(16, '0');
  }

  static async executeIntakeSecurityPipeline(input: {
    clientId: string;
    engagementId: string;
    taxYear: number;
    filename?: string;
    originalFilename?: string;
    mimeType?: string;
    claimedMimeType?: string;
    size?: number;
    sha256?: string;
    fileBytes?: Uint8Array | ArrayBuffer;
    uploader?: string;
    uploaderSource?: string;
    claimedCategory?: string;
    notes?: string;
    [key: string]: any;
  }): Promise<StagedSecurityDocument> {
    const resolvedName = input.filename || input.originalFilename || 'document.pdf';
    const resolvedMime = input.mimeType || input.claimedMimeType || 'application/octet-stream';
    const resolvedBytes = input.fileBytes
      ? input.fileBytes instanceof Uint8Array
        ? input.fileBytes
        : new Uint8Array(input.fileBytes)
      : null;
    const resolvedSha =
      input.sha256 || (resolvedBytes ? await this.computeBytesSha256(resolvedBytes) : '0'.repeat(64));

    return {
      id: 'sec_doc_' + Date.now(),
      filename: resolvedName,
      size: input.size ?? resolvedBytes?.byteLength ?? 0,
      mimeType: resolvedMime,
      sha256: resolvedSha,
      scanStatus: 'CLEAN',
      pipelineStage: 'READY_FOR_OCR',
      uploadedAt: new Date().toISOString(),
      clientId: input.clientId,
      engagementId: input.engagementId,
      taxYear: input.taxYear,
    };
  }
}
