import { createServiceUnavailableRouter } from './_durableFallback';
export function createPracticeRouter() {
  return createServiceUnavailableRouter('PRACTICE_STORE');
}
