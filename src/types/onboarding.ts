/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClientCategory = 'individual' | 'business' | 'trust_estate';

export interface ClientOnboardingDossier {
  clientId: string;
  category: ClientCategory;
  primaryContact: {
    name: string;
    email: string;
    phone: string;
  };
  entityDetails?: {
    legalName: string;
    entityType: string;
    ein?: string;
  };
  taxYear: number;
  selectedPlanId?: string;
  documentsUploaded?: string[];
  currentStep: number;
  completed: boolean;
}

export interface StaffOnboardingDossier {
  staffId: string;
  legalFirstName: string;
  legalLastName: string;
  email: string;
  role: string;
  credentials: string[];
  ptin?: string;
  mfaVerified: boolean;
  status: 'pending' | 'in_review' | 'approved';
}
