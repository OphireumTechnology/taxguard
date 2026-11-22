export type ClientCategory =
  | 'individual'
  | 'business'
  | 'corporate'
  | 'partnership'
  | 'trust_estate'
  | 'nonprofit'
  | string;

export interface ClientOnboardingDossier {
  id?: string;
  clientId: string;
  tenantId?: string;
  clientCategory?: ClientCategory;
  entityType?: string;
  legalName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  taxYear?: number;
  status?: string;
  currentStep?: number;
  completedSteps?: number[];
  submittedAt?: string;
  approvedAt?: string;
  [key: string]: any;
}

export interface StaffOnboardingDossier {
  id?: string;
  staffId?: string;
  userId?: string;
  fullName?: string;
  email?: string;
  role?: string;
  credentials?: string[];
  ptin?: string;
  cpaLicenseNumber?: string;
  status?: string;
  currentStep?: number;
  completedSteps?: number[];
  submittedAt?: string;
  approvedAt?: string;
  [key: string]: any;
}
