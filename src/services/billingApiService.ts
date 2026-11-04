import { INITIAL_INVOICES } from '../data/mockData';
import type { Invoice } from '../types';

export class BillingRequestError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'BillingRequestError';
    this.status = status;
    this.code = code;
  }
}

export const ISSUED_INVOICE_STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'] as const;

export function newBillingKey(): string {
  return 'bill_key_' + Math.random().toString(36).slice(2) + '_' + Date.now();
}

export function billingMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Billing service error.';
}

export function saveBlob(blob: Blob, fileName: string): void {
  if (typeof window === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export interface AgingRow {
  clientId: string;
  clientName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  total: number;
}

export type { Invoice };

export const billingApiService = {
  aging: async (): Promise<{ rows: AgingRow[]; pending: number }> => ({
    rows: [
      { clientId: 'c1', clientName: 'Michael Perotti', current: 250, days30: 0, days60: 0, days90: 0, total: 250 }
    ],
    pending: 0
  }),
  catalog: async (): Promise<Array<{ serviceCode: string; name: string; baseFee: string }>> => [
    { serviceCode: 'TAX_1040', name: 'Individual Tax Preparation Form 1040', baseFee: '250.00' },
    { serviceCode: 'TAX_1120S', name: 'S-Corporation Form 1120-S Preparation', baseFee: '650.00' },
    { serviceCode: 'BK_MONTHLY', name: 'Monthly Bookkeeping & Reconciliation', baseFee: '199.00' }
  ],
  invoices: async (clientId?: string): Promise<Invoice[]> => INITIAL_INVOICES,
  getInvoices: async (clientId?: string): Promise<Invoice[]> => INITIAL_INVOICES,
  createInvoice: async (data: Partial<Invoice>): Promise<{ success: boolean; invoice: Invoice }> => ({
    success: true,
    invoice: { ...(INITIAL_INVOICES[0] as any), ...data, id: 'inv_' + Date.now() }
  }),
  processPayment: async (invoiceId: string, paymentMethodId?: string): Promise<{ success: boolean }> => ({ success: true }),
  createDraft: async (...args: any[]) => ({ success: true }),
  submitDraft: async (...args: any[]) => ({ success: true }),
  approveDraft: async (...args: any[]) => ({ success: true }),
  recordPayment: async (...args: any[]) => ({ success: true }),
  issueRefund: async (...args: any[]) => ({ success: true }),
  downloadPdf: async (...args: any[]) => new Blob()
};

export const billingApi = billingApiService;
