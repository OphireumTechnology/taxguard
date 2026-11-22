import { createFailClosedRouter } from './_failClosedRouter';
export function createSchedulingRouter() {
  return createFailClosedRouter('SCHEDULING_DURABLE');
}
