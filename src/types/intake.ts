export type USEntityType =
  | 'individual'
  | 'sole_proprietorship'
  | 'single_member_llc'
  | 'partnership'
  | 'multi_member_llc'
  | 'scorp'
  | 'ccorp'
  | 'trust_estate'
  | 'nonprofit'
  | 'all'
  | string;

export type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | string;

export interface OwnerOrOfficer {
  id?: string;
  fullName: string;
  title?: string;
  ownershipPercentage?: number;
  ssnOrTinMasked?: string;
  email?: string;
  isActiveParticipant?: boolean;
  [key: string]: any;
}

export interface GovernedResearchRule {
  id: string;
  entityType: USEntityType;
  taxYear: number;
  jurisdictionLevel: 'federal' | 'state' | 'local' | string;
  jurisdictionCode: string;
  triggerCondition: string;
  requiredDocumentName: string;
  documentCategory: string;
  officialSourceCitation: string;
  sourceUrl: string;
  dateLastVerified: string;
  professionalApprover: string;
  ruleVersion: string;
  [key: string]: any;
}

export interface AccountingStagingRecord {
  id: string;
  clientId?: string;
  taxYear?: number;
  category?: string;
  description?: string;
  amount?: number;
  status?: string;
  [key: string]: any;
}

export interface FullClientIntakeDossier {
  id: string;
  clientId: string;
  clientName: string;
  legalBusinessName?: string;
  entityType?: USEntityType;
  taxYear?: number;
  filingStatus?: string;
  primaryState?: USStateCode;
  additionalStates?: USStateCode[];
  owners?: OwnerOrOfficer[];
  officers?: OwnerOrOfficer[];
  [key: string]: any;
}
