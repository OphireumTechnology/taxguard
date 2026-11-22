import { apiRequest, ApiRequestError } from './api';

export class VaultRequestError extends ApiRequestError {
  constructor(statusOrMessage: number | string, codeOrStatus?: string | number, messageOrCode?: string) {
    if (typeof statusOrMessage === 'number') {
      const code = typeof codeOrStatus === 'string' ? codeOrStatus : `HTTP_${statusOrMessage}`;
      const message = messageOrCode || code;
      super(message, statusOrMessage, code);
    } else {
      const status = typeof codeOrStatus === 'number' ? codeOrStatus : 500;
      const code = messageOrCode || `HTTP_${status}`;
      super(statusOrMessage, status, code);
    }
    this.name = 'VaultRequestError';
  }
}

export const ACCEPTED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const DOCUMENT_CATEGORIES = [
  'income',
  'business',
  'deductions',
  'investments',
  'identity',
  'prior_year',
  'notices',
  'other',
] as const;

export interface VaultDocument {
  id: string;
  clientId?: string;
  fileName: string;
  category?: string;
  status: string;
  scanStatus?: string;
  sizeBytes?: number;
  mimeType?: string;
  taxYear?: number;
  uploadedAt?: string;
  [key: string]: any;
}

export interface VaultExtraction {
  id: string;
  documentId: string;
  status: string;
  fields: Record<string, any>;
  confidence?: number;
  [key: string]: any;
}

export function newVaultKey(prefix = 'vault'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function documentStatusText(status: string): string {
  const map: Record<string, string> = {
    quarantined: 'Scanning',
    uploaded: 'Uploaded',
    under_review: 'Under Review',
    verified: 'Verified',
    approved: 'Approved',
    rejected: 'Replacement Needed',
  };
  return map[status] || status;
}

export function vaultMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Document vault is temporarily unavailable.';
}

export const vaultService: any = new Proxy(
  {
    list: (clientId?: string) =>
      apiRequest(`/api/vault/documents${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    upload: (payload: any) =>
      apiRequest('/api/vault/documents', { method: 'POST', body: JSON.stringify(payload) }),
    getDownloadUrl: (id: string) =>
      apiRequest(`/api/vault/documents/${encodeURIComponent(id)}/download`),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/vault/${prop}`);
    },
  }
);
