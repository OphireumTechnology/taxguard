import type { AuthenticatedRequest } from './auth';
import { db } from './db';
import { isStaffCurrentlyAssignedToClient } from './assignment-authorization';

/**
 * Shared object-level authorization for legacy (in-memory) routes.
 * Fails closed: an unknown client, a client in another tenant, or a missing tenant denies access.
 */
export const ADMIN_ROLES: ReadonlySet<string> = new Set(['admin', 'administrator', 'super_admin', 'super_administrator']);
export const CLIENT_ROLES: ReadonlySet<string> = new Set(['client', 'prospective_client']);

export function getClientUser(clientId: string) {
  return db.users.get(clientId) ||
    Array.from(db.users.values()).find(user => CLIENT_ROLES.has(user.role) && user.clientId === clientId);
}

/** Staff (incl. administrators) may act on a client only within their own tenant, and non-admins only when assigned. */
export function canAccessStaffClient(
  user: NonNullable<AuthenticatedRequest['user']>,
  clientId: string,
  scope: { engagementId?: string; taxYear?: number; caseId?: string } = {}
): boolean {
  const client = getClientUser(clientId);
  if (!user.tenantId || client?.tenantId !== user.tenantId) return false;
  if (ADMIN_ROLES.has(user.role)) return true;
  return isStaffCurrentlyAssignedToClient({
    userId: user.id,
    tenantId: user.tenantId,
    clientId,
    clientTenantId: client.tenantId,
    assignments: db.getClientBindings(clientId),
    authorizedClientIds: user.authorizedClientIds,
    production: process.env.NODE_ENV === 'production',
    ...scope
  });
}

/** A client may act only on its own client record; staff use canAccessStaffClient. */
export function canAccessClientRecord(user: NonNullable<AuthenticatedRequest['user']>, clientId: string): boolean {
  if (CLIENT_ROLES.has(user.role)) {
    const own = user.clientId || user.id;
    if (own !== clientId) return false;
    const record = getClientUser(clientId);
    return !record?.tenantId || !user.tenantId || record.tenantId === user.tenantId;
  }
  return canAccessStaffClient(user, clientId);
}
