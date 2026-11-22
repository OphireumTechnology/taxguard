const ALLOWED_ROLES = new Set([
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

export function canReadTaxFormsLibrary(
  user: { role?: string; status?: string } | null | undefined,
  authState?: string
): boolean {
  if (!user) return false;
  if (authState && authState !== 'AUTHENTICATED') return false;
  return user.status === 'active' && Boolean(user.role && ALLOWED_ROLES.has(user.role));
}
