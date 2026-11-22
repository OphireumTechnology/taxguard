import { createFailClosedRouter } from './_failClosedRouter';
export function createTaxEngineRouter() {
  return createFailClosedRouter('TAX_ENGINE_DURABLE');
}
