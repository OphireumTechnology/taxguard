export type USEntityType = 'Individual' | 'LLC' | 'S-Corp' | 'C-Corp' | 'Partnership' | 'Non-Profit';
export type USStateCode = string;

export interface OwnerOrOfficer {
  id: string;
  name: string;
  title: string;
  ownershipPercentage: number;
  ssnMasked?: string;
}

export interface SetupAreaItem {
  id: string;
  name: string;
  completed: boolean;
}

export interface CrossBorderReviewTask {
  id: string;
  status: string;
  notes?: string;
}

export interface GovernedResearchRule {
  id: string;
  topic: string;
  citation: string;
}

export interface AccountingStagingRecord {
  id: string;
  clientId: string;
  taxYear: number;
  status: string;
}

export interface FullClientIntakeDossier {
  clientId?: string;
  taxYear?: number;
  entityType?: USEntityType;
  businessName?: string;
  owners?: OwnerOrOfficer[];
  setupAreas?: SetupAreaItem[];
  [key: string]: unknown;
}
