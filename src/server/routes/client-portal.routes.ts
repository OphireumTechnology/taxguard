import { createServiceUnavailableRouter } from './_durableFallback';
export function createClientPortalRouter() {
  return createServiceUnavailableRouter('CLIENT_PORTAL_STORE');
}
export function createClientSignaturesRouter() {
  return createServiceUnavailableRouter('CLIENT_SIGNATURES_STORE');
}
