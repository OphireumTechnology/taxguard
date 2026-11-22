/**
 * TaxGuard AI Tax Forms Library: shared types.
 *
 * A library entry is reference information. Appearing in the library never means TaxGuard can
 * prepare, calculate, render or file the form: every entry carries explicit capability states
 * derived from what the codebase actually implements (see capabilities.ts).
 */
export const CATALOG_TAX_YEARS = [2022, 2023, 2024, 2025] as const;
export type CatalogTaxYear = (typeof CATALOG_TAX_YEARS)[number];

export type LibraryGroupId =
  | 'individual-1040' | 'estates-trusts-1041' | 'partnerships-1065' | 'c-corporations-1120' | 's-corporations-1120s'
  | 'nonprofits-990' | 'estate-tax-706' | 'gift-tax-709' | 'payroll-employment' | 'information-returns'
  | 'international' | 'credits-deductions-schedules' | 'extensions-amendments' | 'federal-authorizations'
  | 'state-local' | 'search-reference';

export type FormClassification =
  | 'original' | 'amended' | 'extension' | 'supporting' | 'information' | 'payroll' | 'estimated' | 'authorization';

export type EntityCategory =
  | 'individual' | 'estate-trust' | 'partnership' | 'c-corporation' | 's-corporation' | 'exempt-organization'
  | 'decedent-estate' | 'donor' | 'employer' | 'payer' | 'any-taxpayer';

/** Ordered readiness ladder. A form's label is the highest step whose capability (and every earlier one) is available. */
export const READINESS_LADDER = [
  'Cataloged / Reference Only',
  'Official Source Verified',
  'Data Entry Supported',
  'Calculation Supported',
  'Validation Supported',
  'PDF Generation Supported',
  'Review Ready',
  'E-File Integration Available',
  'Filing Ready',
] as const;
export type ReadinessLabel = (typeof READINESS_LADDER)[number];
export const BLOCKED_LABEL = 'Blocked / Not Implemented';

export type CapabilityKey = 'dataEntry' | 'calculation' | 'validation' | 'pdf' | 'reviewReady' | 'efile' | 'filingReady';
/** available: operational and authoritative. prototype: code exists but is not authoritative and must not be relied on. */
export type CapabilityStatus = 'available' | 'prototype' | 'not_implemented' | 'blocked';
export interface CapabilityState { status: CapabilityStatus; note: string }

export interface SourceVerification {
  status: 'verified' | 'partially_verified' | 'unverified';
  /** How it was checked, e.g. official page title fetched. */
  method: string;
  /** ISO date of the check; null when never checked. */
  checkedOn: string | null;
}

export interface VersionEntry { taxYear: number; revision: string | null; note: string }

export interface FederalForm {
  id: string;
  formNumber: string;
  officialName: string;
  jurisdiction: 'FEDERAL';
  groups: LibraryGroupId[];
  entityCategory: EntityCategory;
  classification: FormClassification;
  taxYears: number[];
  officialSourceUrl: string;
  /** Instructions are linked from the official source page; no separate URL is asserted. */
  instructionsNote: string;
  schedules: string[];
  /** TaxGuard preparation checklist (not an IRS publication). */
  requiredDocuments: string[];
  source: SourceVerification;
  capabilities: Record<CapabilityKey, CapabilityState>;
  versionHistory: VersionEntry[];
  notes?: string;
}

export type StateTaxCategoryId =
  | 'individual-income' | 'individual-amended-extension-estimated' | 'corporate-income' | 's-corporation'
  | 'partnership' | 'pass-through-entity' | 'franchise-gross-receipts' | 'sales-use' | 'employer-withholding'
  | 'unemployment-insurance' | 'fiduciary-income' | 'estate-tax' | 'inheritance-tax' | 'gift-tax' | 'local-taxes';

export type Applicability = 'applies' | 'limited' | 'does-not-apply' | 'not-confirmed';
export interface CategoryApplicability {
  applicability: Applicability;
  note?: string;
  /** Tax-year specific applicability; overrides `applicability` for listed years. */
  byYear?: Partial<Record<number, Applicability>>;
}

export interface StateJurisdiction {
  code: string;
  name: string;
  agencyName: string;
  agencyUrl: string;
  agencyCheck: { result: 'reachable' | 'bot-protected' | 'unreachable-from-environment' | 'error'; checkedOn: string };
  categories: Record<StateTaxCategoryId, CategoryApplicability>;
  /** Applicability is reference information pending verification with the agency. */
  verification: SourceVerification;
}
