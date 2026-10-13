/**
 * Read-only administrative audit center over the proposal-041 RPCs. Administrator authority, tenant
 * scope, redaction (allow-listed identifier and status fields only), range and page limits are
 * enforced by the database; this class validates shapes and maps codes to HTTP statuses.
 */
import type { PracticeRpcClient } from '../practice/practiceStore';

export class AuditCenterError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { AUDIT_ADMIN_REQUIRED: 403, AUDIT_EVENT_NOT_FOUND: 404 };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface AuditFilter { from: string; to: string; category?: string; action?: string; actorUid?: string; clientId?: string; cursor?: string; limit?: number }

export class AuditCenterStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new AuditCenterError('AUDIT_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new AuditCenterError(message, STATUS[message] ?? 400);
      throw new AuditCenterError('AUDIT_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private when(v: unknown) { if (typeof v !== 'string' || v.length > 40 || !Number.isFinite(Date.parse(v))) throw new AuditCenterError('AUDIT_RANGE_INVALID', 400); return v; }

  async list(tenant: string, actor: string, filter: AuditFilter) {
    let after: { at: string; eventId: string } | undefined;
    if (filter.cursor !== undefined) {
      try { after = JSON.parse(Buffer.from(filter.cursor, 'base64url').toString('utf8')); } catch { throw new AuditCenterError('AUDIT_INPUT_INVALID', 400); }
      if (!after || typeof after.at !== 'string' || typeof after.eventId !== 'string' || !UUID.test(after.eventId)) throw new AuditCenterError('AUDIT_INPUT_INVALID', 400);
    }
    if (filter.limit !== undefined && (!Number.isInteger(filter.limit) || filter.limit < 1 || filter.limit > 100)) throw new AuditCenterError('AUDIT_INPUT_INVALID', 400);
    const page = await this.call<{ items: any[]; next: { at: string; eventId: string } | null }>('taxguard_audit_center_list', { p_tenant: tenant, p_actor: actor, p_filter: {
      from: this.when(filter.from), to: this.when(filter.to), category: filter.category ?? null, action: filter.action ?? null, actorUid: filter.actorUid ?? null,
      clientId: filter.clientId ?? null, limit: filter.limit ?? 50, ...(after ? { after } : {}) } });
    return { items: page.items, nextCursor: page.next ? Buffer.from(JSON.stringify(page.next)).toString('base64url') : null };
  }
  event(tenant: string, actor: string, eventId: unknown) {
    if (typeof eventId !== 'string' || !UUID.test(eventId)) throw new AuditCenterError('AUDIT_EVENT_NOT_FOUND', 404);
    return this.call('taxguard_audit_center_event', { p_tenant: tenant, p_actor: actor, p_event: eventId });
  }
  categories(tenant: string, actor: string, from: unknown, to: unknown) {
    return this.call<Array<{ category: string; count: number }>>('taxguard_audit_center_categories', { p_tenant: tenant, p_actor: actor, p_from: this.when(from), p_to: this.when(to) });
  }
}
