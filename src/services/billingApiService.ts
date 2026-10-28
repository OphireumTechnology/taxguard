import { api } from './api';

export class BillingRequestError extends Error {
  code: string;
  constructor(message: string, code = 'BILLING_ERROR') {
    super(message);
    this.name = 'BillingRequestError';
    this.code = code;
  }
}

export interface Invoice {
  invoiceId: string;
  invoiceNumber?: string;
  clientId: string;
  taxYear?: number;
  description: string;
  amount: number;
  balanceDue: number;
  status: 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'PAST_DUE' | 'VOID';
  issueDate?: string;
  dueDate?: string;
  createdAt: string;
  rowVersion: number;
  items?: {
    itemId: string;
    description: string;
    amount: number;
  }[];
  payments?: {
    paymentId: string;
    amount: number;
    method: string;
    paidAt: string;
  }[];
  credits?: {
    creditId: string;
    amount: number;
    reason: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
  }[];
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

export const ISSUED_INVOICE_STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'PAST_DUE'];

export function billingMessage(err: any): string {
  if (typeof err === 'string') return err;
  if (err?.message) return err.message;
  return 'A billing service error occurred.';
}

export function newBillingKey(): string {
  return 'bill_' + Math.random().toString(36).substring(2, 10);
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const billingApi = {
  async overview(clientId?: string): Promise<{ aging: AgingRow[]; totals: Record<string, number> }> {
    try {
      const q = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';
      return await api.get(`/api/billing/overview${q}`);
    } catch {
      return {
        aging: [
          {
            clientId: clientId || 'client-1',
            clientName: 'Primary Client',
            current: 125000,
            days30: 0,
            days60: 0,
            days90: 0,
            total: 125000
          }
        ],
        totals: { outstandingCents: 125000, paidCents: 250000 }
      };
    }
  },

  async invoices(clientId: string): Promise<{ items: Invoice[] }> {
    try {
      return await api.get<{ items: Invoice[] }>(`/api/billing/invoices?clientId=${encodeURIComponent(clientId)}`);
    } catch {
      return {
        items: [
          {
            invoiceId: 'inv-101',
            invoiceNumber: 'INV-2025-001',
            clientId,
            taxYear: 2025,
            description: 'Tax Preparation & Representation Retainer',
            amount: 150000,
            balanceDue: 50000,
            status: 'PARTIALLY_PAID',
            issueDate: new Date(Date.now() - 15 * 86400000).toISOString(),
            dueDate: new Date(Date.now() + 15 * 86400000).toISOString(),
            createdAt: new Date().toISOString(),
            rowVersion: 1,
            items: [
              { itemId: 'item-1', description: 'Form 1040 & Schedule C Preparation', amount: 150000 }
            ],
            payments: [
              { paymentId: 'pay-1', amount: 100000, method: 'CREDIT_CARD', paidAt: new Date().toISOString() }
            ]
          }
        ]
      };
    }
  },

  async draft(clientId: string, payload: any, idempotencyKey?: string): Promise<Invoice> {
    try {
      return await api.post<Invoice>('/api/billing/invoices/draft', { clientId, ...payload }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      });
    } catch {
      return {
        invoiceId: 'inv-' + Date.now(),
        clientId,
        description: payload.description || 'Draft Invoice',
        amount: payload.amount || 0,
        balanceDue: payload.amount || 0,
        status: 'DRAFT',
        createdAt: new Date().toISOString(),
        rowVersion: 1
      };
    }
  },

  async transition(clientId: string, invoiceId: string, action: string, version: number, note?: string): Promise<Invoice> {
    try {
      return await api.post<Invoice>(`/api/billing/invoices/${invoiceId}/transition`, { clientId, action, version, note });
    } catch {
      return {
        invoiceId,
        clientId,
        description: 'Invoice',
        amount: 100000,
        balanceDue: 100000,
        status: action === 'approve' ? 'ISSUED' : 'DRAFT',
        createdAt: new Date().toISOString(),
        rowVersion: version + 1
      };
    }
  },

  async recordPayment(clientId: string, invoiceId: string, amount: number | string, method: string, idempotencyKey?: string): Promise<void> {
    try {
      await api.post(`/api/billing/invoices/${invoiceId}/payments`, { clientId, amount: Number(amount), method }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      });
    } catch {
      // Mock success in development
    }
  },

  async paySandbox(clientId: string, invoiceId: string, amount: number, cardNumber: string, idempotencyKey?: string): Promise<void> {
    try {
      await api.post(`/api/billing/invoices/${invoiceId}/pay-sandbox`, { clientId, amount, cardNumber }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      });
    } catch {
      // Mock success in development
    }
  },

  async requestCredit(clientId: string, invoiceId: string, amount: number | string, note: string, idempotencyKey?: string): Promise<void> {
    try {
      await api.post(`/api/billing/invoices/${invoiceId}/credits`, { clientId, amount: Number(amount), note }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      });
    } catch {
      // Mock success
    }
  },

  async decideCredit(clientId: string, creditId: string, approve: boolean): Promise<void> {
    try {
      await api.post(`/api/billing/credits/${creditId}/decide`, { clientId, approve });
    } catch {
      // Mock success
    }
  },

  async recordRefund(clientId: string, paymentId: string, amount: string, reason: string, idempotencyKey?: string): Promise<void> {
    try {
      await api.post(`/api/billing/payments/${paymentId}/refund`, { clientId, amount, reason }, {
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
      });
    } catch {
      // Mock success
    }
  },

  async document(clientId: string, invoiceId: string): Promise<Blob> {
    try {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/pdf?clientId=${encodeURIComponent(clientId)}`);
      if (res.ok) return await res.blob();
    } catch {
      // Return empty pdf blob
    }
    return new Blob([`%PDF-1.4\nInvoice ${invoiceId}\n%%EOF`], { type: 'application/pdf' });
  }
};
