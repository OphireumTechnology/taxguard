import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import { sessionAssuranceLevel } from './staffMfa';
import { AuthorityError, safeId } from './taxguard/authority.repository';

/** actor must be restored by durable session authentication, never deserialized from the request. */
export async function approveStaffActivation(client: SupabaseClient, deploymentTenant: string, actor: User, targetUid: unknown) {
  safeId(deploymentTenant); safeId(targetUid);
  if (actor.tenantId !== deploymentTenant || actor.status !== 'active' ||
      !['admin', 'administrator', 'super_admin', 'super_administrator'].includes(actor.role) || sessionAssuranceLevel(actor) !== 'aal2') {
    throw new AuthorityError('STAFF_ADMIN_REQUIRED', 403);
  }
  if (actor.id === targetUid) throw new AuthorityError('INDEPENDENT_APPROVER_REQUIRED', 403);
  const { data, error } = await client.rpc('taxguard_approve_staff_activation', {
    p_tenant: deploymentTenant, p_actor: actor.id, p_uid: targetUid,
  });
  if (error) {
    if (error.code === 'P0001') throw new AuthorityError('STAFF_ACTIVATION_DENIED', 403);
    throw new AuthorityError('STAFF_ACTIVATION_STORE_UNAVAILABLE', 503);
  }
  if (data?.status !== 'active') throw new AuthorityError('STAFF_ACTIVATION_STORE_UNAVAILABLE', 503);
  return { status: 'active' as const };
}
