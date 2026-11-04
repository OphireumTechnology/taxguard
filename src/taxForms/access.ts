import type { User } from '../types';

export function canReadTaxFormsLibrary(user: User | null | undefined, authState?: string): boolean {
  if (!user) return false;
  const staffRoles = ['accountant', 'reviewer', 'senior_reviewer', 'bookkeeper', 'practice_manager', 'operations', 'admin', 'super_admin', 'super_administrator'];
  return staffRoles.includes(user.role);
}
