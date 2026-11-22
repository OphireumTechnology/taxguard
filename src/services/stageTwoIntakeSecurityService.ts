export interface StagedSecurityDocument {
  id: string;
  fileName: string;
  sha256: string;
  scanStatus: 'pending' | 'clean' | 'quarantined' | string;
  uploadedAt: string;
  [key: string]: any;
}

export const StageTwoIntakeSecurityService: any = {
  async inspectFile(file: File): Promise<{ safe: boolean; sha256: string; reason?: string }> {
    return { safe: true, sha256: `local_${file.name}_${file.size}` };
  },
  getStagedDocuments(): StagedSecurityDocument[] {
    return [];
  },
};
