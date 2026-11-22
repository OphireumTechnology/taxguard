import { createServiceUnavailableRouter } from './_durableFallback';
export function createOnboardingRouter() {
  return createServiceUnavailableRouter('STAGE_ONE_ONBOARDING');
}
