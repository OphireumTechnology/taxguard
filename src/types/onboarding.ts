export type ClientCategory = 'individual' | 'business' | 'trust_estate' | 'nonprofit' | string;

export interface ClientOnboardingDossier {
  identityContact?: any;
  entityClassification?: any;
  taxProfile?: any;
  accountingNeeds?: any;
  serviceSelection?: any;
  documentChecklist?: any;
  consultation?: any;
  engagementConsent?: any;
  status?: string;
  [key: string]: any;
}

export interface StaffOnboardingDossier {
  personalContact?: any;
  employmentInfo?: any;
  qualifications?: any;
  specializations?: any;
  jurisdictions?: any;
  securityMfa?: any;
  status?: string;
  [key: string]: any;
}
