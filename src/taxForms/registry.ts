import type {
  CapabilityKey,
  CapabilityStatus,
  LibraryGroupId,
  StateJurisdiction,
  StateTaxCategoryId,
} from './types';

export interface FormCapabilityDetail {
  status: CapabilityStatus;
  note: string;
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
  instructionsNote: string;
  notes?: string;
  source: {
    status: string;
    method: string;
    checkedOn?: string;
  };
  capabilities: Record<CapabilityKey, FormCapabilityDetail>;
  versionHistory: FormVersionHistoryEntry[];
}

export interface LibraryCatalog {
  disclaimer?: string;
  catalogTaxYears?: number[];
  federalForms: FormView[];
  states: StateJurisdiction[];
  groups: Array<{ id: LibraryGroupId; label: string }>;
  coreCategories: Array<{ id: LibraryGroupId; label: string; title?: string; scope?: string }>;
  stateCategories: Array<{ id: StateTaxCategoryId; label: string }>;
  preparationPipeline: Array<{
    id: string;
    label: string;
    workflowStages: number[];
    status: string;
    evidence: string;
  }>;
}
