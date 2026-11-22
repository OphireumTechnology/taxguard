import type { UserRole } from '../types';

/**
 * Roles that may read the Tax Forms Library (reference data only, no taxpayer data). Clients,
 * prospective clients and recruiters are excluded. Super administrators are included through the
 * administrator superset rule in requireRole and may read it like any administrator; the library
 * offers no preparation or filing action to anyone.
 */
export const TAX_FORMS_LIBRARY_ROLES: UserRole[] = [
  'accountant', 'reviewer', 'senior_reviewer', 'bookkeeper', 'practice_manager', 'operations',
  'consultant', 'managing_consultant', 'founder', 'firm_manager', 'admin', 'administrator',
];

export function canReadTaxFormsLibrary(user: { role?: string; status?: string } | null | undefined, authState: string): boolean {
  if (authState !== 'AUTHENTICATED' || user?.status !== 'active' || !user.role) return false;
  return (TAX_FORMS_LIBRARY_ROLES as string[]).includes(user.role) || user.role === 'super_admin' || user.role === 'super_administrator';
}
