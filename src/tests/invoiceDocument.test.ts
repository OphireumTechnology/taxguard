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
  it.each([499, 500, 501, 1001])('includes all %i invoice lines and their full identifiers', count => {
    const many = Array.from({ length: count }, (_, i) => ({ lineNo: i + 1, description: `Boundary item ${i + 1}`, quantity: '1', unitRate: '1.00', amount: '1.00' }));
    const view = { ...base, subtotal: `${count}.00`, creditsApplied: '0.00', total: `${count}.00`, amountPaid: '0.00', balanceDue: `${count}.00`, lines: many };
    const lines = invoiceDocumentText(view, at).filter(line => line.includes('Boundary item'));
    expect(lines).toHaveLength(count);
    many.forEach((line, i) => expect(lines[i]).toMatch(new RegExp(`^${line.lineNo}\\s+Boundary item ${line.lineNo}\\s`)));
    const pdf = renderInvoicePdf(view, at).toString('latin1');
    expect(pdf.match(/Boundary item /g)).toHaveLength(count);
    expect(offsetsValid(pdf)).toBe(true);
  });
  it('validates amounts after line 500 instead of silently omitting invalid detail', () => {
    const many = Array.from({ length: 501 }, (_, i) => ({ lineNo: i + 1, description: `Item ${i + 1}`, quantity: '1', unitRate: '1.00', amount: i === 500 ? '1.001' : '1.00' }));
    expect(() => renderInvoicePdf({ ...base, lines: many }, at)).toThrow('INVOICE_DOCUMENT_DATA_INVALID');
  });
  it('preserves sparse database line identifiers through the PostgreSQL integer range', () => {
    const lines = invoiceDocumentText({ ...base, lines: [1001, 2147483647].map(lineNo => ({ lineNo, description: 'Sparse item', quantity: '1', unitRate: '1.00', amount: '1.00' })) }, at);
    expect(lines.find(line => line.includes('Sparse item'))).toMatch(/^1001\s+Sparse item/);
    expect(lines.find(line => line.startsWith('2147483647'))).toMatch(/^2147483647\s+Sparse item/);
    expect(lines.filter(line => line.includes('Sparse item')).every(line => line.length === 86)).toBe(true);
  });
  it('preserves the full maximum supported quantity in its existing column', () => {
    const lines = invoiceDocumentText({ ...base, lines: [{ lineNo: 1, description: 'Quantity boundary', quantity: '10000.00', unitRate: '1.00', amount: '10000.00' }] }, at);
    expect(lines.find(line => line.includes('Quantity boundary'))).toMatch(/10000\.00\s+1\.00\s+10000\.00$/);
  });
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
