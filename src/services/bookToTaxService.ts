/** Browser client for /api/book-to-tax (durable workpapers; no tax computation). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class BookToTaxRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string) { super(code || 'B2T_REQUEST_FAILED'); }
}
export interface B2tCategoryRow { categoryCode: string; label: string; bookCents: number; adjustmentCents: number; taxBasisCents: number; referenceText: string | null }
export interface B2tOverview {
  mappingSets: Array<{ setId: string; version: number; status: string; preparedBy: string; reviewedBy: string | null; reviewNote: string | null; mappings: Array<{ accountId: string; accountNumber: string; accountName: string; categoryCode: string }> }>;
  adjustments: Array<{ adjustmentId: string; categoryCode: string; amountCents: number; adjustmentType: string; description: string; status: string; preparedBy: string }>;
  workpapers: Array<{ workpaperId: string; status: string; reconciled: boolean; unmappedAccounts: number; generatedBy: string; snapshotSha256: string; createdAt: string;
    snapshot: { categories: B2tCategoryRow[]; unmapped: Array<{ accountNumber: string; accountName: string; netCents: number }>; reconciliation: { differenceCents: number }; notice: string } }>;
}
export const newB2tKey = () => 'b2t-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new BookToTaxRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/book-to-tax' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new BookToTaxRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new BookToTaxRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}
const c = (clientId: string) => '/clients/' + encodeURIComponent(clientId);
export const bookToTaxApi = {
  categories: (family: string) => request<{ items: Array<{ categoryCode: string; label: string }> }>('GET', '/categories/' + encodeURIComponent(family)),
  overview: (clientId: string, year: number, family: string) => request<B2tOverview>('GET', `${c(clientId)}/${year}/${encodeURIComponent(family)}`),
  openSet: (clientId: string, year: number, family: string) => request('POST', `${c(clientId)}/${year}/${encodeURIComponent(family)}/mapping-sets`),
  setMapping: (clientId: string, setId: string, accountId: string, categoryCode: string | null) => request('POST', `${c(clientId)}/mapping-sets/${encodeURIComponent(setId)}/mappings`, { accountId, categoryCode }),
  reviewSet: (clientId: string, setId: string, action: 'submit' | 'approve' | 'reject', note?: string) => request('POST', `${c(clientId)}/mapping-sets/${encodeURIComponent(setId)}/${action}`, { note }),
  prepareAdjustment: (clientId: string, a: { taxYear: number; returnFamily: string; categoryCode: string; amount: string; adjustmentType: string; description: string }, key: string) =>
    request('POST', `${c(clientId)}/adjustments`, a, key),
  reviewAdjustment: (clientId: string, id: string, approve: boolean, note?: string) => request('POST', `${c(clientId)}/adjustments/${encodeURIComponent(id)}/${approve ? 'approve' : 'reject'}`, { note }),
  generateWorkpaper: (clientId: string, year: number, family: string) => request('POST', `${c(clientId)}/${year}/${encodeURIComponent(family)}/workpapers`, {}),
  reviewWorkpaper: (clientId: string, id: string, approve: boolean, note?: string) => request('POST', `${c(clientId)}/workpapers/${encodeURIComponent(id)}/${approve ? 'approve' : 'reject'}`, { note }),
};
export const centsText = (cents: number) => (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MESSAGES: Record<string, string> = { MAKER_CHECKER_VIOLATION: 'A different reviewer must approve this.', B2T_REVIEWER_REQUIRED: 'Only a reviewer can approve or reject.',
  WORKPAPER_NOT_RECONCILED: 'Map every account with activity before approving the workpaper.', WORKPAPER_STALE: 'A newer mapping version was approved; generate a new workpaper.',
  APPROVED_MAPPING_REQUIRED: 'Approve a mapping set before generating a workpaper.', MAPPING_SET_NOT_EDITABLE: 'Only draft mapping sets can be changed.',
  EVIDENCE_DOCUMENT_NOT_VERIFIED: 'Evidence must be a verified document of this client.', B2T_UNAVAILABLE: 'Durable book-to-tax is not enabled in this environment.' };
export function bookToTaxMessage(error: unknown): string {
  if (error instanceof BookToTaxRequestError && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error instanceof BookToTaxRequestError && error.status === 403) return 'You are not assigned to this client.';
  return 'The book-to-tax service did not confirm this action. Refresh and retry.';
}
