export interface StagedSecurityDocument {
  id: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  scanStatus: 'pending' | 'clean' | 'quarantined' | 'rejected' | string;
  sha256?: string;
  uploadedAt?: string;
  [key: string]: any;
}

export const StageTwoIntakeSecurityService: any = {
  validateFile(file: File): { valid: boolean; error?: string } {
    const maxBytes = 25 * 1024 * 1024;
    if (file.size > maxBytes) {
      return { valid: false, error: 'File exceeds the 25 MB upload limit.' };
    }
    return { valid: true };
  },
  stageDocument(file: File): StagedSecurityDocument {
    return {
      id: `doc_${Date.now().toString(36)}`,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      scanStatus: 'pending',
      uploadedAt: new Date().toISOString(),
    };
  },
};
