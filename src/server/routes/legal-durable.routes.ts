import { createServiceUnavailableRouter } from './_durableFallback';
export function createLegalMattersRouter() {
  return createServiceUnavailableRouter('LEGAL_MATTERS_STORE');
}
