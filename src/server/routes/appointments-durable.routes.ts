import { createServiceUnavailableRouter } from './_durableFallback';
export function createSchedulingRouter() {
  return createServiceUnavailableRouter('SCHEDULING_STORE');
}
