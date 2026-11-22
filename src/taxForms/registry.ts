import type { CapabilityEntry, CapabilityKey, LibraryGroupId, StateJurisdiction } from './types';

export interface FormView {
  id: string;
  code: string;
  formNumber?: string;
  title: string;
  officialName?: string;
  schedules?: string[];
  description?: string;
  groups: LibraryGroupId[];
  taxYears: number[];
  readiness: string;
  officialUrl?: string;
  capabilities: Record<CapabilityKey, CapabilityEntry>;
  [key: string]: any;
}

export interface LibraryCatalog {
  version: string;
  updatedAt: string;
  taxYears: number[];
  disclaimer?: string;
  coreCategories?: Array<{ id: LibraryGroupId; title: string; scope: string }>;
  groups: Array<{ id: LibraryGroupId; label: string; description?: string }>;
  federalForms: FormView[];
  states: StateJurisdiction[];
  [key: string]: any;
}

const DEFAULT_CAPS: Record<CapabilityKey, CapabilityEntry> = {
  dataEntry: { status: 'prototype' },
  calculation: { status: 'prototype' },
  validation: { status: 'available' },
  pdf: { status: 'not_implemented' },
  reviewReady: { status: 'prototype' },
  efile: { status: 'blocked', note: 'External filing disabled' },
  filingReady: { status: 'blocked', note: 'Requires formal authorization' },
};

export const DEFAULT_TAX_FORMS_CATALOG: LibraryCatalog = {
  version: '2025.1',
  updatedAt: '2026-01-15T00:00:00Z',
  taxYears: [2025, 2024, 2023],
  coreCategories: [],
  groups: [
    { id: 'individual-1040', label: 'Individual (1040)' },
    { id: 'estates-trusts-1041', label: 'Estates & Trusts (1041)' },
    { id: 'partnerships-1065', label: 'Partnerships (1065)' },
    { id: 'c-corporations-1120', label: 'C-Corporations (1120)' },
    { id: 's-corporations-1120s', label: 'S-Corporations (1120-S)' },
    { id: 'nonprofits-990', label: 'Tax-Exempt (990)' },
    { id: 'estate-tax-706', label: 'Estate Tax (706)' },
    { id: 'gift-tax-709', label: 'Gift Tax (709)' },
  ],
  federalForms: [
    {
      id: 'f1040',
      code: 'Form 1040',
      formNumber: '1040',
      title: 'U.S. Individual Income Tax Return',
      officialName: 'U.S. Individual Income Tax Return',
      schedules: ['Schedule A', 'Schedule B', 'Schedule C', 'Schedule D', 'Schedule E'],
      description: 'Primary federal individual income tax return.',
      groups: ['individual-1040'],
      taxYears: [2025, 2024, 2023],
      readiness: 'Cataloged / Reference Only',
      officialUrl: 'https://www.irs.gov/forms-pubs/about-form-1040',
      capabilities: DEFAULT_CAPS,
    },
    {
      id: 'f1120s',
      code: 'Form 1120-S',
      formNumber: '1120-S',
      title: 'U.S. Income Tax Return for an S Corporation',
      officialName: 'U.S. Income Tax Return for an S Corporation',
      schedules: ['Schedule K-1', 'Schedule L', 'Schedule M-1', 'Schedule M-2'],
      description: 'Federal return for qualifying S-Corporations including Schedule K-1.',
      groups: ['s-corporations-1120s'],
      taxYears: [2025, 2024, 2023],
      readiness: 'Cataloged / Reference Only',
      officialUrl: 'https://www.irs.gov/forms-pubs/about-form-1120-s',
      capabilities: DEFAULT_CAPS,
    },
    {
      id: 'f1065',
      code: 'Form 1065',
      formNumber: '1065',
      title: 'U.S. Return of Partnership Income',
      officialName: 'U.S. Return of Partnership Income',
      schedules: ['Schedule K-1', 'Schedule L', 'Schedule M-1', 'Schedule M-2'],
      description: 'Information return reporting partnership income, deductions, and K-1 allocations.',
      groups: ['partnerships-1065'],
      taxYears: [2025, 2024, 2023],
      readiness: 'Cataloged / Reference Only',
      officialUrl: 'https://www.irs.gov/forms-pubs/about-form-1065',
      capabilities: DEFAULT_CAPS,
    },
    {
      id: 'f1120',
      code: 'Form 1120',
      formNumber: '1120',
      title: 'U.S. Corporation Income Tax Return',
      officialName: 'U.S. Corporation Income Tax Return',
      schedules: ['Schedule C', 'Schedule J', 'Schedule L', 'Schedule M-1'],
      description: 'Federal corporate income tax return for domestic C-Corporations.',
      groups: ['c-corporations-1120'],
      taxYears: [2025, 2024, 2023],
      readiness: 'Cataloged / Reference Only',
      officialUrl: 'https://www.irs.gov/forms-pubs/about-form-1120',
      capabilities: DEFAULT_CAPS,
    },
  ],
  states: [
    {
      code: 'SC',
      name: 'South Carolina',
      agencyName: 'South Carolina Department of Revenue',
      agencyUrl: 'https://dor.sc.gov',
      categories: {
        'individual-income': { applicability: 'applies', forms: ['SC1040'] },
        'corporate-income': { applicability: 'applies', forms: ['SC1120', 'SC1120S'] },
        'partnership-pte': { applicability: 'applies', forms: ['SC1065'] },
        fiduciary: { applicability: 'applies', forms: ['SC1041'] },
        'sales-use': { applicability: 'applies', forms: ['ST-3'] },
        'payroll-withholding': { applicability: 'applies', forms: ['WH-1605', 'WH-1606'] },
      },
    },
    {
      code: 'GA',
      name: 'Georgia',
      agencyName: 'Georgia Department of Revenue',
      agencyUrl: 'https://dor.georgia.gov',
      categories: {
        'individual-income': { applicability: 'applies', forms: ['Form 500'] },
        'corporate-income': { applicability: 'applies', forms: ['Form 600', 'Form 600S'] },
        'partnership-pte': { applicability: 'applies', forms: ['Form 700'] },
        fiduciary: { applicability: 'applies', forms: ['Form 501'] },
        'sales-use': { applicability: 'applies', forms: ['ST-3'] },
        'payroll-withholding': { applicability: 'applies', forms: ['G-7'] },
      },
    },
  ],
};
