/**
 * Read-only queries over the Tax Forms Library. No taxpayer data is involved.
 */
import { preparationStatus, readinessLabel } from './capabilities';
import { CORE_RETURN_CATEGORIES, FEDERAL_FORMS } from './federalForms';
import { PREPARATION_PIPELINE } from './preparationPipeline';
import { applicabilityFor, STATE_JURISDICTIONS, STATE_TAX_CATEGORIES } from './stateJurisdictions';
import type { FederalForm, LibraryGroupId, ReadinessLabel, StateJurisdiction } from './types';
import { CATALOG_TAX_YEARS } from './types';

export const LIBRARY_GROUPS: Array<{ id: LibraryGroupId; label: string }> = [
  { id: 'individual-1040', label: 'Individual Tax Returns — 1040' },
  { id: 'estates-trusts-1041', label: 'Estates and Trusts — 1041' },
  { id: 'partnerships-1065', label: 'Partnerships — 1065' },
  { id: 'c-corporations-1120', label: 'C Corporations — 1120' },
  { id: 's-corporations-1120s', label: 'S Corporations — 1120-S' },
  { id: 'nonprofits-990', label: 'Nonprofits — 990' },
  { id: 'estate-tax-706', label: 'Estate Tax — 706' },
  { id: 'gift-tax-709', label: 'Gift Tax — 709' },
  { id: 'payroll-employment', label: 'Payroll and Employment' },
  { id: 'information-returns', label: 'Information Returns' },
  { id: 'international', label: 'International Tax' },
  { id: 'credits-deductions-schedules', label: 'Credits, Deductions, and Supporting Schedules' },
  { id: 'extensions-amendments', label: 'Extensions and Amendments' },
  { id: 'federal-authorizations', label: 'Federal Authorizations' },
  { id: 'state-local', label: 'State and Local Taxes' },
  { id: 'search-reference', label: 'Tax Forms Search and Reference' },
];

export interface FormView extends FederalForm { readiness: ReadinessLabel; preparation: ReturnType<typeof preparationStatus> }

export function formView(form: FederalForm): FormView {
  return { ...form, readiness: readinessLabel(form.source, form.capabilities), preparation: preparationStatus(form.capabilities) };
}

export interface FormQuery { group?: LibraryGroupId; taxYear?: number; text?: string; readiness?: ReadinessLabel }

export function queryFederalForms(q: FormQuery = {}): FormView[] {
  const text = q.text?.trim().toLowerCase();
  return FEDERAL_FORMS.map(formView).filter(f =>
    (!q.group || q.group === 'search-reference' || f.groups.includes(q.group)) &&
    (!q.taxYear || f.taxYears.includes(q.taxYear)) &&
    (!q.readiness || f.readiness === q.readiness) &&
    (!text || [f.formNumber, f.officialName, ...f.schedules].join(' ').toLowerCase().includes(text)));
}

export function queryStates(q: { text?: string; taxYear?: number; category?: string; onlyApplicable?: boolean } = {}): StateJurisdiction[] {
  const text = q.text?.trim().toLowerCase();
  const year = q.taxYear ?? CATALOG_TAX_YEARS[CATALOG_TAX_YEARS.length - 1];
  return STATE_JURISDICTIONS.filter(s =>
    (!text || `${s.code} ${s.name} ${s.agencyName}`.toLowerCase().includes(text)) &&
    (!q.category || !q.onlyApplicable || ['applies', 'limited'].includes(applicabilityFor(s, q.category as any, year))));
}

/** Complete payload served to authorized staff by GET /api/tax-forms (reference data only). */
export function libraryCatalog() {
  return {
    catalogTaxYears: [...CATALOG_TAX_YEARS],
    groups: LIBRARY_GROUPS,
    coreCategories: CORE_RETURN_CATEGORIES,
    federalForms: FEDERAL_FORMS.map(formView),
    stateCategories: STATE_TAX_CATEGORIES,
    states: STATE_JURISDICTIONS,
    preparationPipeline: PREPARATION_PIPELINE,
    disclaimer: 'Reference catalog. Listing a form does not mean TaxGuard can prepare, calculate, render or file it; see each entry’s capability states.',
  };
}
export type LibraryCatalog = ReturnType<typeof libraryCatalog>;
