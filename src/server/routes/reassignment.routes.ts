import { createFailClosedRouter } from './_failClosedRouter';
export function createReassignmentRouter() {
  return createFailClosedRouter('REASSIGNMENT_DURABLE');
}
