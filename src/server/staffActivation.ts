import { AuthorityError } from './taxguard/authority.repository';

export async function approveStaffActivation(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_ACTIVATION_STORE_UNAVAILABLE', 503);
}
