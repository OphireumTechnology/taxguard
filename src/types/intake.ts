export type USEntityType =
  | 'individual'
  | 'llc'
  | 's_corp'
  | 'c_corp'
  | 'partnership'
  | 'trust_estate'
  | 'non_profit'
  | string;

export type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC' | string;

export interface OwnerOrOfficer {
  id: string;
  name: string;
  title: string;
  ownershipPercentage: number;
  ssnOrEin?: string;
  email?: string;
  phone?: string;
  isAuthorizedSigner?: boolean;
  [key: string]: any;
}

export interface SetupArea {
  id: string;
  name: string;
  status: string;
  statusLabel?: string;
  badgeVariant?: string;
  description?: string;
  requiredForSubmission?: boolean;
  completionPercentage?: number;
  [key: string]: any;
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
  setupAreas?: SetupArea[];
  owners?: OwnerOrOfficer[];
  [key: string]: any;
}

export interface GovernedResearchRule {
  id: string;
  entityType: string;
  taxYear: number;
  jurisdictionLevel: string;
  jurisdictionCode: string;
  triggerCondition: string;
  requiredDocumentName: string;
  documentCategory: string;
  officialSourceCitation: string;
  sourceUrl: string;
  dateLastVerified: string;
  professionalApprover: string;
  ruleVersion: string;
}

export interface AccountingStagingRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
  account?: string;
  status: string;
  [key: string]: any;
}
