/**
 * Client / staff messaging over the proposal-039 RPCs. Scope (tenant, client), assignment, client
 * ownership, visibility (clients never see internal notes) and thread status are enforced by the
 * database; this class validates shapes, derives idempotent IDs and maps codes to HTTP statuses.
 */
import { createHash } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';

export class CommunicationStoreError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { COMM_ACCESS_DENIED: 403, COMM_STAFF_REQUIRED: 403, COMM_MANAGER_REQUIRED: 403, COMM_INTERNAL_STAFF_ONLY: 403,
  PRACTICE_ACCESS_DENIED: 403, COMM_THREAD_CLOSED: 409, IDEMPOTENCY_KEY_REUSED: 409, COMM_SCOPE_MISMATCH: 422 };
// Unknown clients and threads are reported identically ("not found"), never as "forbidden".
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
const publicCode = (code: string) => code === 'DOCUMENT_NOT_FOUND' ? 'COMM_CLIENT_NOT_FOUND' : code === 'DOCUMENT_ACCESS_DENIED' ? 'COMM_ACCESS_DENIED' : code === 'DOCUMENT_INPUT_INVALID' ? 'COMM_INPUT_INVALID' : code;
const KEY = /^[A-Za-z0-9_.:-]{8,128}$/;
const CATEGORIES = ['GENERAL', 'TAX_QUESTION', 'DOCUMENT_QUERY', 'INVOICING', 'ADVISORY'];
const VISIBILITY = ['CLIENT_VISIBLE', 'INTERNAL_ONLY'];

export interface ThreadInput { subject: string; category?: string; engagementId?: string; body: string; visibility?: string }

export class CommunicationStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new CommunicationStoreError('COMM_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) { const c = publicCode(message); throw new CommunicationStoreError(c, statusOf(c)); }
      throw new CommunicationStoreError('COMM_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private id(prefix: 'thr' | 'msg', parts: string[], key: unknown) {
    if (typeof key !== 'string' || !KEY.test(key)) throw new CommunicationStoreError('IDEMPOTENCY_KEY_REQUIRED', 400);
    return prefix + '_' + createHash('sha256').update([prefix, ...parts, key].join('|')).digest('hex').slice(0, 32);
  }
  private b(tenant: string, client: string, actor: string) { return { p_tenant: tenant, p_client: client, p_actor: actor }; }
  private text(value: unknown, max: number) { if (typeof value !== 'string' || !value.trim() || value.length > max) throw new CommunicationStoreError('COMM_INPUT_INVALID', 400); return value; }

  createThread(tenant: string, client: string, actor: string, idempotencyKey: unknown, input: ThreadInput) {
    const subject = this.text(input?.subject, 200), body = this.text(input?.body, 5000);
    if (input.category !== undefined && !CATEGORIES.includes(input.category)) throw new CommunicationStoreError('COMM_INPUT_INVALID', 400);
    if (input.visibility !== undefined && !VISIBILITY.includes(input.visibility)) throw new CommunicationStoreError('COMM_INPUT_INVALID', 400);
    if (input.engagementId !== undefined && (typeof input.engagementId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(input.engagementId))) throw new CommunicationStoreError('COMM_INPUT_INVALID', 400);
    const scope = [tenant, client, actor];
    return this.call('taxguard_comm_thread_create', { ...this.b(tenant, client, actor), p_thread: this.id('thr', scope, idempotencyKey), p_message: this.id('msg', scope, idempotencyKey),
      p_input: { subject, body, category: input.category ?? 'GENERAL', engagementId: input.engagementId ?? null, visibility: input.visibility ?? 'CLIENT_VISIBLE' } });
  }
  post(tenant: string, client: string, actor: string, threadId: string, idempotencyKey: unknown, body: unknown, visibility?: unknown) {
    if (visibility !== undefined && (typeof visibility !== 'string' || !VISIBILITY.includes(visibility))) throw new CommunicationStoreError('COMM_INPUT_INVALID', 400);
    return this.call('taxguard_comm_post', { ...this.b(tenant, client, actor), p_thread: threadId, p_message: this.id('msg', [tenant, client, actor, threadId], idempotencyKey),
      p_body: this.text(body, 5000), p_visibility: visibility ?? 'CLIENT_VISIBLE' });
  }
  threads(tenant: string, client: string, actor: string, status?: string) {
    if (status !== undefined && !['ACTIVE', 'RESOLVED', 'ARCHIVED'].includes(status)) throw new CommunicationStoreError('COMM_INPUT_INVALID', 400);
    return this.call<any[]>('taxguard_comm_threads', { ...this.b(tenant, client, actor), p_status: status ?? null });
  }
  messages(tenant: string, client: string, actor: string, threadId: string) { return this.call('taxguard_comm_messages', { ...this.b(tenant, client, actor), p_thread: threadId }); }
  markRead(tenant: string, client: string, actor: string, threadId: string) { return this.call('taxguard_comm_mark_read', { ...this.b(tenant, client, actor), p_thread: threadId }); }
  setStatus(tenant: string, client: string, actor: string, threadId: string, status: unknown) {
    if (typeof status !== 'string' || !['ACTIVE', 'RESOLVED', 'ARCHIVED'].includes(status)) throw new CommunicationStoreError('COMM_INPUT_INVALID', 400);
    return this.call('taxguard_comm_set_status', { ...this.b(tenant, client, actor), p_thread: threadId, p_status: status });
  }
  inbox(tenant: string, actor: string, limit?: number) {
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 200)) throw new CommunicationStoreError('COMM_INPUT_INVALID', 400);
    return this.call<any[]>('taxguard_comm_staff_inbox', { p_tenant: tenant, p_actor: actor, p_limit: limit ?? 50 });
  }
}
