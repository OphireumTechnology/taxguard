import { AuthorityError } from './taxguard/authority.repository';

export async function listStaffMembers(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_DIRECTORY_UNAVAILABLE', 503);
}
export async function listStaffInvitations(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_DIRECTORY_UNAVAILABLE', 503);
}
