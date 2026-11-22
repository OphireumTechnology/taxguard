import type { User } from '../types';
import { AuthorityError } from './taxguard/authority.repository';

const ADMIN_ROLES = new Set(['admin', 'administrator', 'super_admin', 'super_administrator']);

export function requireStaffAdministrator(actor: User | null | undefined, tenantId?: string): void {
  if (!actor || actor.status !== 'active' || !ADMIN_ROLES.has(actor.role)) {
    throw new AuthorityError('STAFF_ADMINISTRATOR_REQUIRED', 403);
  }
  if (tenantId && actor.tenantId && actor.tenantId !== tenantId) {
    throw new AuthorityError('TENANT_SCOPE_MISMATCH', 403);
  }
}
