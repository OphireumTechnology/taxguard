import type { SupabaseClient } from '@supabase/supabase-js';
import type { User } from '../types';
import { requireStaffAdministrator } from './staffAccessPolicy';
import { AuthorityError, safeId } from './taxguard/authority.repository';

export type StaffMembershipAction = 'suspend' | 'deactivate' | 'reactivate';
/** The actor is supplied by durable AAL2 session authentication, never the request body. */
export async function changeStaffMembershipStatus(
  client: SupabaseClient, deploymentTenant: string, actor: User, input: unknown
) {
  requireStaffAdministrator(actor, deploymentTenant);
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AuthorityError('STAFF_LIFECYCLE_INPUT_INVALID');
  const value = input as Record<string, unknown>;
  safeId(value.targetUid);
  const targetUid = value.targetUid as string;
  if (actor.id === targetUid) throw new AuthorityError('INDEPENDENT_ACTOR_REQUIRED', 403);
  if (!['suspend', 'deactivate', 'reactivate'].includes(value.action as string)) throw new AuthorityError('STAFF_LIFECYCLE_INPUT_INVALID');
  const action = value.action as StaffMembershipAction;
  const reason = typeof value.reason === 'string' ? value.reason.trim() : '';
  if (!reason || reason.length > 1000 || /[\x00-\x1f\x7f]/.test(reason)) throw new AuthorityError('STAFF_LIFECYCLE_INPUT_INVALID');
  let response;
  try {
    response = await client.rpc('taxguard_change_staff_membership_status', {
      p_tenant: deploymentTenant, p_actor: actor.id, p_uid: targetUid, p_action: action, p_reason: reason
    });
  } catch {
    throw new AuthorityError('STAFF_LIFECYCLE_STORE_UNAVAILABLE', 503);
  }
  if (response.error) {
    if (response.error.code === 'P0001') throw new AuthorityError('STAFF_LIFECYCLE_DENIED', 403);
    throw new AuthorityError('STAFF_LIFECYCLE_STORE_UNAVAILABLE', 503);
  }
  const status = action === 'suspend' ? 'suspended' : action === 'deactivate' ? 'disabled' : 'active';
  if (response.data?.status !== status || !Number.isSafeInteger(response.data?.revokedSessions) || response.data.revokedSessions < 0) {
    throw new AuthorityError('STAFF_LIFECYCLE_STORE_UNAVAILABLE', 503);
  }
  return { status, revokedSessions: response.data.revokedSessions as number };
}
