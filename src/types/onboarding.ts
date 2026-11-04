export type ClientCategory = 'individual' | 'small_business' | 'enterprise' | 'estate_trust';

export interface ClientOnboardingDossier {
  step: number;
  category: ClientCategory;
  taxYear: number;
  primaryContact: {
    fullName: string;
    email: string;
    phone: string;
  };
  businessDetails?: {
    legalName: string;
    ein: string;
    entityType: string;
  };
  consentAgreed: boolean;
  status: 'draft' | 'submitted' | 'approved';
}

export interface StaffOnboardingDossier {
  step: number;
  fullName: string;
  email: string;
  role: string;
  mfaConfigured: boolean;
  trainingCompleted: boolean;
  ndaSigned: boolean;
  status: 'in_progress' | 'completed';
}
