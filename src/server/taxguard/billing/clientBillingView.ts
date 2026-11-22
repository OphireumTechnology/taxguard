/**
 * Client projection of billing responses. The proposal-028 invoice JSON is shared by staff and
 * client calls and carries staff-only financial information (preparer / approver identities, the
 * maker-checker review note, rate-override reasons, credit-request reasons and deciders, payment
 * provider). Every response to a client passes through this allow-list: unknown fields are dropped
 * by default, so a field added to the database projection never reaches clients unreviewed.
 */
const INVOICE = ['invoiceId', 'invoiceNumber', 'clientId', 'engagementId', 'status', 'subtotal', 'creditsApplied', 'total', 'amountPaid', 'balanceDue', 'currency',
  'dueDate', 'issueDate', 'createdAt', 'rowVersion', 'lines', 'payments', 'credits'];
const LINE = ['lineNo', 'serviceCode', 'description', 'quantity', 'unitRate', 'amount'];
const PAYMENT = ['paymentId', 'amount', 'refundedAmount', 'method', 'status', 'createdAt'];
const CREDIT = ['creditId', 'amount', 'status'];
const pick = (value: unknown, keys: string[]) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(keys.filter(k => k in (value as object)).map(k => [k, (value as Record<string, unknown>)[k]])) : value;
const list = (value: unknown, keys: string[]) => Array.isArray(value) ? value.map(v => pick(v, keys)) : value;

export function clientInvoiceView(invoice: unknown): unknown {
  const i = pick(invoice, INVOICE) as Record<string, unknown>;
  if (!i || typeof i !== 'object') return i;
  return { ...i, ...('lines' in i ? { lines: list(i.lines, LINE) } : {}), ...('payments' in i ? { payments: list(i.payments, PAYMENT) } : {}),
    ...('credits' in i ? { credits: list(i.credits, CREDIT) } : {}) };
}

/** Applies the invoice projection wherever an invoice appears in a client response. */
export function clientBillingView(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clientBillingView);
  if (!value || typeof value !== 'object') return value;
  const v = value as Record<string, unknown>;
  if ('invoiceId' in v) return clientInvoiceView(v);
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'items' || k === 'invoice' ? clientBillingView(x) : x]));
}
