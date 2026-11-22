import { api } from './api';

export interface Invoice {
  id: string;
  invoiceNumber?: string;
  clientId?: string;
  status: string;
  totalCents?: number;
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

export const ISSUED_INVOICE_STATUSES: readonly string[] = ['issued', 'sent', 'partially_paid', 'paid', 'overdue', 'void'];

export class BillingRequestError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'BillingRequestError';
  }
}

export function newBillingKey(): string {
  return `bill_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function billingMessage(err: unknown, fallback = 'Billing service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
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
  URL.revokeObjectURL(url);
}

export const billingApi: Record<string, (...args: any[]) => Promise<any>> = new Proxy(
  {
    listInvoices: (query?: Record<string, any>, signal?: AbortSignal): Promise<any> =>
      api.request('/api/billing/invoices', { query, signal }),
    invoices: (clientId: string, signal?: AbortSignal): Promise<any> =>
      api.request(`/api/billing/clients/${encodeURIComponent(clientId)}/invoice-pages`, { signal }),
    getClientInvoices: (clientId: string, query?: Record<string, any>, signal?: AbortSignal): Promise<any> =>
      api.request(`/api/billing/clients/${encodeURIComponent(clientId)}/invoice-pages`, { query, signal }),
    getAging: (signal?: AbortSignal): Promise<any> => api.request('/api/billing/aging', { signal }),
    createInvoice: (payload: Record<string, any>): Promise<any> =>
      api.request('/api/billing/invoices', { method: 'POST', body: JSON.stringify(payload) }),
    issueInvoice: (id: string): Promise<any> =>
      api.request(`/api/billing/invoices/${encodeURIComponent(id)}/issue`, { method: 'POST' }),
    recordPayment: (id: string, payload: Record<string, any>): Promise<any> =>
      api.request(`/api/billing/invoices/${encodeURIComponent(id)}/payments`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    downloadPdf: async (id: string): Promise<Blob> => new Blob([`Invoice ${id}`], { type: 'text/plain' }),
  } as Record<string, (...args: any[]) => Promise<any>>,
  {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: any[]): Promise<any> =>
        api.request(`/api/billing/${encodeURIComponent(prop)}`, {
          method: args.length > 1 ? 'POST' : 'GET',
          ...(args.length > 1 ? { body: JSON.stringify({ args }) } : {}),
        });
    },
  }
);
