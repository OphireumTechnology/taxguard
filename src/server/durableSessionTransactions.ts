import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthorityError, safeId } from './taxguard/authority.repository';
import type { AssuranceLevel } from './staffMfa';
export interface DurableSessionCreation {
  uid: string; tokenHash: string; authTime: number; expiresAt: number;
  aal: AssuranceLevel; verifiedFactorCount: number;
}
const unavailable = () => new AuthorityError('SESSION_STORE_UNAVAILABLE', 503);
function tokenHash(value: unknown): value is string { return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value); }
async function rpc(client: SupabaseClient, name: string, parameters: Record<string, unknown>) {
  let response;
  try { response = await client.rpc(name, parameters); } catch { throw unavailable(); }
  if (response?.error) {
    if (response.error.code === 'P0001') {
      const code = response.error.message;
      if (code === 'SESSION_INPUT_INVALID') throw new AuthorityError(code, 400);
      if (['SESSION_AUTHORITY_DENIED','STAFF_MFA_REQUIRED','STAFF_MFA_ENROLLMENT_REQUIRED','STAFF_MFA_REENROLLMENT_REQUIRED','STAFF_FRESH_SIGN_IN_REQUIRED'].includes(code)) throw new AuthorityError(code, 403);
    }
    throw unavailable();
  }
  return response?.data;
}
/** All proof fields come from verified server identity; raw bearer tokens never enter RPC or audit. */
export async function createDurableSession(client: SupabaseClient, tenantId: string, input: DurableSessionCreation): Promise<void> {
  safeId(tenantId); safeId(input?.uid);
  const now = Date.now();
  if (!tokenHash(input.tokenHash) || !Number.isSafeInteger(input.authTime) || input.authTime <= 0 || input.authTime * 1000 > now + 30_000 ||
    !Number.isSafeInteger(input.expiresAt) || input.expiresAt <= now || input.expiresAt > now + 2 * 60 * 60 * 1000 + 30_000 ||
    !['aal1','aal2'].includes(input.aal) || !Number.isSafeInteger(input.verifiedFactorCount) || input.verifiedFactorCount < 0 || input.verifiedFactorCount > 100) throw new AuthorityError('SESSION_INPUT_INVALID', 400);
  const data = await rpc(client,'taxguard_create_session',{ p_tenant: tenantId,p_uid: input.uid,p_token_hash: input.tokenHash,
    p_auth_time: input.authTime,p_expires_at: input.expiresAt,p_aal: input.aal,p_verified_factor_count: input.verifiedFactorCount });
  if (!data || typeof data !== 'object' || Array.isArray(data) || data.created !== true) throw unavailable();
}
/** Missing/repeated/wrong-tenant revocation is indistinguishable and produces no new audit. */
export async function revokeDurableSession(client: SupabaseClient, tenantId: string, hash: string): Promise<boolean> {
  safeId(tenantId);
  if (!tokenHash(hash)) throw new AuthorityError('SESSION_INPUT_INVALID', 400);
  const data = await rpc(client,'taxguard_revoke_session',{ p_tenant: tenantId,p_token_hash: hash });
  if (!data || typeof data !== 'object' || Array.isArray(data) || typeof data.revoked !== 'boolean') throw unavailable();
  return data.revoked;
}
