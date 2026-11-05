import type { AuthLifecycleState } from '../supabase/auth';

const STAFF_ROLES = new Set([
  'accountant',
  'senior_reviewer',
  'reviewer',
  'bookkeeper',
  'practice_manager',
  'operations',
  'admin',
  'super_admin',
  'super_administrator',
  'staff'
]);

export function canReadTaxFormsLibrary(
  user: { role?: string } | null | undefined,
  _authLifecycleState?: AuthLifecycleState
): boolean {
  if (!user?.role) return false;
  return STAFF_ROLES.has(user.role.toLowerCase());
}
