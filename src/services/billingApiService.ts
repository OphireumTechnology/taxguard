import { INITIAL_INVOICES } from '../data/mockData';

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

export const ISSUED_INVOICE_STATUSES: readonly string[] = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'];

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
  clientName?: string;
  totalDue: string;
  current: string;
  days1to30: string;
  days31to60: string;
  days61to90: string;
  over90: string;
  openInvoices: number;
}

export interface InvoiceLine {
  lineNo: number;
  description: string;
  quantity: number | string;
  unitRate: string;
  amount: string;
  rateOverrideReason?: string;
}

export interface InvoiceCredit {
  creditId: string;
  amount: string;
  requestedBy: string;
  reason: string;
  status: string;
}

export interface InvoicePayment {
  paymentId: string;
  amount: string;
  refundedAmount: string;
  method: string;
  status: string;
}

export interface Invoice {
  invoiceId: string;
  id?: string;
  invoiceNumber?: string;
  clientId: string;
  status: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  issueDate?: string;
  dueDate?: string;
  reviewNote?: string;
  rowVersion: number;
  currency?: string;
  lines: InvoiceLine[];
  credits: InvoiceCredit[];
  payments: InvoicePayment[];
}

const mapMockInvoices = (): Invoice[] =>
  INITIAL_INVOICES.map((inv: any) => {
    const amountPaid = Number(inv.amountPaid || 0);
    const total = Number(inv.amount || 0);
    return {
      invoiceId: inv.id,
      id: inv.id,
      invoiceNumber: inv.invoiceNumber || `INV-${inv.id}`,
      clientId: inv.clientId,
      status: String(inv.status || 'ISSUED').toUpperCase(),
      total: total.toFixed(2),
      amountPaid: amountPaid.toFixed(2),
      balanceDue: Math.max(0, total - amountPaid).toFixed(2),
      issueDate: inv.issuedDate || inv.issueDate,
      dueDate: inv.dueDate,
      rowVersion: 1,
      currency: inv.currency || 'USD',
      lines: [
        {
          lineNo: 1,
          description: inv.description || 'Tax Advisory Services',
          quantity: 1,
          unitRate: total.toFixed(2),
          amount: total.toFixed(2)
        }
      ],
      credits: [],
      payments: []
    };
  });

export const billingApiService = {
  aging: async (): Promise<{ clients: AgingRow[]; pendingApproval: number }> => ({
    clients: [
      {
        clientId: 'user_client_1',
        clientName: 'Michael Perotti',
        totalDue: '250.00',
        current: '250.00',
        days1to30: '0.00',
        days31to60: '0.00',
        days61to90: '0.00',
        over90: '0.00',
        openInvoices: 1
      }
    ],
    pendingApproval: 0
  }),
  catalog: async (): Promise<{ items: Array<{ serviceCode: string; name: string; baseFee: string; isActive: boolean }> }> => ({
    items: [
      { serviceCode: 'TAX_1040', name: 'Individual Tax Preparation Form 1040', baseFee: '250.00', isActive: true },
      { serviceCode: 'TAX_1120S', name: 'S-Corporation Form 1120-S Preparation', baseFee: '650.00', isActive: true },
      { serviceCode: 'BK_MONTHLY', name: 'Monthly Bookkeeping & Reconciliation', baseFee: '199.00', isActive: true }
    ]
  }),
  invoices: async (_clientId?: string, _signal?: AbortSignal): Promise<{ items: Invoice[] }> => ({
    items: mapMockInvoices()
  }),
  getInvoices: async (_clientId?: string) => INITIAL_INVOICES,
  create: async (_clientId: string, _dueDate: string, _key?: string) => ({ success: true }),
  createInvoice: async (_data: any) => ({ success: true, invoice: mapMockInvoices()[0] }),
  addLine: async (
    _clientId: string,
    _invoiceId: string,
    _line: { serviceCode: string; quantity: string; unitRate?: string; overrideReason?: string },
    _key?: string
  ) => ({ success: true }),
  transition: async (
    _clientId: string,
    _invoiceId: string,
    _action: string,
    _rowVersion: number,
    _note?: string
  ) => ({ success: true }),
  requestCredit: async (
    _clientId: string,
    _invoiceId: string,
    _amount: string,
    _note: string,
    _key?: string
  ) => ({ success: true }),
  decideCredit: async (_clientId: string, _creditId: string, _approved: boolean) => ({ success: true }),
  recordRefund: async (
    _clientId: string,
    _paymentId: string,
    _amount: string,
    _reason: string,
    _key?: string
  ) => ({ success: true }),
  processPayment: async (_invoiceId: string, _paymentMethodId?: string): Promise<{ success: boolean }> => ({ success: true }),
  paySandbox: async (_clientId: string, _invoiceId: string, _amount: string | number, _card: string, _idempotencyKey: string): Promise<{ success: boolean }> => ({ success: true }),
  document: async (_clientId: string, _invoiceId: string): Promise<Blob> => new Blob(['%PDF-1.4 Mock Invoice Document'], { type: 'application/pdf' }),
  createDraft: async (..._args: any[]) => ({ success: true }),
  submitDraft: async (..._args: any[]) => ({ success: true }),
  approveDraft: async (..._args: any[]) => ({ success: true }),
  recordPayment: async (..._args: any[]) => ({ success: true }),
  issueRefund: async (..._args: any[]) => ({ success: true }),
  downloadPdf: async (..._args: any[]) => new Blob(['%PDF-1.4 Mock PDF'], { type: 'application/pdf' })
};

export const billingApi = billingApiService;
