import { createFailClosedRouter } from './_failClosedRouter';
export function createLegalMattersRouter() {
  return createFailClosedRouter('LEGAL_MATTERS_DURABLE');
}
