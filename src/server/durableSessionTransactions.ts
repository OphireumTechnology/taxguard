import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthorityError } from './taxguard/authority.repository';

export interface DurableSessionInput {
  uid: string;
  tokenHash: string;
  authTime: number;
  expiresAt: number;
  aal: 'aal1' | 'aal2';
  verifiedFactorCount: number;
}

export async function createDurableSession(
  client: SupabaseClient,
  tenantId: string,
  input: DurableSessionInput
): Promise<void> {
  const response = await client.rpc('taxguard_create_session', {
    p_tenant: tenantId,
    p_uid: input.uid,
    p_token_hash: input.tokenHash,
    p_auth_time: input.authTime,
    p_expires_at: input.expiresAt,
    p_aal: input.aal,
    p_verified_factor_count: input.verifiedFactorCount,
  });
  if (response?.error) {
    throw new AuthorityError('DURABLE_SESSION_CREATE_FAILED', 503);
  }
}

export async function revokeDurableSession(
  client: SupabaseClient,
  tenantId: string,
  tokenHash: string
): Promise<void> {
  const response = await client.rpc('taxguard_revoke_session', {
    p_tenant: tenantId,
    p_token_hash: tokenHash,
  });
  if (response?.error) {
    throw new AuthorityError('DURABLE_SESSION_REVOKE_FAILED', 503);
  }
}
