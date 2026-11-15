export type USEntityType =
  | 'individual'
  | 'sole_proprietorship'
  | 'llc'
  | 'scorp'
  | 'ccorp'
  | 'partnership'
  | 'nonprofit'
  | 'trust_estate'
  | string;

export type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI'
  | 'WY' | string;

export interface OwnerOrOfficer {
  id: string;
  fullName?: string;
  legalName?: string;
  title?: string;
  role?: string;
  ownershipPercentage: number;
  ssnOrTinMasked?: string;
  maskedSsnOrTin?: string;
  email?: string;
  phone?: string;
  startDate?: string;
  isUsResident?: boolean;
  isAuthorizedSignatory?: boolean;
  isResponsibleParty?: boolean;
  isBoiBeneficialOwner?: boolean;
  approvalAuthorityLevel?: string;
  portalAccessRole?: string;
  authorizedAccountingContact?: boolean;
  authorizedBillingContact?: boolean;
  isPrimaryContact?: boolean;
  isAuthorizedSigner?: boolean;
  distributionAmount?: number;
  guaranteedPayments?: number;
  [key: string]: unknown;
}

export interface GovernedResearchRule {
  id: string;
  entityType: USEntityType | 'all';
  taxYear: number;
  jurisdictionLevel: 'federal' | 'state' | string;
  jurisdictionCode: string;
  triggerCondition: string;
  requiredDocumentName: string;
  documentCategory: string;
  officialSourceCitation: string;
  sourceUrl: string;
  dateLastVerified: string;
  professionalApprover: string;
  ruleVersion: string;
  [key: string]: unknown;
}

export interface AccountingStagingRecord {
  id: string;
  clientId: string;
  clientName: string;
  sourceDocumentId: string;
  sourceDocumentName: string;
  sourcePageNumber?: number;
  recordType: string;
  date: string;
  period: string;
  description: string;
  amount: number;
  debitAmount: number;
  creditAmount: number;
  suggestedAccountCode: string;
  suggestedAccountName: string;
  confidenceScore: number;
  aiModelVersion: string;
  status: string;
  reviewedBy?: string;
  reviewedAt?: string;
  isDuplicateFlag: boolean;
  auditTrail: Array<{
    action: string;
    actor: string;
    timestamp: string;
    notes?: string;
  }>;
  [key: string]: unknown;
}

export interface FullClientIntakeDossier {
  id: string;
  clientId: string;
  clientName: string;
  legalBusinessName?: string;
  dbaName?: string;
  entityType: USEntityType;
  taxYear: number;
  primaryJurisdiction: string;
  assignedAccountantName?: string;
  assignedAccountantId?: string;
  currentEngagementTitle?: string;
  percentComplete: number;
  currentSectionStep: number;
  status: string;
  setupAreas: Array<{
    id: string;
    name: string;
    status: string;
    statusLabel: string;
    badgeVariant: string;
    description: string;
    requiredForSubmission: boolean;
    completionPercentage: number;
  }>;
  businessProfile: Record<string, any>;
  jurisdictions: Record<string, any>;
  entitySpecificDetails?: Record<string, any>;
  ownersAndContacts: OwnerOrOfficer[];
  accountingSetup: Record<string, any>;
  businessOperations: Record<string, any>;
  crossBorderTriggers: Record<string, any>;
  documentChecklist: Array<Record<string, any>>;
  preferencesAndConsents: Record<string, any>;
  accountantCorrections?: Array<Record<string, any>>;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}
