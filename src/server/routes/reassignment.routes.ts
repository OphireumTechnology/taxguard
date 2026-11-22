import { createServiceUnavailableRouter } from './_durableFallback';
export function createReassignmentRouter() {
  return createServiceUnavailableRouter('REASSIGNMENT_STORE');
}
