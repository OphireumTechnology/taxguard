import { AuthorityError } from './taxguard/authority.repository';

export async function listOwnSessions(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_SESSION_STORE_UNAVAILABLE', 503);
}
export async function revokeOwnSession(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_SESSION_STORE_UNAVAILABLE', 503);
}
export async function revokeOtherOwnSessions(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_SESSION_STORE_UNAVAILABLE', 503);
}
export async function revokeMemberSessions(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_SESSION_STORE_UNAVAILABLE', 503);
}
export async function listOwnSecurityEvents(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_SESSION_STORE_UNAVAILABLE', 503);
}
