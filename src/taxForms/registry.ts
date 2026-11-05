/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  CapabilityKey,
  LibraryGroupId,
  StateJurisdiction,
  StateTaxCategoryId
} from './types';

export interface FormCapabilityDetail {
  status: 'available' | 'prototype' | 'not_implemented' | 'blocked';
  note: string;
}

export interface FormVersionHistory {
  taxYear: number;
  revision?: string;
  note: string;
}

export interface FormSourceVerification {
  status: 'verified' | 'unverified' | 'pending';
  method: string;
  checkedOn?: string;
}

export interface FormView {
  id: string;
  formNumber: string;
  officialName: string;
  groups: LibraryGroupId[];
  taxYears: number[];
  classification: string;
  readiness: string;
  preparation: string;
  entityCategory: string;
  officialSourceUrl: string;
  instructionsNote?: string;
  source: FormSourceVerification;
  schedules: string[];
  requiredDocuments: string[];
  notes?: string;
  capabilities: Record<CapabilityKey, FormCapabilityDetail>;
  versionHistory: FormVersionHistory[];
}

export interface PreparationPipelineItem {
  id: string;
  label: string;
  workflowStages: number[];
  status: string;
  evidence: string;
}

export interface LibraryCatalog {
  disclaimer?: string;
  catalogTaxYears: number[];
  groups: Array<{ id: LibraryGroupId; label: string }>;
  coreCategories: Array<{ id: LibraryGroupId; label: string; title?: string; scope?: string }>;
  stateCategories: Array<{ id: StateTaxCategoryId; label: string }>;
  federalForms: FormView[];
  states: StateJurisdiction[];
  preparationPipeline: PreparationPipelineItem[];
}
