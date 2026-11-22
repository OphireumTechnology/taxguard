const STAFF_MFA_ROLES = new Set([
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

const ASSURANCE_LEVEL = new WeakMap<object, string>();

export function requiresStaffMfa(role: string | undefined): boolean {
  if (!role) return false;
  return STAFF_MFA_ROLES.has(role);
}

export function attachSessionAssuranceLevel(user: object, level: string): void {
  if (user && typeof user === 'object') {
    ASSURANCE_LEVEL.set(user, level);
  }
}

export function sessionAssuranceLevel(user: any): string {
  if (!user || typeof user !== 'object') return 'aal1';
  return ASSURANCE_LEVEL.get(user) || user.assuranceLevel || 'aal1';
}
