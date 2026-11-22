import { AuthorityError } from './taxguard/authority.repository';

export async function changeStaffMembershipStatus(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_MEMBERSHIP_STORE_UNAVAILABLE', 503);
}
