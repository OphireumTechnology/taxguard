export type ClientCategory = 'individual' | 'business' | 'trust_estate' | 'non_profit';

export interface ClientOnboardingDossier {
  clientId?: string;
  category?: ClientCategory;
  step?: number;
  completed?: boolean;
  data?: Record<string, any>;
  [key: string]: any;
}

export interface StaffOnboardingDossier {
  staffId?: string;
  step?: number;
  completed?: boolean;
  data?: Record<string, any>;
  [key: string]: any;
}
