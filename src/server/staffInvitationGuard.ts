import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthorityError } from './taxguard/authority.repository';

/** Before client auto-provisioning, check authoritative invitations, never browser metadata. */
export async function denyInvitedStaffClientProvisioning(client: SupabaseClient, tenantId: string, email: string): Promise<void> {
  const { data, error } = await client.from('taxguard_staff_invitations')
    .select('id').eq('tenant_id', tenantId).eq('email', email.trim().toLowerCase()).limit(1);
  // Missing proposal schema must block provisioning rather than silently turn staff into clients.
  if (error || !Array.isArray(data)) throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
  if (data.length) throw new AuthorityError('STAFF_INVITATION_ACCEPTANCE_REQUIRED', 403);
}
