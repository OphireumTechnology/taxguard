import { createFailClosedRouter } from './_failClosedRouter';
export function createJobsRouter() {
  return createFailClosedRouter('JOBS_DURABLE');
}
