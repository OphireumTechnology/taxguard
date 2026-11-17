/**
 * Document requests, checklists and client notifications over the proposal-031 RPCs. Every
 * authority rule (client vs staff, assignment, reviewer-only waivers, manager-only templates and
 * cancellation, upload requirements) is enforced by the database; this class validates shapes and
 * maps database codes to HTTP statuses.
 */
import { createHash } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';
import { DocumentVaultError } from './documentVaultStore';

const STATUS: Record<string, number> = { DOC_REQUEST_STAFF_REQUIRED: 403, DOC_REQUEST_MANAGER_REQUIRED: 403, DOC_REQUEST_WAIVER_REQUIRES_REVIEWER: 403,
  NOTIFICATION_CLIENT_ONLY: 403, NOTIFICATION_CATEGORY_MANDATORY: 422, NOTIFICATION_CHANNEL_UNAVAILABLE: 422, NOTIFICATION_PREF_VERSION_CONFLICT: 409, NOTIFICATION_PREF_LIMIT: 429, DOCUMENT_ACCESS_DENIED: 403, DOC_REQUEST_VERSION_CONFLICT: 409, DOC_REQUEST_CLOSED: 409, DOC_REQUEST_REMINDER_TOO_SOON: 429,
  ENGAGEMENT_YEAR_NOT_OPEN: 409, DOC_REQUEST_SCOPE_MISMATCH: 422, DOC_REQUEST_REQUIREMENT_NOT_MET: 422, DOCUMENT_NOT_ELIGIBLE: 409 };
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
const KEY = /^[A-Za-z0-9_.:-]{8,128}$/;

export interface DocumentRequestInput { engagementId: string; taxYear: number; title: string; category: string; instructions?: string; required?: boolean; dueDate?: string; acceptedTypes?: string[]; minDocuments?: number }

export class DocumentRequestStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new DocumentVaultError('DOCUMENT_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new DocumentVaultError(message, statusOf(message));
      throw new DocumentVaultError('DOCUMENT_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private b(tenant: string, client: string, actor: string) { return { p_tenant: tenant, p_client: client, p_actor: actor }; }

  create(tenant: string, client: string, actor: string, idempotencyKey: unknown, input: DocumentRequestInput) {
    if (typeof idempotencyKey !== 'string' || !KEY.test(idempotencyKey)) throw new DocumentVaultError('IDEMPOTENCY_KEY_REQUIRED', 400);
    const id = 'req_' + createHash('sha256').update([tenant, client, actor, idempotencyKey].join('|')).digest('hex').slice(0, 32);
    return this.call('taxguard_docreq_create', { ...this.b(tenant, client, actor), p_id: id, p_request: input });
  }
  list(tenant: string, client: string, actor: string, filter: { engagementId?: string; taxYear?: number } = {}) {
    return this.call<any[]>('taxguard_docreq_list', { ...this.b(tenant, client, actor), p_engagement: filter.engagementId ?? null, p_year: filter.taxYear ?? null });
  }
  link(tenant: string, client: string, actor: string, requestId: string, documentId: string, version: number) {
    if (!Number.isInteger(version) || version < 1) throw new DocumentVaultError('DOC_REQUEST_INPUT_INVALID', 400);
    return this.call('taxguard_docreq_link', { ...this.b(tenant, client, actor), p_request: requestId, p_document_id: documentId, p_version: version });
  }
  resolve(tenant: string, client: string, actor: string, requestId: string, action: 'waive' | 'cancel', reason: string, rowVersion: number) {
    return this.call('taxguard_docreq_resolve', { ...this.b(tenant, client, actor), p_request: requestId, p_action: action, p_reason: reason ?? null, p_row_version: rowVersion });
  }
  remind(tenant: string, client: string, actor: string, requestId: string) {
    return this.call('taxguard_docreq_remind', { ...this.b(tenant, client, actor), p_request: requestId });
  }
  saveTemplate(tenant: string, actor: string, template: { templateId: string; name: string; items: unknown[]; status?: string }) {
    return this.call('taxguard_docreq_template_upsert', { p_tenant: tenant, p_actor: actor, p_template: template });
  }
  templates(tenant: string, actor: string) { return this.call<any[]>('taxguard_docreq_template_list', { p_tenant: tenant, p_actor: actor }); }
  applyTemplate(tenant: string, client: string, actor: string, templateId: string, engagementId: string, taxYear: number, dueDate?: string) {
    return this.call('taxguard_docreq_apply_template', { ...this.b(tenant, client, actor), p_template: templateId, p_engagement: engagementId, p_year: taxYear, p_due: dueDate ?? null });
  }
  missing(tenant: string, actor: string, filter: { taxYear?: number; overdueOnly?: boolean; limit?: number } = {}) {
    return this.call('taxguard_docreq_missing', { p_tenant: tenant, p_actor: actor, p_filter: filter });
  }
  reviewQueue(tenant: string, actor: string, limit = 50) { return this.call<any[]>('taxguard_docreq_review_queue', { p_tenant: tenant, p_actor: actor, p_limit: limit }); }
  notifications(tenant: string, client: string, actor: string, unreadOnly = false) {
    return this.call('taxguard_client_notifications_list', { ...this.b(tenant, client, actor), p_unread_only: unreadOnly });
  }
  /** Contract C6: this client user's in-app preferences; e-mail and SMS are not commissioned. */
  preferences(tenant: string, client: string, actor: string) { return this.call('taxguard_notification_prefs', this.b(tenant, client, actor)); }
  setPreference(tenant: string, client: string, actor: string, input: { category?: unknown; channel?: unknown; enabled?: unknown; version?: unknown }) {
    const { category, channel = 'IN_APP', enabled, version } = input ?? {};
    if (typeof category !== 'string' || !/^[A-Z_]{3,32}$/.test(category) || typeof channel !== 'string' || !/^[A-Z_]{2,16}$/.test(channel) || typeof enabled !== 'boolean'
      || !Number.isInteger(version) || (version as number) < 0 || (version as number) > 1000) throw new DocumentVaultError('NOTIFICATION_INPUT_INVALID', 400);
    return this.call('taxguard_notification_pref_set', { ...this.b(tenant, client, actor), p_category: category, p_channel: channel, p_enabled: enabled, p_version: version });
  }
  markRead(tenant: string, client: string, actor: string, notificationId: string) {
    if (!/^[0-9a-f-]{36}$/.test(notificationId)) throw new DocumentVaultError('NOTIFICATION_NOT_FOUND', 404);
    return this.call('taxguard_client_notification_mark_read', { ...this.b(tenant, client, actor), p_notification: notificationId });
  }
}
