import { AuthorityError } from './taxguard/authority.repository';

export async function createStaffInvitation(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
}
export async function lookupStaffInvitation(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
}
export async function revokeStaffInvitation(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_INVITATION_STORE_UNAVAILABLE', 503);
}
