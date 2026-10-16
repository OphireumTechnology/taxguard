/**
 * Appointments over the proposal-040 RPCs. Scope, staff eligibility, booking conflicts (locked and
 * re-checked in the same transaction), status transitions, versions and idempotency are enforced
 * by the database; this class validates shapes, derives appointment IDs and maps codes to HTTP.
 */
import { createHash } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';

export class AppointmentStoreError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { APPOINTMENT_ACCESS_DENIED: 403, APPOINTMENT_STAFF_REQUIRED: 403, APPOINTMENT_MANAGER_REQUIRED: 403, PRACTICE_ACCESS_DENIED: 403,
  APPOINTMENT_STAFF_CONFLICT: 409, APPOINTMENT_CLIENT_CONFLICT: 409, APPOINTMENT_VERSION_CONFLICT: 409, APPOINTMENT_CLOSED: 409, APPOINTMENT_TRANSITION_INVALID: 409,
  APPOINTMENT_NOT_STARTED: 409, IDEMPOTENCY_KEY_REUSED: 409, APPOINTMENT_SCOPE_MISMATCH: 422, APPOINTMENT_STAFF_INVALID: 422,
  ROOM_NOT_OPEN: 409, ROOM_EVENT_LIMIT: 429, ROOM_INPUT_INVALID: 400 };
const publicCode = (code: string) => ({ DOCUMENT_NOT_FOUND: 'APPOINTMENT_CLIENT_NOT_FOUND', DOCUMENT_ACCESS_DENIED: 'APPOINTMENT_ACCESS_DENIED', DOCUMENT_INPUT_INVALID: 'APPOINTMENT_INPUT_INVALID' } as Record<string, string>)[code] ?? code;
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
const KEY = /^[A-Za-z0-9_.:-]{8,80}$/;
const ID = /^apt_[a-f0-9]{32}$/;
export const APPOINTMENT_CATEGORIES = ['CONSULTATION', 'DOCUMENT_REVIEW', 'TAX_PLANNING', 'RETURN_REVIEW', 'SIGNING_MEETING', 'GENERAL'] as const;
export const APPOINTMENT_MODES = ['REMOTE', 'IN_PERSON', 'PHONE'] as const;

export interface AppointmentInput { title: string; category?: string; mode: string; startsAt: string; endsAt: string; timezone: string; engagementId?: string;
  staffUid?: string; agenda?: string; internalNote?: string; meetingUrl?: string; location?: string; confirm?: boolean }

export class AppointmentStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new AppointmentStoreError('APPOINTMENT_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) { const c = publicCode(message); throw new AppointmentStoreError(c, statusOf(c)); }
      throw new AppointmentStoreError('APPOINTMENT_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private b(tenant: string, client: string, actor: string) { return { p_tenant: tenant, p_client: client, p_actor: actor }; }
  private key(k: unknown) { if (typeof k !== 'string' || !KEY.test(k)) throw new AppointmentStoreError('IDEMPOTENCY_KEY_REQUIRED', 400); return k; }
  private id(v: unknown) { if (typeof v !== 'string' || !ID.test(v)) throw new AppointmentStoreError('APPOINTMENT_NOT_FOUND', 404); return v; }
  private version(v: unknown) { if (!Number.isInteger(v) || (v as number) < 1) throw new AppointmentStoreError('APPOINTMENT_INPUT_INVALID', 400); return v as number; }
  private iso(v: unknown) { if (typeof v !== 'string' || v.length > 40 || !Number.isFinite(Date.parse(v))) throw new AppointmentStoreError('APPOINTMENT_TIME_INVALID', 400); return v; }

  create(tenant: string, client: string, actor: string, idempotencyKey: unknown, input: AppointmentInput) {
    const key = this.key(idempotencyKey);
    if (!input || typeof input.title !== 'string' || typeof input.mode !== 'string' || !(APPOINTMENT_MODES as readonly string[]).includes(input.mode)
      || (input.category !== undefined && !(APPOINTMENT_CATEGORIES as readonly string[]).includes(input.category)) || typeof input.timezone !== 'string')
      throw new AppointmentStoreError('APPOINTMENT_INPUT_INVALID', 400);
    const id = 'apt_' + createHash('sha256').update(['apt', tenant, client, actor, key].join('|')).digest('hex').slice(0, 32);
    return this.call('taxguard_apt_create', { ...this.b(tenant, client, actor), p_id: id, p_key: key, p_input: { ...input, startsAt: this.iso(input.startsAt), endsAt: this.iso(input.endsAt) } });
  }
  get(tenant: string, client: string, actor: string, id: unknown) { return this.call('taxguard_apt_get', { ...this.b(tenant, client, actor), p_id: this.id(id) }); }
  /** Contract C5: derived consultation-room state and durable join / leave events (no video transport). */
  room(tenant: string, client: string, actor: string, id: unknown) { return this.call('taxguard_apt_room', { ...this.b(tenant, client, actor), p_appointment: this.id(id) }); }
  roomEvent(tenant: string, client: string, actor: string, id: unknown, event: 'JOINED' | 'LEFT') {
    return this.call('taxguard_apt_room_event', { ...this.b(tenant, client, actor), p_appointment: this.id(id), p_event: event });
  }
  listForClient(tenant: string, client: string, actor: string) { return this.call<any[]>('taxguard_apt_list_client', this.b(tenant, client, actor)); }
  schedule(tenant: string, actor: string, from: unknown, to: unknown, staffUid?: string) {
    return this.call<any[]>('taxguard_apt_schedule', { p_tenant: tenant, p_actor: actor, p_from: this.iso(from), p_to: this.iso(to), p_staff: staffUid ?? null });
  }
  update(tenant: string, client: string, actor: string, id: unknown, version: unknown, idempotencyKey: unknown, fields: Record<string, unknown>) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new AppointmentStoreError('APPOINTMENT_INPUT_INVALID', 400);
    return this.call('taxguard_apt_update', { ...this.b(tenant, client, actor), p_id: this.id(id), p_version: this.version(version), p_key: this.key(idempotencyKey), p_fields: fields });
  }
  reschedule(tenant: string, client: string, actor: string, id: unknown, version: unknown, idempotencyKey: unknown, input: { startsAt: unknown; endsAt: unknown; timezone: unknown; staffUid?: unknown }) {
    if (typeof input?.timezone !== 'string' || (input.staffUid !== undefined && typeof input.staffUid !== 'string')) throw new AppointmentStoreError('APPOINTMENT_INPUT_INVALID', 400);
    return this.call('taxguard_apt_reschedule', { ...this.b(tenant, client, actor), p_id: this.id(id), p_version: this.version(version), p_key: this.key(idempotencyKey),
      p_input: { startsAt: this.iso(input.startsAt), endsAt: this.iso(input.endsAt), timezone: input.timezone, ...(input.staffUid !== undefined ? { staffUid: input.staffUid } : {}) } });
  }
  transition(tenant: string, client: string, actor: string, id: unknown, version: unknown, idempotencyKey: unknown, action: unknown, reason?: unknown) {
    if (typeof action !== 'string' || !['confirm', 'complete', 'no_show', 'cancel'].includes(action) || (reason !== undefined && typeof reason !== 'string'))
      throw new AppointmentStoreError('APPOINTMENT_INPUT_INVALID', 400);
    return this.call('taxguard_apt_transition', { ...this.b(tenant, client, actor), p_id: this.id(id), p_version: this.version(version), p_key: this.key(idempotencyKey),
      p_action: action, p_reason: reason ?? null });
  }
}
