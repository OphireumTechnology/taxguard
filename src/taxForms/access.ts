/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function canReadTaxFormsLibrary(currentUser: any, _authLifecycleState?: string): boolean {
  if (!currentUser) return false;
  const role = currentUser.role;
  const staffRoles = [
    'accountant',
    'senior_reviewer',
    'reviewer',
    'bookkeeper',
    'practice_manager',
    'operations',
    'admin',
    'super_admin',
    'super_administrator',
    'staff'
  ];
  return staffRoles.includes(role) || (typeof role === 'string' && role !== 'client');
}
