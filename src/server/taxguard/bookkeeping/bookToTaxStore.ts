/**
 * Durable book-to-tax over the proposal-029 RPCs: firm-defined categories, versioned mappings,
 * reviewable adjustments and reconciled workpaper snapshots. No tax is computed here.
 */
import type { PracticeRpcClient } from '../practice/practiceStore';
import { toCents } from './sqlLedgerStore';

export class BookToTaxError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { LEDGER_ACCESS_DENIED: 403, B2T_REVIEWER_REQUIRED: 403, B2T_MANAGER_REQUIRED: 403, MAKER_CHECKER_VIOLATION: 403,
  B2T_CONCURRENT_UPDATE: 409, B2T_IDEMPOTENCY_CONFLICT: 409, WORKPAPER_NOT_RECONCILED: 409, WORKPAPER_STALE: 409 };
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
/** Signed dollars (two decimals at most) to integer cents; never rounds. */
export function signedCents(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n === 0) throw new BookToTaxError('B2T_INPUT_INVALID', 400);
  try { return (n < 0 ? -1 : 1) * toCents(Math.abs(n)); } catch { throw new BookToTaxError('B2T_INPUT_INVALID', 400); }
}

export class BookToTaxStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new BookToTaxError('B2T_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (['55P03', '40001', '40P01'].includes(code)) throw new BookToTaxError('B2T_BUSY', 409);
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z0-9_]{3,64}$/.test(message)) throw new BookToTaxError(message, statusOf(message));
      throw new BookToTaxError('B2T_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private b(tenant: string, client: string, actor: string) { return { p_tenant: tenant, p_client: client, p_actor: actor }; }
  saveCategory(tenant: string, actor: string, c: { returnFamily: string; categoryCode: string; label: string; referenceText?: string }) {
    return this.call('taxguard_b2t_upsert_category', { p_tenant: tenant, p_actor: actor, p_family: c.returnFamily, p_code: c.categoryCode, p_label: c.label, p_reference: c.referenceText ?? null });
  }
  categories(tenant: string, actor: string, family: string) { return this.call<any[]>('taxguard_b2t_categories_list', { p_tenant: tenant, p_actor: actor, p_family: family }); }
  openSet(tenant: string, client: string, actor: string, taxYear: number, family: string) {
    return this.call('taxguard_b2t_open_set', { ...this.b(tenant, client, actor), p_year: taxYear, p_family: family });
  }
  setMapping(tenant: string, client: string, actor: string, setId: string, accountId: string, categoryCode: string | null) {
    return this.call('taxguard_b2t_set_mapping', { ...this.b(tenant, client, actor), p_set: setId, p_account: accountId, p_category: categoryCode });
  }
  reviewSet(tenant: string, client: string, actor: string, setId: string, action: 'submit' | 'approve' | 'reject', note?: string) {
    return this.call('taxguard_b2t_review_set', { ...this.b(tenant, client, actor), p_set: setId, p_action: action, p_note: note ?? null });
  }
  prepareAdjustment(tenant: string, client: string, actor: string, key: unknown, a: { taxYear: number; returnFamily: string; categoryCode: string; amount: unknown; adjustmentType: string; description: string; evidenceDocumentId?: string }) {
    if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(key)) throw new BookToTaxError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return this.call('taxguard_b2t_prepare_adjustment', { ...this.b(tenant, client, actor), p_key: key, p_body: { taxYear: a.taxYear, returnFamily: a.returnFamily,
      categoryCode: a.categoryCode, amountCents: signedCents(a.amount), adjustmentType: a.adjustmentType, description: a.description, evidenceDocumentId: a.evidenceDocumentId ?? null } });
  }
  reviewAdjustment(tenant: string, client: string, actor: string, adjustmentId: string, approve: boolean, note?: string) {
    return this.call('taxguard_b2t_review_adjustment', { ...this.b(tenant, client, actor), p_adjustment: adjustmentId, p_approve: approve, p_note: note ?? null });
  }
  generateWorkpaper(tenant: string, client: string, actor: string, taxYear: number, family: string, caseId?: string) {
    return this.call('taxguard_b2t_generate_workpaper', { ...this.b(tenant, client, actor), p_year: taxYear, p_family: family, p_case: caseId ?? null });
  }
  reviewWorkpaper(tenant: string, client: string, actor: string, workpaperId: string, approve: boolean, note?: string) {
    return this.call('taxguard_b2t_review_workpaper', { ...this.b(tenant, client, actor), p_workpaper: workpaperId, p_approve: approve, p_note: note ?? null });
  }
  overview(tenant: string, client: string, actor: string, taxYear: number, family: string) {
    return this.call('taxguard_b2t_overview', { ...this.b(tenant, client, actor), p_year: taxYear, p_family: family });
  }
}
