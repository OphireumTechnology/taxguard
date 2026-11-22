/**
 * Durable case workflow over the proposal-026 service RPCs. Stage evidence is computed or
 * checked in the database; this layer never supplies a "passed" decision of its own.
 */
import { derivedId, PracticeStoreError, type PracticeRpcClient } from './practiceStore';

export const RETURN_FAMILIES = ['1040', '1041', '1065', '1120', '1120S', '990', '706', '709'] as const;
export class CaseStoreError extends PracticeStoreError {
  constructor(code: string, status: number, public readonly failedChecks: string[] = []) { super(code, status); }
}
const STATUS: Record<string, number> = { CASE_VERSION_CONFLICT: 409, CASE_ALREADY_EXISTS: 409, STAGE_ACTION_NOT_AUTHORIZED: 403, STAGE_ATTESTATION_REQUIRES_REVIEWER: 403,
  STAGE_RETURN_REQUIRES_REVIEWER: 403, CASE_CREATE_NOT_AUTHORIZED: 403, PRACTICE_ACCESS_DENIED: 403, PRACTICE_MANAGER_REQUIRED: 403, ASSIGNMENT_SEGREGATION_OF_DUTIES: 409,
  STAGE_GATE_NOT_MET: 409, CASE_BUSY: 409, CASE_ASSIGNEE_NOT_ASSIGNED: 409 };
const statusOf = (code: string) => STATUS[code] ?? (code.startsWith('STAGE_BLOCKED_') ? 409 : code.endsWith('_NOT_FOUND') ? 404 : 400);

export class CaseStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new CaseStoreError('CASE_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error; const details = (response.error as { details?: unknown }).details;
      if (code === '55P03' || code === '40001' || code === '40P01') throw new CaseStoreError('CASE_BUSY', 409);
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z0-9_]{3,64}$/.test(message)) {
        let failed: string[] = [];
        if (message === 'STAGE_GATE_NOT_MET' && typeof details === 'string') {
          try { const v = JSON.parse(details); if (Array.isArray(v)) failed = v.filter(x => typeof x === 'string' && /^[A-Za-z_]{1,64}$/.test(x)); } catch { /* ignore malformed detail */ }
        }
        throw new CaseStoreError(message, statusOf(message), failed);
      }
      throw new CaseStoreError('CASE_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  create(tenantId: string, clientId: string, actor: string, key: string, input: { engagementId: string; taxYear: number; returnFamily: string }) {
    return this.call<{ caseId: string; created: boolean }>('taxguard_case_create', { p_tenant: tenantId, p_client: clientId, p_actor: actor, p_engagement: input.engagementId,
      p_year: input.taxYear, p_case: derivedId('case', tenantId, clientId, key), p_family: input.returnFamily });
  }
  advance(tenantId: string, caseId: string, actor: string, fromStage: number, version: number, attestation?: { confirmed: string[]; statement: string }) {
    return this.call('taxguard_case_advance', { p_tenant: tenantId, p_case: caseId, p_actor: actor, p_from_stage: fromStage, p_version: version, p_attestation: attestation ?? null });
  }
  returnTo(tenantId: string, caseId: string, actor: string, toStage: number, version: number, reason: string) {
    return this.call('taxguard_case_return', { p_tenant: tenantId, p_case: caseId, p_actor: actor, p_to_stage: toStage, p_version: version, p_reason: reason });
  }
  setHold(tenantId: string, caseId: string, actor: string, hold: boolean, version: number, reason: string) {
    return this.call('taxguard_case_set_hold', { p_tenant: tenantId, p_case: caseId, p_actor: actor, p_hold: hold, p_version: version, p_reason: reason });
  }
  /** Moves the case's preparer or reviewer to a person holding the live assignment (managers and administrators only; proposal 20261018105000). */
  restaff(tenantId: string, caseId: string, actor: string, input: { role: string; userId: string; version: number; reason: string }) {
    return this.call('taxguard_case_restaff', { p_tenant: tenantId, p_case: caseId, p_actor: actor, p_role: input.role, p_user: input.userId, p_version: input.version, p_reason: input.reason });
  }
  detail(tenantId: string, caseId: string, actor: string) { return this.call('taxguard_case_detail', { p_tenant: tenantId, p_case: caseId, p_actor: actor }); }
  addNote(tenantId: string, caseId: string, actor: string, body: string) { return this.call('taxguard_case_add_note', { p_tenant: tenantId, p_case: caseId, p_actor: actor, p_body: body }); }
  async queue(tenantId: string, actor: string, filter: { role?: string; stage?: number; status?: string; taxYear?: number; after?: string; limit?: number } = {}) {
    const limit = filter.limit ?? 50;
    const rows = await this.call<any[]>('taxguard_case_queue', { p_tenant: tenantId, p_actor: actor, p_filter: { ...filter, limit: limit + 1 } });
    const items = rows.slice(0, limit);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].caseId as string : null };
  }
  statusReport(tenantId: string, actor: string) { return this.call('taxguard_case_status_report', { p_tenant: tenantId, p_actor: actor }); }
}
