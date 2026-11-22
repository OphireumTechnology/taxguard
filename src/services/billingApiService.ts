import { apiRequest, ApiRequestError } from './api';

export class BillingRequestError extends ApiRequestError {
  constructor(message: string, status = 500, code = 'BILLING_ERROR') {
    super(message, status, code);
    this.name = 'BillingRequestError';
  }
}

export const ISSUED_INVOICE_STATUSES: string[] = ['issued', 'open', 'partially_paid', 'paid', 'overdue', 'void'];

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientId?: string;
  status: string;
  totalCents?: number;
  balanceDueCents?: number;
  amount?: number;
  dueDate?: string;
  issuedAt?: string;
  lines?: any[];
  [key: string]: any;
}

export interface AgingRow {
  clientId: string;
  clientName?: string;
  currentCents: number;
  days30Cents: number;
  days60Cents: number;
  days90PlusCents: number;
  totalCents: number;
  [key: string]: any;
}

export function newBillingKey(prefix = 'bill'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function billingMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Billing service is currently unavailable.';
}

export function saveBlob(blob: Blob, filename: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const billingApi: Record<string, (...args: any[]) => Promise<any>> = new Proxy(
  {
    invoices: (clientId?: string, signal?: AbortSignal) =>
      apiRequest(`/api/billing/invoices${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`, { signal }),
    listInvoices: (_params?: any) => apiRequest('/api/billing/invoices'),
    listClientInvoices: (clientId?: string) =>
      apiRequest(`/api/billing/client-invoices${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`),
    getInvoice: (id: string) => apiRequest(`/api/billing/invoices/${encodeURIComponent(id)}`),
    createInvoice: (payload: any) =>
      apiRequest('/api/billing/invoices', { method: 'POST', body: JSON.stringify(payload) }),
    issueInvoice: (id: string, payload?: any) =>
      apiRequest(`/api/billing/invoices/${encodeURIComponent(id)}/issue`, {
        method: 'POST',
        body: JSON.stringify(payload || {}),
      }),
    recordPayment: (id: string, payload: any) =>
      apiRequest(`/api/billing/invoices/${encodeURIComponent(id)}/payments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    getAging: () => apiRequest('/api/billing/aging'),
    getSummary: () => apiRequest('/api/billing/summary'),
  } as Record<string, (...args: any[]) => Promise<any>>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return async (..._args: any[]) => apiRequest(`/api/billing/${prop}`);
    },
  }
);
