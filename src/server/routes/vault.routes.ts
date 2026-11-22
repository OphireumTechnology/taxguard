import { createServiceUnavailableRouter } from './_durableFallback';
export function createVaultRouter(_options?: Record<string, any>) {
  return createServiceUnavailableRouter('VAULT_STORE');
}
