/**
 * Legal-coordination matters over the proposal-042 RPCs (tracking of referrals to independent
 * attorneys; no signatures, filings or transmissions). Scope, staff-only steps, the defined status
 * order, counsel prerequisites, evidence eligibility, versions and idempotency are enforced by the
 * database; this class validates shapes, derives matter IDs and maps codes to HTTP statuses.
 */
import { createHash } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';

export class LegalMatterError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = { LEGAL_ACCESS_DENIED: 403, LEGAL_STAFF_REQUIRED: 403, LEGAL_VERSION_CONFLICT: 409, LEGAL_MATTER_CLOSED: 409, IDEMPOTENCY_KEY_REUSED: 409,
  LEGAL_COUNSEL_REQUIRED: 409, LEGAL_DOCUMENT_NOT_ELIGIBLE: 409, LEGAL_SCOPE_MISMATCH: 422, LEGAL_DISCLAIMER_REQUIRED: 422 };
const publicCode = (code: string) => ({ DOCUMENT_NOT_FOUND: 'LEGAL_CLIENT_NOT_FOUND', DOCUMENT_ACCESS_DENIED: 'LEGAL_ACCESS_DENIED', DOCUMENT_INPUT_INVALID: 'LEGAL_INPUT_INVALID' } as Record<string, string>)[code] ?? code;
const statusOf = (code: string) => STATUS[code] ?? (code.endsWith('_NOT_FOUND') ? 404 : 400);
const KEY = /^[A-Za-z0-9_.:-]{8,80}$/;
export const LEGAL_CATEGORIES = ['estate_trust', 'operating_agreement', 'probate_document', 'court_pleading', 'power_of_attorney'] as const;
/** Version of the statutory disclaimer shown at intake; the database records which one was acknowledged. */
export const LEGAL_DISCLAIMER_VERSION = '2026-10-legal-coordination-1';
export const LEGAL_DISCLAIMER_TEXT = 'A/R Tax Services, LLC provides tax and accounting services. Legal document preparation and legal representation are handled exclusively through independent licensed attorneys. This record tracks a coordination with outside counsel; it is not legal advice and does not sign, file or send any document.';

export class LegalMatterStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new LegalMatterError('LEGAL_STORE_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) { const c = publicCode(message); throw new LegalMatterError(c, statusOf(c)); }
      throw new LegalMatterError('LEGAL_STORE_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  private b(tenant: string, client: string, actor: string) { return { p_tenant: tenant, p_client: client, p_actor: actor }; }
  private key(k: unknown) { if (typeof k !== 'string' || !KEY.test(k)) throw new LegalMatterError('IDEMPOTENCY_KEY_REQUIRED', 400); return k; }
  private version(v: unknown) { if (!Number.isInteger(v) || (v as number) < 1) throw new LegalMatterError('LEGAL_INPUT_INVALID', 400); return v as number; }

  create(tenant: string, client: string, actor: string, idempotencyKey: unknown, input: Record<string, unknown>) {
    const key = this.key(idempotencyKey);
    if (!input || typeof input !== 'object' || !(LEGAL_CATEGORIES as readonly string[]).includes(String(input.category)) || typeof input.title !== 'string')
      throw new LegalMatterError('LEGAL_INPUT_INVALID', 400);
    if (input.disclaimerAcknowledged !== true || input.disclaimerVersion !== LEGAL_DISCLAIMER_VERSION) throw new LegalMatterError('LEGAL_DISCLAIMER_REQUIRED', 422);
    const id = 'lgl_' + createHash('sha256').update(['lgl', tenant, client, actor, key].join('|')).digest('hex').slice(0, 32);
    const allowed = ['category', 'title', 'summary', 'engagementId', 'filingDeadline', 'publicRecordReference', 'disclaimerAcknowledged', 'disclaimerVersion'];
    return this.call('taxguard_legal_create', { ...this.b(tenant, client, actor), p_id: id, p_key: key,
      p_input: Object.fromEntries(Object.entries(input).filter(([k]) => allowed.includes(k))) });
  }
  list(tenant: string, client: string, actor: string) { return this.call<any[]>('taxguard_legal_list', this.b(tenant, client, actor)); }
  update(tenant: string, client: string, actor: string, id: string, version: unknown, idempotencyKey: unknown, fields: unknown) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new LegalMatterError('LEGAL_INPUT_INVALID', 400);
    return this.call('taxguard_legal_update', { ...this.b(tenant, client, actor), p_id: id, p_version: this.version(version), p_key: this.key(idempotencyKey), p_fields: fields });
  }
  transition(tenant: string, client: string, actor: string, id: string, version: unknown, idempotencyKey: unknown, action: unknown, reason?: unknown) {
    if (action !== 'advance' && action !== 'cancel') throw new LegalMatterError('LEGAL_INPUT_INVALID', 400);
    return this.call('taxguard_legal_transition', { ...this.b(tenant, client, actor), p_id: id, p_version: this.version(version), p_key: this.key(idempotencyKey),
      p_action: action, p_reason: typeof reason === 'string' ? reason : null });
  }
  linkDocument(tenant: string, client: string, actor: string, id: string, idempotencyKey: unknown, documentId: unknown, documentVersion: unknown) {
    if (typeof documentId !== 'string' || !/^[A-Za-z0-9_.:-]{1,128}$/.test(documentId)) throw new LegalMatterError('LEGAL_INPUT_INVALID', 400);
    return this.call('taxguard_legal_link_document', { ...this.b(tenant, client, actor), p_id: id, p_document: documentId, p_document_version: this.version(documentVersion),
      p_key: this.key(idempotencyKey) });
  }
}
