import { createFailClosedRouter } from './_failClosedRouter';
export function createScanCallbackRouter(_options?: Record<string, unknown>) {
  return createFailClosedRouter('VAULT_SCAN_CALLBACK', { requireAuth: false });
}
