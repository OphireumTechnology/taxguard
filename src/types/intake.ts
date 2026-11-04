export type USEntityType =
  | 'individual'
  | 'sole_proprietorship'
  | 'single_member_llc'
  | 'multi_member_llc'
  | 's_corporation'
  | 'c_corporation'
  | 'partnership'
  | 'trust_or_estate'
  | 'nonprofit_501c3';

export type USStateCode = string;

export interface OwnerOrOfficer {
  name: string;
  title: string;
  ssnOrEinLast4?: string;
  ownershipPercentage: number;
}

export interface FullClientIntakeDossier {
  clientId: string;
  legalBusinessName?: string;
  dbaName?: string;
  einOrSsn: string;
  entityType: USEntityType;
  stateOfFormation?: USStateCode;
  taxYear: number;
  contactEmail: string;
  contactPhone: string;
  mailingAddress: string;
  ownersOrOfficers: OwnerOrOfficer[];
  hasForeignAccounts?: boolean;
  hasCryptoTransactions?: boolean;
  hasPayrollEmployees?: boolean;
  priorYearFiled?: boolean;
}

export interface GovernedResearchRule {
  id: string;
  ruleCode: string;
  description: string;
  sourceAuthority: string;
}

export interface AccountingStagingRecord {
  id: string;
  clientId: string;
  status: string;
  timestamp: string;
}
