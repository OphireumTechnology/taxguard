export const ACCEPTED_TYPES: readonly string[] = [
  '.pdf',
  '.jpg',
  '.jpeg',
  '.png',
  '.xlsx',
  '.csv',
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
];

export const DOCUMENT_CATEGORIES = [
  'income',
  'w2',
  '1099',
  'k1',
  'deductions',
  'expenses',
  'bank_statements',
  'bookkeeping',
  'payroll',
  'state_tax',
  'identity',
  'prior_return',
  'notices',
  'other',
] as const;

export interface VaultExtraction {
  fieldId: string;
  id?: string;
  version: number;
  fieldKey: string;
  field?: string;
  proposedValue: unknown;
  verifiedValue?: unknown;
  value?: string;
  confidence: number;
  provider: string;
  decision?: 'ACCEPTED' | 'CORRECTED' | 'REJECTED' | string;
  verified?: boolean;
  verifiedBy?: string;
  [key: string]: any;
}

export interface VaultDocument {
  documentId: string;
  clientId: string;
  clientName?: string;
  engagementId: string;
  taxYear: number;
  fileName: string;
  category: string;
  status: string;
  version: number;
  rowVersion: number;
  createdAt: string;
  uploadedAt?: string;
  uploadedBy?: string;
  uploaderRole?: string;
  canReview?: boolean;
  undecidedProposals?: number;
  fileSizeBytes?: number;
  mimeType?: string;
  extractions?: VaultExtraction[];
  [key: string]: any;
}

export class VaultRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function newVaultKey(): string {
  return `vk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function documentStatusText(status: string): string {
  return (status || 'PENDING_REVIEW').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function vaultMessage(err: unknown): string {
  if (err instanceof VaultRequestError) {
    if (err.code === 'DOCUMENT_VAULT_UNAVAILABLE') return 'Document vault is temporarily unavailable.';
    return err.message || 'Document vault request failed.';
  }
  return err instanceof Error ? err.message : 'Unable to complete document vault request.';
}

const inMemoryVaultDocs: VaultDocument[] = [];

export const vaultService = {
  async list(clientId: string): Promise<{ items: VaultDocument[] }> {
    return { items: inMemoryVaultDocs.filter(d => d.clientId === clientId) };
  },
  async uploadTargets(clientId: string): Promise<{ items: Array<{ engagementId: string; title: string; taxYear: number }> }> {
    return { items: [{ engagementId: `eng_${clientId}_2025`, title: '2025 Tax Return Engagement', taxYear: 2025 }] };
  },
  async upload(
    clientId: string,
    file: File,
    meta: { engagementId: string; taxYear: number; category: string; documentId?: string },
    _idempotencyKey?: string,
  ): Promise<{ documentId: string; status: string; version: number }> {
    const existing = meta.documentId
      ? inMemoryVaultDocs.find(d => d.documentId === meta.documentId)
      : undefined;
    const version = existing ? existing.version + 1 : 1;
    const documentId = existing?.documentId ?? `vdoc_${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const record: VaultDocument = {
      documentId,
      clientId,
      engagementId: meta.engagementId,
      taxYear: meta.taxYear,
      fileName: file.name,
      category: meta.category,
      status: 'PENDING_REVIEW',
      version,
      rowVersion: existing ? existing.rowVersion + 1 : 1,
      createdAt: now,
      uploadedAt: now,
      uploaderRole: 'client',
      canReview: true,
      fileSizeBytes: file.size,
      mimeType: file.type,
      extractions: [],
    };
    if (existing) {
      Object.assign(existing, record);
    } else {
      inMemoryVaultDocs.push(record);
    }
    return { documentId, status: record.status, version };
  },
  async download(_clientId: string, documentId: string, _version?: number): Promise<{ url: string }> {
    return { url: `#vault-document-${documentId}` };
  },
  async reviewQueue(_query?: Record<string, any>): Promise<{ items: VaultDocument[] }> {
    return { items: [...inMemoryVaultDocs] };
  },
  async detail(_clientId: string, documentId: string): Promise<{ document: VaultDocument | null; extractions: VaultExtraction[] }> {
    const doc = inMemoryVaultDocs.find(d => d.documentId === documentId) ?? null;
    return { document: doc, extractions: doc?.extractions ?? [] };
  },
  async review(
    _clientId: string,
    documentId: string,
    _version: number,
    action: string,
    _rowVersion?: number,
    _note?: string,
    _clientReason?: string,
  ): Promise<{ success: boolean; status: string }> {
    const doc = inMemoryVaultDocs.find(d => d.documentId === documentId);
    const nextStatus = action === 'approve' ? 'VERIFIED' : action === 'request_replacement' ? 'REPLACEMENT_REQUESTED' : 'REJECTED';
    if (doc) doc.status = nextStatus;
    return { success: true, status: nextStatus };
  },
  async verifyField(
    _clientId: string,
    fieldId: string,
    decision: string,
    correctedValue?: string,
  ): Promise<{ success: boolean }> {
    for (const doc of inMemoryVaultDocs) {
      const ext = doc.extractions?.find(e => e.fieldId === fieldId || e.id === fieldId);
      if (ext) {
        ext.decision = decision;
        ext.verified = decision !== 'REJECTED';
        if (correctedValue !== undefined) {
          ext.verifiedValue = correctedValue;
          ext.value = correctedValue;
        }
      }
    }
    return { success: true };
  },
};
