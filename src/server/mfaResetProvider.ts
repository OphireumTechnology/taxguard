/**
 * Provider adapter for staff MFA factor reset (proposal 034 job execution).
 *
 * Disabled unless TAXGUARD_MFA_RESET_PROVIDER=supabase-admin is set outside production against a
 * project that is not the protected production project. Built on the installed SDK's typed admin MFA
 * API (@supabase/auth-js 2.117.x: auth.admin.mfa.listFactors({ userId }) and
 * auth.admin.mfa.deleteFactor({ id, userId }); both marked experimental by the SDK). The SDK does
 * not document an "already removed" response, so success is never inferred from a delete call:
 * the worker re-lists factors and only an empty inventory counts as a verified reset.
 * Factor IDs are opaque and are only ever persisted as salted hashes; no secret, QR code, seed or
 * one-time code passes through this adapter.
 */
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isProtectedIdentityDestination } from '../supabase/protectedDestination';
import { cleanSupabaseUrl, getSupabaseAdmin } from './supabase';

export interface ProviderFactor { id: string; status: 'verified' | 'unverified' | string; factorType: string; createdAt: string }
export interface MfaFactorProvider {
  readonly name: string;
  listFactors(uid: string): Promise<ProviderFactor[]>;
  deleteFactor(uid: string, factorId: string): Promise<void>;
}
export class MfaProviderError extends Error {
  constructor(public readonly code: string, public readonly retryable: boolean) { super(code); }
}
const FACTOR_ID = /^[A-Za-z0-9_-]{1,128}$/;
// The SDK's admin MFA calls require UUID user and factor IDs (validateUUID in @supabase/auth-js) and throw
// a plain Error otherwise; reject earlier with a permanent, explicit code.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function requireUuid(value: string) { if (!UUID.test(value)) throw new MfaProviderError('PROVIDER_ID_NOT_UUID', false); }

/** Salted with tenant and user so equal provider IDs never correlate across members. */
export const factorHash = (tenant: string, uid: string, factorId: string) => createHash('sha256').update(`${tenant}|${uid}|${factorId}`).digest('hex');

function classify(error: unknown): MfaProviderError {
  const e = error as { status?: unknown; name?: unknown };
  // Network failures surface as AuthRetryableFetchError (status 0); a status-less error is not an outage.
  if (e?.name === 'AuthRetryableFetchError' || e?.status === 0) return new MfaProviderError('PROVIDER_UNAVAILABLE', true);
  const status = Number(e?.status);
  if (!Number.isFinite(status)) return new MfaProviderError('PROVIDER_REQUEST_INVALID', false);
  if (status === 429 || status >= 500) return new MfaProviderError(status === 429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_UNAVAILABLE', true);
  if (status === 401 || status === 403) return new MfaProviderError('PROVIDER_NOT_AUTHORIZED', false);
  if (status === 404) return new MfaProviderError('PROVIDER_USER_NOT_FOUND', false);
  return new MfaProviderError('PROVIDER_REQUEST_REJECTED', false);
}

export class SupabaseAdminMfaProvider implements MfaFactorProvider {
  readonly name = 'supabase-admin-mfa';
  constructor(private readonly client: SupabaseClient) {}
  async listFactors(uid: string): Promise<ProviderFactor[]> {
    requireUuid(uid);
    let response;
    try { response = await this.client.auth.admin.mfa.listFactors({ userId: uid }); } catch (e) { throw classify(e); }
    if (response.error) throw classify(response.error);
    const factors = response.data?.factors;
    if (!Array.isArray(factors)) throw new MfaProviderError('PROVIDER_RESPONSE_INVALID', true);
    return factors.map(f => {
      if (!f || typeof f.id !== 'string' || !FACTOR_ID.test(f.id) || typeof f.created_at !== 'string' || !Number.isFinite(Date.parse(f.created_at)))
        throw new MfaProviderError('PROVIDER_RESPONSE_INVALID', true);
      return { id: f.id, status: f.status, factorType: String(f.factor_type), createdAt: f.created_at };
    });
  }
  async deleteFactor(uid: string, factorId: string): Promise<void> {
    if (!FACTOR_ID.test(factorId)) throw new MfaProviderError('PROVIDER_RESPONSE_INVALID', false);
    requireUuid(uid); requireUuid(factorId);
    let response;
    try { response = await this.client.auth.admin.mfa.deleteFactor({ id: factorId, userId: uid }); } catch (e) { throw classify(e); }
    // A 404 may mean "already removed" or "never existed"; the caller decides from a fresh inventory.
    if (response.error && Number((response.error as { status?: unknown }).status) !== 404) throw classify(response.error);
  }
}

/** The configured adapter, or null (reset unavailable; members stay suspended and gated). */
export function configuredMfaResetProvider(env: NodeJS.ProcessEnv = process.env, client?: SupabaseClient): MfaFactorProvider | null {
  if (env.NODE_ENV === 'production' || env.TAXGUARD_MFA_RESET_PROVIDER !== 'supabase-admin') return null;
  const url = cleanSupabaseUrl(env.SUPABASE_URL);
  if (!url || isProtectedIdentityDestination(url) || url.includes('cvrlhixxczerytiocxid') || !(env.SUPABASE_SERVICE_ROLE_KEY || '').trim()) return null;
  return new SupabaseAdminMfaProvider(client ?? getSupabaseAdmin());
}
