/**
 * Client and engagement management over the proposal-025 service RPCs. Identifiers for
 * created records are derived from the caller's idempotency key, so a retried request maps to
 * the same row instead of creating a duplicate.
 */
import { createHash } from 'node:crypto';

export interface PracticeRpcClient { rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: any; error: { code?: string; message?: string } | null }> }
export class PracticeStoreError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = {
  PRACTICE_ACCESS_DENIED: 403, PRACTICE_MANAGER_REQUIRED: 403, DASHBOARD_MANAGER_REQUIRED: 403, DASHBOARD_ROLE_NOT_SUPPORTED: 403, TASK_ACTION_NOT_AUTHORIZED: 403, DEADLINE_WAIVER_NOT_AUTHORIZED: 403, WORKLOAD_NOT_AUTHORIZED: 403,
  PRACTICE_VERSION_CONFLICT: 409, PRACTICE_CONCURRENT_UPDATE: 409, PRACTICE_IDEMPOTENCY_CONFLICT: 409, PRACTICE_BUSY: 409,
  CLIENT_HAS_OPEN_ENGAGEMENTS: 409, ENGAGEMENT_HAS_OPEN_TASKS: 409, TASK_DEPENDENCIES_OPEN: 409, ASSIGNMENT_SEGREGATION_OF_DUTIES: 409,
};
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
/** Stable record ID from (tenant, client, purpose, idempotency key). */
export function derivedId(prefix: string, tenantId: string, clientId: string, key: string) {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_.:-]{8,128}$/.test(key)) throw new PracticeStoreError('IDEMPOTENCY_KEY_REQUIRED', 400);
  return `${prefix}_${createHash('sha256').update([tenantId, clientId, prefix, key].join('|')).digest('hex').slice(0, 32)}`;
}

export interface ClientListFilter { q?: string; status?: 'active' | 'archived'; clientType?: string; after?: string; limit?: number }

export class PracticeStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new PracticeStoreError('PRACTICE_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === '55P03' || code === '40001' || code === '40P01') throw new PracticeStoreError('PRACTICE_BUSY', 409);
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new PracticeStoreError(message, statusOf(message));
      throw new PracticeStoreError('PRACTICE_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private base(tenantId: string, clientId: string, actor: string) { return { p_tenant: tenantId, p_client: clientId, p_actor: actor }; }

  /** Proposal 032: the actor's own durable work queue (cases, reviews, requests, returned entries). */
  myWork(tenantId: string, actor: string) { return this.call('taxguard_dash_my_work', { p_tenant: tenantId, p_actor: actor }); }
  /** Proposal 032: manager summary computed only from recorded rows, with definitions. */
  practiceSummary(tenantId: string, actor: string, taxYear?: number) {
    if (taxYear !== undefined && (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100)) throw new PracticeStoreError('DASHBOARD_INPUT_INVALID', 400);
    return this.call('taxguard_dash_practice_summary', { p_tenant: tenantId, p_actor: actor, p_tax_year: taxYear ?? null });
  }
  async listClients(tenantId: string, actor: string, filter: ClientListFilter = {}) {
    const limit = filter.limit ?? 25;
    const rows = await this.call<any[]>('taxguard_practice_list_clients', { p_tenant: tenantId, p_actor: actor, p_filter: { ...filter, limit: limit + 1 } });
    const items = rows.slice(0, limit);
    return { items, nextCursor: rows.length > limit ? items[items.length - 1].clientId as string : null };
  }
  clientDetail(tenantId: string, clientId: string, actor: string) { return this.call('taxguard_practice_client_detail', this.base(tenantId, clientId, actor)); }
  setClientStatus(tenantId: string, clientId: string, actor: string, status: string, reason: string) {
    return this.call('taxguard_practice_set_client_status', { ...this.base(tenantId, clientId, actor), p_status: status, p_reason: reason });
  }
  setClientType(tenantId: string, clientId: string, actor: string, clientType: string) {
    return this.call('taxguard_practice_set_client_type', { ...this.base(tenantId, clientId, actor), p_type: clientType });
  }
  createEngagement(tenantId: string, clientId: string, actor: string, key: string, input: { title: string; type: string; description?: string; taxYears: number[] }) {
    if (!Array.isArray(input?.taxYears) || !input.taxYears.every(y => Number.isInteger(y))) throw new PracticeStoreError('PRACTICE_INPUT_INVALID', 400);
    return this.call<{ engagementId: string; created: boolean }>('taxguard_practice_create_engagement', { ...this.base(tenantId, clientId, actor),
      p_engagement: derivedId('eng', tenantId, clientId, key), p_title: input.title, p_type: input.type, p_description: input.description ?? null, p_tax_years: input.taxYears });
  }
  setEngagementStatus(tenantId: string, clientId: string, actor: string, engagementId: string, status: string, version: number, reason?: string) {
    return this.call('taxguard_practice_set_engagement_status', { ...this.base(tenantId, clientId, actor), p_engagement: engagementId, p_status: status, p_version: version, p_reason: reason ?? null });
  }
  addTaxYear(tenantId: string, clientId: string, actor: string, engagementId: string, taxYear: number) {
    return this.call('taxguard_practice_add_tax_year', { ...this.base(tenantId, clientId, actor), p_engagement: engagementId, p_year: taxYear });
  }
  assign(tenantId: string, clientId: string, actor: string, key: string, input: { engagementId: string; taxYear: number; role: string; userId: string; reason: string }) {
    return this.call('taxguard_practice_assign', { ...this.base(tenantId, clientId, actor), p_engagement: input.engagementId, p_year: input.taxYear, p_role: input.role,
      p_user: input.userId, p_reason: input.reason, p_assignment: derivedId('asg', tenantId, clientId, key) });
  }
  unassign(tenantId: string, clientId: string, actor: string, assignmentId: string, reason: string) {
    return this.call('taxguard_practice_unassign', { ...this.base(tenantId, clientId, actor), p_assignment: assignmentId, p_reason: reason });
  }
  addNote(tenantId: string, clientId: string, actor: string, body: string, engagementId?: string) {
    return this.call<{ noteId: string }>('taxguard_practice_add_note', { ...this.base(tenantId, clientId, actor), p_engagement: engagementId ?? null, p_body: body });
  }
  createTask(tenantId: string, clientId: string, actor: string, key: string, task: Record<string, unknown>) {
    return this.call<{ taskId: string; created: boolean }>('taxguard_practice_create_task', { ...this.base(tenantId, clientId, actor), p_task: derivedId('task', tenantId, clientId, key), p_body: task });
  }
  setTaskStatus(tenantId: string, clientId: string, actor: string, taskId: string, status: string, version: number) {
    return this.call('taxguard_practice_set_task_status', { ...this.base(tenantId, clientId, actor), p_task: taskId, p_status: status, p_version: version });
  }
  /** Block 84: reassign or clear a task's assignee (manager, creator or current assignee, in scope). */
  reassignTask(tenantId: string, clientId: string, actor: string, taskId: string, assignee: string | null, version: number, reason?: string) {
    return this.call('taxguard_practice_reassign_task', { ...this.base(tenantId, clientId, actor), p_task: taskId, p_assignee: assignee, p_version: version, p_reason: reason ?? null });
  }
  /** Block 84: a staff member's open tasks and assignments; another member's only for managers. */
  workload(tenantId: string, actor: string, userId?: string) { return this.call('taxguard_dash_workload', { p_tenant: tenantId, p_actor: actor, p_user: userId ?? null }); }
  addDeadline(tenantId: string, clientId: string, actor: string, key: string, deadline: Record<string, unknown>) {
    return this.call('taxguard_practice_add_deadline', { ...this.base(tenantId, clientId, actor), p_deadline: derivedId('ddl', tenantId, clientId, key), p_body: deadline });
  }
  resolveDeadline(tenantId: string, clientId: string, actor: string, deadlineId: string, status: string, reason?: string) {
    return this.call('taxguard_practice_resolve_deadline', { ...this.base(tenantId, clientId, actor), p_deadline: deadlineId, p_status: status, p_reason: reason ?? null });
  }
}
