export type ClientCategory =
  | 'individual'
  | 'business'
  | 'small_business'
  | 'enterprise'
  | 'trust_estate'
  | 'nonprofit'
  | string;

export interface ClientOnboardingDossier {
  id?: string;
  clientId?: string;
  category?: ClientCategory;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  companyName?: string;
  entityType?: string;
  taxYear?: number;
  filingStatus?: string;
  primaryState?: string;
  servicesRequested?: string[];
  preferredConsultationSlot?: string;
  notes?: string;
  status?: string;
  [key: string]: any;
}

export interface StaffOnboardingDossier {
  id?: string;
  staffId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  credentials?: string[];
  ptin?: string;
  licenseNumber?: string;
  licenseState?: string;
  department?: string;
  status?: string;
  [key: string]: any;
}
