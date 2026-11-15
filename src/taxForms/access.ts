import { canAccessStaffWorkspace } from '../config/canonicalRouting';

export function canReadTaxFormsLibrary(
  user: { role?: string; status?: string } | null | undefined,
  authLifecycleState: string
): boolean {
  if (!user || authLifecycleState !== 'AUTHENTICATED' || user.status !== 'active') return false;
  return canAccessStaffWorkspace(user.role);
}
