import { getStoredToken } from './api';

export const ACCEPTED_TYPES: readonly string[] = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.csv',
  '.xlsx',
  '.xls',
  '.doc',
  '.docx',
  '.txt',
];

export const DOCUMENT_CATEGORIES = [
  'W2',
  '1099',
  '1098',
  'K1',
  'BANK_STATEMENT',
  'FINANCIAL_STATEMENT',
  'PAYROLL',
  'PRIOR_RETURN',
  'IDENTITY',
  'RECEIPT',
  'NOTICE',
  'OTHER',
] as const;

export interface VaultDocument {
  documentId: string;
  clientId: string;
  engagementId?: string;
  taxYear?: number;
  category: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  version: number;
  rowVersion: number;
  status: string;
  scanStatus?: string;
  canReview?: boolean;
  clientReason?: string | null;
  uploadedAt: string;
  uploadedBy?: string;
  [key: string]: any;
}

export interface VaultExtraction {
  fieldId: string;
  documentId: string;
  version: number;
  fieldName: string;
  value: string;
  correctedValue?: string | null;
  confidence?: number | null;
  status: 'PENDING' | 'ACCEPTED' | 'CORRECTED' | 'REJECTED' | string;
  [key: string]: any;
}

export class VaultRequestError extends Error {
  status: number;
  code?: string;
  constructor(statusOrMessage: number | string, codeOrStatus?: string | number, messageOrCode?: string) {
    if (typeof statusOrMessage === 'number') {
      const code = typeof codeOrStatus === 'string' ? codeOrStatus : undefined;
      const msg = messageOrCode || code || `Vault request failed (${statusOrMessage})`;
      super(msg);
      this.status = statusOrMessage;
      this.code = code;
    } else {
      super(statusOrMessage);
      this.status = typeof codeOrStatus === 'number' ? codeOrStatus : 500;
      this.code = messageOrCode;
    }
    this.name = 'VaultRequestError';
  }
}

export function newVaultKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `vk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function documentStatusText(status?: string): string {
  switch ((status || '').toUpperCase()) {
    case 'APPROVED':
    case 'ACCEPTED':
    case 'VERIFIED':
      return 'Accepted';
    case 'REJECTED':
      return 'Rejected';
    case 'REPLACEMENT_REQUESTED':
    case 'NEEDS_REPLACEMENT':
      return 'Replacement requested';
    case 'PENDING_SCAN':
    case 'SCANNING':
      return 'Scanning';
    case 'QUARANTINED':
      return 'Quarantined';
    case 'IN_REVIEW':
    case 'PENDING_REVIEW':
      return 'In review';
    default:
      return status ? status.replace(/_/g, ' ') : 'Received';
  }
}

export function vaultMessage(error: unknown): string {
  if (error instanceof VaultRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'The document vault could not complete this request. Please try again.';
}

async function vaultFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!(init?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new VaultRequestError(
      res.status,
      body?.code,
      (body && (body.error || body.message)) || `Vault request failed (${res.status})`
    );
  }
  return body as T;
}

export const vaultService = {
  async list(clientId: string): Promise<{ items: VaultDocument[] }> {
    const data = await vaultFetch<any>(`/api/vault/clients/${encodeURIComponent(clientId)}/documents`);
    return { items: Array.isArray(data?.items) ? data.items : [] };
  },

  async uploadTargets(
    clientId: string
  ): Promise<{ items: Array<{ engagementId: string; taxYear: number; title: string; [key: string]: any }> }> {
    const data = await vaultFetch<any>(`/api/vault/clients/${encodeURIComponent(clientId)}/upload-targets`);
    return { items: Array.isArray(data?.items) ? data.items : [] };
  },

  async upload(
    clientId: string,
    file: File,
    meta: { engagementId: string; taxYear: number; category: string; documentId?: string },
    idempotencyKey?: string
  ): Promise<{ document: VaultDocument; documentId: string; version: number; status: string; [key: string]: any }> {
    const form = new FormData();
    form.append('file', file);
    form.append('engagementId', meta.engagementId);
    form.append('taxYear', String(meta.taxYear));
    form.append('category', meta.category);
    if (meta.documentId) form.append('documentId', meta.documentId);
    const headers: Record<string, string> = {};
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    return vaultFetch(`/api/vault/clients/${encodeURIComponent(clientId)}/documents`, {
      method: 'POST',
      headers,
      body: form,
    });
  },

  async download(
    clientId: string,
    documentId: string,
    version?: number
  ): Promise<{ url: string }> {
    const q = version !== undefined ? `?version=${encodeURIComponent(String(version))}` : '';
    return vaultFetch(
      `/api/vault/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(documentId)}/download${q}`
    );
  },

  async reviewQueue(): Promise<{ items: VaultDocument[] }> {
    const data = await vaultFetch<any>('/api/vault/review-queue');
    return { items: Array.isArray(data?.items) ? data.items : [] };
  },

  async detail(
    clientId: string,
    documentId: string
  ): Promise<{ document?: VaultDocument; extractions: VaultExtraction[] }> {
    const data = await vaultFetch<any>(
      `/api/vault/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(documentId)}`
    );
    return {
      document: data?.document,
      extractions: Array.isArray(data?.extractions) ? data.extractions : [],
    };
  },

  async verifyField(
    clientId: string,
    fieldId: string,
    decision: 'ACCEPTED' | 'CORRECTED' | 'REJECTED',
    correctedValue?: string
  ): Promise<any> {
    return vaultFetch(
      `/api/vault/clients/${encodeURIComponent(clientId)}/extractions/${encodeURIComponent(fieldId)}`,
      {
        method: 'POST',
        body: JSON.stringify({ decision, correctedValue }),
      }
    );
  },

  async review(
    clientId: string,
    documentId: string,
    version: number,
    decision: 'approve' | 'request_replacement' | 'reject',
    rowVersion: number,
    note?: string,
    clientReason?: string
  ): Promise<any> {
    return vaultFetch(
      `/api/vault/clients/${encodeURIComponent(clientId)}/documents/${encodeURIComponent(documentId)}/review`,
      {
        method: 'POST',
        body: JSON.stringify({ version, decision, rowVersion, note, clientReason }),
      }
    );
  },
};
