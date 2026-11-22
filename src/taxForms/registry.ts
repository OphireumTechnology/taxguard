import type { Applicability, LibraryGroupId, StateJurisdiction } from './types';

export interface FormView {
  id: string;
  code: string;
  title: string;
  group: LibraryGroupId;
  applicability?: Applicability[];
  preparation: string;
  review?: string;
  efile?: string;
  taxYear?: number;
  notes?: string;
  [key: string]: any;
}

export interface LibraryCatalog {
  forms: FormView[];
  states?: StateJurisdiction[];
  groups?: Array<{ id: LibraryGroupId; label: string }>;
  updatedAt?: string;
  [key: string]: any;
}
