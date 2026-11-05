import type { CapabilityKey, LibraryGroupId, StateJurisdiction, StateTaxCategoryId } from './types';

export interface FormCapability {
  status: 'available' | 'prototype' | 'not_implemented' | 'blocked';
  note: string;
}

export interface FormVersion {
  taxYear: number;
  revision?: string;
  note: string;
}

export interface FormView {
  id: string;
  formNumber: string;
  officialName: string;
  groups: LibraryGroupId[];
  taxYears: number[];
  readiness: string;
  preparation: string;
  classification: string;
  entityCategory: string;
  officialSourceUrl: string;
  instructionsNote: string;
  source: {
    status: 'verified' | 'unverified';
    method: string;
    checkedOn?: string;
  };
  schedules: string[];
  requiredDocuments: string[];
  notes?: string;
  capabilities: Record<CapabilityKey, FormCapability>;
  versionHistory: FormVersion[];
}

export interface LibraryGroup {
  id: LibraryGroupId;
  label: string;
}

export interface CoreCategory {
  id: LibraryGroupId;
  title: string;
  scope: string;
}

export interface PreparationPipelineStep {
  id: string;
  label: string;
  workflowStages: number[];
  status: 'operational' | 'prototype' | 'not_implemented' | 'blocked';
  evidence: string;
}

export interface LibraryCatalog {
  disclaimer?: string;
  catalogTaxYears: number[];
  federalForms: FormView[];
  states: StateJurisdiction[];
  groups: LibraryGroup[];
  coreCategories: CoreCategory[];
  stateCategories: { id: StateTaxCategoryId; label: string }[];
  preparationPipeline: PreparationPipelineStep[];
}
