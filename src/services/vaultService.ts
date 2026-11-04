import { INITIAL_DOCUMENTS } from '../data/mockData';
import type { DocumentItem } from '../types';

export const ACCEPTED_TYPES = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.csv'];

export const DOCUMENT_CATEGORIES = [
  'tax_form_w2',
  'tax_form_1099',
  'balance_sheet',
  'legal_document',
  'prior_year_return',
  'bank_statement',
  'other'
] as const;

export type VaultDocument = DocumentItem;

export interface VaultExtraction {
  documentId: string;
  fields: Array<{ key: string; label: string; value: string; confidence: number }>;
}

export class VaultRequestError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'VaultRequestError';
    this.code = code;
  }
}

export function documentStatusText(status: string): string {
  switch (status) {
    case 'approved': return 'Verified & Approved';
    case 'accountant_reviewing': return 'Accountant Reviewing';
    case 'needs_review': return 'Needs Review';
    case 'rejected': return 'Rejected';
    default: return 'Pending Review';
  }
}

export function newVaultKey(clientId: string, fileName: string): string {
  return `${clientId}/${Date.now()}-${fileName}`;
}

export function vaultMessage(msg: string): string {
  return msg;
}

export const vaultService = {
  getDocuments: async (clientId?: string): Promise<VaultDocument[]> => {
    return INITIAL_DOCUMENTS;
  },
  uploadDocument: async (file: File, category: string, clientId?: string): Promise<VaultDocument> => {
    return {
      id: 'doc_' + Date.now(),
      clientId: clientId || 'user_client_1',
      fileName: file.name,
      fileSize: `${(file.size / 1024).toFixed(1)} KB`,
      fileType: file.type || 'application/pdf',
      category,
      taxYear: 2025,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
      version: 1
    };
  },
  deleteDocument: async (id: string): Promise<{ success: boolean }> => {
    return { success: true };
  },
  verifyDocument: async (id: string): Promise<{ success: boolean }> => {
    return { success: true };
  }
};
