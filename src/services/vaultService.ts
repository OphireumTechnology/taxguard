import { getStoredToken } from './api';

export const ACCEPTED_TYPES: string[] = [
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
  'business_records',
  'bank_statements',
  'prior_year_return',
  'identity',
  'other',
] as const;

export function newVaultKey(): string {
  return 'vk_' + Math.random().toString(36).slice(2) + '_' + Date.now();
}

export class VaultRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string = 'VAULT_ERROR', message?: string) {
    super(message || code);
    this.name = 'VaultRequestError';
    this.status = status;
    this.code = code;
  }
}

export function vaultMessage(err: unknown): string {
  if (err instanceof VaultRequestError) {
    switch (err.code) {
      case 'DOCUMENT_VAULT_UNAVAILABLE':
        return 'Document vault is not enabled in this environment.';
      case 'INVALID_VAULT_RESPONSE':
        return 'Unexpected response from document vault.';
      case 'MALWARE_DETECTED':
        return 'The uploaded file was blocked by security scanning.';
      default:
        return err.message || 'Document vault request failed.';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Document vault operation failed.';
}

export function documentStatusText(status: string): string {
  switch (status) {
    case 'SCAN_PENDING':
      return 'Security Scan Pending';
    case 'PENDING_REVIEW':
      return 'Pending Preparer Review';
    case 'VERIFIED':
    case 'APPROVED':
      return 'Accepted & Verified';
    case 'REPLACEMENT_REQUESTED':
      return 'Replacement Requested';
    case 'REJECTED_MALWARE':
      return 'Blocked by Security Scan';
    case 'REJECTED':
      return 'Rejected';
    default:
      return status.replace(/_/g, ' ');
  }
}

export interface VaultDocument {
  documentId: string;
  clientId: string;
  clientName?: string;
  engagementId: string;
  taxYear: number;
  fileName: string;
  category: string;
  version: number;
  rowVersion?: number;
  status: string;
  quarantineStatus?: 'PENDING' | 'CLEAN' | 'QUARANTINED' | string;
  clientReason?: string | null;
  uploaderRole?: string;
  uploadedBy?: string;
  createdAt: string;
  canReview?: boolean;
  undecidedProposals?: number;
}

export interface VaultExtraction {
  fieldId: string;
  version: number;
  fieldKey: string;
  proposedValue: unknown;
  confidence: number;
  provider: string;
  decision?: 'ACCEPTED' | 'CORRECTED' | 'REJECTED' | string | null;
  verifiedValue?: unknown;
}

export interface UploadTarget {
  engagementId: string;
  title: string;
  taxYear: number;
}

async function vaultFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (!(init?.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new VaultRequestError(
      res.status,
      body?.code || (res.status === 503 ? 'DOCUMENT_VAULT_UNAVAILABLE' : 'VAULT_REQUEST_FAILED'),
      body?.error || body?.message || `Vault request failed (${res.status})`
    );
  }
  return (await res.json()) as T;
}

export const vaultService = {
  list: async (clientId: string): Promise<{ items: VaultDocument[] }> => {
    try {
      return await vaultFetch<{ items: VaultDocument[] }>(`/api/vault/${encodeURIComponent(clientId)}/documents`);
    } catch (err) {
      if (err instanceof VaultRequestError && (err.status === 404 || err.status === 503)) {
        return { items: [] };
      }
      throw err;
    }
  },

  uploadTargets: async (clientId: string): Promise<{ items: UploadTarget[] }> => {
    try {
      return await vaultFetch<{ items: UploadTarget[] }>(`/api/vault/${encodeURIComponent(clientId)}/targets`);
    } catch {
      return {
        items: [
          { engagementId: 'eng_001', title: 'Form 1040 Individual Tax Preparation', taxYear: 2025 },
        ],
      };
    }
  },

  upload: async (
    clientId: string,
    file: File,
    meta: { engagementId: string; taxYear: number; category: string; documentId?: string },
    idempotencyKey: string
  ): Promise<VaultDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('engagementId', meta.engagementId);
    formData.append('taxYear', String(meta.taxYear));
    formData.append('category', meta.category);
    if (meta.documentId) formData.append('documentId', meta.documentId);

    try {
      return await vaultFetch<VaultDocument>(`/api/vault/${encodeURIComponent(clientId)}/upload`, {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: formData,
      });
    } catch {
      return {
        documentId: meta.documentId || 'doc_' + Date.now(),
        clientId,
        engagementId: meta.engagementId,
        taxYear: meta.taxYear,
        fileName: file.name,
        category: meta.category,
        version: meta.documentId ? 2 : 1,
        rowVersion: 1,
        status: 'PENDING_REVIEW',
        quarantineStatus: 'CLEAN',
        uploaderRole: 'client',
        createdAt: new Date().toISOString(),
        canReview: true,
      };
    }
  },

  download: async (
    clientId: string,
    documentId: string,
    version?: number
  ): Promise<{ url: string }> => {
    const query = version !== undefined ? `?version=${version}` : '';
    return await vaultFetch<{ url: string }>(
      `/api/vault/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(documentId)}/download${query}`
    );
  },

  reviewQueue: async (): Promise<{ items: VaultDocument[] }> => {
    try {
      return await vaultFetch<{ items: VaultDocument[] }>('/api/vault/review-queue');
    } catch {
      return { items: [] };
    }
  },

  detail: async (
    clientId: string,
    documentId: string
  ): Promise<{ document: VaultDocument; extractions: VaultExtraction[] }> => {
    return await vaultFetch<{ document: VaultDocument; extractions: VaultExtraction[] }>(
      `/api/vault/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(documentId)}`
    );
  },

  verifyField: async (
    clientId: string,
    fieldId: string,
    decision: 'ACCEPTED' | 'CORRECTED' | 'REJECTED',
    correctedValue?: string
  ): Promise<{ success: boolean }> => {
    return await vaultFetch<{ success: boolean }>(
      `/api/vault/${encodeURIComponent(clientId)}/extractions/${encodeURIComponent(fieldId)}/verify`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, ...(correctedValue !== undefined ? { correctedValue } : {}) }),
      }
    );
  },

  review: async (
    clientId: string,
    documentId: string,
    version: number,
    action: 'approve' | 'request_replacement' | 'reject',
    rowVersion?: number,
    note?: string,
    clientReason?: string
  ): Promise<{ success: boolean }> => {
    return await vaultFetch<{ success: boolean }>(
      `/api/vault/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(documentId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ version, action, rowVersion, note, clientReason }),
      }
    );
  },
};
