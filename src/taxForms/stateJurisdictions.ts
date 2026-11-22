import type { Applicability, StateJurisdiction, StateTaxCategoryId } from './types';

export const STATE_TAX_CATEGORIES: Array<{ id: StateTaxCategoryId; label: string }> = [
  { id: 'individual-income', label: 'Individual Income Tax' },
  { id: 'corporate-income', label: 'Corporate Income Tax' },
  { id: 's-corporation', label: 'S Corporation' },
  { id: 'partnership', label: 'Partnership' },
  { id: 'pass-through-entity', label: 'Pass-Through Entity Tax (PTET)' },
  { id: 'sales-use', label: 'Sales & Use Tax' },
  { id: 'employer-withholding', label: 'Employer Withholding' },
];

const defaultCategories: StateJurisdiction['categories'] = {
  'individual-income': { applicability: 'applies' },
  'individual-amended-extension-estimated': { applicability: 'applies' },
  'corporate-income': { applicability: 'applies' },
  's-corporation': { applicability: 'applies' },
  partnership: { applicability: 'applies' },
  'pass-through-entity': { applicability: 'applies' },
  'franchise-gross-receipts': { applicability: 'limited' },
  'sales-use': { applicability: 'applies' },
  'employer-withholding': { applicability: 'applies' },
  'unemployment-insurance': { applicability: 'applies' },
  'fiduciary-income': { applicability: 'applies' },
  'estate-tax': { applicability: 'does-not-apply' },
  'inheritance-tax': { applicability: 'does-not-apply' },
  'gift-tax': { applicability: 'does-not-apply' },
  'local-taxes': { applicability: 'limited' },
};

export const STATE_JURISDICTIONS: StateJurisdiction[] = [
  {
    code: 'SC',
    name: 'South Carolina',
    agencyName: 'South Carolina Department of Revenue',
    agencyUrl: 'https://dor.sc.gov',
    agencyCheck: { result: 'reachable', checkedOn: '2026-01-15' },
    categories: defaultCategories,
    verification: { status: 'verified', method: 'State agency catalog reference', checkedOn: '2026-01-15' },
  },
];

export function applicabilityFor(
  jurisdiction: StateJurisdiction,
  category: StateTaxCategoryId,
  taxYear?: number
): Applicability {
  const entry = jurisdiction.categories[category];
  if (!entry) return 'not-confirmed';
  if (taxYear && entry.byYear && entry.byYear[taxYear]) {
    return entry.byYear[taxYear] as Applicability;
  }
  return entry.applicability;
}
