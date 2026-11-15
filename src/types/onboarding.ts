export type ClientCategory = 'individual' | 'business' | 'trust_estate' | 'nonprofit' | string;

export interface ClientOnboardingDossier {
  id?: string;
  clientId?: string;
  category: ClientCategory;
  taxYear?: number;
  personalInfo?: Record<string, any>;
  businessInfo?: Record<string, any>;
  taxPreferences?: Record<string, any>;
  documents?: any[];
  appointment?: Record<string, any>;
  consents?: Record<string, boolean>;
  status?: string;
  currentStep?: number;
  [key: string]: any;
}

export interface StaffOnboardingDossier {
  id?: string;
  staffId?: string;
  fullName: string;
  email: string;
  role: string;
  credentials?: string[];
  ptin?: string;
  cafNumber?: string;
  specializations?: string[];
  jurisdictions?: string[];
  status?: string;
  [key: string]: any;
}
