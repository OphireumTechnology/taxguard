import type {
  CapabilityKey,
  CapabilityStatus,
  LibraryGroupId,
  StateJurisdiction,
  StateTaxCategoryId
} from './types';

export interface FormCapabilityEntry {
  status: CapabilityStatus;
  note?: string;
}

export interface FormVersionHistoryEntry {
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
  source: {
    status: 'verified' | 'pending_review';
    method: string;
    checkedOn?: string;
  };
  capabilities: Record<CapabilityKey, FormCapabilityEntry>;
  versionHistory: FormVersionHistoryEntry[];
  notes?: string;
}

export interface LibraryCatalog {
  disclaimer?: string;
  catalogTaxYears: number[];
  groups: Array<{ id: LibraryGroupId; label: string }>;
  coreCategories: Array<{ id: LibraryGroupId; title: string; scope: string }>;
  stateCategories: Array<{ id: StateTaxCategoryId; label: string }>;
  federalForms: FormView[];
  states: StateJurisdiction[];
  preparationPipeline: Array<{
    id: string;
    label: string;
    workflowStages: number[];
    status: string;
    evidence: string;
  }>;
}
