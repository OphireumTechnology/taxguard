/**
 * A/R TAX SERVICES, LLC - Comprehensive U.S.-Only Client Intake & Intelligence System
 * Strict U.S. Federal, State, and Local Jurisdictions
 * Zero Foreign / BIR / Philippine References
 */

export type USStateCode =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME'
  | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH'
  | 'NJ' | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI'
  | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI'
  | 'WY' | 'PR' | 'VI' | 'GU' | 'AS' | 'MP';

export type USEntityType =
  | 'individual'
  | 'sole_proprietorship'
  | 'partnership'
  | 'llc'
  | 'scorp'
  | 'ccorp'
  | 'nonprofit'
  | 'trust_estate'
  | 'real_estate_investor'
  | 'payroll_client'
  | 'sales_tax_client';

export type SetupAreaStatus =
  | 'complete'
  | 'in_progress'
  | 'required'
  | 'needs_review'
  | 'one_missing'
  | 'three_missing';

export interface SetupAreaItem {
  id: string;
  name: string;
  status: 'complete' | 'in_progress' | 'required' | 'needs_review' | 'missing_items';
  statusLabel: string;
  badgeVariant: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  description: string;
  requiredForSubmission: boolean;
  completionPercentage: number;
}

export interface OwnerOrOfficer {
  id: string;
  legalName: string;
  role: string;
  title: string;
  email: string;
  phone: string;
  ownershipPercentage: number; // validated to total 100% or flagged
  startDate: string;
  endDate?: string;
  isUsResident: boolean;
  isAuthorizedSignatory: boolean;
  isResponsibleParty: boolean;
  approvalAuthorityLevel: 'full' | 'financial_only' | 'view_only';
  portalAccessRole: 'owner' | 'manager' | 'viewer';
  authorizedAccountingContact: boolean;
  authorizedBillingContact: boolean;
  isBoiBeneficialOwner: boolean; // FinCEN Corporate Transparency Act
  maskedSsnOrTin: string; // e.g. "•••-••-1234"
}

export interface BankAccountRecord {
  id: string;
  institutionName: string;
  accountType: 'checking' | 'savings' | 'money_market' | 'credit_card' | 'line_of_credit';
  maskedAccountNumber: string; // e.g. "••••4829"
  routingNumberMasked: string; // e.g. "••••1234"
  currency: 'USD';
  openingBalance: number;
  openingBalanceDate: string;
  currentReconciliationStatus: 'reconciled' | 'pending' | 'needs_review';
  feedConnected: boolean;
  lastStatementUploadedDate?: string;
}

export interface ChartOfAccountRecord {
  id: string;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'cogs';
  subType: string;
  balance: number;
  mappingSuggestion?: string;
  mappingConfidence?: number;
  accountantApproved: boolean;
  notes?: string;
}

export interface CrossBorderReviewTask {
  id: string;
  clientId: string;
  taxYear: number;
  triggerField: string;
  triggerValue: string;
  recommendedFormsToInspect: Array<'FinCEN_114_FBAR' | 'Form_8938' | 'Form_5471' | 'Form_8865' | 'Form_3520'>;
  mandatedByStaff: boolean; // MUST NOT be automated without CPA sign-off
  reviewedByCpa?: string;
  reviewDate?: string;
  cpaDecision?: 'mandatory' | 'optional_safeguard' | 'not_applicable';
  cpaNotes?: string;
  createdAt: string;
}

export interface GovernedResearchRule {
  id: string;
  entityType: USEntityType | 'all';
  taxYear: number;
  jurisdictionLevel: 'federal' | 'state' | 'local';
  jurisdictionCode: string; // "US" or State code like "SC", "CA", "NY"
  triggerCondition: string;
  requiredDocumentName: string;
  documentCategory: string;
  officialSourceCitation: string; // e.g. "IRC § 6041, Treas. Reg. § 1.6041-1"
  sourceUrl: string; // e.g. "https://www.irs.gov/instructions/iw2w3"
  dateLastVerified: string;
  professionalApprover: string;
  ruleVersion: string;
}

export type StagingRecordStatus =
  | 'extracted'
  | 'validated'
  | 'needs_review'
  | 'accountant_approved'
  | 'ready_for_posting'
  | 'posted'
  | 'reconciled'
  | 'locked';

export type StagingRecordType =
  | 'bank_transaction'
  | 'credit_card_transaction'
  | 'invoice'
  | 'bill'
  | 'receipt'
  | 'payroll_summary'
  | 'tax_payment'
  | 'fixed_asset'
  | 'loan_balance'
  | 'inventory_total'
  | 'trial_balance_account'
  | 'journal_entry_candidate';

export interface AccountingStagingRecord {
  id: string;
  clientId: string;
  clientName: string;
  sourceDocumentId: string;
  sourceDocumentName: string;
  sourcePageNumber: number;
  recordType: StagingRecordType;
  date: string;
  period: string; // e.g. "2025-12"
  description: string;
  amount: number; // positive for debit, negative for credit
  debitAmount: number;
  creditAmount: number;
  suggestedAccountCode: string;
  suggestedAccountName: string;
  confidenceScore: number; // 0-100
  aiModelVersion: string;
  status: StagingRecordStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  accountantCorrections?: {
    originalAccountCode?: string;
    adjustedAccountCode?: string;
    notes?: string;
  };
  isDuplicateFlag: boolean;
  duplicateConfidence?: number;
  auditTrail: Array<{
    action: string;
    actor: string;
    timestamp: string;
    notes?: string;
  }>;
}

export interface FullClientIntakeDossier {
  id: string;
  clientId: string;
  clientName: string;
  legalBusinessName: string;
  dbaName?: string;
  entityType: USEntityType;
  taxYear: number;
  primaryJurisdiction: string; // e.g. "Federal & South Carolina, USA"
  assignedAccountantName: string;
  assignedAccountantId: string;
  currentEngagementTitle: string;
  percentComplete: number;
  currentSectionStep: number;
  status: 'draft' | 'in_progress' | 'submitted_pending_review' | 'corrections_requested' | 'approved_and_active';
  
  // High-level Setup Areas Table
  setupAreas: SetupAreaItem[];
  
  // Section 1: Business Information
  businessProfile: {
    legalBusinessName: string;
    tradeNameDba: string;
    entityType: USEntityType;
    einMasked: string; // e.g. "XX-XXX4912"
    formationState: USStateCode;
    formationDate: string;
    fiscalYearEndMonth: number; // 1-12
    accountingMethod: 'cash' | 'accrual' | 'hybrid';
    businessAddress: {
      street: string;
      city: string;
      state: USStateCode;
      zip: string;
    };
    mailingAddressSameAsBusiness: boolean;
    mailingAddress?: {
      street: string;
      city: string;
      state: USStateCode;
      zip: string;
    };
    phoneUs: string;
    email: string;
    website?: string;
    industrySector: string;
    primaryActivityDescription: string;
    employeeCount: number;
    contractorCount: number;
    branchesCount: number;
    reportingCurrency: 'USD';
    hasForeignActivity: boolean;
    hasRelatedEntities: boolean;
    relatedEntitiesSummary?: string;
  };

  // Section 2: Jurisdictions & Nexus
  jurisdictions: {
    federalFilingRequired: boolean;
    residentState: USStateCode;
    statesOfOperation: USStateCode[];
    statesWithEmployees: USStateCode[];
    statesWithContractors: USStateCode[];
    statesWithInventory: USStateCode[];
    statesWithProperty: USStateCode[];
    statesWithSalesNexus: USStateCode[];
    stateTaxAccounts: Array<{
      state: USStateCode;
      accountType: 'income_tax' | 'withholding' | 'sales_and_use' | 'unemployment';
      maskedAccountNumber: string;
    }>;
    localJurisdictions: string[];
  };

  // Section 3: Entity-Specific Tax Modules
  entitySpecificDetails: {
    // Individual
    individual?: {
      filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household' | 'qualifying_surviving_spouse';
      dependentsCount: number;
      hadHealthInsuranceMarketplace: boolean;
      madeEstimatedTaxes: boolean;
      estimatedTaxAmount: number;
    };
    // Sole Proprietor / Single-Member LLC
    soleProprietor?: {
      businessName: string;
      principalActivity: string;
      homeOfficeDeductionClaimed: boolean;
      homeOfficeSquareFootage?: number;
      businessMileage: number;
      mileageMethod: 'standard_rate' | 'actual_expense';
      inventoryAtYearEnd: number;
    };
    // Partnership / Multi-Member LLC
    partnership?: {
      form1065FilingRequired: boolean;
      numberOfPartners: number;
      hasGuaranteedPayments: boolean;
      guaranteedPaymentsAmount?: number;
      hasForeignPartners: boolean;
      capitalAccountMaintenanceMethod: 'tax_basis' | 'gaap' | '704b';
    };
    // S-Corporation
    sCorp?: {
      form1120sFilingRequired: boolean;
      form2553ElectionDate?: string;
      officerW2CompensationPaid: number;
      distributionsPaid: number;
      hasShareholderLoans: boolean;
      shareholderLoanBalance?: number;
      statePtetElectionMade: boolean;
    };
    // C-Corporation
    cCorp?: {
      form1120FilingRequired: boolean;
      dividendsPaid: number;
      accumulatedEarningsTaxConcern: boolean;
      stateApportionmentMethod: 'single_sales_factor' | 'three_factor';
    };
    // Nonprofit
    nonprofit?: {
      irsExemptionSection: '501(c)(3)' | '501(c)(4)' | '501(c)(6)' | 'other';
      irsDeterminationLetterDate?: string;
      filingType: 'Form_990' | 'Form_990_EZ' | 'Form_990_N';
      hasUnrelatedBusinessIncome: boolean;
      publicSupportPercentage?: number;
    };
    // Estate & Trust
    estateTrust?: {
      form1041FilingRequired: boolean;
      trustType: 'simple' | 'complex' | 'grantor' | 'estate';
      fiduciaryName: string;
      einMasked: string;
      distributableNetIncomeEstimated?: number;
    };
    // Real Estate
    realEstate?: {
      propertiesCount: number;
      performed1031Exchange: boolean;
      hasCostSegregationStudies: boolean;
    };
  };

  // Section 4: Owners & Representatives
  ownersAndContacts: OwnerOrOfficer[];

  // Section 5: Accounting Setup
  accountingSetup: {
    accountingMethod: 'cash' | 'accrual';
    chartOfAccountsSource: 'uploaded_trial_balance' | 'default_standard_coa' | 'qbo_sync' | 'custom_csv';
    chartOfAccounts: ChartOfAccountRecord[];
    bankAccounts: BankAccountRecord[];
    openingBalancesRecorded: boolean;
    openingBalancesDebitTotal: number;
    openingBalancesCreditTotal: number;
    openingBalancesBalanced: boolean;
    accountsReceivableBalance: number;
    accountsPayableBalance: number;
    fixedAssetsRecorded: boolean;
    depreciationSchedulesAvailable: boolean;
    inventoryMethod: 'fifo' | 'lifo' | 'average_cost' | 'none';
    currentSoftware: string;
  };

  // Section 6: Business Operations Questionnaire
  businessOperations: {
    acceptsCreditCards: boolean;
    acceptsCashOver10k: boolean;
    acceptsEWallets: boolean;
    sellsOnOnlineMarketplaces: boolean;
    holdsInventory: boolean;
    pays1099Contractors: boolean;
    contractor1099Issued: boolean;
    hasCommercialLoans: boolean;
    hasEquipmentLeases: boolean;
    sponsorsRetirementPlan: boolean;
    sponsorsGroupHealth: boolean;
    conductsRdActivities: boolean;
    holdsGovernmentContracts: boolean;
  };

  // Section 7: Cross-Border & Foreign Triggers (Professional Review Tasks)
  crossBorderTriggers: {
    hasForeignBankAccounts: boolean;
    hasForeignBusinessInterests: boolean;
    hasForeignTrustsOrGifts: boolean;
    hasForeignCryptoExchanges: boolean;
    hasForeignTaxesPaid: boolean;
    generatedReviewTasks: CrossBorderReviewTask[];
  };

  // Section 8: Financial Documents Checklist
  documentChecklist: Array<{
    id: string;
    category: string;
    title: string;
    description: string;
    required: boolean;
    status: 'missing' | 'requested' | 'uploading' | 'submitted' | 'under_ai_review' | 'under_accountant_review' | 'approved' | 'needs_replacement';
    uploadedDocId?: string;
    fileName?: string;
    aiConfidence?: number;
  }>;

  // Section 9: Preferences & Consents
  preferencesAndConsents: {
    preferredContactMethod: 'portal' | 'email' | 'phone';
    preferredConsultationSchedule: 'morning' | 'afternoon' | 'evening';
    timeZone: string;
    electronicDeliveryConsentDate: string;
    engagementLetterAcceptedDate: string;
    privacyConsentDate: string;
    aiDocumentIntelligenceConsentDate: string;
    consentVersion: string;
    electronicSignature: string;
    submissionTimestamp?: string;
  };

  // Accountant Requested Corrections (if rejected/resubmitted)
  accountantCorrections?: Array<{
    id: string;
    section: string;
    instructions: string;
    requestedAt: string;
    requestedBy: string;
    resolved: boolean;
    clientResponse?: string;
  }>;

  createdAt: string;
  updatedAt: string;
}
