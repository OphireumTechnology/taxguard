export type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI'
  | 'WY' | string;

export type USEntityType =
  | 'individual'
  | 'sole_proprietorship'
  | 'single_member_llc'
  | 'multi_member_llc'
  | 's_corporation'
  | 'c_corporation'
  | 'partnership'
  | 'nonprofit'
  | 'trust_estate'
  | string;

export interface OwnerOrOfficer {
  id?: string;
  name: string;
  title: string;
  ownershipPercentage: number;
  ssnOrEin?: string;
  [key: string]: any;
}

export interface FullClientIntakeDossier {
  id?: string;
  clientId?: string;
  taxYear?: number;
  status?: string;
  entityType?: USEntityType;
  businessProfile?: any;
  personalProfile?: any;
  owners?: OwnerOrOfficer[];
  taxFilingStatus?: string;
  accountingSoftware?: string;
  priorYearFiled?: boolean;
  notes?: string;
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
  clientId: string;
  clientName: string;
  sourceDocumentId: string;
  sourceDocumentName: string;
  sourcePageNumber: number;
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
  reviewedBy?: string | null;
  [key: string]: any;
}
