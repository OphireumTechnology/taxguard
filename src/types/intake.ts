export type USEntityType =
  | 'individual'
  | 'sole_proprietor'
  | 'single_member_llc'
  | 'multi_member_llc'
  | 's_corp'
  | 'c_corp'
  | 'partnership'
  | 'nonprofit'
  | 'trust_estate'
  | string;

export type USStateCode = string;

export interface OwnerOrOfficer {
  id: string;
  fullName: string;
  title?: string;
  ownershipPercent: number;
  ssnOrEinLast4?: string;
  email?: string;
  isManagingMember?: boolean;
  [key: string]: any;
}

export interface FullClientIntakeDossier {
  id: string;
  clientId?: string;
  taxYear: number;
  entityType: USEntityType;
  legalName?: string;
  legalBusinessName?: string;
  dbaName?: string;
  einOrSsn?: string;
  primaryState?: USStateCode;
  primaryJurisdiction?: string;
  additionalStates?: USStateCode[];
  owners?: OwnerOrOfficer[];
  filingStatus?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: Record<string, any>;
  taxProfile?: Record<string, any>;
  accountingSystem?: string;
  status?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface GovernedResearchRule {
  id: string;
  entityType: string;
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
  clientId: string;
  taxYear?: number;
  source?: string;
  category?: string;
  description: string;
  amount: number;
  status: string;
  [key: string]: any;
}
