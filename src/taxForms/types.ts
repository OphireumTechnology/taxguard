export type LibraryGroupId =
  | 'federal-individual'
  | 'federal-business'
  | 'federal-fiduciary'
  | 'federal-information'
  | 'state-local'
  | string;

export type Applicability = 'individual' | 'business' | 'trust' | 'payroll' | 'all' | string;
export type CapabilityKey = 'preparation' | 'review' | 'efile' | 'amendment' | string;
export type StateTaxCategoryId = 'income' | 'sales' | 'franchise' | 'payroll' | 'local' | string;

export interface StateJurisdiction {
  code: string;
  name: string;
  categories: Record<string, { applicability?: Applicability; note?: string; [key: string]: any }>;
  notes?: string;
  [key: string]: any;
}

export const BLOCKED_LABEL = 'Not Commissioned';

export const READINESS_LADDER = [
  'Cataloged',
  'Rules Verified',
  'Draft Preparation',
  'Reviewer Ready',
  'Filing Ready',
] as const;
