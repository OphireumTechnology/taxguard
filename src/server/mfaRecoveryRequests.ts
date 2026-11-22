import { AuthorityError } from './taxguard/authority.repository';

export async function requestMfaRecovery(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('MFA_RECOVERY_STORE_UNAVAILABLE', 503);
}
export async function approveMfaRecovery(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('MFA_RECOVERY_STORE_UNAVAILABLE', 503);
}
