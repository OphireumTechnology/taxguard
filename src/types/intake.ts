export type USEntityType =
  | 'individual'
  | 'sole_proprietor'
  | 'single_member_llc'
  | 'multi_member_llc'
  | 'partnership'
  | 's_corp'
  | 'c_corp'
  | 'trust_estate'
  | 'nonprofit'
  | string;

export type USStateCode = string;

export interface OwnerOrOfficer {
  id?: string;
  fullName: string;
  title?: string;
  ownershipPercent?: number;
  ssnLast4?: string;
  email?: string;
  phone?: string;
  [key: string]: any;
}

export interface FullClientIntakeDossier {
  id?: string;
  clientId?: string;
  tenantId?: string;
  taxYear?: number;
  entityType?: USEntityType;
  legalName?: string;
  dbaName?: string;
  ein?: string;
  stateOfFormation?: USStateCode;
  filingStates?: USStateCode[];
  owners?: OwnerOrOfficer[];
  status?: string;
  [key: string]: any;
}

export interface GovernedResearchRule {
  id: string;
  code?: string;
  title?: string;
  jurisdiction?: string;
  authorityLevel?: string;
  citation?: string;
  summary?: string;
  effectiveYear?: number;
  status?: string;
  [key: string]: any;
}

export interface AccountingStagingRecord {
  id: string;
  clientId?: string;
  source?: string;
  documentId?: string;
  category?: string;
  amount?: number;
  status?: string;
  createdAt?: string;
  [key: string]: any;
}
