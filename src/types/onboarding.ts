export type ClientCategory = 'individual' | 'business' | 'trust_estate' | 'nonprofit' | string;

export interface ClientOnboardingDossier {
  id?: string;
  clientId?: string;
  category?: ClientCategory;
  fullName?: string;
  email?: string;
  phone?: string;
  businessName?: string;
  entityType?: string;
  taxYear?: number;
  status?: string;
  [key: string]: any;
}

export interface StaffOnboardingDossier {
  id?: string;
  staffId?: string;
  fullName?: string;
  email?: string;
  role?: string;
  credentials?: string[];
  ptin?: string;
  cafNumber?: string;
  statesLicensed?: string[];
  status?: string;
  [key: string]: any;
}
