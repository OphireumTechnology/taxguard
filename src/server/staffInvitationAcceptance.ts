import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { VerifiedSupabaseUser } from './supabase';
import { AuthorityError, safeId } from './taxguard/authority.repository';
import { staffMfaDenial } from './staffMfa';

/** No client ID or application session is minted; activation requires a different admin. */
export async function acceptStaffInvitation(client: SupabaseClient, tenantId: string, token: unknown, verified: VerifiedSupabaseUser) {
  safeId(tenantId); safeId(verified.uid);
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new AuthorityError('INVITATION_INVALID', 400);
  if (!verified.emailVerified || !verified.email || !Number.isFinite(verified.authTime) || verified.authTime <= 0) throw new AuthorityError('IDENTITY_DENIED', 403);
  const denial = staffMfaDenial('accountant', verified);
  if (denial) throw new AuthorityError(denial, 403);
  const { data, error } = await client.rpc('taxguard_accept_staff_invitation', {
    p_tenant: tenantId, p_token_hash: createHash('sha256').update(token).digest('hex'),
    p_uid: verified.uid, p_email: verified.email.trim().toLowerCase(),
  });
  if (error) {
    if (error.code === 'P0001') throw new AuthorityError('INVITATION_ACCEPTANCE_DENIED', 403);
    throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
  }
  if (data?.status !== 'pending_approval') throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
  return { status: 'pending_approval' as const };
}
