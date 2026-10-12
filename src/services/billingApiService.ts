/** Browser client for /api/billing (durable billing; sandbox payments only). */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class BillingRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string) { super(code || 'BILLING_REQUEST_FAILED'); }
}
export interface InvoiceLine { lineNo: number; serviceCode: string; description: string; quantity: string; unitRate: string; amount: string; rateOverrideReason: string | null }
export interface Invoice { invoiceId: string; invoiceNumber: string | null; clientId: string; status: string; subtotal: string; creditsApplied: string; total: string; amountPaid: string;
  balanceDue: string; dueDate: string; issueDate: string | null; preparedBy: string; approvedBy: string | null; reviewNote: string | null; rowVersion: number; lines: InvoiceLine[];
  payments: Array<{ paymentId: string; amount: string; refundedAmount: string; method: string; status: string }>; credits: Array<{ creditId: string; amount: string; reason: string; status: string; requestedBy: string }> }
export interface AgingRow { clientId: string; clientName: string | null; totalDue: string; current: string; days1to30: string; days31to60: string; days61to90: string; over90: string; openInvoices: number }
export const newBillingKey = () => 'bill-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));

async function request<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new BillingRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/billing' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new BillingRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new BillingRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}
const c = (clientId: string) => '/clients/' + encodeURIComponent(clientId);
const i = (clientId: string, invoiceId: string) => `${c(clientId)}/invoices/${encodeURIComponent(invoiceId)}`;
export const billingApi = {
  catalog: () => request<{ items: Array<{ serviceCode: string; name: string; baseFee: string; isActive: boolean }> }>('GET', '/catalog'),
  aging: (asOf?: string) => request<{ asOf: string; pendingApproval: number; clients: AgingRow[] }>('GET', '/ar-aging' + (asOf ? `?asOf=${asOf}` : '')),
  invoices: (clientId: string) => request<{ items: Invoice[] }>('GET', c(clientId) + '/invoices'),
  create: (clientId: string, dueDate: string, key: string) => request<{ invoiceId: string }>('POST', c(clientId) + '/invoices', { dueDate }, key),
  addLine: (clientId: string, invoiceId: string, line: { serviceCode: string; quantity: string; unitRate?: string; overrideReason?: string }) => request<Invoice>('POST', i(clientId, invoiceId) + '/lines', line),
  transition: (clientId: string, invoiceId: string, action: 'submit' | 'approve' | 'return' | 'void', rowVersion: number, note?: string) =>
    request<Invoice>('POST', `${i(clientId, invoiceId)}/${action}`, { rowVersion, note }),
  recordPayment: (clientId: string, invoiceId: string, amount: string, method: string, key: string) => request('POST', i(clientId, invoiceId) + '/payments', { amount, method }, key),
  paySandbox: (clientId: string, invoiceId: string, amount: string, testCard: string, key: string) => request('POST', i(clientId, invoiceId) + '/pay-sandbox', { amount, testCard }, key),
  requestCredit: (clientId: string, invoiceId: string, amount: string, reason: string) => request('POST', i(clientId, invoiceId) + '/credits', { amount, reason }),
  decideCredit: (clientId: string, creditId: string, apply: boolean) => request<Invoice>('POST', `${c(clientId)}/credits/${encodeURIComponent(creditId)}/${apply ? 'apply' : 'reject'}`),
};
const MESSAGES: Record<string, string> = {
  MAKER_CHECKER_VIOLATION: 'A different manager must approve this.', BILLING_MANAGER_REQUIRED: 'Only a practice manager or administrator can do this.',
  INVOICE_VERSION_CONFLICT: 'The invoice changed since it was loaded. Refresh and retry.', RATE_OVERRIDE_REASON_REQUIRED: 'Enter a reason for using a rate other than the catalog price.',
  PAYMENT_EXCEEDS_BALANCE: 'The payment is larger than the balance due.', CREDIT_EXCEEDS_BALANCE: 'The credit is larger than the balance due.',
  BILLING_AMOUNT_INVALID: 'Enter an amount with at most two decimals.', PAYMENT_DECLINED: 'The sandbox payment was declined.', DUPLICATE_PAYMENT: 'This payment was already recorded.',
  SANDBOX_TEST_CARD_REQUIRED: 'Use a published sandbox test card number. No real card is ever charged.', BILLING_UNAVAILABLE: 'Billing is not enabled in this environment.',
  INVOICE_NOT_EDITABLE: 'Only draft invoices can be edited.', INVOICE_EMPTY: 'Add at least one line before submitting.',
};
export function billingMessage(error: unknown): string {
  if (error instanceof BillingRequestError && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error instanceof BillingRequestError && (error.status === 403 || error.status === 404)) return 'You are not authorized for this billing record.';
  return 'The billing service did not confirm this action. Refresh and retry.';
}
