export type ClientCategory =
  | 'individual'
  | 'self_employed'
  | 'small_business'
  | 'corporation'
  | 'partnership'
  | 'nonprofit'
  | 'trust_estate'
  | string;

export interface ClientOnboardingDossier {
  id?: string;
  clientId?: string;
  taxYear?: number;
  status: 'draft' | 'in_progress' | 'submitted' | 'approved' | 'needs_correction' | string;
  percentComplete: number;
  identityContact: Record<string, any>;
  entityClassification?: Record<string, any>;
  taxProfile: Record<string, any>;
  accountingRequirements: Record<string, any>;
  serviceSelection: Record<string, any>;
  documentChecklist: Array<Record<string, any>>;
  consultationPreferences: Record<string, any>;
  engagementConsent: Record<string, any>;
  reviewSubmission?: {
    lockedForClient?: boolean;
    submittedAt?: string;
    reviewedAt?: string;
    reviewedBy?: string;
    notes?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface StaffOnboardingDossier {
  id?: string;
  staffUid?: string;
  status: 'draft' | 'in_progress' | 'submitted' | 'approved' | string;
  personalContact: Record<string, any>;
  employmentInfo: Record<string, any>;
  qualifications: Record<string, any>;
  servicesSpecializations: Record<string, any>;
  jurisdictionsEligibility: Record<string, any>;
  securitySetup: Record<string, any>;
  calendarSetup: Record<string, any>;
  adminReview: Record<string, any>;
  [key: string]: any;
}
