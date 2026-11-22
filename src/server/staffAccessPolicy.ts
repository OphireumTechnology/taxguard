import type { User } from '../types';
import { AuthorityError } from './taxguard/authority.repository';

const ADMIN_ROLES = new Set(['admin', 'administrator', 'super_admin', 'super_administrator', 'practice_admin']);

export function requireStaffAdministrator(actor: User | undefined | null, tenantId: string): void {
  if (!actor) {
    throw new AuthorityError('STAFF_ADMIN_REQUIRED', 403);
  }
  const role = String(actor.role || '').toLowerCase();
  if (!ADMIN_ROLES.has(role)) {
    throw new AuthorityError('STAFF_ADMIN_REQUIRED', 403);
  }
  if (tenantId && actor.tenantId && actor.tenantId !== tenantId) {
    throw new AuthorityError('STAFF_ADMIN_REQUIRED', 403);
  }
}
