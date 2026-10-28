export type ClientCategory = 'individual' | 'business';

export interface ClientOnboardingDossier {
  clientId?: string;
  category?: ClientCategory;
  primaryContactName?: string;
  email?: string;
  phone?: string;
  step?: number;
  completed?: boolean;
  [key: string]: unknown;
}

export interface StaffOnboardingDossier {
  staffId?: string;
  name?: string;
  role?: string;
  step?: number;
  completed?: boolean;
  [key: string]: unknown;
}
