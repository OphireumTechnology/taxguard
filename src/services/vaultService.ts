/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const ACCEPTED_TYPES = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.tiff',
  '.csv',
  '.xlsx'
] as const;

export const DOCUMENT_CATEGORIES = [
  'income',
  'expense',
  'deduction',
  'bank_statement',
  'id_verification',
  'prior_return',
  'other'
] as const;

export interface VaultExtraction {
  fieldId: string;
  fieldName: string;
  extractedValue: string;
  confidence: number;
  status: 'PENDING' | 'ACCEPTED' | 'CORRECTED' | 'REJECTED';
  version: number;
}

export interface VaultDocument {
  documentId: string;
  clientId: string;
  taxYear: number;
  engagementId: string;
  title: string;
  fileName: string;
  category: string;
  status: string;
  version: number;
  rowVersion?: number;
  uploadedAt: string;
  canReview?: boolean;
}

export class VaultRequestError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
    this.name = 'VaultRequestError';
  }
}

export function newVaultKey(): string {
  return 'vkey_' + Math.random().toString(36).substring(2, 12);
}

export function documentStatusText(status: string): string {
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export function vaultMessage(e: any): string {
  if (!e) return 'Vault operation failed.';
  if (typeof e === 'string') return e;
  if (e instanceof VaultRequestError) {
    if (e.code === 'DOCUMENT_VAULT_UNAVAILABLE') return 'Document vault is currently offline.';
    return `Vault error: ${e.code}`;
  }
  return e.message || 'Vault operation failed.';
}

export const vaultService = {
  list: async (clientId: string): Promise<{ items: VaultDocument[] }> => {
    return {
      items: [
        {
          documentId: 'doc_w2_2025',
          clientId,
          taxYear: 2025,
          engagementId: 'eng_001',
          title: 'Form W-2 Wage and Tax Statement',
          fileName: 'w2_perotti_2025.pdf',
          category: 'income',
          status: 'VERIFIED',
          version: 1,
          rowVersion: 1,
          uploadedAt: '2026-01-20T14:22:00Z',
          canReview: true,
        },
        {
          documentId: 'doc_1099_2025',
          clientId,
          taxYear: 2025,
          engagementId: 'eng_001',
          title: 'Form 1099-NEC Nonemployee Compensation',
          fileName: '1099_nec_consulting.pdf',
          category: 'income',
          status: 'PENDING_REVIEW',
          version: 1,
          rowVersion: 1,
          uploadedAt: '2026-02-05T09:15:00Z',
          canReview: true,
        }
      ]
    };
  },

  uploadTargets: async (clientId: string): Promise<{ items: Array<{ engagementId: string; title: string; taxYear: number }> }> => {
    return {
      items: [
        { engagementId: 'eng_001', title: '2025 Form 1040 Individual Income Tax', taxYear: 2025 },
        { engagementId: 'eng_002', title: '2024 Form 1040 Individual Prior Filing', taxYear: 2024 }
      ]
    };
  },

  upload: async (
    clientId: string,
    file: File,
    meta: { engagementId: string; taxYear: number; category?: string; documentId?: string },
    _vaultKey?: string
  ): Promise<{ success: boolean; documentId: string; version: number }> => {
    return {
      success: true,
      documentId: meta.documentId || 'doc_' + Math.random().toString(36).substring(2, 9),
      version: 1
    };
  },

  download: async (clientId: string, documentId: string, _version?: number): Promise<{ url: string }> => {
    return {
      url: `/api/documents/${encodeURIComponent(documentId)}/download`
    };
  },

  reviewQueue: async (): Promise<{ items: any[] }> => {
    return { items: [] };
  },

  detail: async (clientId: string, documentId: string): Promise<{ extractions: VaultExtraction[] }> => {
    return { extractions: [] };
  },

  verifyField: async (clientId: string, fieldId: string, status: string, correctedValue?: string): Promise<{ success: boolean }> => {
    return { success: true };
  },

  review: async (
    clientId: string,
    documentId: string,
    version: number,
    action: string,
    rowVersion: any,
    note?: string,
    clientReason?: string
  ): Promise<{ success: boolean }> => {
    return { success: true };
  }
};
