/**
 * Durable Stage 01 onboarding over the proposal 20261018030000 service RPCs. The database derives every
 * requirement (identity document, duplicates, consent version) itself; this layer only maps errors.
 */
import type { PracticeRpcClient } from '../practice/practiceStore';

export class OnboardingError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}
const STATUS: Record<string, number> = {
  ONBOARDING_CLIENT_REQUIRED: 403, PRACTICE_ACCESS_DENIED: 403, PRACTICE_MANAGER_REQUIRED: 403, ONBOARDING_SELF_DECISION: 403, CLIENT_NOT_FOUND: 404,
  ONBOARDING_VERSION_CONFLICT: 409, ONBOARDING_NOT_EDITABLE: 409, ONBOARDING_NOT_SUBMITTED: 409, ONBOARDING_BUSY: 409,
  ONBOARDING_INCOMPLETE: 422, ONBOARDING_CONSENT_NOT_APPROVED: 422, ONBOARDING_IDENTITY_DOCUMENT_REQUIRED: 422,
  ONBOARDING_DUPLICATE_REVIEW_REQUIRED: 422, ONBOARDING_REASON_REQUIRED: 422,
};
const statusOf = (code: string) => STATUS[code] ?? 400;
const revision = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : -1);

export interface OnboardingFields {
  taxpayerType?: string | null; legalName?: string | null; street?: string | null; city?: string | null; state?: string | null; postalCode?: string | null;
  repName?: string | null; repTitle?: string | null; tinType?: string | null; tinLast4?: string | null;
}

export class OnboardingStore {
  constructor(private readonly client: PracticeRpcClient) {}
  private async call<T = any>(name: string, args: Record<string, unknown>): Promise<T> {
    let response;
    try { response = await this.client.rpc(name, args); } catch { throw new OnboardingError('ONBOARDING_UNAVAILABLE', 503); }
    if (response?.error) {
      const { code, message } = response.error;
      if (code === '55P03' || code === '40001' || code === '40P01') throw new OnboardingError('ONBOARDING_BUSY', 409);
      if (code === 'P0001' && typeof message === 'string' && /^[A-Z_]{3,64}$/.test(message)) throw new OnboardingError(message, statusOf(message));
      throw new OnboardingError('ONBOARDING_UNAVAILABLE', 503);
    }
    return response?.data as T;
  }
  get(tenant: string, client: string, actor: string) { return this.call('taxguard_onb_get', { p_tenant: tenant, p_client: client, p_actor: actor }); }
  save(tenant: string, client: string, actor: string, rev: unknown, fields: unknown) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new OnboardingError('ONBOARDING_INPUT_INVALID', 400);
    return this.call('taxguard_onb_save', { p_tenant: tenant, p_client: client, p_actor: actor, p_revision: revision(rev), p_fields: fields });
  }
  submit(tenant: string, client: string, actor: string, rev: unknown, consentVersion: unknown, signer: unknown) {
    return this.call('taxguard_onb_submit', { p_tenant: tenant, p_client: client, p_actor: actor, p_revision: revision(rev),
      p_consent_version: typeof consentVersion === 'string' ? consentVersion : null, p_signer: typeof signer === 'string' ? signer : null });
  }
  decide(tenant: string, client: string, actor: string, rev: unknown, decision: unknown, input: { clientReason?: unknown; internalNote?: unknown; duplicateOverride?: unknown }) {
    if (decision !== 'approve' && decision !== 'request_changes') throw new OnboardingError('ONBOARDING_INPUT_INVALID', 400);
    const text = (v: unknown) => (typeof v === 'string' ? v : null);
    return this.call('taxguard_onb_decide', { p_tenant: tenant, p_client: client, p_actor: actor, p_revision: revision(rev), p_decision: decision,
      p_client_reason: text(input.clientReason), p_internal_note: text(input.internalNote), p_duplicate_override: input.duplicateOverride === true });
  }
  queue(tenant: string, actor: string) { return this.call('taxguard_onb_queue', { p_tenant: tenant, p_actor: actor }); }
  /** Stage 02 gate: true only when the server recorded this client's onboarding as completed. */
  async clientReady(tenant: string, client: string) { return (await this.call<boolean>('taxguard_onb_client_ready', { p_tenant: tenant, p_client: client })) === true; }
}
