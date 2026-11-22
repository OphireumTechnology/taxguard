import { createFailClosedRouter } from './_failClosedRouter';

export function createVaultRouter(_options?: { scanRequests?: () => unknown }) {
  return createFailClosedRouter('VAULT');
}
