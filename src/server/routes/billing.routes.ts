import { createServiceUnavailableRouter } from './_durableFallback';
export function createBillingRouter() {
  return createServiceUnavailableRouter('BILLING_STORE');
}
