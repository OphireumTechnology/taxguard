import { AuthorityError } from './taxguard/authority.repository';

export async function staffOnboardingStatus(..._args: unknown[]): Promise<never> {
  throw new AuthorityError('STAFF_ONBOARDING_STORE_UNAVAILABLE', 503);
}
