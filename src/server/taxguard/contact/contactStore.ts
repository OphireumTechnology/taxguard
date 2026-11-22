/**
 * Contract C8: server-backed contact intake over the proposal-20261016050000 RPCs, PREPARED BUT
 * DISABLED. The database refuses every submission (CONTACT_INTAKE_NOT_APPROVED) until the practice
 * records an approved intake policy (retention, consent version, abuse limits). Nothing here sends
 * e-mail or SMS, and no response claims a message was delivered.
 */
import { createHash } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';
import { clientFingerprint } from '../consultations/consultationStore';

export class ContactIntakeError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { CONTACT_INTAKE_NOT_APPROVED: 503, CONTACT_INTAKE_UNAVAILABLE: 503, CONTACT_RATE_LIMITED: 429, CONTACT_CONSENT_REQUIRED: 422,
  IDEMPOTENCY_KEY_REUSED: 409, CONTACT_MANAGER_REQUIRED: 403 };
const KEY = /^[A-Za-z0-9_.:-]{8,80}$/;
export const CONTACT_TOPICS = ['INDIVIDUAL_TAX', 'BUSINESS_TAX', 'TAX_PLANNING', 'BOOKKEEPING', 'IRS_NOTICE', 'OTHER'] as const;

export class ContactStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new ContactIntakeError('CONTACT_INTAKE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new ContactIntakeError(message, STATUS[message] ?? 400);
      throw new ContactIntakeError('CONTACT_INTAKE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }

  /** Public submission. Only whitelisted fields reach the database; the response never echoes stored data. */
  submit(tenant: string, idempotencyKey: unknown, address: string, input: unknown) {
    if (typeof idempotencyKey !== 'string' || !KEY.test(idempotencyKey)) throw new ContactIntakeError('IDEMPOTENCY_KEY_REQUIRED', 400);
    const i = input as Record<string, unknown>;
    const str = (v: unknown, max: number) => typeof v === 'string' && v.length <= max;
    if (!i || typeof i !== 'object' || Array.isArray(i) || !str(i.fullName, 120) || !str(i.email, 254) || (i.phone !== undefined && !str(i.phone, 32))
      || !(CONTACT_TOPICS as readonly string[]).includes(String(i.topic)) || !str(i.message, 2000) || !str(i.consentVersion, 32))
      throw new ContactIntakeError('CONTACT_INPUT_INVALID', 400);
    if (i.consent !== true) throw new ContactIntakeError('CONTACT_CONSENT_REQUIRED', 422);
    const id = 'ctm_' + createHash('sha256').update(['ctm', tenant, idempotencyKey].join('|')).digest('hex').slice(0, 32);
    return this.call<{ received: true; reference: string; replayed: boolean }>('taxguard_contact_submit', { p_tenant: tenant, p_id: id, p_key: idempotencyKey,
      p_fingerprint: clientFingerprint(tenant, address), p_input: { fullName: i.fullName, email: i.email, ...(i.phone ? { phone: i.phone } : {}), topic: i.topic,
        message: i.message, consent: true, consentVersion: i.consentVersion } });
  }
  list(tenant: string, actor: string, limit = 50) { return this.call<any[]>('taxguard_contact_list', { p_tenant: tenant, p_actor: actor, p_limit: limit }); }
  purgeExpired(tenant: string) { return this.call<number>('taxguard_contact_purge_expired', { p_tenant: tenant }); }
}
