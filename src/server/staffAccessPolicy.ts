import type { User } from '../types';
import { sessionAssuranceLevel } from './staffMfa';
import { AuthorityError, safeId } from './taxguard/authority.repository';

export const INVITABLE_STAFF_ROLES = ['accountant', 'reviewer', 'senior_reviewer', 'bookkeeper', 'practice_manager', 'operations', 'admin'] as const;
export type InvitableStaffRole = typeof INVITABLE_STAFF_ROLES[number];
export function requireStaffAdministrator(actor: User, tenantId: string): void {
  safeId(tenantId); safeId(actor.id);
  if (actor.tenantId !== tenantId || actor.status !== 'active' || !['admin', 'administrator', 'super_admin', 'super_administrator'].includes(actor.role) || sessionAssuranceLevel(actor) !== 'aal2') {
    throw new AuthorityError('STAFF_ADMIN_REQUIRED', 403);
  }
}
export function normalizedInvitationInput(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new AuthorityError('INVITATION_INPUT_INVALID');
  const value = input as Record<string, unknown>;
  const email = typeof value.email === 'string' ? value.email.trim().toLowerCase() : '';
  if (email.length > 255 || !/^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[^\s@\x00-\x1f]+$/.test(email)) throw new AuthorityError('INVITATION_INPUT_INVALID');
  const name = (key: string) => {
    const result = typeof value[key] === 'string' ? value[key].trim() : '';
    if (!result || result.length > 128 || /[\x00-\x1f\x7f]/.test(result)) throw new AuthorityError('INVITATION_INPUT_INVALID');
    return result;
  };
  if (!INVITABLE_STAFF_ROLES.includes(value.role as InvitableStaffRole)) throw new AuthorityError('INVITATION_ROLE_INVALID');
  return { email, role: value.role as InvitableStaffRole, legalFirstName: name('legalFirstName'), legalLastName: name('legalLastName') };
}
