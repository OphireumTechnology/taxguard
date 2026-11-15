export type USEntityType =
  | 'individual'
  | 'sole_proprietorship'
  | 'llc_single'
  | 'llc_multi'
  | 'partnership'
  | 'scorp'
  | 'ccorp'
  | 'nonprofit'
  | 'trust'
  | 'estate'
  | 'all'
  | string;

export type USStateCode = string;

export interface OwnerOrOfficer {
  id?: string;
  name: string;
  title?: string;
  ownershipPercent?: number;
  ssnLast4?: string;
  email?: string;
  phone?: string;
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
  sourceSystem?: string;
  accountName?: string;
  category?: string;
  amountCents?: number;
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
  primaryState?: USStateCode;
  states?: USStateCode[];
  owners?: OwnerOrOfficer[];
  status?: string;
  [key: string]: any;
}
