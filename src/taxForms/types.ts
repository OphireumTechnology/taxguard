export type CapabilityKey =
  | 'dataEntry'
  | 'calculation'
  | 'validation'
  | 'pdf'
  | 'reviewReady'
  | 'efile'
  | 'filingReady';

export type CapabilityStatus = 'available' | 'prototype' | 'not_implemented' | 'blocked';

export type Applicability = 'applies' | 'limited' | 'does-not-apply' | 'not-confirmed';

export type LibraryGroupId =
  | 'individual-1040'
  | 'estates-trusts-1041'
  | 'partnerships-1065'
  | 'c-corporations-1120'
  | 's-corporations-1120s'
  | 'nonprofits-990'
  | 'estate-tax-706'
  | 'gift-tax-709'
  | 'state-jurisdictions'
  | 'search-reference'
  | string;

export type StateTaxCategoryId =
  | 'individual-income'
  | 'corporate-income'
  | 'partnership-pte'
  | 'fiduciary'
  | 'sales-use'
  | 'payroll-withholding'
  | string;

export interface CapabilityEntry {
  status: CapabilityStatus;
  note?: string;
}

export interface StateJurisdiction {
  code: string;
  name: string;
  agencyName?: string;
  agencyUrl?: string;
  notes?: string;
  categories: Record<
    string,
    {
      applicability: Applicability;
      byYear?: Record<number, Applicability>;
      forms?: string[];
      note?: string;
      notes?: string;
    }
  >;
  [key: string]: any;
}

export const BLOCKED_LABEL = 'Blocked — External Filing Disabled';

export const READINESS_LADDER = [
  'Cataloged / Reference Only',
  'Schema Mapped',
  'Deterministic Rules Verified',
  'Review Ready',
] as const;
