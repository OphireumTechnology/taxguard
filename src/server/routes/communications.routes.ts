import { createServiceUnavailableRouter } from './_durableFallback';
export function createCommunicationsRouter() {
  return createServiceUnavailableRouter('COMMUNICATIONS_STORE');
}
