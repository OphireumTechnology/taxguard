import type {
  Applicability,
  CapabilityKey,
  LibraryGroupId,
  StateJurisdiction,
  StateTaxCategoryId
} from './types';

export interface FormCapabilityDetail {
  status: 'available' | 'prototype' | 'not_implemented' | 'blocked';
  note: string;
}

export interface FormVersionHistoryItem {
  taxYear: number;
  revision?: string;
  note: string;
}

export interface FormView {
  id: string;
  formNumber: string;
  officialName: string;
  classification: string;
  entityCategory: string;
  groups: LibraryGroupId[];
  taxYears: number[];
  readiness: string;
  preparation: string;
  schedules: string[];
  requiredDocuments: string[];
  officialSourceUrl: string;
  instructionsNote?: string;
  notes?: string;
  source: {
    status: string;
    method: string;
    checkedOn?: string;
  };
  capabilities: Record<CapabilityKey, FormCapabilityDetail>;
  versionHistory: FormVersionHistoryItem[];
}

export interface PreparationPipelineStep {
  id: string;
  label: string;
  workflowStages: number[];
  status: string;
  evidence: string;
}

export interface LibraryCatalog {
  federalForms: FormView[];
  states: StateJurisdiction[];
  groups: Array<{ id: LibraryGroupId; label: string }>;
  coreCategories: Array<{ id: LibraryGroupId; title: string; scope: string }>;
  stateCategories: Array<{ id: StateTaxCategoryId; label: string }>;
  catalogTaxYears: number[];
  disclaimer?: string;
  preparationPipeline: PreparationPipelineStep[];
}
