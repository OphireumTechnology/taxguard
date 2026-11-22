export type ClientCategory =
  | 'individual'
  | 'small_business'
  | 'corporate'
  | 'trust_estate'
  | 'high_net_worth'
  | string;

export interface ClientOnboardingDossier {
  id?: string;
  clientId?: string;
  category?: ClientCategory;
  fullName?: string;
  email?: string;
  phone?: string;
  entityType?: string;
  taxYear?: number;
  filingStatus?: string;
  state?: string;
  status?: string;
  step?: number;
  [key: string]: any;
}

export interface StaffOnboardingDossier {
  id?: string;
  userId?: string;
  fullName?: string;
  email?: string;
  role?: string;
  credentials?: string;
  ptin?: string;
  licenseNumber?: string;
  licenseState?: string;
  specialties?: string[];
  status?: string;
  [key: string]: any;
}
