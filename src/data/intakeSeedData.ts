/**
 * A/R TAX SERVICES, LLC - Intake, Staging & Governed Research Seed Data
 * Strictly U.S. Federal & State Jurisdictions (South Carolina, Georgia, North Carolina, Florida, etc.)
 */

import { FullClientIntakeDossier, GovernedResearchRule, AccountingStagingRecord } from '../types/intake';

export const INITIAL_GOVERNED_RESEARCH_RULES: GovernedResearchRule[] = [
  {
    id: 'rule_irs_w2',
    entityType: 'all',
    taxYear: 2025,
    jurisdictionLevel: 'federal',
    jurisdictionCode: 'US',
    triggerCondition: 'Taxpayer or spouse reports wage employment or officer compensation',
    requiredDocumentName: 'Form W-2 Wage and Tax Statement',
    documentCategory: 'w2',
    officialSourceCitation: 'IRC § 6051(a); Treas. Reg. § 31.6051-1',
    sourceUrl: 'https://www.irs.gov/forms-pubs/about-form-w-2',
    dateLastVerified: '2026-01-15',
    professionalApprover: 'Desmond Hinds, RTRP ProAdvisor',
    ruleVersion: '2025.1.0'
  },
  {
    id: 'rule_irs_1099nec',
    entityType: 'all',
    taxYear: 2025,
    jurisdictionLevel: 'federal',
    jurisdictionCode: 'US',
    triggerCondition: 'Taxpayer receives $600 or more in nonemployee compensation or independent contract payments',
    requiredDocumentName: 'Form 1099-NEC Nonemployee Compensation',
    documentCategory: '1099',
    officialSourceCitation: 'IRC § 6041A; Treas. Reg. § 1.6041A-1',
    sourceUrl: 'https://www.irs.gov/forms-pubs/about-form-1099-nec',
    dateLastVerified: '2026-01-15',
    professionalApprover: 'Desmond Hinds, RTRP ProAdvisor',
    ruleVersion: '2025.1.0'
  },
  {
    id: 'rule_irs_1098_mortgage',
    entityType: 'individual',
    taxYear: 2025,
    jurisdictionLevel: 'federal',
    jurisdictionCode: 'US',
    triggerCondition: 'Taxpayer claims home mortgage interest itemized deduction on Schedule A',
    requiredDocumentName: 'Form 1098 Mortgage Interest Statement',
    documentCategory: 'deductions',
    officialSourceCitation: 'IRC § 6050H; Treas. Reg. § 1.6050H-1',
    sourceUrl: 'https://www.irs.gov/forms-pubs/about-form-1098',
    dateLastVerified: '2026-01-18',
    professionalApprover: 'Elena Rostova, CPA',
    ruleVersion: '2025.1.0'
  },
  {
    id: 'rule_irs_k1_passthrough',
    entityType: 'all',
    taxYear: 2025,
    jurisdictionLevel: 'federal',
    jurisdictionCode: 'US',
    triggerCondition: 'Taxpayer holds partner, shareholder, or beneficiary interest in passthrough entity',
    requiredDocumentName: 'Schedule K-1 (Form 1065, 1120-S, or 1041)',
    documentCategory: 'k1',
    officialSourceCitation: 'IRC § 6031(b); IRC § 6037(b)',
    sourceUrl: 'https://www.irs.gov/forms-pubs/about-schedule-k-1-form-1065',
    dateLastVerified: '2026-01-20',
    professionalApprover: 'Desmond Hinds, RTRP ProAdvisor',
    ruleVersion: '2025.1.0'
  },
  {
    id: 'rule_irs_scorp_officer_comp',
    entityType: 'scorp',
    taxYear: 2025,
    jurisdictionLevel: 'federal',
    jurisdictionCode: 'US',
    triggerCondition: 'S-Corporation operating with shareholder-employees receiving distributions',
    requiredDocumentName: 'Form 941 Quarterly Federal Payroll Tax Returns & Form W-2',
    documentCategory: 'payroll',
    officialSourceCitation: 'Rev. Rul. 74-44, 1974-1 C.B. 287; IRC § 3121',
    sourceUrl: 'https://www.irs.gov/businesses/small-businesses-self-employed/s-corporation-compensation-and-medical-insurance-issues',
    dateLastVerified: '2026-01-10',
    professionalApprover: 'Elena Rostova, CPA',
    ruleVersion: '2025.1.0'
  },
  {
    id: 'rule_sc_dor_withholding',
    entityType: 'all',
    taxYear: 2025,
    jurisdictionLevel: 'state',
    jurisdictionCode: 'SC',
    triggerCondition: 'Business pays wages to South Carolina resident or nonresident employees working in SC',
    requiredDocumentName: 'SC Form WH-1605 / WH-1606 State Withholding Returns',
    documentCategory: 'state_tax',
    officialSourceCitation: 'S.C. Code Ann. § 12-8-520; SC Department of Revenue',
    sourceUrl: 'https://dor.sc.gov/tax/withholding',
    dateLastVerified: '2026-01-22',
    professionalApprover: 'Desmond Hinds, RTRP ProAdvisor',
    ruleVersion: '2025.1.0'
  },
  {
    id: 'rule_foreign_fbar_trigger',
    entityType: 'all',
    taxYear: 2025,
    jurisdictionLevel: 'federal',
    jurisdictionCode: 'US',
    triggerCondition: 'U.S. person has financial interest in or signature authority over foreign financial accounts exceeding $10,000 in aggregate',
    requiredDocumentName: 'FinCEN Form 114 (FBAR) & Year-End Foreign Account Statements (Professional Review Required)',
    documentCategory: 'international_tax',
    officialSourceCitation: '31 U.S.C. § 5314; 31 CFR § 1010.350',
    sourceUrl: 'https://www.fincen.gov/report-foreign-bank-and-financial-accounts',
    dateLastVerified: '2026-01-12',
    professionalApprover: 'Elena Rostova, CPA',
    ruleVersion: '2025.1.0'
  }
];

export const INITIAL_CLIENT_INTAKE_DOSSIER: FullClientIntakeDossier = {
  id: 'intake_user_client_1',
  clientId: 'user_client_1',
  clientName: 'Michael Perotti',
  legalBusinessName: 'Perotti Financial Consulting LLC',
  dbaName: 'Perotti Advisory Group',
  entityType: 'llc',
  taxYear: 2025,
  primaryJurisdiction: 'Federal & South Carolina, USA',
  assignedAccountantName: 'Desmond Hinds',
  assignedAccountantId: 'user_accountant_desmond',
  currentEngagementTitle: '2025 Form 1040 Individual & Schedule C Business Engagement',
  percentComplete: 68,
  currentSectionStep: 4,
  status: 'in_progress',

  setupAreas: [
    {
      id: 'area_business_info',
      name: 'Business Information',
      status: 'complete',
      statusLabel: 'Complete',
      badgeVariant: 'success',
      description: 'Legal business name, formation state (SC), EIN, addresses, and industry.',
      requiredForSubmission: true,
      completionPercentage: 100
    },
    {
      id: 'area_tax_info',
      name: 'Tax Information',
      status: 'complete',
      statusLabel: 'Complete',
      badgeVariant: 'success',
      description: 'Filing classification, federal tax profile, and state nexus elections.',
      requiredForSubmission: true,
      completionPercentage: 100
    },
    {
      id: 'area_owners_contacts',
      name: 'Owners and Contacts',
      status: 'complete',
      statusLabel: 'Complete',
      badgeVariant: 'success',
      description: 'Officer identity, 100% equity distribution, and BOI compliance details.',
      requiredForSubmission: true,
      completionPercentage: 100
    },
    {
      id: 'area_coa',
      name: 'Chart of Accounts',
      status: 'needs_review',
      statusLabel: 'Needs Review',
      badgeVariant: 'warning',
      description: '4 accounts mapped by AI need your confirmation or accountant review.',
      requiredForSubmission: true,
      completionPercentage: 75
    },
    {
      id: 'area_bank_accounts',
      name: 'Bank Accounts',
      status: 'missing_items',
      statusLabel: '1 Account Missing',
      badgeVariant: 'danger',
      description: 'Wells Fargo Operating account missing December 2025 statement.',
      requiredForSubmission: true,
      completionPercentage: 50
    },
    {
      id: 'area_opening_balances',
      name: 'Opening Balances',
      status: 'required',
      statusLabel: 'Required',
      badgeVariant: 'danger',
      description: 'Beginning balance as of Jan 1, 2025 must be verified and balanced.',
      requiredForSubmission: true,
      completionPercentage: 40
    },
    {
      id: 'area_financial_docs',
      name: 'Financial Documents',
      status: 'missing_items',
      statusLabel: '3 Documents Missing',
      badgeVariant: 'danger',
      description: 'Form 1098, bank statement, and mileage log pending client upload.',
      requiredForSubmission: true,
      completionPercentage: 60
    },
    {
      id: 'area_accounting_prefs',
      name: 'Accounting Preferences',
      status: 'complete',
      statusLabel: 'Complete',
      badgeVariant: 'success',
      description: 'Cash basis accounting method, fiscal year end Dec 31, QBO sync active.',
      requiredForSubmission: true,
      completionPercentage: 100
    }
  ],

  businessProfile: {
    legalBusinessName: 'Perotti Financial Consulting LLC',
    tradeNameDba: 'Perotti Advisory Group',
    entityType: 'llc',
    einMasked: '57-•••2401',
    formationState: 'SC',
    formationDate: '2021-04-14',
    fiscalYearEndMonth: 12,
    accountingMethod: 'cash',
    businessAddress: {
      street: '124 Executive Center Dr, Suite 300',
      city: 'Columbia',
      state: 'SC',
      zip: '29210'
    },
    mailingAddressSameAsBusiness: true,
    phoneUs: '803-555-0142',
    email: 'm.perotti@example.com',
    website: 'https://perotticonsulting.example.com',
    industrySector: 'Professional, Scientific, and Technical Services (NAICS 541219)',
    primaryActivityDescription: 'Financial analytics, management consulting, and strategic business valuation.',
    employeeCount: 2,
    contractorCount: 3,
    branchesCount: 1,
    reportingCurrency: 'USD',
    hasForeignActivity: true, // triggers professional review task
    hasRelatedEntities: false
  },

  jurisdictions: {
    federalFilingRequired: true,
    residentState: 'SC',
    statesOfOperation: ['SC', 'NC', 'GA'],
    statesWithEmployees: ['SC'],
    statesWithContractors: ['SC', 'NC'],
    statesWithInventory: [],
    statesWithProperty: ['SC'],
    statesWithSalesNexus: ['SC'],
    stateTaxAccounts: [
      {
        state: 'SC',
        accountType: 'income_tax',
        maskedAccountNumber: 'SC-••••8912'
      },
      {
        state: 'SC',
        accountType: 'withholding',
        maskedAccountNumber: 'WH-••••3411'
      }
    ],
    localJurisdictions: ['City of Columbia Business License', 'Richland County Assessor']
  },

  entitySpecificDetails: {
    individual: {
      filingStatus: 'married_filing_jointly',
      dependentsCount: 2,
      hadHealthInsuranceMarketplace: false,
      madeEstimatedTaxes: true,
      estimatedTaxAmount: 18400
    },
    soleProprietor: {
      businessName: 'Perotti Financial Consulting LLC',
      principalActivity: 'Management Consulting Services',
      homeOfficeDeductionClaimed: true,
      homeOfficeSquareFootage: 280,
      businessMileage: 6420,
      mileageMethod: 'standard_rate',
      inventoryAtYearEnd: 0
    }
  },

  ownersAndContacts: [
    {
      id: 'owner_1',
      legalName: 'Michael Perotti',
      role: 'Managing Member & Principal',
      title: 'Managing Member',
      email: 'm.perotti@example.com',
      phone: '803-555-0142',
      ownershipPercentage: 100,
      startDate: '2021-04-14',
      isUsResident: true,
      isAuthorizedSignatory: true,
      isResponsibleParty: true,
      approvalAuthorityLevel: 'full',
      portalAccessRole: 'owner',
      authorizedAccountingContact: true,
      authorizedBillingContact: true,
      isBoiBeneficialOwner: true,
      maskedSsnOrTin: '•••-••-4912'
    }
  ],

  accountingSetup: {
    accountingMethod: 'cash',
    chartOfAccountsSource: 'qbo_sync',
    chartOfAccounts: [
      {
        id: 'coa_1010',
        code: '1010',
        name: 'Operating Checking Account (Wells Fargo)',
        type: 'asset',
        subType: 'cash_and_bank',
        balance: 38450.25,
        accountantApproved: true
      },
      {
        id: 'coa_1020',
        code: '1020',
        name: 'Money Market Reserve (First Citizens Bank)',
        type: 'asset',
        subType: 'cash_and_bank',
        balance: 52100.00,
        accountantApproved: true
      },
      {
        id: 'coa_1200',
        code: '1200',
        name: 'Accounts Receivable',
        type: 'asset',
        subType: 'accounts_receivable',
        balance: 14200.00,
        accountantApproved: true
      },
      {
        id: 'coa_2000',
        code: '2000',
        name: 'Accounts Payable',
        type: 'liability',
        subType: 'current_liabilities',
        balance: 3850.00,
        accountantApproved: true
      },
      {
        id: 'coa_4000',
        code: '4000',
        name: 'Advisory & Consulting Revenue',
        type: 'revenue',
        subType: 'operating_revenue',
        balance: 248900.00,
        accountantApproved: true
      },
      {
        id: 'coa_6100',
        code: '6100',
        name: 'Independent Subcontractors',
        type: 'expense',
        subType: 'operating_expenses',
        balance: 34800.00,
        mappingSuggestion: 'IRS Schedule C Line 11 (Contract Labor)',
        mappingConfidence: 96,
        accountantApproved: false,
        notes: 'AI mapped to Contract Labor. Needs CPA Desmond review.'
      },
      {
        id: 'coa_6200',
        code: '6200',
        name: 'Software, SaaS & IT Cloud Tools',
        type: 'expense',
        subType: 'operating_expenses',
        balance: 7850.00,
        mappingSuggestion: 'IRS Schedule C Line 27a (Other Expenses - Cloud Tech)',
        mappingConfidence: 94,
        accountantApproved: false
      }
    ],
    bankAccounts: [
      {
        id: 'bank_acc_1',
        institutionName: 'Wells Fargo Bank, N.A.',
        accountType: 'checking',
        maskedAccountNumber: '••••4829',
        routingNumberMasked: '••••0514',
        currency: 'USD',
        openingBalance: 24192.40,
        openingBalanceDate: '2025-01-01',
        currentReconciliationStatus: 'needs_review',
        feedConnected: true,
        lastStatementUploadedDate: '2025-11-30'
      },
      {
        id: 'bank_acc_2',
        institutionName: 'First Citizens Bank',
        accountType: 'money_market',
        maskedAccountNumber: '••••9120',
        routingNumberMasked: '••••3810',
        currency: 'USD',
        openingBalance: 50000.00,
        openingBalanceDate: '2025-01-01',
        currentReconciliationStatus: 'reconciled',
        feedConnected: true,
        lastStatementUploadedDate: '2025-12-31'
      }
    ],
    openingBalancesRecorded: true,
    openingBalancesDebitTotal: 74192.40,
    openingBalancesCreditTotal: 74192.40,
    openingBalancesBalanced: true,
    accountsReceivableBalance: 14200.00,
    accountsPayableBalance: 3850.00,
    fixedAssetsRecorded: true,
    depreciationSchedulesAvailable: true,
    inventoryMethod: 'none',
    currentSoftware: 'QuickBooks Online Plus'
  },

  businessOperations: {
    acceptsCreditCards: true,
    acceptsCashOver10k: false,
    acceptsEWallets: true,
    sellsOnOnlineMarketplaces: false,
    holdsInventory: false,
    pays1099Contractors: true,
    contractor1099Issued: true,
    hasCommercialLoans: false,
    hasEquipmentLeases: true,
    sponsorsRetirementPlan: true,
    sponsorsGroupHealth: true,
    conductsRdActivities: false,
    holdsGovernmentContracts: false
  },

  crossBorderTriggers: {
    hasForeignBankAccounts: true, // User selected YES
    hasForeignBusinessInterests: false,
    hasForeignTrustsOrGifts: false,
    hasForeignCryptoExchanges: false,
    hasForeignTaxesPaid: false,
    generatedReviewTasks: [
      {
        id: 'task_crossborder_1',
        clientId: 'user_client_1',
        taxYear: 2025,
        triggerField: 'hasForeignBankAccounts',
        triggerValue: 'Canadian consulting deposit account ($14,200 max aggregate value)',
        recommendedFormsToInspect: ['FinCEN_114_FBAR', 'Form_8938'],
        mandatedByStaff: false, // Must not be automated without CPA sign-off!
        createdAt: '2026-02-15T10:00:00Z'
      }
    ]
  },

  documentChecklist: [
    {
      id: 'chk_1',
      category: 'w2',
      title: 'Form W-2 Wage & Tax Statements',
      description: 'All 2025 W-2 statements from all employers.',
      required: true,
      status: 'approved',
      uploadedDocId: 'doc_w2_2025_01',
      fileName: '2025_W2_Perotti_Consulting.pdf',
      aiConfidence: 96
    },
    {
      id: 'chk_2',
      category: '1099',
      title: 'Form 1099-NEC / 1099-MISC',
      description: 'Non-employee compensation slips from clients.',
      required: true,
      status: 'approved',
      uploadedDocId: 'doc_1099_2025_01',
      fileName: '2025_1099NEC_Stripe_Payments.pdf',
      aiConfidence: 94
    },
    {
      id: 'chk_3',
      category: 'banking',
      title: 'December 2025 Bank Statements',
      description: 'Closing statement for Wells Fargo Operating Checking (acct ••••4829).',
      required: true,
      status: 'missing'
    },
    {
      id: 'chk_4',
      category: 'deductions',
      title: 'Form 1098 Mortgage Interest Statement',
      description: 'Issued by mortgage servicer showing total deductible interest.',
      required: true,
      status: 'missing'
    },
    {
      id: 'chk_5',
      category: 'deductions',
      title: 'Annual Written Mileage Log Summary',
      description: 'Required by IRS IRC § 274(d) to substantiate 6,420 business miles.',
      required: true,
      status: 'missing'
    }
  ],

  preferencesAndConsents: {
    preferredContactMethod: 'portal',
    preferredConsultationSchedule: 'morning',
    timeZone: 'America/New_York (EST)',
    electronicDeliveryConsentDate: '2026-01-15T11:00:00Z',
    engagementLetterAcceptedDate: '2026-01-15T11:02:00Z',
    privacyConsentDate: '2026-01-15T11:02:00Z',
    aiDocumentIntelligenceConsentDate: '2026-01-15T11:03:00Z',
    consentVersion: 'v2026.1',
    electronicSignature: 'Michael Perotti',
    submissionTimestamp: '2026-01-15T11:04:00Z'
  },

  accountantCorrections: [
    {
      id: 'corr_1',
      section: 'area_bank_accounts',
      instructions: 'Please upload the final December 31, 2025 bank statement for Wells Fargo checking account so we can complete bank reconciliation before drafting Schedule C.',
      requestedAt: '2026-03-02T14:30:00Z',
      requestedBy: 'Desmond Hinds',
      resolved: false
    }
  ],

  createdAt: '2026-01-15T10:00:00Z',
  updatedAt: '2026-03-02T14:30:00Z'
};

export const INITIAL_ACCOUNTING_STAGING_RECORDS: AccountingStagingRecord[] = [
  {
    id: 'stage_rec_001',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    sourceDocumentId: 'doc_w2_2025_01',
    sourceDocumentName: '2025_W2_Perotti_Consulting.pdf',
    sourcePageNumber: 1,
    recordType: 'payroll_summary',
    date: '2025-12-31',
    period: '2025-12',
    description: 'Annual Form W-2 Box 1 Taxable Wages - Desmond Hinds Review',
    amount: 185000.00,
    debitAmount: 185000.00,
    creditAmount: 0,
    suggestedAccountCode: '6000',
    suggestedAccountName: 'Officer & Executive Wages',
    confidenceScore: 97,
    aiModelVersion: 'Gemini 3.8 Flash + OCR',
    status: 'accountant_approved',
    reviewedBy: 'Desmond Hinds',
    reviewedAt: '2026-02-18T10:15:00Z',
    isDuplicateFlag: false,
    auditTrail: [
      {
        action: 'EXTRACTED_BY_AI',
        actor: 'Gemini 3.8 Flash Engine',
        timestamp: '2026-02-17T15:20:00Z'
      },
      {
        action: 'DETERMINISTIC_RULES_PASSED',
        actor: 'IRS Form Rules Engine',
        timestamp: '2026-02-17T15:20:02Z',
        notes: 'SS Wages and Medicare Wages reconciled.'
      },
      {
        action: 'ACCOUNTANT_APPROVED',
        actor: 'Desmond Hinds, RTRP ProAdvisor',
        timestamp: '2026-02-18T10:15:00Z',
        notes: 'Verified against QBO payroll journal. Ready for posting.'
      }
    ]
  },
  {
    id: 'stage_rec_002',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    sourceDocumentId: 'doc_1099_2025_01',
    sourceDocumentName: '2025_1099NEC_Stripe_Payments.pdf',
    sourcePageNumber: 1,
    recordType: 'receipt',
    date: '2025-12-31',
    period: '2025-12',
    description: 'Form 1099-NEC Box 1 Nonemployee Compensation (Gross Platform Receipts)',
    amount: 34800.00,
    debitAmount: 0,
    creditAmount: 34800.00,
    suggestedAccountCode: '4000',
    suggestedAccountName: 'Advisory & Consulting Revenue',
    confidenceScore: 95,
    aiModelVersion: 'Gemini 3.8 Flash + OCR',
    status: 'needs_review',
    isDuplicateFlag: false,
    auditTrail: [
      {
        action: 'EXTRACTED_BY_AI',
        actor: 'Gemini 3.8 Flash Engine',
        timestamp: '2026-02-17T15:22:00Z'
      },
      {
        action: 'STAGED_FOR_ACCOUNTANT_REVIEW',
        actor: 'Staging Engine',
        timestamp: '2026-02-17T15:22:05Z',
        notes: 'Requires CPA verification that gross merchant revenue is not double-counted with bank deposits.'
      }
    ]
  },
  {
    id: 'stage_rec_003',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    sourceDocumentId: 'doc_bank_stmt_nov25',
    sourceDocumentName: 'WellsFargo_Nov2025_Statement.pdf',
    sourcePageNumber: 3,
    recordType: 'bank_transaction',
    date: '2025-11-14',
    period: '2025-11',
    description: 'ACH DEBIT: AWS CLOUD HOSTING SERVICES',
    amount: 642.50,
    debitAmount: 642.50,
    creditAmount: 0,
    suggestedAccountCode: '6200',
    suggestedAccountName: 'Software, SaaS & IT Cloud Tools',
    confidenceScore: 94,
    aiModelVersion: 'Gemini 3.8 Flash + OCR',
    status: 'ready_for_posting',
    isDuplicateFlag: false,
    auditTrail: [
      {
        action: 'EXTRACTED_BY_AI',
        actor: 'Gemini 3.8 Flash Engine',
        timestamp: '2026-02-16T11:00:00Z'
      },
      {
        action: 'ACCOUNTANT_APPROVED',
        actor: 'Desmond Hinds, RTRP ProAdvisor',
        timestamp: '2026-02-17T09:30:00Z',
        notes: 'Approved debit to IT Cloud Tools.'
      }
    ]
  },
  {
    id: 'stage_rec_004',
    clientId: 'user_client_1',
    clientName: 'Michael Perotti',
    sourceDocumentId: 'doc_receipt_laptop_2025',
    sourceDocumentName: 'AppleStore_Receipt_MacBookPro_Nov2025.pdf',
    sourcePageNumber: 1,
    recordType: 'fixed_asset',
    date: '2025-11-20',
    period: '2025-11',
    description: 'MacBook Pro 16" M3 Max for Business Use',
    amount: 3899.00,
    debitAmount: 3899.00,
    creditAmount: 0,
    suggestedAccountCode: '1500',
    suggestedAccountName: 'Computer Equipment & Hardware (Fixed Asset)',
    confidenceScore: 91,
    aiModelVersion: 'Gemini 3.8 Flash + OCR',
    status: 'needs_review',
    isDuplicateFlag: false,
    auditTrail: [
      {
        action: 'EXTRACTED_BY_AI',
        actor: 'Gemini 3.8 Flash Engine',
        timestamp: '2026-02-16T11:05:00Z'
      },
      {
        action: 'STAGED_FOR_DEPRECIATION_REVIEW',
        actor: 'Staging Engine',
        timestamp: '2026-02-16T11:05:10Z',
        notes: 'Eligible for IRC § 179 expensing or de minimis safe harbor ($2,500 threshold test requires review).'
      }
    ]
  }
];
