import type { CapabilityKey, LibraryGroupId, StateJurisdiction } from './types';

export interface FormView {
  id: string;
  formNumber: string;
  officialName: string;
  groups: LibraryGroupId[];
  taxYears: number[];
  readiness: string;
  schedules: string[];
  capabilities?: Record<CapabilityKey, 'available' | 'prototype' | 'not_implemented' | 'blocked'>;
  description?: string;
}

export interface LibraryGroupMeta {
  id: LibraryGroupId;
  label: string;
  description?: string;
}

export interface LibraryCatalog {
  federalForms: FormView[];
  states: StateJurisdiction[];
  groups: LibraryGroupMeta[];
  coreCategories: Array<{ id: LibraryGroupId; label: string; description?: string }>;
}
