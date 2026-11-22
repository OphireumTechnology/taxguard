export interface InvoiceDocumentView {
  id: string;
  invoiceNumber?: string;
  clientName?: string;
  totalCents?: number;
  lines?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export function renderInvoicePdf(_invoice: InvoiceDocumentView): Buffer {
  return Buffer.from('%PDF-1.4\n% Destria Tax Services Invoice\n%%EOF\n', 'utf8');
}
