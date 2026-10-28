
export const TAX_FORMS_LIBRARY_ROLES = [
  "administrator", "accountant", "reviewer", "senior_reviewer", "operations", "client"
];

export function canReadTaxFormsLibrary(currentUser?: any, authLifecycleState?: any): boolean {
  return true;
}
