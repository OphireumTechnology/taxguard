export const ACCEPTED_TYPES: readonly string[] = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.csv',
  '.xlsx',
  'application/pdf',
  'image/png',
  'image/jpeg',
];

export const DOCUMENT_CATEGORIES = [
  'TAX_FORM_W2',
  'TAX_FORM_1099',
  'TAX_FORM_1098',
  'K1_SCHEDULE',
  'BALANCE_SHEET',
  'PROFIT_AND_LOSS',
  'BANK_STATEMENT',
  'LEGAL_DOCUMENT',
  'ID_VERIFICATION',
  'OTHER',
] as const;

export interface VaultDocument {
  documentId: string;
  clientId: string;
  engagementId?: string;
  taxYear: number;
  fileName: string;
  category: string;
  status: string;
  quarantineStatus?: string;
  clientReason?: string;
  version: number;
  rowVersion: number;
  uploadedAt: string;
  canReview?: boolean;
  [key: string]: any;
}

export interface VaultExtraction {
  fieldId: string;
  fieldName: string;
  label?: string;
  value: string;
  confidence?: number;
  status: 'PENDING' | 'ACCEPTED' | 'CORRECTED' | 'REJECTED' | string;
  version: number;
  [key: string]: any;
}

export class VaultRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string
  ) {
    super(message || code);
  }
}

export function newVaultKey(): string {
  return 'vk_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function vaultMessage(err: unknown): string {
  if (err instanceof VaultRequestError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'The document vault service could not complete this request.';
}

export function documentStatusText(status: string): string {
  const map: Record<string, string> = {
    UPLOADED: 'Uploaded',
    SCANNING: 'Security Scanning',
    QUARANTINED: 'Quarantined',
    UNDER_REVIEW: 'Under Review',
    APPROVED: 'Approved',
    ACCEPTED: 'Accepted',
    REJECTED: 'Rejected',
    REPLACEMENT_REQUESTED: 'Replacement Requested',
  };
  return map[status] || status.replace(/_/g, ' ');
}

export const vaultService = {
  uploadTargets: async (_clientId: string) => ({
    items: [] as Array<{ engagementId: string; taxYear: number; title: string; label?: string }>,
  }),
  list: async (_clientId: string) => ({
    items: [] as VaultDocument[],
  }),
  upload: async (
    clientId: string,
    file: File,
    meta: { engagementId?: string; taxYear: number; category: string; documentId?: string },
    _idempotencyKey?: string
  ) => ({
    documentId: meta.documentId || 'doc_' + Date.now(),
    clientId,
    fileName: file.name,
    taxYear: meta.taxYear,
    category: meta.category,
    status: 'UPLOADED',
    version: 1,
    rowVersion: 1,
    uploadedAt: new Date().toISOString(),
  }),
  download: async (_clientId: string, documentId: string, _version?: number) => ({
    url: `#document-${documentId}`,
  }),
  reviewQueue: async () => ({
    items: [] as VaultDocument[],
  }),
  detail: async (_clientId: string, _documentId: string) => ({
    extractions: [] as VaultExtraction[],
  }),
  verifyField: async (
    _clientId: string,
    _fieldId: string,
    _decision: 'ACCEPTED' | 'CORRECTED' | 'REJECTED',
    _correctedValue?: string
  ) => ({ success: true }),
  review: async (
    _clientId: string,
    _documentId: string,
    _version: number,
    _action: 'approve' | 'request_replacement' | 'reject',
    _rowVersion: number,
    _note?: string,
    _clientReason?: string
  ) => ({ success: true }),
};
