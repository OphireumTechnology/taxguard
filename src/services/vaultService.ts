/** Browser client for /api/vault (secure document vault). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class VaultRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string) { super(code || 'VAULT_REQUEST_FAILED'); }
}
export interface VaultDocument { documentId: string; version: number; clientId: string; engagementId: string; taxYear: number; caseId: string | null; category: string;
  fileName: string; mimeType: string; sizeBytes: number; status: string; quarantineStatus: string; uploadedBy: string; uploaderRole: string; reviewedBy: string | null;
  reviewNote: string | null; createdAt: string; rowVersion: number; clientName?: string; canReview?: boolean }
export interface VaultExtraction { fieldId: string; version: number; fieldKey: string; proposedValue: unknown; confidence: number; provider: string; decision: string | null; verifiedValue: unknown }
export const DOCUMENT_CATEGORIES = ['income', 'deductions', 'identity', 'prior_return', 'business_records', 'bank_statement', 'correspondence', 'engagement', 'other'] as const;
export const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
export const MAX_UPLOAD_BYTES = 26_214_400;
export const newVaultKey = () => 'vault-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));

async function request<T>(method: 'GET' | 'POST', path: string, body?: BodyInit, headers: Record<string, string> = {}): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new VaultRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/vault' + path), { method, cache: 'no-store', credentials: 'omit', headers: { Authorization: `Bearer ${token}`, ...headers }, ...(body ? { body } : {}) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new VaultRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new VaultRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}
const c = (clientId: string) => '/clients/' + encodeURIComponent(clientId);
const json = (body: unknown) => ({ body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
export const vaultService = {
  uploadTargets: (clientId: string) => request<{ items: Array<{ engagementId: string; title: string; taxYear: number }> }>('GET', c(clientId) + '/upload-targets'),
  list: (clientId: string, taxYear?: number) => request<{ items: VaultDocument[] }>('GET', c(clientId) + '/documents' + (taxYear ? `?taxYear=${taxYear}` : '')),
  detail: (clientId: string, documentId: string) => request<{ versions: VaultDocument[]; extractions: VaultExtraction[]; history: Array<{ action: string; actorUid: string; at: string }> }>('GET', c(clientId) + '/documents/' + encodeURIComponent(documentId)),
  reviewQueue: () => request<{ items: VaultDocument[] }>('GET', '/review-queue'),
  /** Client-side checks mirror the server; the server re-validates type, size, content and hash. */
  upload: (clientId: string, file: File, meta: { engagementId: string; taxYear: number; category: string; documentId?: string }, key: string) => {
    if (!ACCEPTED_TYPES.includes(file.type)) return Promise.reject(new VaultRequestError(415, 'DOCUMENT_TYPE_NOT_ALLOWED'));
    if (file.size < 1 || file.size > MAX_UPLOAD_BYTES) return Promise.reject(new VaultRequestError(413, 'DOCUMENT_TOO_LARGE'));
    const q = new URLSearchParams({ engagementId: meta.engagementId, taxYear: String(meta.taxYear), category: meta.category, fileName: file.name, ...(meta.documentId ? { documentId: meta.documentId } : {}) });
    return request<{ documentId: string; version: number; status: string }>('POST', c(clientId) + '/documents?' + q, file, { 'Content-Type': file.type, 'Idempotency-Key': key });
  },
  review: (clientId: string, documentId: string, version: number, decision: 'approve' | 'reject' | 'request_replacement', rowVersion: number, note?: string) => {
    const r = json({ decision, rowVersion, note });
    return request('POST', `${c(clientId)}/documents/${encodeURIComponent(documentId)}/versions/${version}/review`, r.body, r.headers);
  },
  download: (clientId: string, documentId: string, version: number) =>
    request<{ url: string; expiresInSeconds: number; fileName: string }>('POST', `${c(clientId)}/documents/${encodeURIComponent(documentId)}/versions/${version}/download`),
  verifyField: (clientId: string, fieldId: string, decision: 'ACCEPTED' | 'CORRECTED' | 'REJECTED', value?: unknown) => {
    const r = json({ decision, value });
    return request('POST', `${c(clientId)}/extractions/${encodeURIComponent(fieldId)}/verify`, r.body, r.headers);
  },
};
const STATUS_TEXT: Record<string, string> = {
  SCAN_PENDING: 'Awaiting security scan', PENDING_REVIEW: 'Awaiting staff review', VERIFIED: 'Accepted', REJECTED: 'Not accepted', REPLACEMENT_REQUESTED: 'Replacement requested',
  REJECTED_MALWARE: 'Blocked by security scan', SUPERSEDED: 'Replaced by a newer version',
};
export const documentStatusText = (status: string) => STATUS_TEXT[status] ?? status.toLowerCase().replace(/_/g, ' ');
const MESSAGES: Record<string, string> = {
  DOCUMENT_TYPE_NOT_ALLOWED: 'Upload a PDF, JPEG, PNG, XLSX or CSV file.', DOCUMENT_TOO_LARGE: 'Files must be 25 MB or smaller.',
  DOCUMENT_CONTENT_MISMATCH: 'The file content does not match its type, or a CSV contains formulas. Export the file again and retry.',
  DOCUMENT_NOT_AVAILABLE: 'This document is not available for download yet (it may still be awaiting its security scan).',
  MAKER_CHECKER_VIOLATION: 'A different staff member must review a document you uploaded.', DOCUMENT_VERSION_CONFLICT: 'The document changed since it was loaded. Refresh and retry.',
  DOCUMENT_VERSION_IN_PROGRESS: 'The previous version is still being processed.', DOCUMENT_VAULT_UNAVAILABLE: 'Secure document storage is not enabled in this environment.',
  ENGAGEMENT_YEAR_NOT_FOUND: 'Select an open engagement and tax year.', DOCUMENT_INPUT_INVALID: 'Check the file name, category and note, then retry.',
};
export function vaultMessage(error: unknown): string {
  if (error instanceof VaultRequestError && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error instanceof VaultRequestError && (error.status === 403 || error.status === 404)) return 'You are not authorized for this document.';
  return 'The document service did not confirm this action. Try again.';
}
