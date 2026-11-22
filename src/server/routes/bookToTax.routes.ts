import { createServiceUnavailableRouter } from './_durableFallback';
export function createBookToTaxRouter() {
  return createServiceUnavailableRouter('BOOK_TO_TAX_STORE');
}
