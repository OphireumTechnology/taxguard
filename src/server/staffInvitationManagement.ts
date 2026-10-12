import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import { AuthorityError, safeId } from './taxguard/authority.repository';
import { normalizedInvitationInput, requireStaffAdministrator } from './staffAccessPolicy';
import type { VerifiedSupabaseUser } from './supabase';

export async function createStaffInvitation(client: SupabaseClient, tenantId: string, actor: User, input: unknown) {
  requireStaffAdministrator(actor, tenantId);
  const invitation = normalizedInvitationInput(input);
  const token = randomBytes(32).toString('hex');
  const id = randomUUID();
  const { data, error } = await client.rpc('taxguard_create_staff_invitation', {
    p_tenant: tenantId, p_actor: actor.id, p_id: id,
    p_email: invitation.email, p_role: invitation.role, p_first: invitation.legalFirstName, p_last: invitation.legalLastName,
    p_token_hash: createHash('sha256').update(token).digest('hex'),
  });
  if (error) {
    if (error.code === 'P0001' && error.message === 'INVITATION_RATE_LIMITED') throw new AuthorityError('INVITATION_RATE_LIMITED', 429);
    if (error.code === 'P0001' || error.code === '23505') throw new AuthorityError('INVITATION_CREATION_DENIED', 409);
    throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
  }
  if (!data || data.id !== id || typeof data.expiresAt !== 'string') throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
  // Raw token is returned once to this authenticated administrator. Never send it to audit or email automatically.
  return { id, token, expiresAt: data.expiresAt, delivery: 'administrator_handoff' as const };
}

export async function revokeStaffInvitation(client: SupabaseClient, tenantId: string, actor: User, id: unknown) {
  requireStaffAdministrator(actor, tenantId); safeId(id);
  const { data, error } = await client.rpc('taxguard_revoke_staff_invitation', { p_tenant: tenantId, p_actor: actor.id, p_id: id });
  if (error) throw new AuthorityError(error.code === 'P0001' ? 'INVITATION_REVOCATION_DENIED' : 'STAFF_INVITATION_STORE_UNAVAILABLE', error.code === 'P0001' ? 409 : 503);
  if (data?.status !== 'revoked') throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
  return { status: 'revoked' as const };
}

/** Lookup is authenticated, confirmed-email bound, and uses POST body tokens rather than URL tokens. */
export async function lookupStaffInvitation(client: SupabaseClient, tenantId: string, token: unknown, identity: VerifiedSupabaseUser) {
  safeId(tenantId); safeId(identity.uid);
  if (!identity.emailVerified) throw new AuthorityError('IDENTITY_DENIED', 403);
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new AuthorityError('INVITATION_INVALID', 404);
  const { data, error } = await client.from('taxguard_staff_invitations')
    .select('role,legal_first_name,legal_last_name,expires_at')
    .eq('tenant_id', tenantId).eq('token_hash', createHash('sha256').update(token).digest('hex'))
    .eq('email', identity.email.trim().toLowerCase()).eq('status', 'pending').maybeSingle();
  if (error) throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
  if (!data || !(Date.parse(data.expires_at) > Date.now())) throw new AuthorityError('INVITATION_INVALID', 404);
  return { role: data.role, legalFirstName: data.legal_first_name, legalLastName: data.legal_last_name, expiresAt: data.expires_at };
}
