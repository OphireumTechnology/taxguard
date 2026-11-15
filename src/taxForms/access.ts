import type { User } from '../types';
import type { AuthLifecycleState } from '../supabase/auth';
import { canAccessStaffWorkspace } from '../config/canonicalRouting';

export function canReadTaxFormsLibrary(
  user: User | null | undefined,
  authLifecycleState: AuthLifecycleState,
): boolean {
  return authLifecycleState === 'AUTHENTICATED' && user?.status === 'active' && canAccessStaffWorkspace(user?.role);
}
