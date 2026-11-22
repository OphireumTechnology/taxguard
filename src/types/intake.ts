export type USEntityType =
  | 'individual'
  | 'sole_proprietorship'
  | 'single_member_llc'
  | 'multi_member_llc'
  | 'partnership'
  | 'scorp'
  | 'ccorp'
  | 'nonprofit'
  | 'trust'
  | 'estate'
  | 'all'
  | string;

export type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC' | 'US' | string;

export interface OwnerOrOfficer {
  id?: string;
  name: string;
  fullName?: string;
  title?: string;
  role?: string;
  ownershipPercentage?: number;
  ssnLast4?: string;
  email?: string;
  phone?: string;
  address?: string;
  isAuthorizedSigner?: boolean;
  [key: string]: any;
}

export interface GovernedResearchRule {
  id: string;
  entityType: USEntityType;
  taxYear: number;
  jurisdictionLevel: 'federal' | 'state' | 'local' | string;
  jurisdictionCode: USStateCode;
  triggerCondition: string;
  requiredDocumentName: string;
  documentCategory: string;
  officialSourceCitation: string;
  sourceUrl?: string;
  dateLastVerified?: string;
  professionalApprover?: string;
  ruleVersion?: string;
  [key: string]: any;
}

export interface FullClientIntakeDossier {
  id: string;
  clientId: string;
  clientName?: string;
  legalBusinessName?: string;
  entityType?: USEntityType;
  taxYear?: number;
  primaryState?: USStateCode;
  operatingStates?: USStateCode[];
  owners?: OwnerOrOfficer[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface AccountingStagingRecord {
  id: string;
  clientId: string;
  taxYear?: number;
  source?: string;
  category?: string;
  description?: string;
  amount?: number;
  status: string;
  confidence?: number;
  createdAt?: string;
  [key: string]: any;
}
