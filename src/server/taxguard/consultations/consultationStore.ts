/**
 * Public consultation requests over the proposal-043 RPCs. Visitors submit requests (never
 * bookings); managers review them and convert approved ones into proposal-040 appointments for an
 * existing client. Validation, abuse limits, lifecycle and audit are enforced by the database; this
 * class validates shapes, derives IDs and the client fingerprint (an HMAC, never the raw address).
 */
import { createHash, createHmac, randomBytes } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';

export class ConsultationError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { CONSULTATION_REVIEWER_REQUIRED: 403, PRACTICE_ACCESS_DENIED: 403, CONSULTATION_RATE_LIMITED: 429, CONSULTATION_VERSION_CONFLICT: 409,
  CONSULTATION_TRANSITION_INVALID: 409, IDEMPOTENCY_KEY_REUSED: 409, CONSULTATION_CONSENT_REQUIRED: 422, CONSULTATION_UNAVAILABLE: 503,
  APPOINTMENT_STAFF_CONFLICT: 409, APPOINTMENT_CLIENT_CONFLICT: 409, APPOINTMENT_STAFF_INVALID: 422, APPOINTMENT_TIME_INVALID: 400, APPOINTMENT_STAFF_REQUIRED: 403 };
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
const KEY = /^[A-Za-z0-9_.:-]{8,80}$/;
export const CONSULTATION_CONSENT_VERSION = '2026-10-consultation-1';
export const CONSULTATION_CONSENT_TEXT = 'I agree that A/R Tax Services may store the contact details and message I submit and use them only to respond to this consultation request. No account is created and no appointment is confirmed until the practice contacts me.';
export const CONSULTATION_TOPICS = ['INDIVIDUAL_TAX', 'BUSINESS_TAX', 'TAX_PLANNING', 'BOOKKEEPING', 'IRS_NOTICE', 'OTHER'] as const;
// Without a configured salt a per-process random salt is used: fingerprints then only correlate within one process lifetime.
const SALT = (process.env.TAXGUARD_CONSULTATION_FINGERPRINT_SALT || '').trim() || randomBytes(32).toString('hex');
export const clientFingerprint = (tenant: string, address: string) => createHmac('sha256', SALT).update(tenant + '|' + address).digest('hex');

export interface ConsultationSubmission { fullName: string; email: string; phone?: string; preferredContact: 'EMAIL' | 'PHONE'; topic: string; modePreference: 'REMOTE' | 'IN_PERSON' | 'PHONE';
  preferredWindows: Array<{ date: string; partOfDay: 'MORNING' | 'AFTERNOON' | 'EVENING' }>; timezone: string; message?: string; consent: boolean; consentVersion: string }

export class ConsultationStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new ConsultationError('CONSULTATION_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new ConsultationError(message, statusOf(message));
      throw new ConsultationError('CONSULTATION_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private key(k: unknown) { if (typeof k !== 'string' || !KEY.test(k)) throw new ConsultationError('IDEMPOTENCY_KEY_REQUIRED', 400); return k; }
  private version(v: unknown) { if (!Number.isInteger(v) || (v as number) < 1) throw new ConsultationError('CONSULTATION_INPUT_INVALID', 400); return v as number; }

  /** Public submission. Only whitelisted fields reach the database; the response never echoes stored data. */
  submit(tenant: string, idempotencyKey: unknown, address: string, input: unknown) {
    const key = this.key(idempotencyKey);
    const i = input as Record<string, unknown>;
    const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
    if (!i || typeof i !== 'object' || Array.isArray(i) || !str(i.fullName, 120) || !str(i.email, 254) || (i.phone !== undefined && !str(i.phone, 32))
      || !['EMAIL', 'PHONE'].includes(String(i.preferredContact)) || !(CONSULTATION_TOPICS as readonly string[]).includes(String(i.topic))
      || !['REMOTE', 'IN_PERSON', 'PHONE'].includes(String(i.modePreference)) || !Array.isArray(i.preferredWindows) || i.preferredWindows.length < 1 || i.preferredWindows.length > 3
      || !str(i.timezone, 64) || (i.message !== undefined && !str(i.message, 1000)))
      throw new ConsultationError('CONSULTATION_INPUT_INVALID', 400);
    if (i.consent !== true || i.consentVersion !== CONSULTATION_CONSENT_VERSION) throw new ConsultationError('CONSULTATION_CONSENT_REQUIRED', 422);
    const windows = (i.preferredWindows as unknown[]).map(w => { const x = w as Record<string, unknown>; return { date: String(x?.date ?? ''), partOfDay: String(x?.partOfDay ?? '') }; });
    const id = 'csr_' + createHash('sha256').update(['csr', tenant, key].join('|')).digest('hex').slice(0, 32);
    return this.call<{ received: true; reference: string; replayed: boolean }>('taxguard_consult_submit', { p_tenant: tenant, p_id: id, p_key: key,
      p_fingerprint: clientFingerprint(tenant, address), p_input: { fullName: i.fullName, email: i.email, ...(i.phone ? { phone: i.phone } : {}), preferredContact: i.preferredContact,
        topic: i.topic, modePreference: i.modePreference, preferredWindows: windows, timezone: i.timezone, ...(i.message ? { message: i.message } : {}),
        consent: true, consentVersion: i.consentVersion } });
  }
  list(tenant: string, actor: string, status?: string, limit?: number) {
    return this.call<any[]>('taxguard_consult_list', { p_tenant: tenant, p_actor: actor, p_status: status ?? null, p_limit: limit ?? 50 });
  }
  decide(tenant: string, actor: string, requestId: string, version: unknown, idempotencyKey: unknown, action: unknown, reason?: unknown) {
    if (!['review', 'decline', 'spam'].includes(String(action))) throw new ConsultationError('CONSULTATION_INPUT_INVALID', 400);
    return this.call('taxguard_consult_decide', { p_tenant: tenant, p_actor: actor, p_request: requestId, p_version: this.version(version), p_key: this.key(idempotencyKey),
      p_action: action, p_reason: typeof reason === 'string' ? reason : null });
  }
  convert(tenant: string, actor: string, requestId: string, version: unknown, idempotencyKey: unknown, clientId: unknown, appointment: unknown) {
    const key = this.key(idempotencyKey);
    if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(clientId) || !appointment || typeof appointment !== 'object' || Array.isArray(appointment))
      throw new ConsultationError('CONSULTATION_INPUT_INVALID', 400);
    const appointmentId = 'apt_' + createHash('sha256').update(['apt-consult', tenant, requestId, key].join('|')).digest('hex').slice(0, 32);
    return this.call('taxguard_consult_convert', { p_tenant: tenant, p_actor: actor, p_request: requestId, p_version: this.version(version), p_key: key, p_client: clientId,
      p_appointment_id: appointmentId, p_appointment: appointment });
  }
}
