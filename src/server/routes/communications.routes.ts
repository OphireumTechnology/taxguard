import { createFailClosedRouter } from './_failClosedRouter';
export function createCommunicationsRouter() {
  return createFailClosedRouter('COMMUNICATIONS_DURABLE');
}
