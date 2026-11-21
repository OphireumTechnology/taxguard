import type { AuthLifecycleState } from '../supabase/auth';

const ALLOWED_STAFF_ROLES = new Set([
  'accountant',
  'reviewer',
  'senior_reviewer',
  'bookkeeper',
  'practice_manager',
  'client_service',
  'operations',
  'admin',
  'super_admin',
  'super_administrator',
]);

export function canReadTaxFormsLibrary(
  user: { role?: string; status?: string } | null | undefined,
  authLifecycleState?: AuthLifecycleState | string
): boolean {
  if (!user || user.status !== 'active') return false;
  if (authLifecycleState && authLifecycleState !== 'AUTHENTICATED') return false;
  return Boolean(user.role && ALLOWED_STAFF_ROLES.has(user.role));
}
