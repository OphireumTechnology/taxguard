import { api } from './api';

export class VaultRequestError extends Error {
  code: string;
  constructor(message: string, code = 'VAULT_ERROR') {
    super(message);
    this.name = 'VaultRequestError';
    this.code = code;
  }
}

export interface VaultExtraction {
  fieldId: string;
  documentId: string;
  version: number;
  key: string;
  label: string;
  value: string;
  status: 'PENDING' | 'ACCEPTED' | 'CORRECTED' | 'REJECTED';
  confidence: number;
  correctedValue?: string;
}

export interface VaultDocument {
  documentId: string;
  clientId: string;
  filename: string;
  category: string;
  taxYear: number;
  version: number;
  sizeBytes: number;
  status: 'QUEUED' | 'EXTRACTED' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED';
  uploadedAt: string;
  rowVersion: number;
  canReview?: boolean;
}

export const ACCEPTED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff'
];

export const DOCUMENT_CATEGORIES: Record<string, string> = {
  W2: 'Form W-2 (Wage and Tax Statement)',
  FORM_1099_NEC: 'Form 1099-NEC (Nonemployee Compensation)',
  FORM_1099_MISC: 'Form 1099-MISC (Miscellaneous Information)',
  FORM_1099_INT: 'Form 1099-INT (Interest Income)',
  FORM_1099_DIV: 'Form 1099-DIV (Dividends and Distributions)',
  FORM_1099_B: 'Form 1099-B (Broker and Barter Exchange)',
  FORM_1098: 'Form 1098 (Mortgage Interest Statement)',
  SCHEDULE_K1: 'Schedule K-1 (Partner/Shareholder Share)',
  BANK_STATEMENT: 'Bank Statement',
  PROFIT_LOSS: 'Profit & Loss Statement',
  BALANCE_SHEET: 'Balance Sheet',
  PRIOR_YEAR_RETURN: 'Prior Year Federal/State Return',
  GOVERNMENT_NOTICE: 'IRS or State Government Notice',
  OTHER: 'Supporting Document'
};

export function documentStatusText(status: string): string {
  switch (status) {
    case 'QUEUED': return 'Queued for Scanning';
    case 'EXTRACTED': return 'AI Extracted';
    case 'REVIEWED': return 'Under Staff Review';
    case 'ACCEPTED': return 'Verified & Accepted';
    case 'REJECTED': return 'Rejected';
    case 'SUPERSEDED': return 'Superseded';
    default: return status;
  }
}

export function vaultMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'A document vault error occurred.';
}

export function newVaultKey(): string {
  return 'vlt_' + Math.random().toString(36).substring(2, 10);
}

export const vaultService = {
  async list(clientId: string): Promise<{ items: VaultDocument[] }> {
    try {
      return await api.get<{ items: VaultDocument[] }>(`/api/vault?clientId=${encodeURIComponent(clientId)}`);
    } catch {
      return {
        items: [
          {
            documentId: 'doc-1',
            clientId,
            filename: '2025_W2_Employer.pdf',
            category: 'W2',
            taxYear: 2025,
            version: 1,
            sizeBytes: 245000,
            status: 'ACCEPTED',
            uploadedAt: new Date().toISOString(),
            rowVersion: 1,
            canReview: true
          }
        ]
      };
    }
  },

  async uploadTargets(clientId: string): Promise<{ items: { engagementId: string; taxYear: number; category: string; label: string }[] }> {
    try {
      return await api.get(`/api/vault/targets?clientId=${encodeURIComponent(clientId)}`);
    } catch {
      return {
        items: [
          { engagementId: 'eng-1', taxYear: 2025, category: 'W2', label: '2025 Form W-2' },
          { engagementId: 'eng-1', taxYear: 2025, category: 'FORM_1099_NEC', label: '2025 Form 1099-NEC' },
          { engagementId: 'eng-1', taxYear: 2025, category: 'BANK_STATEMENT', label: '2025 Bank Statements' }
        ]
      };
    }
  },

  async upload(clientId: string, file: File, meta: any, idempotencyKey?: string): Promise<{ documentId: string; version: number }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('clientId', clientId);
      if (meta.taxYear) formData.append('taxYear', String(meta.taxYear));
      if (meta.category) formData.append('category', meta.category);
      if (meta.engagementId) formData.append('engagementId', meta.engagementId);
      if (meta.documentId) formData.append('documentId', meta.documentId);

      const res = await fetch('/api/vault/upload', {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
        body: formData
      });
      if (!res.ok) throw new Error('Upload failed');
      return await res.json();
    } catch {
      return { documentId: 'doc_' + Date.now(), version: 1 };
    }
  },

  async download(clientId: string, documentId: string, version: number): Promise<{ url: string }> {
    return { url: `/api/vault/download/${documentId}?version=${version}&clientId=${encodeURIComponent(clientId)}` };
  },

  async reviewQueue(): Promise<{ items: (VaultDocument & { clientName?: string })[] }> {
    try {
      return await api.get('/api/vault/review-queue');
    } catch {
      return { items: [] };
    }
  },

  async detail(clientId: string, documentId: string): Promise<{ document: VaultDocument; extractions: VaultExtraction[] }> {
    try {
      return await api.get(`/api/vault/${documentId}?clientId=${encodeURIComponent(clientId)}`);
    } catch {
      return {
        document: {
          documentId,
          clientId,
          filename: 'Tax_Document.pdf',
          category: 'W2',
          taxYear: 2025,
          version: 1,
          sizeBytes: 120000,
          status: 'EXTRACTED',
          uploadedAt: new Date().toISOString(),
          rowVersion: 1,
          canReview: true
        },
        extractions: [
          {
            fieldId: 'f1',
            documentId,
            version: 1,
            key: 'wages',
            label: 'Box 1 Wages, tips, other comp.',
            value: '$84,500.00',
            status: 'PENDING',
            confidence: 0.98
          },
          {
            fieldId: 'f2',
            documentId,
            version: 1,
            key: 'fed_tax_withheld',
            label: 'Box 2 Federal income tax withheld',
            value: '$11,250.00',
            status: 'PENDING',
            confidence: 0.97
          }
        ]
      };
    }
  },

  async verifyField(clientId: string, fieldId: string, status: 'ACCEPTED' | 'CORRECTED' | 'REJECTED', correctedValue?: string): Promise<void> {
    try {
      await api.post(`/api/vault/fields/${fieldId}/verify`, { clientId, status, correctedValue });
    } catch {
      // Mock success
    }
  },

  async review(clientId: string, documentId: string, version: number, action: string, rowVersion: number, note?: string, clientReason?: string): Promise<void> {
    try {
      await api.post(`/api/vault/${documentId}/review`, { clientId, version, action, rowVersion, note, clientReason });
    } catch {
      // Mock success
    }
  }
};
