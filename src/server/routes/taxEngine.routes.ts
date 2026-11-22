import { createServiceUnavailableRouter } from './_durableFallback';
export function createTaxEngineRouter() {
  return createServiceUnavailableRouter('TAX_ENGINE_STORE');
}
