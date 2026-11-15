import type { User } from '../types';

const STAFF_ROLES = new Set([
  'accountant',
  'reviewer',
  'senior_reviewer',
  'bookkeeper',
  'practice_manager',
  'operations',
  'client_service',
  'admin',
  'super_admin',
  'super_administrator',
]);

export function canReadTaxFormsLibrary(user: User | null, authLifecycleState: string): boolean {
  return authLifecycleState === 'AUTHENTICATED' && user?.status === 'active' && STAFF_ROLES.has(user.role);
}
