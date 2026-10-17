/**
 * Invoice document (PDF) generated on request from the client-allow-listed invoice projection.
 *
 * Uncommissioned artifact workflow: the document is produced only for the authenticated requester
 * and returned in the response. It is never e-mailed, stored or sent anywhere, and it says so. It is
 * not a receipt and makes no payment claim beyond the recorded amounts. Text-only PDF 1.4 with the
 * standard Courier font (no embedded fonts, images, scripts or external references).
 */
import { BillingError } from './billingStore';

export const ISSUED_DOCUMENT_STATUSES = ['ISSUED', 'PARTIALLY_PAID', 'PAID', 'PAST_DUE', 'VOID'] as const;
export const INVOICE_DOCUMENT_PRACTICE = 'A/R Tax Services, LLC';

type Line = { lineNo?: unknown; description?: unknown; quantity?: unknown; unitRate?: unknown; amount?: unknown };
export interface InvoiceDocumentView {
  invoiceId: string; invoiceNumber: string | null; clientId: string; status: string; currency?: string | null;
  issueDate?: string | null; dueDate?: string | null; subtotal: string; creditsApplied: string; total: string; amountPaid: string; balanceDue: string; lines?: Line[];
}

const MONEY = /^-?\d{1,12}\.\d{2}$/;
const money = (value: unknown) => {
  if (typeof value !== 'string' || !MONEY.test(value)) throw new BillingError('INVOICE_DOCUMENT_DATA_INVALID', 503);
  return value;
};
const text = (value: unknown, max: number) => (typeof value === 'string' || typeof value === 'number' ? String(value) : '')
  // Printable ASCII only: the standard-font encoding cannot carry other characters safely.
  .replace(/[^\x20-\x7e]/g, '?').slice(0, max);
const escape = (value: string) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const pad = (value: string, width: number) => value.length >= width ? value.slice(0, width) : value + ' '.repeat(width - value.length);
const right = (value: string, width: number) => value.length >= width ? value : ' '.repeat(width - value.length) + value;

/** Lines of text (monospaced layout) for the document; exported for tests. */
export function invoiceDocumentText(view: InvoiceDocumentView, generatedAt: Date): string[] {
  if (!view || !ISSUED_DOCUMENT_STATUSES.includes(view.status as typeof ISSUED_DOCUMENT_STATUSES[number])) throw new BillingError('INVOICE_DOCUMENT_NOT_ISSUED', 409);
  const currency = text(view.currency || 'USD', 3);
  const out = [
    INVOICE_DOCUMENT_PRACTICE,
    `INVOICE ${text(view.invoiceNumber || view.invoiceId, 40)}${view.status === 'VOID' ? '   ** VOID - NOT PAYABLE **' : ''}`,
    '',
    `Client: ${text(view.clientId, 64)}`,
    `Issued: ${text(view.issueDate, 32) || 'not recorded'}    Due: ${text(view.dueDate, 32) || 'not recorded'}    Status: ${text(view.status, 20).replace(/_/g, ' ')}`,
    '',
    `${pad('#', 4)}${pad('Description', 44)}${right('Qty', 8)}${right('Rate', 14)}${right('Amount', 16)}`,
    '-'.repeat(86),
  ];
  for (const line of Array.isArray(view.lines) ? view.lines.slice(0, 500) : []) {
    out.push(`${pad(text(line.lineNo, 3), 4)}${pad(text(line.description, 43), 44)}${right(text(line.quantity, 7), 8)}${right(money(line.unitRate), 14)}${right(money(line.amount), 16)}`);
  }
  out.push('-'.repeat(86));
  for (const [label, value] of [['Subtotal', view.subtotal], ['Credits applied', view.creditsApplied], ['Total', view.total], ['Amount paid', view.amountPaid], ['Balance due', view.balanceDue]] as const)
    out.push(`${right(label, 70)}${right(`${money(value)} ${currency}`, 16)}`);
  out.push('', `Generated ${generatedAt.toISOString()} from the practice's billing records for the signed-in user.`,
    'This document is not a receipt. It has not been e-mailed or otherwise delivered by TaxGuard.');
  return out;
}

/** Renders the text lines as a paginated, monospaced PDF; byte offsets in the cross-reference table are exact. */
export function renderInvoicePdf(view: InvoiceDocumentView, generatedAt = new Date()): Buffer {
  const lines = invoiceDocumentText(view, generatedAt);
  const perPage = 52;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add(''), pagesRef = add(''), font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>');
  const kids: number[] = [];
  pages.forEach((page, index) => {
    const ops = ['BT', '/F1 9 Tf', '11 TL', '40 800 Td', ...page.map(l => `(${escape(l)}) '`),
      `(${escape(`Page ${index + 1} of ${pages.length}`)}) '`, 'ET'].join('\n');
    const content = add(`<< /Length ${Buffer.byteLength(ops, 'latin1')} >>\nstream\n${ops}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${pagesRef} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`));
  });
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesRef} 0 R >>`;
  objects[pagesRef - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf, 'latin1')); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('')}`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}
