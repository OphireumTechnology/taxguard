import { createServiceUnavailableRouter } from './_durableFallback';
export function createCasesRouter() {
  return createServiceUnavailableRouter('CASES_STORE');
}
