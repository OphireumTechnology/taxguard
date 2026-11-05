/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type USEntityType =
  | 'individual'
  | 'single_member_llc'
  | 'multi_member_llc'
  | 's_corporation'
  | 'c_corporation'
  | 'partnership'
  | 'trust_estate'
  | 'non_profit'
  | (string & {});

export type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY'
  | 'DC';

export interface OwnerOrOfficer {
  id: string;
  name: string;
  title: string;
  ownershipPercentage: number;
  ssnOrEin?: string;
  address?: string;
}

export interface FullClientIntakeDossier {
  id: string;
  clientId: string;
  clientName?: string;
  entityType: USEntityType;
  businessName?: string;
  dba?: string;
  ein?: string;
  incorporationState?: USStateCode;
  taxYear: number;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: USStateCode;
  zip: string;
  owners?: OwnerOrOfficer[];
  hasPayroll?: boolean;
  hasInventory?: boolean;
  accountingSoftware?: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'in_progress' | string;
  submittedAt?: string;
  intakeNotes?: string;
}

export interface GovernedResearchRule {
  id: string;
  entityType: string;
  taxYear: number;
  jurisdictionLevel: 'federal' | 'state';
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
  clientName?: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  sourcePageNumber?: number;
  recordType?: string;
  date?: string;
  period?: string;
  description?: string;
  amount?: number;
  debitAmount?: number;
  creditAmount?: number;
  suggestedAccountCode?: string;
  suggestedAccountName?: string;
  confidenceScore?: number;
  aiModelVersion?: string;
  status?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  isDuplicateFlag?: boolean;
  auditTrail?: Array<{
    action: string;
    actor: string;
    timestamp: string;
    notes?: string;
  }>;
  accountName?: string;
  balance?: number;
  asOfDate?: string;
  reconciled?: boolean;
  notes?: string;
  [key: string]: any;
}

