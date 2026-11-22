import { createFailClosedRouter } from './_failClosedRouter';
export function createCasesRouter() {
  return createFailClosedRouter('CASES_DURABLE');
}
