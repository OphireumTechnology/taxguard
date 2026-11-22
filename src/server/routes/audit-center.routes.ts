import { createServiceUnavailableRouter } from './_durableFallback';
export function createAuditCenterRouter() {
  return createServiceUnavailableRouter('AUDIT_CENTER_STORE');
}
