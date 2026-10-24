import { describe, expect, it } from 'vitest';
import { invoiceDocumentText, renderInvoicePdf, type InvoiceDocumentView } from '../server/taxguard/billing/invoiceDocument';

const base: InvoiceDocumentView = { invoiceId: 'inv_1', invoiceNumber: 'INV-2026-000007', clientId: 'C001', status: 'ISSUED', currency: 'USD', issueDate: '2026-03-01', dueDate: '2026-03-31',
  subtotal: '950.00', creditsApplied: '50.00', total: '900.00', amountPaid: '100.00', balanceDue: '800.00',
  lines: [{ lineNo: 1, description: 'Individual return (synthetic)', quantity: '1', unitRate: '475.00', amount: '475.00' }, { lineNo: 2, description: 'Review', quantity: '1', unitRate: '475.00', amount: '475.00' }] };
const at = new Date('2026-03-02T00:00:00Z');
const offsetsValid = (pdf: string) => {
  const xref = Number(/startxref\n(\d+)\n/.exec(pdf)![1]);
  const entries = [...pdf.slice(xref).matchAll(/^(\d{10}) 00000 n $/gm)].map(m => Number(m[1]));
  return pdf.slice(xref, xref + 4) === 'xref' && entries.length > 0 && entries.every((o, i) => pdf.startsWith(`${i + 1} 0 obj`, o));
};

describe('invoice document renderer', () => {
  it('lays out exact amounts and the delivery disclaimer', () => {
    const lines = invoiceDocumentText(base, at);
    expect(lines[1]).toBe('INVOICE INV-2026-000007');
    expect(lines.find(l => l.includes('Balance due'))).toMatch(/Balance due\s+800\.00 USD$/);
    expect(lines.at(-1)).toBe('This document is not a receipt. It has not been e-mailed or otherwise delivered by TaxGuard.');
    expect(lines.join('\n')).toContain('2026-03-02T00:00:00.000Z');
  });
  it('escapes PDF string delimiters and replaces characters the standard font cannot carry', () => {
    const pdf = renderInvoicePdf({ ...base, lines: [{ lineNo: 1, description: 'Fee (a) \\ b) é', quantity: '1', unitRate: '1.00', amount: '1.00' }] }, at).toString('latin1');
    expect(pdf).toContain('Fee \\(a\\) \\\\ b\\) ?');
    expect(offsetsValid(pdf)).toBe(true);
  });
  it('refuses amounts that are not exact two-decimal strings rather than rounding them', () => {
    for (const bad of ['900', '900.0', '900.005', 900, '1e3', null])
      expect(() => invoiceDocumentText({ ...base, total: bad as any }, at)).toThrow('INVOICE_DOCUMENT_DATA_INVALID');
    expect(() => invoiceDocumentText({ ...base, lines: [{ lineNo: 1, description: 'x', quantity: '1', unitRate: '1.001', amount: '1.00' }] }, at)).toThrow('INVOICE_DOCUMENT_DATA_INVALID');
  });
  it('refuses drafts and pending invoices; marks void invoices as not payable', () => {
    for (const status of ['DRAFT', 'PENDING_APPROVAL', 'UNKNOWN']) expect(() => invoiceDocumentText({ ...base, status }, at)).toThrow('INVOICE_DOCUMENT_NOT_ISSUED');
    expect(invoiceDocumentText({ ...base, status: 'VOID' }, at)[1]).toContain('VOID - NOT PAYABLE');
  });
  it('paginates long invoices with a valid cross-reference table', () => {
    const many = Array.from({ length: 140 }, (_, i) => ({ lineNo: i + 1, description: `Synthetic item ${i + 1}`, quantity: '1', unitRate: '1.00', amount: '1.00' }));
    const pdf = renderInvoicePdf({ ...base, lines: many }, at).toString('latin1');
    const pages = Math.ceil(invoiceDocumentText({ ...base, lines: many }, at).length / 52);
    expect(pages).toBe(4);
    expect(/\/Count (\d+)/.exec(pdf)![1]).toBe(String(pages));
    expect(pdf).toContain(`(Page ${pages} of ${pages})`);
    expect(offsetsValid(pdf)).toBe(true);
  });
});
