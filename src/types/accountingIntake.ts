export type IntakeSourceType = 'GOOGLE_DRIVE' | 'DROPBOX' | 'MANUAL_UPLOAD' | 'EMAIL';

export interface CandidateDocument {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
}

export interface ImportedDocument {
  id: string;
  sourceId: string;
  name: string;
  url?: string;
  importedAt: string;
}

export interface AccountingDocumentSource {
  sourceType: IntakeSourceType;
  providerName: string;
}

export interface StoredDocumentMetadata {
  id: string;
  name: string;
  status: string;
}
