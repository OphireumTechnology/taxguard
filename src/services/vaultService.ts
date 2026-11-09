export class VaultRequestError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message || code);
    this.name = 'VaultRequestError';
  }
}

export function vaultMessage(err: unknown): string {
  if (err instanceof VaultRequestError) {
    return err.message || err.code;
  }
  if (err instanceof Error) return err.message;
  return 'Vault operation failed.';
}

export function documentStatusText(status: string): string {
  switch (status) {
    case 'SCAN_PENDING': return 'Scanning for security';
    case 'REJECTED_MALWARE': return 'Blocked by security scan';
    case 'PENDING_REVIEW': return 'Awaiting professional review';
    case 'VERIFIED':
    case 'ACCEPTED': return 'Accepted';
    case 'REPLACEMENT_REQUESTED': return 'Replacement requested';
    case 'REJECTED': return 'Rejected';
    default: return status ? status.replace(/_/g, ' ') : 'Unknown';
  }
}

export function newVaultKey(): string {
  return `vk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
] as const;

export const DOCUMENT_CATEGORIES = [
  'income',
  'deduction',
  'expense',
  'identity',
  'prior_year_return',
  'bank_statement',
  'w2_1099',
  'other'
] as const;

export interface VaultDocument {
  clientId: string;
  clientName?: string;
  documentId: string;
  version: number;
  rowVersion?: number;
  fileName: string;
  taxYear: number;
  category: string;
  uploadedBy: string;
  uploaderRole?: string;
  createdAt: string;
  status: string;
  canReview?: boolean;
  undecidedProposals?: number;
  mimeType?: string;
  sizeBytes?: number;
  downloadUrl?: string;
}

export interface VaultExtraction {
  fieldId: string;
  version: number;
  fieldName: string;
  extractedValue: string;
  status: string;
  confidence?: number;
}

export const vaultService = {
  list: async (_clientId: string): Promise<{ items: VaultDocument[] }> => {
    return { items: [] };
  },
  uploadTargets: async (_clientId: string): Promise<{ items: Array<{ engagementId: string; title: string; taxYear: number }> }> => {
    return {
      items: [
        { engagementId: 'eng_current', title: 'Annual Tax Engagement', taxYear: new Date().getFullYear() },
        { engagementId: 'eng_prior', title: 'Prior Year Tax Engagement', taxYear: new Date().getFullYear() - 1 },
      ]
    };
  },
  upload: async (
    _clientId: string,
    file: File,
    meta: { engagementId: string; taxYear: number; category: string; documentId?: string },
    _key?: string
  ): Promise<{ status: string; documentId: string }> => {
    return {
      status: 'PENDING_REVIEW',
      documentId: meta.documentId || `doc_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`,
    };
  },
  download: async (clientId: string, documentId: string, version: number): Promise<{ url: string }> => {
    return { url: `/api/vault/download?client=${encodeURIComponent(clientId)}&doc=${encodeURIComponent(documentId)}&v=${version}` };
  },
  reviewQueue: async (): Promise<{ items: VaultDocument[] }> => {
    return { items: [] };
  },
  detail: async (_clientId: string, _documentId: string): Promise<{ extractions: VaultExtraction[] }> => {
    return { extractions: [] };
  },
  verifyField: async (_clientId: string, _fieldId: string, _status: string, _correction?: string): Promise<{ success: boolean }> => {
    return { success: true };
  },
  review: async (
    _clientId: string,
    _documentId: string,
    _version: number,
    _action: string,
    _rowVersion?: number,
    _note?: string,
    _clientReason?: string
  ): Promise<{ success: boolean }> => {
    return { success: true };
  },
};
