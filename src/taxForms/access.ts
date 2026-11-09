export function canReadTaxFormsLibrary(
  user: { role?: string; status?: string } | null | undefined,
  _authLifecycleState?: string
): boolean {
  if (!user) {
    return false;
  }

  const staffRoles = new Set([
    'accountant',
    'tax_preparer',
    'cpa',
    'senior_reviewer',
    'reviewer',
    'bookkeeper',
    'practice_manager',
    'operations',
    'admin',
    'super_admin',
    'super_administrator'
  ]);

  return Boolean(user.role && staffRoles.has(user.role.toLowerCase()));
}
