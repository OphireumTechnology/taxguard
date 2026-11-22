import { api } from './api';

export const ACCEPTED_TYPES = ['.pdf', '.png', '.jpg', '.jpeg', '.csv', '.xlsx', '.xls', '.doc', '.docx'] as const;

export const DOCUMENT_CATEGORIES = [
  'w2',
  '1099',
  'k1',
  'bank_statement',
  'financial_statement',
  'tax_return',
  'deductions',
  'payroll',
  'identity',
  'correspondence',
  'other',
] as const;

export interface VaultDocument {
  id: string;
  clientId?: string;
  fileName: string;
  category: string;
  taxYear?: number;
  status: string;
  sizeBytes?: number;
  mimeType?: string;
  uploadedAt?: string;
  scanStatus?: string;
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

export class VaultRequestError extends Error {
  public readonly code: string;
  public readonly status?: number;
  constructor(statusOrCode: number | string, codeOrMessage?: string, message?: string) {
    if (typeof statusOrCode === 'number') {
      super(message || codeOrMessage || `Vault request failed (${statusOrCode})`);
      this.status = statusOrCode;
      this.code = codeOrMessage || 'VAULT_ERROR';
    } else {
      super(codeOrMessage || statusOrCode);
      this.code = statusOrCode;
      this.status = typeof message === 'number' ? message : undefined;
    }
    this.name = 'VaultRequestError';
  }
}

export function newVaultKey(): string {
  return `vault_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function documentStatusText(status: string): string {
  return (status || 'uploaded').replace(/_/g, ' ');
}

export function vaultMessage(err: unknown, fallback = 'Document vault service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const vaultService: any = {
  list: (query?: Record<string, any>, signal?: AbortSignal) =>
    api.request('/api/vault/documents', { query, signal }),
  upload: (payload: Record<string, any>) =>
    api.request('/api/vault/documents', { method: 'POST', body: JSON.stringify(payload) }),
  review: (id: string, payload: Record<string, any>) =>
    api.request(`/api/vault/documents/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getExtraction: (id: string, signal?: AbortSignal) =>
    api.request(`/api/vault/documents/${encodeURIComponent(id)}/extraction`, { signal }),
};
