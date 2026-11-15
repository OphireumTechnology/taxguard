import type { CapabilityKey, LibraryGroupId, StateJurisdiction, StateTaxCategoryId } from './types';

export interface FormCapabilityState {
  status: 'available' | 'prototype' | 'not_implemented' | 'blocked';
  note: string;
}

export interface FormView {
  id: string;
  formNumber: string;
  officialName: string;
  groups: LibraryGroupId[];
  taxYears: number[];
  entityCategory: string;
  classification: string;
  officialSourceUrl: string;
  instructionsNote: string;
  source: { status: string; method: string; checkedOn?: string };
  readiness: string;
  preparation: string;
  schedules: string[];
  requiredDocuments: string[];
  notes?: string;
  capabilities: Record<CapabilityKey, FormCapabilityState>;
  versionHistory: Array<{ taxYear: number; revision?: string; note: string }>;
}

export interface LibraryCatalog {
  disclaimer?: string;
  federalForms: FormView[];
  states: StateJurisdiction[];
  groups: Array<{ id: LibraryGroupId; label: string }>;
  coreCategories: Array<{ id: LibraryGroupId; label: string; title?: string; scope?: string }>;
  catalogTaxYears: number[];
  stateCategories: Array<{ id: StateTaxCategoryId; label: string }>;
  preparationPipeline: Array<{
    id: string;
    label: string;
    workflowStages: number[];
    status: string;
    evidence: string;
  }>;
}
