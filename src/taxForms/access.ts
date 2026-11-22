import type { User } from '../types';
import type { AuthLifecycleState } from '../supabase/auth';

const ALLOWED_STAFF_ROLES = new Set([
  'accountant',
  'bookkeeper',
  'reviewer',
  'senior_reviewer',
  'practice_manager',
  'operations',
  'client_service',
  'admin',
  'administrator',
  'super_admin',
  'super_administrator',
]);

export function canReadTaxFormsLibrary(
  user: User | null | undefined,
  authLifecycleState?: AuthLifecycleState
): boolean {
  if (!user || user.status !== 'active') return false;
  if (authLifecycleState && authLifecycleState !== 'AUTHENTICATED') return false;
  return ALLOWED_STAFF_ROLES.has(user.role);
}
