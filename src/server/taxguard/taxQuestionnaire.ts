export interface TaxQuestionnaireAnswers {
  filingStatus?: string;
  hasDependents?: boolean;
  dependentCount?: number;
  hasW2Employment?: boolean;
  hasMultipleEmployers?: boolean;
  hasSelfEmployment?: boolean;
  hasScheduleCActivity?: boolean;
  hasPartnershipInterests?: boolean;
  hasSCorporationInterests?: boolean;
  hasCCorporationInterests?: boolean;
  hasRentalProperties?: boolean;
  hasBusinessAccountingRecords?: boolean;
  hasInterestIncome?: boolean;
  hasDividendIncome?: boolean;
  hasSecuritiesTrades?: boolean;
  hasCapitalGainsOrLosses?: boolean;
  hasDigitalAssetsOrCrypto?: boolean;
  hasRetirementDistributions?: boolean;
  hasSocialSecurityBenefits?: boolean;
  hasMarketplaceInsurance?: boolean;
  hasHSA?: boolean;
  hasEducationExpenses?: boolean;
  hasMortgageOrRealEstateTaxes?: boolean;
  hasItemizedDeductions?: boolean;
  hasEstimatedTaxPayments?: boolean;
  hasPriorYearFederalReturn?: boolean;
  hasPriorYearStateReturn?: boolean;
  hasForeignIncomeOrAssets?: boolean;
  hasForeignBankAccounts?: boolean;
  hasMultiStateIncome?: boolean;
  hasPartYearResidency?: boolean;
  stateOfResidency?: string;
  additionalStates?: string[];
  [key: string]: any;
}

export interface GeneratedDocumentRequirement {
  id: string;
  code?: string;
  title: string;
  name?: string;
  category: string;
  required: boolean;
  status: string;
  taxYear?: number;
  reason?: string;
  citation?: string;
  uploadedDocumentId?: string;
  notApplicableReason?: string;
  [key: string]: any;
}

export interface StoredQuestionnaireRecord {
  id?: string;
  clientId: string;
  tenantId?: string;
  taxYear: number;
  answers: TaxQuestionnaireAnswers;
  status?: string;
  submittedAt?: string;
  updatedAt?: string;
  requirements?: GeneratedDocumentRequirement[];
  [key: string]: any;
}
