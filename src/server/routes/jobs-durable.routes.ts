import { createServiceUnavailableRouter } from './_durableFallback';
export function createJobsRouter() {
  return createServiceUnavailableRouter('JOBS_STORE');
}
