import { createFailClosedRouter } from './_failClosedRouter';
export function createBookToTaxRouter() {
  return createFailClosedRouter('BOOK_TO_TAX_DURABLE');
}
