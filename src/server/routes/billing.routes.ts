import { createFailClosedRouter } from './_failClosedRouter';
export function createBillingRouter() {
  return createFailClosedRouter('BILLING_DURABLE');
}
