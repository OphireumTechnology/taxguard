export type AssuranceLevel = 'aal1' | 'aal2';

const STAFF_MFA_ROLES = new Set([
  'accountant',
  'preparer',
  'bookkeeper',
  'reviewer',
  'senior_reviewer',
  'practice_manager',
  'operations',
  'admin',
  'administrator',
  'super_admin',
  'super_administrator',
]);

const ASSURANCE_MAP = new WeakMap<object, AssuranceLevel>();

export function requiresStaffMfa(role: string | undefined): boolean {
  return Boolean(role && STAFF_MFA_ROLES.has(role));
}

export function attachSessionAssuranceLevel<T extends object>(user: T, level: AssuranceLevel): T {
  ASSURANCE_MAP.set(user, level);
  return user;
}

export function sessionAssuranceLevel(user: unknown): AssuranceLevel | undefined {
  if (!user || typeof user !== 'object') return undefined;
  const recorded = ASSURANCE_MAP.get(user);
  if (recorded) return recorded;
  const maybe = (user as any).aal;
  if (maybe === 'aal1' || maybe === 'aal2') return maybe;
  return undefined;
}
