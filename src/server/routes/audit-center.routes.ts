import { createFailClosedRouter } from './_failClosedRouter';
export function createAuditCenterRouter() {
  return createFailClosedRouter('AUDIT_CENTER_DURABLE');
}
