/**
 * Billing over the proposal-028 service RPCs. Money is exchanged as decimal strings/numbers
 * with at most two decimals; the database stores exact NUMERIC(15,2). Payments come only from
 * manual entry by a manager or the sandbox provider; no live payment processor exists.
 */
import { createHash } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';

export class BillingError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { BILLING_MANAGER_REQUIRED: 403, BILLING_STAFF_REQUIRED: 403, MAKER_CHECKER_VIOLATION: 403, PAYMENT_NOT_AUTHORIZED: 403,
  BILLING_ACCESS_DENIED: 403, PRACTICE_ACCESS_DENIED: 403, INVOICE_VERSION_CONFLICT: 409, BILLING_IDEMPOTENCY_CONFLICT: 409, DUPLICATE_PAYMENT: 409, CREDIT_ALREADY_DECIDED: 409 };
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
/** Accepts numbers or numeric strings with at most two decimals; never rounds. */
export function money(value: unknown): string {
  const text = typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(text)) throw new BillingError('BILLING_AMOUNT_INVALID', 400);
  return text;
}
const key = (v: unknown) => { if (typeof v !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(v)) throw new BillingError('IDEMPOTENCY_KEY_REQUIRED', 400); return v; };

/** Sandbox-only payment provider: deterministic, no network, never available in production. */
export interface PaymentProvider { readonly name: 'sandbox'; charge(input: { amount: string; invoiceId: string; idempotencyKey: string; testCard: string }): Promise<{ providerTransactionId: string; status: 'SUCCEEDED' | 'DECLINED' }> }
export const SANDBOX_DECLINE_CARD = '4000000000000002';
export const SANDBOX_SUCCESS_CARD = '4242424242424242';
export class SandboxPaymentProvider implements PaymentProvider {
  readonly name = 'sandbox' as const;
  constructor() { if (process.env.NODE_ENV === 'production') throw new BillingError('PAYMENT_PROVIDER_NOT_COMMISSIONED', 503); }
  async charge(input: { amount: string; invoiceId: string; idempotencyKey: string; testCard: string }) {
    // Only published test card numbers are accepted; anything else is refused, never charged.
    if (![SANDBOX_SUCCESS_CARD, SANDBOX_DECLINE_CARD].includes(input.testCard)) throw new BillingError('SANDBOX_TEST_CARD_REQUIRED', 400);
    const providerTransactionId = 'sbx_' + createHash('sha256').update([input.invoiceId, input.idempotencyKey, input.amount].join('|')).digest('hex').slice(0, 24);
    return { providerTransactionId, status: input.testCard === SANDBOX_DECLINE_CARD ? 'DECLINED' as const : 'SUCCEEDED' as const };
  }
}

export class BillingStore {
  constructor(private readonly client: PracticeRpcClient, private readonly provider?: PaymentProvider) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new BillingError('BILLING_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (['55P03', '40001', '40P01'].includes(code)) throw new BillingError('BILLING_BUSY', 409);
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) {
        // The shared client-access helper speaks in document terms; report billing terms.
        const mapped = message === 'DOCUMENT_NOT_FOUND' ? 'CLIENT_NOT_FOUND' : message === 'DOCUMENT_ACCESS_DENIED' ? 'BILLING_ACCESS_DENIED' : message;
        throw new BillingError(mapped, statusOf(mapped));
      }
      throw new BillingError('BILLING_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private b(tenant: string, client: string, actor: string) { return { p_tenant: tenant, p_client: client, p_actor: actor }; }

  upsertService(tenant: string, actor: string, s: { serviceCode: string; name: string; category: string; billingMethod: string; baseFee: unknown; reason?: string }) {
    return this.call('taxguard_bill_upsert_service_serialized', { p_tenant: tenant, p_actor: actor, p_code: s.serviceCode, p_name: s.name, p_category: s.category, p_method: s.billingMethod,
      p_fee: money(s.baseFee), p_reason: s.reason ?? null });
  }
  catalog(tenant: string, actor: string) { return this.call<any[]>('taxguard_bill_catalog', { p_tenant: tenant, p_actor: actor }); }
  createInvoice(tenant: string, client: string, actor: string, idempotencyKey: unknown, input: { engagementId?: string; dueDate: string }) {
    if (typeof input?.dueDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate)) throw new BillingError('BILLING_INPUT_INVALID', 400);
    return this.call<{ invoiceId: string; created: boolean }>('taxguard_bill_create_invoice', { ...this.b(tenant, client, actor), p_key: key(idempotencyKey), p_engagement: input.engagementId ?? null, p_due: input.dueDate });
  }
  addLine(tenant: string, client: string, actor: string, invoiceId: string, line: { serviceCode: string; quantity: unknown; unitRate?: unknown; description?: string; overrideReason?: string }, idempotencyKey: unknown) {
    return this.call('taxguard_bill_add_line_once', { ...this.b(tenant, client, actor), p_key: key(idempotencyKey), p_invoice: invoiceId, p_service: line.serviceCode, p_quantity: money(line.quantity),
      p_rate: line.unitRate === undefined || line.unitRate === null || line.unitRate === '' ? null : money(line.unitRate), p_description: line.description ?? null, p_override_reason: line.overrideReason ?? null });
  }
  removeLine(tenant: string, client: string, actor: string, invoiceId: string, lineNo: number, idempotencyKey: unknown) {
    return this.call('taxguard_bill_remove_line_once', { ...this.b(tenant, client, actor), p_invoice: invoiceId, p_line: lineNo, p_key: key(idempotencyKey) });
  }
  transition(tenant: string, client: string, actor: string, invoiceId: string, action: string, rowVersion: number, note?: string) {
    return this.call('taxguard_bill_transition', { ...this.b(tenant, client, actor), p_invoice: invoiceId, p_action: action, p_row_version: rowVersion, p_note: note ?? null });
  }
  recordManualPayment(tenant: string, client: string, actor: string, invoiceId: string, input: { amount: unknown; method: string; idempotencyKey: unknown }) {
    return this.call('taxguard_bill_record_payment', { ...this.b(tenant, client, actor), p_invoice: invoiceId, p_amount: money(input.amount), p_method: input.method,
      p_key: key(input.idempotencyKey), p_provider: null, p_provider_txn: null });
  }
  /** Sandbox card payment: charge the sandbox provider, then record the settled payment once. */
  async paySandbox(tenant: string, client: string, actor: string, invoiceId: string, input: { amount: unknown; idempotencyKey: unknown; testCard: string }) {
    if (!this.provider) throw new BillingError('PAYMENT_PROVIDER_NOT_COMMISSIONED', 503);
    const amount = money(input.amount), k = key(input.idempotencyKey);
    const result = await this.provider.charge({ amount, invoiceId, idempotencyKey: k, testCard: input.testCard });
    if (result.status !== 'SUCCEEDED') throw new BillingError('PAYMENT_DECLINED', 402);
    return this.call('taxguard_bill_record_payment', { ...this.b(tenant, client, actor), p_invoice: invoiceId, p_amount: amount, p_method: 'CARD_SANDBOX', p_key: k,
      p_provider: this.provider.name, p_provider_txn: result.providerTransactionId });
  }
  refund(tenant: string, client: string, actor: string, paymentId: string, amount: unknown, reason: string, idempotencyKey: unknown) {
    return this.call('taxguard_bill_refund', { ...this.b(tenant, client, actor), p_payment: paymentId, p_amount: money(amount), p_reason: reason, p_key: key(idempotencyKey) });
  }
  requestCredit(tenant: string, client: string, actor: string, invoiceId: string, amount: unknown, reason: string, idempotencyKey: unknown) {
    return this.call('taxguard_bill_request_credit_once', { ...this.b(tenant, client, actor), p_key: key(idempotencyKey), p_invoice: invoiceId, p_amount: money(amount), p_reason: reason });
  }
  decideCredit(tenant: string, client: string, actor: string, creditId: string, apply: boolean) {
    return this.call('taxguard_bill_decide_credit', { ...this.b(tenant, client, actor), p_credit: creditId, p_apply: apply });
  }
  list(tenant: string, client: string, actor: string) { return this.call<any[]>('taxguard_bill_list', this.b(tenant, client, actor)); }
  page(tenant: string, client: string, actor: string, after?: { at: string; id: string }, limit = 50) {
    return this.call<{ items: any[]; next: { at: string; id: string } | null; summary: { balanceDue: string; invoiceCount: number } }>('taxguard_bill_page',
      { ...this.b(tenant,client,actor), p_after_at:after?.at??null, p_after_id:after?.id??null, p_limit:limit });
  }
  arAging(tenant: string, actor: string, asOf?: string) { return this.call('taxguard_bill_ar_aging', { p_tenant: tenant, p_actor: actor, p_as_of: asOf ?? null }); }
}
