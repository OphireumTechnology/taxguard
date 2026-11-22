import { AuthorityError } from './taxguard/authority.repository';

export async function acceptStaffInvitation(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
}
