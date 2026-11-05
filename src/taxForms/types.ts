/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CapabilityKey =
  | 'dataEntry'
  | 'calculation'
  | 'validation'
  | 'pdf'
  | 'reviewReady'
  | 'efile'
  | 'filingReady';

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
  | 'state-local'
  | 'search-reference'
  | (string & {});

export type StateTaxCategoryId =
  | 'individual-income'
  | 'corporate-income'
  | 'pass-through-entity'
  | 'sales-and-use'
  | 'franchise-tax'
  | (string & {});

export interface StateCategoryApplicability {
  applicability: Applicability;
  note?: string;
  byYear?: Record<number, Applicability>;
}

export interface StateJurisdiction {
  code: string;
  name: string;
  agencyName: string;
  agencyUrl?: string;
  agencyCheck?: {
    checkedOn: string;
    result: string;
  };
  verification?: {
    method: string;
  };
  categories: Record<string, StateCategoryApplicability>;
}

export const BLOCKED_LABEL = 'Blocked / Not Supported';

export const READINESS_LADDER = [
  'Cataloged / Reference Only',
  'Field Mapped',
  'Calculation Certified',
  'Validation Enforced',
  'PDF Generation',
  'E-File Verified',
  'Filing Ready'
] as const;
