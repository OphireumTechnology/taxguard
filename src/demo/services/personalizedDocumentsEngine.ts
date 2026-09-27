/**
 * A/R Tax Services, LLC - Personalized Documents & Multi-State Compliance Engine
 * Federal + CA, NY, NC, SC, VA, TN, FL, NJ
 *
 * Implements:
 * - Dynamic intake rules engine mapping client facts to required/recommended/optional tax documents
 * - State rule engine for all 8 core markets (handling no-income-tax states FL & TN accurately)
 * - 8 realistic Demo Taxpayer Profiles (clearly labeled DEMO / FICTIONAL TAXPAYER)
 * - 14 distinct workflow and review statuses
 * - Multi-document support (multiple W-2s, 1099s, K-1s)
 * - OCR field extraction schemas with audit trail (Original -> Extracted -> Corrected -> Reviewed)
 * - Duplicate upload detection and tax-year mismatch detection
 * - Federal, State, and Overall Tax Package Readiness calculation
 * - Tax professional override capabilities with audit logging
 */

import { DemoClient, DemoDocument } from '../types';

export type DocumentStatus =
  | 'Required'
  | 'Required if applicable'
  | 'Recommended'
  | 'Optional'
  | 'Received'
  | 'Processing'
  | 'AI Review'
  | 'Needs Review'
  | 'Accepted'
  | 'Rejected / Replace'
  | 'Missing'
  | 'Not Applicable'
  | 'Awaiting Client'
  | 'Awaiting Tax Professional';

export type PriorityLevel = 'Required' | 'Required if applicable' | 'Recommended' | 'Optional';

export type DocumentCategory =
  | 'Employment'
  | 'Contract / Gig Work'
  | 'Other Payments'
  | 'Interest'
  | 'Dividends'
  | 'Brokerage / Investments'
  | 'Payment Processing'
  | 'Retirement'
  | 'Government Payments'
  | 'Social Security / Railroad Retirement'
  | 'Partnership / S Corporation / Estate / Trust'
  | 'Mortgage Interest'
  | 'Education'
  | 'Student Loans'
  | 'Foreclosure / Abandonment'
  | 'Cancelled Debt'
  | 'Real Estate Sale'
  | 'HSA / MSA'
  | 'IRA Contributions'
  | 'Marketplace Insurance'
  | 'Long-Term Care'
  | 'ABLE Accounts'
  | 'Education Plans'
  | 'Identity & Dependents'
  | 'Deductions & Expenses'
  | 'State Specific'
  | 'Prior Year / Archival';

export type TargetJurisdiction =
  | 'Federal'
  | 'CA'
  | 'NY'
  | 'NC'
  | 'SC'
  | 'VA'
  | 'TN'
  | 'FL'
  | 'NJ'
  | 'Multi-State';

export interface OcrAuditEntry {
  field: string;
  originalValue: string;
  extractedValue: string;
  correctedValue?: string;
  finalReviewedValue: string;
  reviewer: string;
  timestamp: string;
  confidence: number;
}

export interface PersonalizedDocItem {
  id: string;
  formNumber: string;
  title: string;
  category: DocumentCategory;
  whyWeNeedIt: string;
  whereCanIFindIt: string;
  whyAmIAsked: string;
  source: 'Taxpayer' | 'Employer' | 'Bank' | 'Brokerage' | 'Government' | 'Marketplace' | 'Entity Issuer' | 'Lender' | 'Educational Institution' | 'Other';
  appliesTo: TargetJurisdiction;
  stateCode?: string;
  taxYear: number;
  priority: PriorityLevel;
  status: DocumentStatus;
  instanceIndex?: number;
  totalInstances?: number;
  isMultiInstanceAllowed?: boolean;
  uploadedFileName?: string;
  uploadedFileSize?: string;
  uploadedDate?: string;
  fileHash?: string;
  confidenceScore?: number;
  confidenceTier?: 'High' | 'Medium' | 'Low';
  ocrData?: Record<string, string | number>;
  ocrAudit?: OcrAuditEntry[];
  possibleDuplicateOf?: string;
  taxYearMismatch?: boolean;
  mismatchDetectedYear?: number;
  notApplicableReason?: string;
  needsReviewReason?: string;
  professionalOverrideNote?: string;
  overriddenBy?: string;
  overriddenAt?: string;
  accountantApproved?: boolean;
  reviewedBy?: string;
  requiresReviewReason?: boolean;
  whyWeNeedItNotice?: string;
  autoMatchedFromVault?: boolean;
  matchedVaultDocumentId?: string;
}

export interface IntakeResponses {
  taxYear: number;
  residenceState: 'CA' | 'NY' | 'NC' | 'SC' | 'VA' | 'TN' | 'FL' | 'NJ';
  workStates: ('CA' | 'NY' | 'NC' | 'SC' | 'VA' | 'TN' | 'FL' | 'NJ')[];
  hasOtherStateIncome: boolean;
  filingStatus: 'Single' | 'Married Filing Jointly' | 'Married Filing Separately' | 'Head of Household' | 'Qualifying Surviving Spouse';
  hadW2Employment: boolean;
  w2Count: number;
  hadFreelanceOrContract: boolean;
  received1099MISC?: boolean;
  receivedInterest?: boolean;
  receivedDividends?: boolean;
  receivedInterestOrDividends: boolean;
  soldInvestments: boolean;
  received1099K: boolean;
  receivedRetirementDistributions: boolean;
  receivedGovernmentPayments?: boolean;
  receivedSocialSecurity: boolean;
  hasPassThroughK1: boolean;
  hasMortgage: boolean;
  hasCollegeOrTuition: boolean;
  paysStudentLoanInterest: boolean;
  hasForeclosureOrAbandonment?: boolean;
  hasCancelledDebt?: boolean;
  hasCancelledDebtOrForeclosure: boolean;
  soldRealEstate: boolean;
  hasHSAorMSA: boolean;
  contributedToIRA: boolean;
  hasMarketplaceInsurance: boolean;
  hasLongTermCare?: boolean;
  hasABLEAccount?: boolean;
  hasEducationPlans?: boolean;
  hasOwnBusiness: boolean;
  hasCryptoTransactions: boolean;
  ownsRealEstate: boolean;
  ownsRentalProperty: boolean;
  hasForeignAccountsOrIncome: boolean;
  madeEstimatedTaxPayments: boolean;
  hasDependents: boolean;
  paidChildcare: boolean;
  receivedUnemployment: boolean;
}

export interface StandardTaxFormDef {
  id: string;
  category: DocumentCategory;
  formNumber: string;
  title: string;
  description: string;
  whyWeNeedIt: string;
  whereCanIFindIt: string;
  whyAmIAsked: string;
  source: PersonalizedDocItem['source'];
  intakeKey: keyof IntakeResponses;
  priority: PriorityLevel;
}

export const ALL_STANDARD_TAX_FORMS: StandardTaxFormDef[] = [
  {
    id: 'form_w2',
    category: 'Employment',
    formNumber: 'W-2',
    title: 'Wage and Tax Statement',
    description: 'Wages, salary, withholding',
    whyWeNeedIt: 'Reports wages, salaries, tips, federal, state, and local income tax withholdings, and FICA taxes.',
    whereCanIFindIt: 'Issued by your employer (usually accessible via employer payroll portal ADP, Workday, Gusto or mailed by Jan 31).',
    whyAmIAsked: 'Required to report earned wages and claim tax withholdings on Form 1040.',
    source: 'Employer',
    intakeKey: 'hadW2Employment',
    priority: 'Required'
  },
  {
    id: 'form_1099_nec',
    category: 'Contract / Gig Work',
    formNumber: '1099-NEC',
    title: 'Nonemployee Compensation',
    description: 'Nonemployee compensation',
    whyWeNeedIt: 'Reports fees, commissions, or other compensation of $600 or more paid to non-employees/independent contractors.',
    whereCanIFindIt: 'Provided by companies, clients, or platforms you performed services for.',
    whyAmIAsked: 'Required to report self-employment gross receipts on Schedule C.',
    source: 'Entity Issuer',
    intakeKey: 'hadFreelanceOrContract',
    priority: 'Required'
  },
  {
    id: 'form_1099_misc',
    category: 'Other Payments',
    formNumber: '1099-MISC',
    title: 'Miscellaneous Information',
    description: 'Rents, prizes, certain other payments',
    whyWeNeedIt: 'Reports rents, royalties, prizes, awards, medical payments, and other miscellaneous income.',
    whereCanIFindIt: 'Issued by payers of rents, sweepstakes, legal settlements, or royalty administrators.',
    whyAmIAsked: 'Required to accurately report other income sources on Schedule 1 or Schedule E.',
    source: 'Entity Issuer',
    intakeKey: 'received1099MISC',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1099_int',
    category: 'Interest',
    formNumber: '1099-INT',
    title: 'Interest Income',
    description: 'Bank and investment interest',
    whyWeNeedIt: 'Reports taxable interest of $10 or more from bank accounts, certificates of deposit (CDs), and bonds.',
    whereCanIFindIt: 'Download from your online banking portal or consolidated year-end tax packet.',
    whyAmIAsked: 'Required to report taxable and tax-exempt interest on Schedule B.',
    source: 'Bank',
    intakeKey: 'receivedInterest',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1099_div',
    category: 'Dividends',
    formNumber: '1099-DIV',
    title: 'Dividends and Distributions',
    description: 'Dividends and distributions',
    whyWeNeedIt: 'Distinguishes ordinary dividends from qualified dividends and capital gain distributions that qualify for lower tax rates.',
    whereCanIFindIt: 'Download from your brokerage (Schwab, Fidelity, Vanguard, Morgan Stanley) tax document center.',
    whyAmIAsked: 'Required to report investment portfolio dividend income on Schedule B and Form 1040.',
    source: 'Brokerage',
    intakeKey: 'receivedDividends',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1099_b',
    category: 'Brokerage / Investments',
    formNumber: '1099-B',
    title: 'Proceeds From Broker and Barter Exchange Transactions',
    description: 'Sales of stocks, securities and other reportable transactions',
    whyWeNeedIt: 'Reports gross sales proceeds, acquisition dates, and cost basis needed to calculate capital gains or deductible losses on Schedule D / Form 8949.',
    whereCanIFindIt: 'Download from your investment broker consolidated 1099 statement.',
    whyAmIAsked: 'Required to compute net capital gain or capital loss from securities sales.',
    source: 'Brokerage',
    intakeKey: 'soldInvestments',
    priority: 'Required'
  },
  {
    id: 'form_1099_k',
    category: 'Payment Processing',
    formNumber: '1099-K',
    title: 'Payment Card and Third-Party Network Transactions',
    description: 'Payment-card and third-party network transactions',
    whyWeNeedIt: 'Reports gross payment card and third-party app merchant settlements (Stripe, PayPal, Square, Shopify, Venmo).',
    whereCanIFindIt: 'Merchant payment portal settings under Tax Documents.',
    whyAmIAsked: 'Required to reconcile gross business revenue and avoid duplicate or omitted income audits.',
    source: 'Entity Issuer',
    intakeKey: 'received1099K',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1099_r',
    category: 'Retirement',
    formNumber: '1099-R',
    title: 'Distributions From Pensions, Annuities, Retirement Plans, IRAs',
    description: 'Pensions, IRAs and retirement distributions',
    whyWeNeedIt: 'Reports gross distributions, taxable amounts, and federal/state withholding from 401(k), IRA, pension, or annuity plans.',
    whereCanIFindIt: 'Retirement plan administrator (Empower, Fidelity, Vanguard, pension portal).',
    whyAmIAsked: 'Required to calculate taxable portion of retirement income and verify qualified rollovers.',
    source: 'Brokerage',
    intakeKey: 'receivedRetirementDistributions',
    priority: 'Required'
  },
  {
    id: 'form_1099_g',
    category: 'Government Payments',
    formNumber: '1099-G',
    title: 'Certain Government Payments',
    description: 'Unemployment compensation, certain state/local refunds and other government payments',
    whyWeNeedIt: 'Reports state unemployment compensation, state/local tax refunds received, or taxable government grants.',
    whereCanIFindIt: 'State Department of Labor or State Department of Revenue portal.',
    whyAmIAsked: 'Required to report taxable government benefit income and determine state refund taxability.',
    source: 'Government',
    intakeKey: 'receivedGovernmentPayments',
    priority: 'Required if applicable'
  },
  {
    id: 'form_ssa_1099',
    category: 'Social Security / Railroad Retirement',
    formNumber: 'SSA-1099 / RRB-1099',
    title: 'Social Security / Railroad Retirement Benefits',
    description: 'Social Security / railroad retirement benefits',
    whyWeNeedIt: 'Reports total Social Security or Railroad Retirement benefits paid to determine taxable amount under IRC § 86.',
    whereCanIFindIt: 'Mailed annually in January by the Social Security Administration or downloaded at ssa.gov.',
    whyAmIAsked: 'Required to compute taxable Social Security benefits on Form 1040.',
    source: 'Government',
    intakeKey: 'receivedSocialSecurity',
    priority: 'Required'
  },
  {
    id: 'form_k1',
    category: 'Partnership / S Corporation / Estate / Trust',
    formNumber: 'Schedule K-1',
    title: 'Partner / Shareholder Share of Income, Deductions, Credits (1065 / 1120-S)',
    description: 'Pass-through income, deductions and credits',
    whyWeNeedIt: 'Passes through net profits, losses, deductions, guaranteed payments, and Section 199A QBID information from entities.',
    whereCanIFindIt: 'Issued by the partnership managing partner, S-Corporation corporate secretary, or estate fiduciary.',
    whyAmIAsked: 'Required to report pass-through entity income on Schedule E.',
    source: 'Entity Issuer',
    intakeKey: 'hasPassThroughK1',
    priority: 'Required'
  },
  {
    id: 'form_1098',
    category: 'Mortgage Interest',
    formNumber: '1098',
    title: 'Mortgage Interest Statement',
    description: 'Mortgage interest',
    whyWeNeedIt: 'Reports deductible mortgage interest, points paid, and real estate taxes paid from escrow under IRC § 163.',
    whereCanIFindIt: 'Mortgage servicer website (e.g. Chase, Wells Fargo, Rocket Mortgage) or annual statement.',
    whyAmIAsked: 'Used for itemized deductions on Schedule A or rental expense on Schedule E.',
    source: 'Lender',
    intakeKey: 'hasMortgage',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1098_t',
    category: 'Education',
    formNumber: '1098-T',
    title: 'Tuition Statement',
    description: 'Tuition and education information',
    whyWeNeedIt: 'Reports qualified tuition payments (Box 1) and scholarships/grants (Box 5) for education credits (AOTC / LLC).',
    whereCanIFindIt: 'College or university bursar or registrar student portal.',
    whyAmIAsked: 'Required to claim American Opportunity Tax Credit or Lifetime Learning Credit on Form 8863.',
    source: 'Educational Institution',
    intakeKey: 'hasCollegeOrTuition',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1098_e',
    category: 'Student Loans',
    formNumber: '1098-E',
    title: 'Student Loan Interest Statement',
    description: 'Student-loan interest',
    whyWeNeedIt: 'Reports student loan interest paid during the year for an above-the-line deduction up to $2,500 under IRC § 221.',
    whereCanIFindIt: 'Student loan servicer portal (Nelnet, MOHELA, Aidvantage, Sallie Mae).',
    whyAmIAsked: 'Allows an above-the-line deduction reducing Adjusted Gross Income.',
    source: 'Lender',
    intakeKey: 'paysStudentLoanInterest',
    priority: 'Recommended'
  },
  {
    id: 'form_1099_a',
    category: 'Foreclosure / Abandonment',
    formNumber: '1099-A',
    title: 'Acquisition or Abandonment of Secured Property',
    description: 'Acquisition or abandonment of secured property',
    whyWeNeedIt: 'Reports foreclosure, repossession, or abandonment of property that secured a loan to compute gain or loss.',
    whereCanIFindIt: 'Issued by the lender or financial institution that held the loan.',
    whyAmIAsked: 'Required to determine tax consequences of property surrender or abandonment.',
    source: 'Lender',
    intakeKey: 'hasForeclosureOrAbandonment',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1099_c',
    category: 'Cancelled Debt',
    formNumber: '1099-C',
    title: 'Cancellation of Debt',
    description: 'Cancellation of debt',
    whyWeNeedIt: 'Reports discharge or forgiveness of indebtedness of $600 or more to evaluate cancellation of debt income or statutory exclusions under IRC § 108.',
    whereCanIFindIt: 'Issued by the creditor or financial institution that cancelled or settled the debt.',
    whyAmIAsked: 'Required to assess taxability or qualify for insolvency exclusions on Form 982.',
    source: 'Lender',
    intakeKey: 'hasCancelledDebt',
    priority: 'Required'
  },
  {
    id: 'form_1099_s',
    category: 'Real Estate Sale',
    formNumber: '1099-S',
    title: 'Proceeds From Real Estate Transactions',
    description: 'Proceeds from real-estate transactions',
    whyWeNeedIt: 'Reports gross proceeds from the sale or exchange of real estate, land, or commercial/residential property.',
    whereCanIFindIt: 'Provided at settlement by the title company, escrow agent, or closing attorney.',
    whyAmIAsked: 'Required to calculate capital gain or verify the Section 121 home sale exclusion.',
    source: 'Other',
    intakeKey: 'soldRealEstate',
    priority: 'Required'
  },
  {
    id: 'form_1099_sa',
    category: 'HSA / MSA',
    formNumber: '1099-SA / 5498-SA',
    title: 'HSA / MSA Distributions & Contributions Statement',
    description: 'HSA/MSA distributions and contributions',
    whyWeNeedIt: 'Reports HSA/MSA distributions (1099-SA) and contributions (5498-SA) to file Form 8889 and avoid penalties.',
    whereCanIFindIt: 'HSA custodian online portal (Optum, Fidelity, HSA Bank, HealthEquity).',
    whyAmIAsked: 'Required to reconcile qualified medical expenses and deduct HSA contributions on Form 8889.',
    source: 'Bank',
    intakeKey: 'hasHSAorMSA',
    priority: 'Required'
  },
  {
    id: 'form_5498',
    category: 'IRA Contributions',
    formNumber: '5498',
    title: 'IRA Contribution Information',
    description: 'IRA contribution information',
    whyWeNeedIt: 'Reports Traditional IRA, Roth IRA, SEP-IRA, or SIMPLE IRA contributions, rollovers, and year-end fair market value.',
    whereCanIFindIt: 'IRA custodian or brokerage tax documents portal.',
    whyAmIAsked: 'Required to document deductible IRA contributions and track nondeductible basis on Form 8606.',
    source: 'Brokerage',
    intakeKey: 'contributedToIRA',
    priority: 'Recommended'
  },
  {
    id: 'form_1095_a',
    category: 'Marketplace Insurance',
    formNumber: '1095-A',
    title: 'Health Insurance Marketplace Statement',
    description: 'Health Insurance Marketplace coverage',
    whyWeNeedIt: 'CRITICAL: Reconciles the Advance Premium Tax Credit (APTC) on Form 8962. Omission causes immediate IRS e-file rejection.',
    whereCanIFindIt: 'Healthcare.gov or state marketplace account (Covered CA, NY State of Health, etc.).',
    whyAmIAsked: 'Mandatory if anyone in your tax household enrolled in health coverage via the Marketplace.',
    source: 'Marketplace',
    intakeKey: 'hasMarketplaceInsurance',
    priority: 'Required'
  },
  {
    id: 'form_1099_ltc',
    category: 'Long-Term Care',
    formNumber: '1099-LTC',
    title: 'Long-Term Care and Accelerated Death Benefits',
    description: 'Long-term-care and accelerated death benefits',
    whyWeNeedIt: 'Reports payments received from qualified long-term care insurance policies or accelerated death benefits under life insurance.',
    whereCanIFindIt: 'Issued by the insurance company providing long-term care or life insurance benefits.',
    whyAmIAsked: 'Required to report qualified benefits on Form 8853 to determine tax-free status.',
    source: 'Other',
    intakeKey: 'hasLongTermCare',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1099_qa',
    category: 'ABLE Accounts',
    formNumber: '1099-QA / 5498-QA',
    title: 'ABLE Account Distributions & Contributions',
    description: 'ABLE distributions/contributions',
    whyWeNeedIt: 'Reports distributions and contributions for individuals with disabilities under IRC Section 529A Achieving a Better Life Experience (ABLE) programs.',
    whereCanIFindIt: 'State ABLE program administrator online portal.',
    whyAmIAsked: 'Required to confirm distributions were spent on qualified disability expenses.',
    source: 'Bank',
    intakeKey: 'hasABLEAccount',
    priority: 'Required if applicable'
  },
  {
    id: 'form_1099_q',
    category: 'Education Plans',
    formNumber: '1099-Q',
    title: 'Payments From Qualified Education Programs (Under Sections 529 & 530)',
    description: '529/Coverdell distributions',
    whyWeNeedIt: 'Reports distributions made from a 529 college savings plan or Coverdell ESA to verify tax-free educational usage.',
    whereCanIFindIt: 'State 529 plan custodian or Coverdell trustee online tax portal.',
    whyAmIAsked: 'Required to reconcile distributions against qualified higher education expenses.',
    source: 'Brokerage',
    intakeKey: 'hasEducationPlans',
    priority: 'Required if applicable'
  }
];

export interface DemoTaxpayerProfile {
  id: string;
  name: string;
  title: string;
  state: 'CA' | 'NY' | 'NC' | 'SC' | 'VA' | 'TN' | 'FL' | 'NJ';
  scenarioDescription: string;
  stateFilingNotes: string;
  intake: IntakeResponses;
  seededItems: PersonalizedDocItem[];
}

export interface ReadinessScorecard {
  totalApplicable: number;
  receivedOrAccepted: number;
  requiredTotal: number;
  requiredReceived: number;
  requiredMissing: number;
  needsReviewCount: number;
  optionalMissing: number;
  federalReadinessPct: number;
  stateReadinessPct: number;
  overallReadinessPct: number;
  filingWorkflowStage:
    | 'Documents Gathering'
    | 'Documents Complete'
    | 'Tax Preparation In Progress'
    | 'Professional Review'
    | 'Client Review'
    | 'Signature/Authorization Pending'
    | 'Ready for Filing'
    | 'Filed'
    | 'Accepted'
    | 'Action Required';
}

// --------------------------------------------------------------------------
// 8 STATE RULES & TAX PROFILES
// --------------------------------------------------------------------------

export const STATE_RULES_REGISTRY: Record<string, {
  name: string;
  hasIndividualIncomeTax: boolean;
  returnFormName: string;
  governingAgency: string;
  keyComplianceFeatures: string[];
  exemptionsOrCredits: string[];
  statutoryWarning?: string;
}> = {
  CA: {
    name: 'California',
    hasIndividualIncomeTax: true,
    returnFormName: 'Form 540 / 540-NR',
    governingAgency: 'California Franchise Tax Board (FTB)',
    keyComplianceFeatures: [
      'Mandatory Individual Healthcare Coverage penalty reconciliation (Form FTB 3853)',
      'State Disability Insurance (SDI) tax withholding validation (VPDI/CASDI)',
      'Schedule CA (540) adjustments: Non-conformity for HSA deductions & Section 179 limits',
      'Mental Health Services Tax (1% tax surcharge on taxable income exceeding $1,000,000)'
    ],
    exemptionsOrCredits: ['California Earned Income Tax Credit (CalEITC)', 'Young Child Tax Credit', 'Renter’s Credit']
  },
  NY: {
    name: 'New York',
    hasIndividualIncomeTax: true,
    returnFormName: 'Form IT-201 (Resident) / IT-203 (Nonresident)',
    governingAgency: 'New York Department of Taxation and Finance',
    keyComplianceFeatures: [
      'New York City (NYC) and Yonkers resident & nonresident local income tax schedules',
      'Strict "Convenience of the Employer" telecommuting doctrine for remote work out of state',
      'Pass-Through Entity Tax (PTET) credit calculation under Form IT-653',
      'Form IT-2104 Employee Withholding Allowance verification'
    ],
    exemptionsOrCredits: ['NYS / NYC Household Credit', 'Empire State Child Credit', 'Real Property Tax Credit']
  },
  NC: {
    name: 'North Carolina',
    hasIndividualIncomeTax: true,
    returnFormName: 'Form D-400',
    governingAgency: 'North Carolina Department of Revenue (NCDOR)',
    keyComplianceFeatures: [
      'Flat individual income tax rate system (statutory scheduled rate for tax year)',
      'Specific NC standard deduction: No state itemized deduction for state/local taxes (SALT)',
      'Elective Pass-Through Entity Tax (PTE) credit reconciliation (Form D-403 K-1 attachment)',
      'Add-back requirement for certain federal accelerated bonus depreciation'
    ],
    exemptionsOrCredits: ['Child Deduction based on federal AGI tiers', 'NC 529 Plan rollover considerations']
  },
  SC: {
    name: 'South Carolina',
    hasIndividualIncomeTax: true,
    returnFormName: 'Form SC1040',
    governingAgency: 'South Carolina Department of Revenue (SCDOR)',
    keyComplianceFeatures: [
      'South Carolina Act 61 Active Trade or Business Income (3% flat rate on pass-through income)',
      'South Carolina Pass-Through Entity Tax election credit (Form I-435)',
      'South Carolina Two-Wage Earner Credit (Schedule TC-48)',
      'Motor Fuel Income Tax Credit and South Carolina College Investment Program deductions'
    ],
    exemptionsOrCredits: ['Tuition Tax Credit', 'Child and Dependent Care Credit (7% of federal)', 'Nursing Home / Elder Credit']
  },
  VA: {
    name: 'Virginia',
    hasIndividualIncomeTax: true,
    returnFormName: 'Form 760 (Resident) / 760PY (Part-Year) / 763 (Nonresident)',
    governingAgency: 'Virginia Department of Taxation',
    keyComplianceFeatures: [
      'Fixed-date conformity to the Internal Revenue Code (requiring state add-backs for certain provisions)',
      'Out-of-state tax credit reconciliation (Schedule OSC) for multi-state wage earners',
      'Virginia Pass-Through Entity Tax (Form 502PTET) credit reconciliation',
      'Age Deduction for taxpayers aged 65 and older subject to income thresholds'
    ],
    exemptionsOrCredits: ['Virginia Earned Income Tax Credit', 'Credit for Low-Income Individuals (CLI)', 'Military Subtraction']
  },
  TN: {
    name: 'Tennessee',
    hasIndividualIncomeTax: false,
    returnFormName: 'None (Hall Tax Fully Repealed)',
    governingAgency: 'Tennessee Department of Revenue',
    keyComplianceFeatures: [
      'Tennessee has NO state individual income tax on wages or personal earned income.',
      'The former Hall Income Tax on interest and dividends was fully repealed effective January 1, 2021.',
      'No state individual income tax return is generated or required for individual wage earners.',
      'Only entity franchise & excise taxes (F&E) apply to chartered business entities.'
    ],
    exemptionsOrCredits: ['No state individual tax forms required.'],
    statutoryWarning: 'Notice: Tennessee does not impose an individual personal income tax. No state individual return will be filed.'
  },
  FL: {
    name: 'Florida',
    hasIndividualIncomeTax: false,
    returnFormName: 'None (Constitutional Prohibition)',
    governingAgency: 'Florida Department of Revenue',
    keyComplianceFeatures: [
      'The Florida State Constitution explicitly prohibits a personal individual income tax on residents.',
      'No individual wage, salary, interest, capital gains, or pension income tax returns exist.',
      'No Florida individual income tax return (1040 equivalent) is required or generated.',
      'Corporate income tax applies exclusively to C-Corporations and artificial entities.'
    ],
    exemptionsOrCredits: ['No state personal income tax returns required.'],
    statutoryWarning: 'Notice: Florida has no state personal income tax. Only federal individual returns are prepared.'
  },
  NJ: {
    name: 'New Jersey',
    hasIndividualIncomeTax: true,
    returnFormName: 'Form NJ-1040',
    governingAgency: 'New Jersey Division of Taxation',
    keyComplianceFeatures: [
      'New Jersey Gross Income Tax (GIT) system: No standard deduction allowed.',
      'New Jersey Health Insurance Mandate (Shared Responsibility Payment - Schedule NJ-HCC)',
      'Property Tax Deduction / Credit ($15,000 maximum property tax deduction or $50 credit)',
      'Pass-Through Entity Business Alternative Income Tax (BAIT) credit on Schedule NJ-BUS-1',
      'Strict net business profit computation disallowing federal entertainment deductions'
    ],
    exemptionsOrCredits: ['New Jersey Earned Income Tax Credit', 'Child Tax Credit (tiered by NJ income)', 'Veteran Exemption']
  }
};

// --------------------------------------------------------------------------
// 8 REALISTIC DEMO TAXPAYER PROFILES
// --------------------------------------------------------------------------

export const DEMO_PROFILES: Record<string, DemoTaxpayerProfile> = {
  CA: {
    id: 'demo_ca',
    name: 'Jonathan Sterling (DEMO / FICTIONAL TAXPAYER)',
    title: 'Senior Software Architect & Private Investor',
    state: 'CA',
    scenarioDescription: 'W-2 tech employee with substantial taxable brokerage holdings, capital transactions, primary home mortgage, and mandatory California health coverage mandate reconciliation.',
    stateFilingNotes: 'Requires California Form 540, Schedule CA (540) adjustments for HSA non-conformity, and Form FTB 3853 for health insurance mandate compliance.',
    intake: {
      taxYear: 2025,
      residenceState: 'CA',
      workStates: ['CA'],
      hasOtherStateIncome: false,
      filingStatus: 'Married Filing Jointly',
      hadW2Employment: true,
      w2Count: 2,
      hadFreelanceOrContract: false,
      hasOwnBusiness: false,
      received1099K: false,
      soldInvestments: true,
      hasCryptoTransactions: false,
      receivedInterestOrDividends: true,
      receivedRetirementDistributions: false,
      receivedSocialSecurity: false,
      ownsRealEstate: true,
      hasMortgage: true,
      soldRealEstate: false,
      ownsRentalProperty: false,
      hasCollegeOrTuition: false,
      paysStudentLoanInterest: false,
      hasHSAorMSA: true,
      contributedToIRA: true,
      hasMarketplaceInsurance: false,
      hasForeignAccountsOrIncome: false,
      hasCancelledDebtOrForeclosure: false,
      hasPassThroughK1: false,
      madeEstimatedTaxPayments: true,
      hasDependents: true,
      paidChildcare: false,
      receivedUnemployment: false
    },
    seededItems: [
      {
        id: 'doc-ca-w2-1',
        formNumber: 'Form W-2',
        title: 'Wage & Tax Statement — CloudScale Systems Inc.',
        category: 'Employment',
        whyWeNeedIt: 'Reports Box 1 wages ($238,500.00), federal withholding ($44,200.00), and California CASDI withholding ($1,629.00).',
        whereCanIFindIt: 'Download from your employer payroll portal (Workday / ADP) or corporate HR.',
        whyAmIAsked: 'You indicated W-2 employment in California on your intake organizer.',
        source: 'Employer',
        appliesTo: 'Multi-State',
        stateCode: 'CA',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        instanceIndex: 1,
        totalInstances: 2,
        isMultiInstanceAllowed: true,
        uploadedFileName: '2025_W2_CloudScale_J_Sterling.pdf',
        uploadedFileSize: '1.42 MB',
        uploadedDate: '2026-02-02',
        fileHash: 'sha256_8f2a1b94c038e918',
        confidenceScore: 98,
        confidenceTier: 'High',
        accountantApproved: true,
        reviewedBy: 'Elena Rostova, CPA',
        ocrData: {
          taxYear: 2025,
          taxpayerName: 'Jonathan Sterling',
          payerName: 'CloudScale Systems Inc.',
          payerEIN: 'XX-XXX4910',
          box1Wages: 238500.00,
          box2FedWithheld: 44200.00,
          box16StateWages: 238500.00,
          box17StateWithheld: 19840.00
        }
      },
      {
        id: 'doc-ca-w2-2',
        formNumber: 'Form W-2',
        title: 'Wage & Tax Statement — Stanford Medical Foundation (Spouse)',
        category: 'Employment',
        whyWeNeedIt: 'Reports spouse wage compensation ($142,000.00) and California withholding for joint return.',
        whereCanIFindIt: 'Obtain from Stanford University HR/payroll administrator.',
        whyAmIAsked: 'You selected Married Filing Jointly with two W-2 employers.',
        source: 'Employer',
        appliesTo: 'Multi-State',
        stateCode: 'CA',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        instanceIndex: 2,
        totalInstances: 2,
        isMultiInstanceAllowed: true,
        uploadedFileName: '2025_W2_Stanford_Med_M_Sterling.pdf',
        uploadedFileSize: '1.18 MB',
        uploadedDate: '2026-02-05',
        fileHash: 'sha256_7b82cd93aa018e47',
        confidenceScore: 97,
        confidenceTier: 'High',
        accountantApproved: true,
        reviewedBy: 'Elena Rostova, CPA',
        ocrData: {
          taxYear: 2025,
          taxpayerName: 'Miriam Sterling',
          payerName: 'Stanford Medical Foundation',
          payerEIN: 'XX-XXX9281',
          box1Wages: 142000.00,
          box2FedWithheld: 24100.00,
          box16StateWages: 142000.00,
          box17StateWithheld: 11420.00
        }
      },
      {
        id: 'doc-ca-1099b',
        formNumber: 'Form 1099-B',
        title: 'Consolidated Brokerage Tax Statement — Charles Schwab',
        category: 'Brokerage / Investments',
        whyWeNeedIt: 'Details gross sales proceeds, cost basis reporting, covered/noncovered gains, and wash sale adjustments.',
        whereCanIFindIt: 'Charles Schwab Statements & Tax Documents tab.',
        whyAmIAsked: 'You indicated taxable capital sales of stock and equity securities.',
        source: 'Brokerage',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Needs Review',
        needsReviewReason: 'Missing cost basis on 40 shares of pre-IPO vested RSUs in Section 1099-B Box 1e.',
        uploadedFileName: '2025_Schwab_1099B_Consolidated.pdf',
        uploadedFileSize: '4.80 MB',
        uploadedDate: '2026-02-18',
        fileHash: 'sha256_3391baef09819a32',
        confidenceScore: 89,
        confidenceTier: 'Medium',
        ocrData: {
          taxYear: 2025,
          taxpayerName: 'Jonathan Sterling',
          brokerageName: 'Charles Schwab & Co.',
          totalProceeds: 84320.00,
          reportedCostBasis: 59100.00,
          shortTermGain: 9400.00,
          longTermGain: 15820.00
        }
      },
      {
        id: 'doc-ca-1098',
        formNumber: 'Form 1098',
        title: 'Mortgage Interest Statement — Wells Fargo Home Mortgage',
        category: 'Mortgage Interest',
        whyWeNeedIt: 'Verifies qualifying home acquisition indebtedness interest ($28,450.00) and property taxes for itemized deductions.',
        whereCanIFindIt: 'Wells Fargo Online Portal -> Tax Statements.',
        whyAmIAsked: 'You indicated primary homeownership with an active mortgage in San Francisco.',
        source: 'Lender',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required if applicable',
        status: 'Accepted',
        uploadedFileName: '2025_WellsFargo_Form1098_Mortgage.pdf',
        uploadedFileSize: '920 KB',
        uploadedDate: '2026-02-12',
        fileHash: 'sha256_1098ca_wf_84920',
        confidenceScore: 99,
        confidenceTier: 'High',
        accountantApproved: true,
        reviewedBy: 'Elena Rostova, CPA',
        ocrData: {
          taxYear: 2025,
          lenderName: 'Wells Fargo Bank, N.A.',
          mortgageInterest: 28450.00,
          outstandingPrincipal: 680000.00,
          propertyAddress: 'Presidio Heights, San Francisco, CA'
        }
      },
      {
        id: 'doc-ca-ftb3853',
        formNumber: 'Form FTB 3853',
        title: 'California Health Coverage Exemption & Coverage Verification (1095-B / 1095-C)',
        category: 'State Specific',
        whyWeNeedIt: 'Required under California Health & Safety Code to certify qualifying health coverage throughout the full calendar year or compute the Individual Shared Responsibility Penalty.',
        whereCanIFindIt: 'Provided by your employer health carrier (Kaiser Permanente / Blue Shield).',
        whyAmIAsked: 'California state law enforces an individual health insurance coverage mandate.',
        source: 'Taxpayer',
        appliesTo: 'CA',
        stateCode: 'CA',
        taxYear: 2025,
        priority: 'Required',
        status: 'Missing',
        whyWeNeedItNotice: 'California FTB assesses penalties of at least $900 per adult for unverified coverage gaps.'
      }
    ]
  },
  NY: {
    id: 'demo_ny',
    name: 'Elena Danilova (DEMO / FICTIONAL TAXPAYER)',
    title: 'Consulting Director & Creative Strategist',
    state: 'NY',
    scenarioDescription: 'W-2 corporate employee with side freelance consulting income, Form 1099-K payment processing records, NYC resident income tax, and business expense receipts.',
    stateFilingNotes: 'Requires New York Form IT-201 with NYC resident tax computation and Schedule IT-201-ATT for pass-through entity adjustments.',
    intake: {
      taxYear: 2025,
      residenceState: 'NY',
      workStates: ['NY'],
      hasOtherStateIncome: false,
      filingStatus: 'Single',
      hadW2Employment: true,
      w2Count: 1,
      hadFreelanceOrContract: true,
      hasOwnBusiness: true,
      received1099K: true,
      soldInvestments: true,
      hasCryptoTransactions: false,
      receivedInterestOrDividends: true,
      receivedRetirementDistributions: false,
      receivedSocialSecurity: false,
      ownsRealEstate: false,
      hasMortgage: false,
      soldRealEstate: false,
      ownsRentalProperty: false,
      hasCollegeOrTuition: false,
      paysStudentLoanInterest: false,
      hasHSAorMSA: false,
      contributedToIRA: true,
      hasMarketplaceInsurance: false,
      hasForeignAccountsOrIncome: false,
      hasCancelledDebtOrForeclosure: false,
      hasPassThroughK1: false,
      madeEstimatedTaxPayments: true,
      hasDependents: false,
      paidChildcare: false,
      receivedUnemployment: false
    },
    seededItems: [
      {
        id: 'doc-ny-w2-1',
        formNumber: 'Form W-2',
        title: 'Wage & Tax Statement — Manhattan Media Global LLC',
        category: 'Employment',
        whyWeNeedIt: 'Verifies primary base salary ($168,000.00), NY State tax ($9,420.00), and New York City resident local withholding ($5,840.00).',
        whereCanIFindIt: 'Manhattan Media Global employee portal.',
        whyAmIAsked: 'You reported W-2 employment while residing in New York City.',
        source: 'Employer',
        appliesTo: 'NY',
        stateCode: 'NY',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        instanceIndex: 1,
        totalInstances: 1,
        uploadedFileName: '2025_W2_ManhattanMedia_Danilova.pdf',
        uploadedFileSize: '1.25 MB',
        uploadedDate: '2026-02-08',
        fileHash: 'sha256_ny_w2_91823',
        confidenceScore: 99,
        confidenceTier: 'High',
        accountantApproved: true,
        reviewedBy: 'Marcus Vance, EA',
        ocrData: {
          taxYear: 2025,
          taxpayerName: 'Elena Danilova',
          payerName: 'Manhattan Media Global LLC',
          payerEIN: 'XX-XXX1094',
          box1Wages: 168000.00,
          box2FedWithheld: 31200.00,
          box16StateWages: 168000.00,
          box17StateWithheld: 9420.00,
          box18LocalWages: 168000.00,
          box19LocalWithheld: 5840.00
        }
      },
      {
        id: 'doc-ny-1099nec',
        formNumber: 'Form 1099-NEC',
        title: 'Nonemployee Compensation — Brooklyn Brand Collective',
        category: 'Contract / Gig Work',
        whyWeNeedIt: 'Reports $42,500.00 in gross independent advisory fees subject to federal Self-Employment Tax and NY IT-201 business reporting.',
        whereCanIFindIt: 'Client accounting department or vendor portal.',
        whyAmIAsked: 'You indicated contract and freelance creative consulting during 2025.',
        source: 'Entity Issuer',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_1099NEC_BrooklynBrand_Danilova.pdf',
        uploadedFileSize: '880 KB',
        uploadedDate: '2026-02-14',
        fileHash: 'sha256_ny_nec_44120',
        confidenceScore: 96,
        confidenceTier: 'High',
        accountantApproved: true,
        reviewedBy: 'Marcus Vance, EA',
        ocrData: {
          taxYear: 2025,
          taxpayerName: 'Elena Danilova',
          payerName: 'Brooklyn Brand Collective',
          box1NonempComp: 42500.00
        }
      },
      {
        id: 'doc-ny-1099k',
        formNumber: 'Form 1099-K',
        title: 'Merchant Card and Third-Party Network Transactions — Stripe Inc.',
        category: 'Payment Processing',
        whyWeNeedIt: 'Reports $46,200.00 gross merchant payments. Must be reconciled against invoices to avoid double-counting 1099-NEC amounts.',
        whereCanIFindIt: 'Stripe Dashboard -> Documents & Taxes.',
        whyAmIAsked: 'You processed online client advisory retainers via third-party merchant processor.',
        source: 'Entity Issuer',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required if applicable',
        status: 'Needs Review',
        needsReviewReason: 'Stripe 1099-K includes $3,700 in client expense reimbursements that must be offset against receipts.',
        uploadedFileName: '2025_Stripe_1099K_Danilova.pdf',
        uploadedFileSize: '1.05 MB',
        uploadedDate: '2026-02-16',
        fileHash: 'sha256_ny_1099k_8912',
        confidenceScore: 92,
        confidenceTier: 'Medium',
        ocrData: {
          taxYear: 2025,
          processorName: 'Stripe Payments',
          grossAmount: 46200.00,
          transactionCount: 28
        }
      },
      {
        id: 'doc-ny-biz-expenses',
        formNumber: 'Business Expense Documentation',
        title: 'Schedule C Ordinary & Necessary Business Deductions Summary',
        category: 'Deductions & Expenses',
        whyWeNeedIt: 'Substantiates consulting software, professional insurance, dedicated home office, and advertising expenses.',
        whereCanIFindIt: 'Your QuickBooks Self-Employed or spreadsheet summary with bank matching.',
        whyAmIAsked: 'Needed to offset gross 1099-NEC and 1099-K receipts under IRC § 162.',
        source: 'Taxpayer',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Recommended',
        status: 'Missing'
      }
    ]
  },
  NC: {
    id: 'demo_nc',
    name: 'David MacIntyre (DEMO / FICTIONAL TAXPAYER)',
    title: 'Research Fellow & Retired Educator',
    state: 'NC',
    scenarioDescription: 'W-2 research employee residing in Chapel Hill, NC with high-deductible healthcare (HSA distributions) and supplemental pension/annuity distributions.',
    stateFilingNotes: 'North Carolina Form D-400 flat tax return. NC requires specific state add-backs and does not allow federal itemized deductions for state income taxes.',
    intake: {
      taxYear: 2025,
      residenceState: 'NC',
      workStates: ['NC'],
      hasOtherStateIncome: false,
      filingStatus: 'Single',
      hadW2Employment: true,
      w2Count: 1,
      hadFreelanceOrContract: false,
      hasOwnBusiness: false,
      received1099K: false,
      soldInvestments: false,
      hasCryptoTransactions: false,
      receivedInterestOrDividends: true,
      receivedRetirementDistributions: true,
      receivedSocialSecurity: false,
      ownsRealEstate: true,
      hasMortgage: false,
      soldRealEstate: false,
      ownsRentalProperty: false,
      hasCollegeOrTuition: false,
      paysStudentLoanInterest: false,
      hasHSAorMSA: true,
      contributedToIRA: false,
      hasMarketplaceInsurance: false,
      hasForeignAccountsOrIncome: false,
      hasCancelledDebtOrForeclosure: false,
      hasPassThroughK1: false,
      madeEstimatedTaxPayments: false,
      hasDependents: false,
      paidChildcare: false,
      receivedUnemployment: false
    },
    seededItems: [
      {
        id: 'doc-nc-w2',
        formNumber: 'Form W-2',
        title: 'Wage & Tax Statement — UNC Chapel Hill Research',
        category: 'Employment',
        whyWeNeedIt: 'Reports academic compensation ($88,400.00) and North Carolina state income tax withholding.',
        whereCanIFindIt: 'University employee Self-Service portal.',
        whyAmIAsked: 'You indicated W-2 employment in North Carolina.',
        source: 'Employer',
        appliesTo: 'NC',
        stateCode: 'NC',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_W2_UNC_MacIntyre.pdf',
        uploadedFileSize: '940 KB',
        uploadedDate: '2026-02-04',
        fileHash: 'sha256_nc_w2_78912',
        confidenceScore: 98,
        confidenceTier: 'High',
        accountantApproved: true,
        ocrData: {
          taxYear: 2025,
          taxpayerName: 'David MacIntyre',
          payerName: 'University of North Carolina',
          box1Wages: 88400.00,
          box2FedWithheld: 12400.00,
          box16StateWages: 88400.00,
          box17StateWithheld: 4180.00
        }
      },
      {
        id: 'doc-nc-1099r',
        formNumber: 'Form 1099-R',
        title: 'Distributions From Pensions & Retirement Plans — TIAA-CREF',
        category: 'Retirement',
        whyWeNeedIt: 'Reports $24,800.00 gross pension distribution, taxable amount, and Box 7 distribution code (7 - Normal Distribution).',
        whereCanIFindIt: 'TIAA.org Tax Statements portal.',
        whyAmIAsked: 'You indicated receipt of retirement or annuity distributions.',
        source: 'Brokerage',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_TIAA_Form1099R_MacIntyre.pdf',
        uploadedFileSize: '820 KB',
        uploadedDate: '2026-02-10',
        fileHash: 'sha256_nc_1099r_19283',
        confidenceScore: 99,
        confidenceTier: 'High',
        accountantApproved: true,
        ocrData: {
          taxYear: 2025,
          payerName: 'TIAA-CREF Retirement',
          grossDistribution: 24800.00,
          taxableAmount: 24800.00,
          distributionCode: '7',
          fedWithholding: 2480.00,
          stateWithholding: 1100.00
        }
      },
      {
        id: 'doc-nc-1099sa',
        formNumber: 'Form 1099-SA',
        title: 'Distributions From an HSA, Archer MSA, or Medicare Advantage — Optum Bank',
        category: 'HSA / MSA',
        whyWeNeedIt: 'Verifies $3,450.00 HSA distribution was utilized exclusively for qualified medical expenses under IRC § 223.',
        whereCanIFindIt: 'Optum Bank Online HSA portal -> Tax Forms.',
        whyAmIAsked: 'You took distributions from your Health Savings Account in 2025.',
        source: 'Bank',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Missing'
      },
      {
        id: 'doc-nc-5498sa',
        formNumber: 'Form 5498-SA',
        title: 'HSA, Archer MSA, or Medicare Advantage Information — Optum Bank',
        category: 'HSA / MSA',
        whyWeNeedIt: 'Reports 2025 contributions ($4,150.00) made by you and your employer to verify maximum contribution caps.',
        whereCanIFindIt: 'Optum Bank Tax Center (available by May or in year-end statement).',
        whyAmIAsked: 'Needed to reconcile Form 8889 health savings account contributions.',
        source: 'Bank',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Recommended',
        status: 'Awaiting Client'
      }
    ]
  },
  SC: {
    id: 'demo_sc',
    name: 'Marcus Holloway (DEMO / FICTIONAL TAXPAYER)',
    title: 'General Contractor & Commercial Builder',
    state: 'SC',
    scenarioDescription: 'Columbia, SC business owner operating a commercial construction and subcontracting LLC. Requires Schedule C analysis, vehicle mileage records, and South Carolina Act 61 Active Trade or Business income tax reduction.',
    stateFilingNotes: 'South Carolina Form SC1040 with South Carolina Act 61 elective 3% tax rate on active pass-through business income (I-335).',
    intake: {
      taxYear: 2025,
      residenceState: 'SC',
      workStates: ['SC'],
      hasOtherStateIncome: false,
      filingStatus: 'Head of Household',
      hadW2Employment: false,
      w2Count: 0,
      hadFreelanceOrContract: true,
      hasOwnBusiness: true,
      received1099K: true,
      soldInvestments: false,
      hasCryptoTransactions: false,
      receivedInterestOrDividends: false,
      receivedRetirementDistributions: false,
      receivedSocialSecurity: false,
      ownsRealEstate: true,
      hasMortgage: true,
      soldRealEstate: false,
      ownsRentalProperty: false,
      hasCollegeOrTuition: false,
      paysStudentLoanInterest: false,
      hasHSAorMSA: false,
      contributedToIRA: true,
      hasMarketplaceInsurance: false,
      hasForeignAccountsOrIncome: false,
      hasCancelledDebtOrForeclosure: false,
      hasPassThroughK1: false,
      madeEstimatedTaxPayments: true,
      hasDependents: true,
      paidChildcare: true,
      receivedUnemployment: false
    },
    seededItems: [
      {
        id: 'doc-sc-1099nec-1',
        formNumber: 'Form 1099-NEC',
        title: 'Nonemployee Compensation — Palmetto State Developments LLC',
        category: 'Contract / Gig Work',
        whyWeNeedIt: 'Reports $148,000.00 commercial framing and project management contract payments.',
        whereCanIFindIt: 'Obtain from developer accounts payable department.',
        whyAmIAsked: 'You operate a commercial construction trade business in South Carolina.',
        source: 'Entity Issuer',
        appliesTo: 'SC',
        stateCode: 'SC',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_1099NEC_PalmettoDev_Holloway.pdf',
        uploadedFileSize: '920 KB',
        uploadedDate: '2026-02-09',
        fileHash: 'sha256_sc_nec_10928',
        confidenceScore: 98,
        confidenceTier: 'High',
        accountantApproved: true,
        ocrData: {
          taxYear: 2025,
          taxpayerName: 'Marcus Holloway',
          payerName: 'Palmetto State Developments LLC',
          box1NonempComp: 148000.00
        }
      },
      {
        id: 'doc-sc-mileage',
        formNumber: 'Vehicle Mileage Log',
        title: 'IRS Compliant Contemporaneous Business Mileage Log (Form 2106 / 4562)',
        category: 'Deductions & Expenses',
        whyWeNeedIt: 'IRC § 274(d) requires date, destination, business purpose, and odometer readings for 24,180 commercial job-site miles.',
        whereCanIFindIt: 'Export from MileIQ, QuickBooks, or vehicle logbook.',
        whyAmIAsked: 'Claiming heavy commercial vehicle and travel deductions.',
        source: 'Taxpayer',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Missing'
      },
      {
        id: 'doc-sc-depr-assets',
        formNumber: 'Asset Invoices & Form 4562 Records',
        title: 'Capital Equipment Invoices (Bobcat Skid Steer & Trailer)',
        category: 'Deductions & Expenses',
        whyWeNeedIt: 'Purchase invoices showing acquisition dates, serial numbers, and trade-in allowances for Section 179 expensing.',
        whereCanIFindIt: 'Equipment dealership sales contracts and financing statements.',
        whyAmIAsked: 'You acquired capital machinery for construction operations in 2025.',
        source: 'Taxpayer',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required if applicable',
        status: 'Accepted',
        uploadedFileName: '2025_Equipment_Invoice_CatDealer.pdf',
        uploadedFileSize: '2.10 MB',
        uploadedDate: '2026-02-14',
        fileHash: 'sha256_sc_asset_8812',
        confidenceScore: 95,
        confidenceTier: 'High',
        accountantApproved: true
      },
      {
        id: 'doc-sc-act61-pte',
        formNumber: 'SC Form I-335',
        title: 'South Carolina Active Trade or Business Income Election Schedule',
        category: 'State Specific',
        whyWeNeedIt: 'Calculates the preferential 3% state tax rate under SC Code § 12-6-545 on eligible active small business income, saving up to 3.4% vs regular rates.',
        whereCanIFindIt: 'Prepared by our accounting team using your business records.',
        whyAmIAsked: 'Eligible South Carolina small business owner.',
        source: 'Taxpayer',
        appliesTo: 'SC',
        stateCode: 'SC',
        taxYear: 2025,
        priority: 'Recommended',
        status: 'Awaiting Tax Professional'
      }
    ]
  },
  VA: {
    id: 'demo_va',
    name: 'Robert & Sarah Henderson (DEMO / FICTIONAL TAXPAYER)',
    title: 'Government Affairs Counsel & Real Estate Investor',
    state: 'VA',
    scenarioDescription: 'Alexandria, VA resident with W-2 legal earnings plus residential rental property in Richmond, VA requiring Schedule E rental income, depreciation, and real estate taxes.',
    stateFilingNotes: 'Virginia Form 760 with Schedule FED deductions and Schedule ADJ additions/subtractions for fixed-date conformity adjustments.',
    intake: {
      taxYear: 2025,
      residenceState: 'VA',
      workStates: ['VA'],
      hasOtherStateIncome: false,
      filingStatus: 'Married Filing Jointly',
      hadW2Employment: true,
      w2Count: 2,
      hadFreelanceOrContract: false,
      hasOwnBusiness: false,
      received1099K: false,
      soldInvestments: true,
      hasCryptoTransactions: false,
      receivedInterestOrDividends: true,
      receivedRetirementDistributions: false,
      receivedSocialSecurity: false,
      ownsRealEstate: true,
      hasMortgage: true,
      soldRealEstate: false,
      ownsRentalProperty: true,
      hasCollegeOrTuition: false,
      paysStudentLoanInterest: false,
      hasHSAorMSA: false,
      contributedToIRA: true,
      hasMarketplaceInsurance: false,
      hasForeignAccountsOrIncome: false,
      hasCancelledDebtOrForeclosure: false,
      hasPassThroughK1: false,
      madeEstimatedTaxPayments: true,
      hasDependents: true,
      paidChildcare: false,
      receivedUnemployment: false
    },
    seededItems: [
      {
        id: 'doc-va-w2-1',
        formNumber: 'Form W-2',
        title: 'Wage & Tax Statement — Apex Public Affairs Group',
        category: 'Employment',
        whyWeNeedIt: 'Reports Box 1 legal counsel compensation ($195,000.00) and Virginia state tax withholding ($10,480.00).',
        whereCanIFindIt: 'Employer payroll portal.',
        whyAmIAsked: 'W-2 employment in Northern Virginia.',
        source: 'Employer',
        appliesTo: 'VA',
        stateCode: 'VA',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_W2_ApexPublicAffairs_Henderson.pdf',
        uploadedFileSize: '1.10 MB',
        uploadedDate: '2026-02-06',
        fileHash: 'sha256_va_w2_99182',
        confidenceScore: 99,
        confidenceTier: 'High',
        accountantApproved: true
      },
      {
        id: 'doc-va-rental-e',
        formNumber: 'Schedule E Records',
        title: 'Richmond Rental Property Annual Income & Expense Ledger',
        category: 'Deductions & Expenses',
        whyWeNeedIt: 'Reports gross rental receipts ($32,400.00), property management fees, repairs, insurance, and utilities for Richmond duplex.',
        whereCanIFindIt: 'Property manager year-end statement or bookkeeping software.',
        whyAmIAsked: 'You confirmed ownership of income-producing rental real estate.',
        source: 'Taxpayer',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Missing'
      },
      {
        id: 'doc-va-rental-1098',
        formNumber: 'Form 1098',
        title: 'Mortgage Interest Statement (Richmond Rental Property)',
        category: 'Mortgage Interest',
        whyWeNeedIt: 'Deductible rental property mortgage interest ($14,200.00) and property taxes paid through escrow.',
        whereCanIFindIt: 'Mortgage servicer tax documents section.',
        whyAmIAsked: 'Active loan secured by rental property.',
        source: 'Lender',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_Form1098_Rental_Richmond.pdf',
        uploadedFileSize: '850 KB',
        uploadedDate: '2026-02-12',
        fileHash: 'sha256_va_1098_rent_1029',
        confidenceScore: 97,
        confidenceTier: 'High',
        accountantApproved: true
      }
    ]
  },
  TN: {
    id: 'demo_tn',
    name: 'Charlotte & William Hayes (DEMO / FICTIONAL TAXPAYER)',
    title: 'Healthcare Executive & Private Equity Investor',
    state: 'TN',
    scenarioDescription: 'Nashville, TN resident with executive W-2 earnings, pension income, and substantial dividend portfolio. Tennessee has NO individual state income tax on wages or investment income.',
    stateFilingNotes: 'CRITICAL STATUTORY RULE: Tennessee has no broad-based personal individual income tax. The Hall Income Tax on interest and dividends was completely repealed on January 1, 2021. No state individual tax return is generated.',
    intake: {
      taxYear: 2025,
      residenceState: 'TN',
      workStates: ['TN'],
      hasOtherStateIncome: false,
      filingStatus: 'Married Filing Jointly',
      hadW2Employment: true,
      w2Count: 1,
      hadFreelanceOrContract: false,
      hasOwnBusiness: false,
      received1099K: false,
      soldInvestments: true,
      hasCryptoTransactions: false,
      receivedInterestOrDividends: true,
      receivedRetirementDistributions: true,
      receivedSocialSecurity: false,
      ownsRealEstate: true,
      hasMortgage: true,
      soldRealEstate: false,
      ownsRentalProperty: false,
      hasCollegeOrTuition: false,
      paysStudentLoanInterest: false,
      hasHSAorMSA: false,
      contributedToIRA: true,
      hasMarketplaceInsurance: false,
      hasForeignAccountsOrIncome: false,
      hasCancelledDebtOrForeclosure: false,
      hasPassThroughK1: false,
      madeEstimatedTaxPayments: true,
      hasDependents: false,
      paidChildcare: false,
      receivedUnemployment: false
    },
    seededItems: [
      {
        id: 'doc-tn-w2',
        formNumber: 'Form W-2',
        title: 'Wage & Tax Statement — Nashville Healthcare Systems',
        category: 'Employment',
        whyWeNeedIt: 'Reports Box 1 wages ($285,000.00) and federal income tax withholding ($58,200.00). Note Box 15 State is TN with $0 state withholding.',
        whereCanIFindIt: 'Employee self-service payroll portal.',
        whyAmIAsked: 'Primary wage income reported on federal Form 1040.',
        source: 'Employer',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_W2_NashvilleHealth_Hayes.pdf',
        uploadedFileSize: '1.20 MB',
        uploadedDate: '2026-02-04',
        fileHash: 'sha256_tn_w2_449102',
        confidenceScore: 99,
        confidenceTier: 'High',
        accountantApproved: true
      },
      {
        id: 'doc-tn-1099div',
        formNumber: 'Form 1099-DIV',
        title: 'Dividends & Distributions — Morgan Stanley Wealth Management',
        category: 'Dividends',
        whyWeNeedIt: 'Reports $38,400.00 in total ordinary dividends and $31,200.00 qualified dividends for federal preferential tax rates.',
        whereCanIFindIt: 'Morgan Stanley ClientServ Tax Statements.',
        whyAmIAsked: 'Taxable dividend portfolio distributions.',
        source: 'Brokerage',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_MorganStanley_1099DIV_Hayes.pdf',
        uploadedFileSize: '2.40 MB',
        uploadedDate: '2026-02-15',
        fileHash: 'sha256_tn_div_99018',
        confidenceScore: 97,
        confidenceTier: 'High',
        accountantApproved: true
      },
      {
        id: 'doc-tn-state-notice',
        formNumber: 'State Tax Exemption Confirmation',
        title: 'Tennessee Non-Filing Status Notice',
        category: 'State Specific',
        whyWeNeedIt: 'Confirms that no Tennessee personal individual return is required pursuant to Tenn. Code Ann. § 67-2-102 repeal.',
        whereCanIFindIt: 'Generated by firm compliance engine.',
        whyAmIAsked: 'Tennessee resident with zero individual state tax obligations.',
        source: 'Other',
        appliesTo: 'TN',
        stateCode: 'TN',
        taxYear: 2025,
        priority: 'Optional',
        status: 'Accepted',
        accountantApproved: true
      }
    ]
  },
  FL: {
    id: 'demo_fl',
    name: 'Arthur & Evelyn Vance (DEMO / FICTIONAL TAXPAYER)',
    title: 'Retired Corporate Counsel & Real Estate Owner',
    state: 'FL',
    scenarioDescription: 'Naples, FL retirees receiving Social Security benefits, taxable IRA distributions, and municipal bond interest. Florida has NO state personal income tax under the State Constitution.',
    stateFilingNotes: 'CRITICAL STATUTORY RULE: Florida Constitution Art. VII Sec. 5 strictly bars personal income taxation. Only federal Form 1040 is prepared; no Florida individual state income tax return is required or generated.',
    intake: {
      taxYear: 2025,
      residenceState: 'FL',
      workStates: ['FL'],
      hasOtherStateIncome: false,
      filingStatus: 'Married Filing Jointly',
      hadW2Employment: false,
      w2Count: 0,
      hadFreelanceOrContract: false,
      hasOwnBusiness: false,
      received1099K: false,
      soldInvestments: true,
      hasCryptoTransactions: false,
      receivedInterestOrDividends: true,
      receivedRetirementDistributions: true,
      receivedSocialSecurity: true,
      ownsRealEstate: true,
      hasMortgage: false,
      soldRealEstate: false,
      ownsRentalProperty: false,
      hasCollegeOrTuition: false,
      paysStudentLoanInterest: false,
      hasHSAorMSA: false,
      contributedToIRA: false,
      hasMarketplaceInsurance: false,
      hasForeignAccountsOrIncome: false,
      hasCancelledDebtOrForeclosure: false,
      hasPassThroughK1: false,
      madeEstimatedTaxPayments: true,
      hasDependents: false,
      paidChildcare: false,
      receivedUnemployment: false
    },
    seededItems: [
      {
        id: 'doc-fl-ssa',
        formNumber: 'SSA-1099',
        title: 'Social Security Benefit Statement — Social Security Administration',
        category: 'Social Security / Railroad Retirement',
        whyWeNeedIt: 'Reports Box 3 benefits paid ($46,800.00 for both spouses) to calculate federal taxable portion under IRC § 86 formula.',
        whereCanIFindIt: 'SSA.gov -> My Social Security account or mailed statement.',
        whyAmIAsked: 'You confirmed receiving Social Security retirement benefits in 2025.',
        source: 'Government',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_SSA1099_Vance_Joint.pdf',
        uploadedFileSize: '780 KB',
        uploadedDate: '2026-02-01',
        fileHash: 'sha256_fl_ssa_110928',
        confidenceScore: 99,
        confidenceTier: 'High',
        accountantApproved: true,
        ocrData: {
          taxYear: 2025,
          taxpayerName: 'Arthur Vance',
          box3BenefitsPaid: 46800.00,
          box6FedWithheld: 0.00
        }
      },
      {
        id: 'doc-fl-1099r',
        formNumber: 'Form 1099-R',
        title: 'Distributions From Pensions, Annuities, IRAs — Fidelity Investments',
        category: 'Retirement',
        whyWeNeedIt: 'Verifies Required Minimum Distribution (RMD) of $62,000.00 from traditional IRA accounts.',
        whereCanIFindIt: 'Fidelity.com Tax Statements center.',
        whyAmIAsked: 'You took traditional IRA retirement distributions.',
        source: 'Brokerage',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_Fidelity_1099R_Vance.pdf',
        uploadedFileSize: '1.15 MB',
        uploadedDate: '2026-02-11',
        fileHash: 'sha256_fl_1099r_8820',
        confidenceScore: 98,
        confidenceTier: 'High',
        accountantApproved: true,
        ocrData: {
          taxYear: 2025,
          payerName: 'Fidelity Management Trust',
          grossDistribution: 62000.00,
          taxableAmount: 62000.00,
          distributionCode: '7',
          fedWithholding: 6200.00
        }
      },
      {
        id: 'doc-fl-int',
        formNumber: 'Form 1099-INT',
        title: 'Interest Income Statement — Northern Trust Private Wealth',
        category: 'Interest',
        whyWeNeedIt: 'Reports $18,400.00 in tax-exempt municipal interest (Box 8) and $4,200.00 taxable interest (Box 1).',
        whereCanIFindIt: 'Northern Trust online banking statement repository.',
        whyAmIAsked: 'Interest earned on private banking balances.',
        source: 'Bank',
        appliesTo: 'Federal',
        taxYear: 2025,
        priority: 'Required',
        status: 'Missing'
      }
    ]
  },
  NJ: {
    id: 'demo_nj',
    name: 'Brian & Rachel Kowalski (DEMO / FICTIONAL TAXPAYER)',
    title: 'Biotech Director & Pharmaceutical Consultant',
    state: 'NJ',
    scenarioDescription: 'Princeton, NJ residents with corporate biotech W-2, high local property taxes, significant stock option exercises, and New Jersey Health Insurance Mandate (NJ-HCC) verification.',
    stateFilingNotes: 'New Jersey Form NJ-1040 gross income tax. NJ does not permit federal standard deductions and enforces state health mandate penalties.',
    intake: {
      taxYear: 2025,
      residenceState: 'NJ',
      workStates: ['NJ'],
      hasOtherStateIncome: false,
      filingStatus: 'Married Filing Jointly',
      hadW2Employment: true,
      w2Count: 2,
      hadFreelanceOrContract: false,
      hasOwnBusiness: false,
      received1099K: false,
      soldInvestments: true,
      hasCryptoTransactions: false,
      receivedInterestOrDividends: true,
      receivedRetirementDistributions: false,
      receivedSocialSecurity: false,
      ownsRealEstate: true,
      hasMortgage: true,
      soldRealEstate: false,
      ownsRentalProperty: false,
      hasCollegeOrTuition: false,
      paysStudentLoanInterest: false,
      hasHSAorMSA: false,
      contributedToIRA: true,
      hasMarketplaceInsurance: false,
      hasForeignAccountsOrIncome: false,
      hasCancelledDebtOrForeclosure: false,
      hasPassThroughK1: false,
      madeEstimatedTaxPayments: true,
      hasDependents: true,
      paidChildcare: true,
      receivedUnemployment: false
    },
    seededItems: [
      {
        id: 'doc-nj-w2-1',
        formNumber: 'Form W-2',
        title: 'Wage & Tax Statement — Princeton BioSciences LLC',
        category: 'Employment',
        whyWeNeedIt: 'Reports Box 1 wages ($215,000.00) and New Jersey gross income tax withholding ($12,840.00).',
        whereCanIFindIt: 'Princeton BioSciences HR portal.',
        whyAmIAsked: 'W-2 employment in New Jersey.',
        source: 'Employer',
        appliesTo: 'NJ',
        stateCode: 'NJ',
        taxYear: 2025,
        priority: 'Required',
        status: 'Accepted',
        uploadedFileName: '2025_W2_PrincetonBio_Kowalski.pdf',
        uploadedFileSize: '1.30 MB',
        uploadedDate: '2026-02-07',
        fileHash: 'sha256_nj_w2_109283',
        confidenceScore: 99,
        confidenceTier: 'High',
        accountantApproved: true
      },
      {
        id: 'doc-nj-prop-tax',
        formNumber: 'Property Tax Bill / Form 1098',
        title: 'Princeton Township Property Tax Verification Bill',
        category: 'State Specific',
        whyWeNeedIt: 'New Jersey allows a property tax deduction of up to $15,000 against NJ Gross Income Tax on Form NJ-1040.',
        whereCanIFindIt: 'Township tax collector receipt or mortgage annual escrow statement.',
        whyAmIAsked: 'New Jersey homeowner claiming statutory property tax deduction.',
        source: 'Lender',
        appliesTo: 'NJ',
        stateCode: 'NJ',
        taxYear: 2025,
        priority: 'Required if applicable',
        status: 'Needs Review',
        needsReviewReason: 'Property tax bill includes municipal sewer fee portion that is non-deductible for NJ-1040.',
        uploadedFileName: '2025_Princeton_PropertyTax_Bill.pdf',
        uploadedFileSize: '1.45 MB',
        uploadedDate: '2026-02-14',
        fileHash: 'sha256_nj_taxbill_88192',
        confidenceScore: 91,
        confidenceTier: 'Medium'
      },
      {
        id: 'doc-nj-hcc',
        formNumber: 'Schedule NJ-HCC',
        title: 'New Jersey Health Insurance Coverage Verification (1095-C)',
        category: 'State Specific',
        whyWeNeedIt: 'Certifies minimum essential health coverage for all household members under the New Jersey Health Insurance Market Preservation Act.',
        whereCanIFindIt: 'Employer benefits team or health insurance plan statement.',
        whyAmIAsked: 'New Jersey enforces a mandatory individual health coverage mandate.',
        source: 'Employer',
        appliesTo: 'NJ',
        stateCode: 'NJ',
        taxYear: 2025,
        priority: 'Required',
        status: 'Missing'
      }
    ]
  }
};

// --------------------------------------------------------------------------
// DYNAMIC INTAKE RULES ENGINE
// --------------------------------------------------------------------------

export function generatePersonalizedChecklist(
  intake: IntakeResponses,
  existingItems: PersonalizedDocItem[] = []
): PersonalizedDocItem[] {
  const result: PersonalizedDocItem[] = [...existingItems];
  const existingFormKeys = new Set(existingItems.map(i => `${i.formNumber}_${i.instanceIndex || 1}_${i.taxYear}`));

  const stateRule = STATE_RULES_REGISTRY[intake.residenceState] || STATE_RULES_REGISTRY.SC;

  // Helper to add item if not existing
  const addItem = (item: Omit<PersonalizedDocItem, 'id'>) => {
    const key = `${item.formNumber}_${item.instanceIndex || 1}_${item.taxYear}`;
    if (!existingFormKeys.has(key)) {
      result.push({
        ...item,
        id: `gen_${item.formNumber.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`
      });
      existingFormKeys.add(key);
    }
  };

  // 1. Employment (W-2)
  if (intake.hadW2Employment) {
    const count = Math.max(1, intake.w2Count || 1);
    for (let i = 1; i <= count; i++) {
      addItem({
        formNumber: 'Form W-2',
        title: `Wage & Tax Statement (Employer ${i})`,
        category: 'Employment',
        whyWeNeedIt: 'Reports wages, salaries, tips, and federal/state/local tax withholdings from employment.',
        whereCanIFindIt: 'Issued by your employer (usually available via ADP, Workday, Gusto, or mailed by Jan 31).',
        whyAmIAsked: `You stated that you worked as an employee during tax year ${intake.taxYear}.`,
        source: 'Employer',
        appliesTo: 'Multi-State',
        stateCode: intake.residenceState,
        taxYear: intake.taxYear,
        priority: 'Required',
        status: 'Missing',
        instanceIndex: i,
        totalInstances: count,
        isMultiInstanceAllowed: true
      });
    }
  }

  // 2. Contract / Gig / Self-Employment (1099-NEC)
  if (intake.hadFreelanceOrContract || intake.hasOwnBusiness) {
    addItem({
      formNumber: 'Form 1099-NEC',
      title: 'Nonemployee Compensation (Independent Contractor / 1099)',
      category: 'Contract / Gig Work',
      whyWeNeedIt: 'Reports independent contractor earnings and self-employment income required for Schedule C.',
      whereCanIFindIt: 'Provided by companies, clients, or platforms you performed services for.',
      whyAmIAsked: 'You indicated independent contracting, freelance work, or business revenue.',
      source: 'Entity Issuer',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing',
      isMultiInstanceAllowed: true
    });

    addItem({
      formNumber: 'Business Expense Records',
      title: 'Business Expense & Receipts Log (Schedule C Deductions)',
      category: 'Deductions & Expenses',
      whyWeNeedIt: 'Substantiates deductible business expenses (advertising, software, tools, office supplies) under IRC § 162.',
      whereCanIFindIt: 'Export from accounting software (QuickBooks, Wave) or compiled expense receipts.',
      whyAmIAsked: 'Necessary to calculate net business profit and minimize self-employment taxes.',
      source: 'Taxpayer',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Recommended',
      status: 'Missing'
    });
  }

  // 3. Other Payments (1099-MISC)
  if (intake.received1099MISC) {
    addItem({
      formNumber: 'Form 1099-MISC',
      title: 'Miscellaneous Information (Rents, Prizes, Royalties)',
      category: 'Other Payments',
      whyWeNeedIt: 'Reports rents, royalties, prizes, awards, medical payments, and other miscellaneous payments under IRC § 6041.',
      whereCanIFindIt: 'Issued by payers of rents, sweepstakes, royalties, or legal settlements.',
      whyAmIAsked: 'You indicated receiving rents, prizes, royalties, or other miscellaneous payments.',
      source: 'Entity Issuer',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 4. Interest Income (1099-INT)
  if (intake.receivedInterest || intake.receivedInterestOrDividends) {
    addItem({
      formNumber: 'Form 1099-INT',
      title: 'Interest Income Statements',
      category: 'Interest',
      whyWeNeedIt: 'Reports taxable and tax-exempt interest income from banks, savings accounts, CDs, and bonds under IRC § 6049.',
      whereCanIFindIt: 'Download from your online banking portal or consolidated year-end tax packet.',
      whyAmIAsked: 'You confirmed earning bank or investment interest.',
      source: 'Bank',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 5. Dividends & Distributions (1099-DIV)
  if (intake.receivedDividends || intake.receivedInterestOrDividends) {
    addItem({
      formNumber: 'Form 1099-DIV',
      title: 'Dividends & Distributions',
      category: 'Dividends',
      whyWeNeedIt: 'Separates ordinary dividends from qualified dividends that receive preferential capital gain tax rates under IRC § 6042.',
      whereCanIFindIt: 'Download from your investment brokerage or mutual fund portal tax documents section.',
      whyAmIAsked: 'You confirmed receiving dividend distributions from securities holdings.',
      source: 'Brokerage',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 6. Brokerage / Investments (1099-B)
  if (intake.soldInvestments) {
    addItem({
      formNumber: 'Form 1099-B',
      title: 'Proceeds From Broker & Barter Exchange Transactions',
      category: 'Brokerage / Investments',
      whyWeNeedIt: 'Details gross stock sale proceeds, acquisition dates, cost basis, and short-term vs long-term capital gain or deductible loss calculations.',
      whereCanIFindIt: 'Consolidated Form 1099 from brokerages (Vanguard, Fidelity, Schwab, E*TRADE, Robinhood).',
      whyAmIAsked: 'You indicated sales of stocks, securities, ETFs, or other reportable transactions.',
      source: 'Brokerage',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // 7. Payment Processing (1099-K)
  if (intake.received1099K || intake.hasOwnBusiness) {
    addItem({
      formNumber: 'Form 1099-K',
      title: 'Payment Card & Third-Party Network Transactions',
      category: 'Payment Processing',
      whyWeNeedIt: 'Reports gross payments processed through Stripe, PayPal, Square, Shopify, or merchant card terminals under IRC § 6050W. Must be reconciled to prevent duplicate income reporting.',
      whereCanIFindIt: 'Download from your payment processor online merchant tax portal.',
      whyAmIAsked: 'You indicated processing payment-card or third-party network transactions.',
      source: 'Entity Issuer',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 8. Retirement (1099-R)
  if (intake.receivedRetirementDistributions) {
    addItem({
      formNumber: 'Form 1099-R',
      title: 'Distributions From Pensions, Annuities, Retirement Plans, IRAs',
      category: 'Retirement',
      whyWeNeedIt: 'Determines the taxable vs non-taxable portion of distributions, early withdrawal penalties, or qualified rollover status under IRC § 408.',
      whereCanIFindIt: 'Retirement plan administrator, 401(k) custodian, or pension office.',
      whyAmIAsked: 'You indicated taking distributions or rollovers from a pension, IRA, or retirement plan.',
      source: 'Brokerage',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // 9. Government Payments (1099-G)
  if (intake.receivedGovernmentPayments || intake.receivedUnemployment) {
    addItem({
      formNumber: 'Form 1099-G',
      title: 'Certain Government Payments (Unemployment / State Tax Refunds)',
      category: 'Government Payments',
      whyWeNeedIt: 'Reports state unemployment compensation, state/local tax refunds received, or taxable government grants under IRC § 6050B.',
      whereCanIFindIt: 'State Department of Labor or State Department of Revenue tax portal.',
      whyAmIAsked: 'You received unemployment benefits, certain state/local refunds, or government subsidies.',
      source: 'Government',
      appliesTo: 'Multi-State',
      stateCode: intake.residenceState,
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 10. Social Security / Railroad Retirement (SSA-1099 / RRB-1099)
  if (intake.receivedSocialSecurity) {
    addItem({
      formNumber: 'SSA-1099 / RRB-1099',
      title: 'Social Security / Railroad Retirement Benefits Statement',
      category: 'Social Security / Railroad Retirement',
      whyWeNeedIt: 'Reports total Social Security or Railroad Retirement benefits paid to calculate the federally taxable portion under IRC § 86.',
      whereCanIFindIt: 'Mailed annually in January by the Social Security Administration or downloaded at ssa.gov.',
      whyAmIAsked: 'You received Social Security or railroad retirement benefits during the tax year.',
      source: 'Government',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // 11. Partnership / S Corp / Estate / Trust (Schedule K-1)
  if (intake.hasPassThroughK1) {
    addItem({
      formNumber: 'Schedule K-1',
      title: 'Partner / Shareholder Share of Income, Deductions, Credits (1065 / 1120-S)',
      category: 'Partnership / S Corporation / Estate / Trust',
      whyWeNeedIt: 'Reports distributive share of partnership, S-Corp, or fiduciary estate earnings, deductions, guaranteed payments, and Section 199A QBID information.',
      whereCanIFindIt: 'Issued by the managing partner, CPA, or corporate finance officer of the entity.',
      whyAmIAsked: 'You confirmed ownership in a partnership, S-Corporation, LLC, or trust.',
      source: 'Entity Issuer',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing',
      isMultiInstanceAllowed: true
    });
  }

  // 12. Mortgage Interest (Form 1098)
  if (intake.hasMortgage) {
    addItem({
      formNumber: 'Form 1098',
      title: 'Mortgage Interest Statement',
      category: 'Mortgage Interest',
      whyWeNeedIt: 'Reports deductible mortgage interest, points, and real estate taxes paid through escrow under IRC § 163(h).',
      whereCanIFindIt: 'Mortgage servicer online portal or annual year-end statement.',
      whyAmIAsked: 'You indicated owning real estate with an active mortgage.',
      source: 'Lender',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 13. Education (Form 1098-T)
  if (intake.hasCollegeOrTuition) {
    addItem({
      formNumber: 'Form 1098-T',
      title: 'Tuition Statement (Higher Education Institutions)',
      category: 'Education',
      whyWeNeedIt: 'Reports qualified tuition payments (Box 1) and scholarships (Box 5) to claim the American Opportunity Tax Credit (AOTC) or Lifetime Learning Credit.',
      whereCanIFindIt: 'College or university bursar student portal (ECSI, Heartland, etc.).',
      whyAmIAsked: 'You or your dependent attended eligible college, university, or post-secondary school.',
      source: 'Educational Institution',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 14. Student Loans (Form 1098-E)
  if (intake.paysStudentLoanInterest) {
    addItem({
      formNumber: 'Form 1098-E',
      title: 'Student Loan Interest Statement',
      category: 'Student Loans',
      whyWeNeedIt: 'Allows an above-the-line deduction of up to $2,500 in student loan interest under IRC § 221.',
      whereCanIFindIt: 'Student loan servicer (MOHELA, Nelnet, Aidvantage, Sallie Mae).',
      whyAmIAsked: 'You made qualifying payments on higher education student loans.',
      source: 'Lender',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Recommended',
      status: 'Missing'
    });
  }

  // 15. Foreclosure / Abandonment (Form 1099-A)
  if (intake.hasForeclosureOrAbandonment || intake.hasCancelledDebtOrForeclosure) {
    addItem({
      formNumber: 'Form 1099-A',
      title: 'Acquisition or Abandonment of Secured Property',
      category: 'Foreclosure / Abandonment',
      whyWeNeedIt: 'Reports foreclosure, repossession, or abandonment of property that secured a loan to compute capital gain or loss under IRC § 6050J.',
      whereCanIFindIt: 'Issued by the lender or financial institution that held the loan.',
      whyAmIAsked: 'You indicated surrender, repossession, or abandonment of secured property.',
      source: 'Lender',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 16. Cancelled Debt (Form 1099-C)
  if (intake.hasCancelledDebt || intake.hasCancelledDebtOrForeclosure) {
    addItem({
      formNumber: 'Form 1099-C',
      title: 'Cancellation of Debt',
      category: 'Cancelled Debt',
      whyWeNeedIt: 'Reports cancelled or forgiven debt of $600 or more. Flagged for professional analysis to determine insolvency, bankruptcy, or qualified principal residence exclusions under IRC § 108.',
      whereCanIFindIt: 'Provided by the lending institution or creditor that discharged the debt.',
      whyAmIAsked: 'You reported forgiven, settled, or cancelled debt obligations.',
      source: 'Lender',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // 17. Real Estate Sale (Form 1099-S)
  if (intake.soldRealEstate) {
    addItem({
      formNumber: 'Form 1099-S',
      title: 'Proceeds From Real Estate Transactions & Closing Disclosure',
      category: 'Real Estate Sale',
      whyWeNeedIt: 'Reports gross sales price, closing dates, and settlement charges to evaluate the IRC § 121 primary home exclusion ($250k single / $500k married) or capital gain.',
      whereCanIFindIt: 'Settlement title company or closing attorney closing packet.',
      whyAmIAsked: 'You indicated the sale or transfer of real property during the year.',
      source: 'Other',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // 18. Health Savings Accounts (Form 1099-SA / 5498-SA)
  if (intake.hasHSAorMSA) {
    addItem({
      formNumber: 'Form 1099-SA / 5498-SA',
      title: 'HSA / MSA Distributions & Contributions Statement',
      category: 'HSA / MSA',
      whyWeNeedIt: 'Verifies distributions were utilized for qualified medical expenses to avoid income tax and the 20% excise penalty, and substantiates contributions on Form 8889.',
      whereCanIFindIt: 'HSA administrator portal (HSA Bank, Fidelity, Optum, HealthEquity).',
      whyAmIAsked: 'You held, contributed to, or took distributions from a Health Savings Account (HSA/MSA).',
      source: 'Bank',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // 19. IRA Contributions (Form 5498)
  if (intake.contributedToIRA) {
    addItem({
      formNumber: 'Form 5498',
      title: 'IRA Contribution Information (Traditional, Roth, SEP, SIMPLE)',
      category: 'IRA Contributions',
      whyWeNeedIt: 'Reports contributions, rollovers, and year-end fair market value for IRAs. Required to verify deduction limits and track nondeductible basis on Form 8606.',
      whereCanIFindIt: 'Retirement account custodian or brokerage tax documents section.',
      whyAmIAsked: 'You made contributions or rollovers to a Traditional, Roth, SEP, or SIMPLE IRA.',
      source: 'Brokerage',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Recommended',
      status: 'Missing'
    });
  }

  // 20. Marketplace Insurance (Form 1095-A) - CRITICAL PRIORITY
  if (intake.hasMarketplaceInsurance) {
    addItem({
      formNumber: 'Form 1095-A',
      title: 'Health Insurance Marketplace Statement',
      category: 'Marketplace Insurance',
      whyWeNeedIt: 'CRITICAL PRIORITY: Required by the IRS to reconcile the Advance Premium Tax Credit (APTC) on Form 8962. E-filing without this form causes immediate IRS rejection.',
      whereCanIFindIt: 'Healthcare.gov or state health exchange portal (Covered CA, NY State of Health).',
      whyAmIAsked: 'You indicated obtaining health coverage through the Health Insurance Marketplace.',
      source: 'Marketplace',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // 21. Long-Term Care (Form 1099-LTC)
  if (intake.hasLongTermCare) {
    addItem({
      formNumber: 'Form 1099-LTC',
      title: 'Long-Term Care and Accelerated Death Benefits',
      category: 'Long-Term Care',
      whyWeNeedIt: 'Reports payments received from qualified long-term care insurance policies or accelerated death benefits under life insurance to evaluate tax exclusions on Form 8853.',
      whereCanIFindIt: 'Issued by the insurance company providing long-term care coverage.',
      whyAmIAsked: 'You received long-term care or accelerated death benefit payments.',
      source: 'Other',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 22. ABLE Accounts (Form 1099-QA / 5498-QA)
  if (intake.hasABLEAccount) {
    addItem({
      formNumber: 'Form 1099-QA / 5498-QA',
      title: 'ABLE Account Distributions & Contributions (IRC § 529A)',
      category: 'ABLE Accounts',
      whyWeNeedIt: 'Reports distributions and contributions for individuals with disabilities under Achieving a Better Life Experience (ABLE) programs to confirm qualified disability expenses.',
      whereCanIFindIt: 'State ABLE plan administrator portal.',
      whyAmIAsked: 'You maintained, contributed to, or distributed funds from an ABLE account.',
      source: 'Bank',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // 23. Education Plans (Form 1099-Q)
  if (intake.hasEducationPlans) {
    addItem({
      formNumber: 'Form 1099-Q',
      title: 'Payments From Qualified Education Programs (Sections 529 & 530)',
      category: 'Education Plans',
      whyWeNeedIt: 'Reports distributions from a 529 college savings plan or Coverdell ESA to ensure funds were used for qualified education expenses and avoid tax penalties.',
      whereCanIFindIt: 'State 529 plan custodian or Coverdell trustee account portal.',
      whyAmIAsked: 'You took distributions from a 529 college savings account or Coverdell ESA.',
      source: 'Brokerage',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required if applicable',
      status: 'Missing'
    });
  }

  // Rental Property (Schedule E)
  if (intake.ownsRentalProperty) {
    addItem({
      formNumber: 'Rental Property Ledger',
      title: 'Rental Income & Operating Expense Summary (Schedule E)',
      category: 'Deductions & Expenses',
      whyWeNeedIt: 'Reports tenant rental receipts, repairs, management fees, property taxes, and capital improvements for depreciation.',
      whereCanIFindIt: 'Property management annual statement or rental accounting workbook.',
      whyAmIAsked: 'You indicated ownership of residential or commercial rental real estate.',
      source: 'Taxpayer',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // Estimated Tax Payments
  if (intake.madeEstimatedTaxPayments) {
    addItem({
      formNumber: 'Estimated Tax Payment Records',
      title: 'Federal & State Quarterly Estimated Tax Payment Proofs (Q1-Q4)',
      category: 'Deductions & Expenses',
      whyWeNeedIt: 'Verifies EFTPS transaction confirmations and state voucher receipts to credit payments already made against your tax liability.',
      whereCanIFindIt: 'EFTPS.gov history, IRS Online Account, state revenue portal receipts, or cancelled checks.',
      whyAmIAsked: 'You indicated paying quarterly estimated taxes to federal or state agencies.',
      source: 'Taxpayer',
      appliesTo: 'Multi-State',
      stateCode: intake.residenceState,
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  }

  // 18. Dependents & Childcare
  if (intake.hasDependents && intake.paidChildcare) {
    addItem({
      formNumber: 'Childcare Provider Statement',
      title: 'Child and Dependent Care Provider Information (Form 2441)',
      category: 'Identity & Dependents',
      whyWeNeedIt: 'Required under IRC § 21 to claim the Child Care Credit. Must include provider legal name, address, EIN or SSN, and total amount paid per child.',
      whereCanIFindIt: 'Obtain end-of-year tax receipt from your daycare, preschool, or care provider.',
      whyAmIAsked: 'You reported qualifying dependent care expenses while working.',
      source: 'Other',
      appliesTo: 'Federal',
      taxYear: intake.taxYear,
      priority: 'Recommended',
      status: 'Missing'
    });
  }

  // 19. State-Specific Rules
  if (intake.residenceState === 'CA') {
    addItem({
      formNumber: 'Form FTB 3853',
      title: 'California Health Coverage Exemption & Verification (1095-B / 1095-C)',
      category: 'State Specific',
      whyWeNeedIt: 'California law assesses penalties (minimum $900 per adult) unless full-year health coverage or a statutory exemption is verified.',
      whereCanIFindIt: 'Provided by your health insurance carrier or employer HR.',
      whyAmIAsked: 'You reside in California where individual health coverage is legally mandated.',
      source: 'Taxpayer',
      appliesTo: 'CA',
      stateCode: 'CA',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  } else if (intake.residenceState === 'NJ') {
    addItem({
      formNumber: 'Schedule NJ-HCC',
      title: 'New Jersey Health Coverage Mandate Verification',
      category: 'State Specific',
      whyWeNeedIt: 'New Jersey enforces the Shared Responsibility Payment for individuals without qualifying minimum essential coverage.',
      whereCanIFindIt: 'Form 1095-B/C from employer or private health plan.',
      whyAmIAsked: 'You reside in New Jersey where state health insurance coverage is required.',
      source: 'Taxpayer',
      appliesTo: 'NJ',
      stateCode: 'NJ',
      taxYear: intake.taxYear,
      priority: 'Required',
      status: 'Missing'
    });
  } else if (intake.residenceState === 'SC' && (intake.hadFreelanceOrContract || intake.hasOwnBusiness)) {
    addItem({
      formNumber: 'SC Form I-335',
      title: 'South Carolina Active Trade or Business Income Election Schedule',
      category: 'State Specific',
      whyWeNeedIt: 'Calculates the elective 3% flat tax rate under SC Act 61 on pass-through active business earnings.',
      whereCanIFindIt: 'Prepared by our tax team using your Schedule C / 1065 records.',
      whyAmIAsked: 'You operate an active trade or business in South Carolina.',
      source: 'Taxpayer',
      appliesTo: 'SC',
      stateCode: 'SC',
      taxYear: intake.taxYear,
      priority: 'Recommended',
      status: 'Awaiting Tax Professional'
    });
  } else if (intake.residenceState === 'FL' || intake.residenceState === 'TN') {
    // Both states have NO personal income tax!
    addItem({
      formNumber: 'State Tax Exemption Certificate',
      title: `${stateRule.name} Individual Income Tax Exemption Confirmation`,
      category: 'State Specific',
      whyWeNeedIt: `Confirms ${stateRule.name} imposes NO state personal income tax on wages or personal earnings. No state individual return will be prepared.`,
      whereCanIFindIt: 'Generated automatically by A/R Tax Services compliance engine.',
      whyAmIAsked: `You are a resident of ${stateRule.name}.`,
      source: 'Other',
      appliesTo: intake.residenceState,
      stateCode: intake.residenceState,
      taxYear: intake.taxYear,
      priority: 'Optional',
      status: 'Accepted',
      accountantApproved: true
    });
  }

  return result;
}

// --------------------------------------------------------------------------
// COMPLETENESS & READINESS ENGINE
// --------------------------------------------------------------------------

export function calculateReadinessScorecard(
  items: PersonalizedDocItem[],
  taxYear: number,
  residenceState: string
): ReadinessScorecard {
  const yearItems = items.filter(i => i.taxYear === taxYear);

  // Applicable items are items that are NOT marked as 'Not Applicable'
  const applicableItems = yearItems.filter(i => i.status !== 'Not Applicable');
  const totalApplicable = applicableItems.length;

  const receivedOrAccepted = applicableItems.filter(i =>
    i.status === 'Accepted' || i.status === 'Received'
  ).length;

  const requiredItems = applicableItems.filter(i => i.priority === 'Required');
  const requiredTotal = requiredItems.length;
  const requiredReceived = requiredItems.filter(i =>
    i.status === 'Accepted' || i.status === 'Received'
  ).length;
  const requiredMissing = requiredItems.filter(i =>
    i.status === 'Missing' || i.status === 'Rejected / Replace'
  ).length;

  const needsReviewCount = applicableItems.filter(i =>
    i.status === 'Needs Review' || i.status === 'AI Review' || i.status === 'Processing'
  ).length;

  const optionalMissing = applicableItems.filter(i =>
    (i.priority === 'Recommended' || i.priority === 'Optional') &&
    (i.status === 'Missing' || i.status === 'Awaiting Client')
  ).length;

  // Separate Federal vs State items
  const federalItems = applicableItems.filter(i => i.appliesTo === 'Federal' || i.appliesTo === 'Multi-State');
  const federalRequired = federalItems.filter(i => i.priority === 'Required');
  const federalReceived = federalRequired.filter(i => i.status === 'Accepted' || i.status === 'Received').length;
  const federalReadinessPct = federalRequired.length > 0
    ? Math.round((federalReceived / federalRequired.length) * 100)
    : 100;

  // State calculations: If state is FL or TN, state readiness is 100% since no return is required!
  let stateReadinessPct = 100;
  if (residenceState !== 'FL' && residenceState !== 'TN') {
    const stateItems = applicableItems.filter(i => i.appliesTo === residenceState || i.stateCode === residenceState);
    const stateRequired = stateItems.filter(i => i.priority === 'Required');
    if (stateRequired.length > 0) {
      const stateReceived = stateRequired.filter(i => i.status === 'Accepted' || i.status === 'Received').length;
      stateReadinessPct = Math.round((stateReceived / stateRequired.length) * 100);
    }
  }

  // Overall readiness based strictly on applicable items
  const overallReadinessPct = totalApplicable > 0
    ? Math.round(((receivedOrAccepted) / totalApplicable) * 100)
    : 0;

  // Workflow determination
  let filingWorkflowStage: ReadinessScorecard['filingWorkflowStage'] = 'Documents Gathering';
  if (requiredMissing === 0 && needsReviewCount === 0 && totalApplicable > 0) {
    filingWorkflowStage = 'Documents Complete';
  } else if (needsReviewCount > 0) {
    filingWorkflowStage = 'Professional Review';
  } else if (requiredMissing > 0) {
    filingWorkflowStage = 'Action Required';
  }

  return {
    totalApplicable,
    receivedOrAccepted,
    requiredTotal,
    requiredReceived,
    requiredMissing,
    needsReviewCount,
    optionalMissing,
    federalReadinessPct,
    stateReadinessPct,
    overallReadinessPct,
    filingWorkflowStage
  };
}

// --------------------------------------------------------------------------
// DUPLICATE & MISMATCH DETECTION
// --------------------------------------------------------------------------

export function detectUploadAnomalies(
  newUpload: {
    fileName: string;
    fileHash?: string;
    taxYear: number;
    formType?: string;
    payerName?: string;
    reportedAmount?: number;
  },
  existingItems: PersonalizedDocItem[],
  selectedSystemTaxYear: number
): {
  isPossibleDuplicate: boolean;
  duplicateMatchId?: string;
  duplicateReason?: string;
  isTaxYearMismatch: boolean;
  mismatchYear?: number;
} {
  let isPossibleDuplicate = false;
  let duplicateMatchId: string | undefined;
  let duplicateReason: string | undefined;

  // Hash or name match
  for (const item of existingItems) {
    if (item.uploadedFileName && item.uploadedFileName.toLowerCase() === newUpload.fileName.toLowerCase()) {
      isPossibleDuplicate = true;
      duplicateMatchId = item.id;
      duplicateReason = `Exact filename match with previously uploaded document "${item.uploadedFileName}".`;
      break;
    }

    if (newUpload.fileHash && item.fileHash && newUpload.fileHash === item.fileHash) {
      isPossibleDuplicate = true;
      duplicateMatchId = item.id;
      duplicateReason = `Cryptographic SHA-256 hash match with document "${item.uploadedFileName}".`;
      break;
    }

    // Payer and Form type match
    if (
      newUpload.payerName &&
      item.ocrData?.payerName &&
      newUpload.payerName.toLowerCase() === String(item.ocrData.payerName).toLowerCase() &&
      item.formNumber === newUpload.formType &&
      item.taxYear === newUpload.taxYear
    ) {
      isPossibleDuplicate = true;
      duplicateMatchId = item.id;
      duplicateReason = `Same tax form (${item.formNumber}) and identical issuer (${newUpload.payerName}) for tax year ${item.taxYear}.`;
      break;
    }
  }

  // Tax year mismatch check
  const isTaxYearMismatch = newUpload.taxYear !== selectedSystemTaxYear;
  const mismatchYear = isTaxYearMismatch ? newUpload.taxYear : undefined;

  return {
    isPossibleDuplicate,
    duplicateMatchId,
    duplicateReason,
    isTaxYearMismatch,
    mismatchYear
  };
}

// --------------------------------------------------------------------------
// AUTOMATIC CLIENT DETAILS & SUBMITTED DOCUMENTS RECONCILIATION ENGINE
// --------------------------------------------------------------------------

export function extractStateCode(jurisdictionStr?: string, addressStr?: string): 'CA' | 'NY' | 'NC' | 'SC' | 'VA' | 'TN' | 'FL' | 'NJ' {
  const combined = `${jurisdictionStr || ''} ${addressStr || ''}`.toUpperCase();
  if (combined.includes('SOUTH CAROLINA') || combined.includes('(SC)') || combined.includes(' SC ') || combined.includes(', SC')) return 'SC';
  if (combined.includes('NORTH CAROLINA') || combined.includes('(NC)') || combined.includes(' NC ') || combined.includes(', NC')) return 'NC';
  if (combined.includes('CALIFORNIA') || combined.includes('(CA)') || combined.includes(' CA ') || combined.includes(', CA')) return 'CA';
  if (combined.includes('NEW YORK') || combined.includes('(NY)') || combined.includes(' NY ') || combined.includes(', NY')) return 'NY';
  if (combined.includes('VIRGINIA') || combined.includes('(VA)') || combined.includes(' VA ') || combined.includes(', VA')) return 'VA';
  if (combined.includes('TENNESSEE') || combined.includes('(TN)') || combined.includes(' TN ') || combined.includes(', TN')) return 'TN';
  if (combined.includes('FLORIDA') || combined.includes('(FL)') || combined.includes(' FL ') || combined.includes(', FL')) return 'FL';
  if (combined.includes('NEW JERSEY') || combined.includes('(NJ)') || combined.includes(' NJ ') || combined.includes(', NJ')) return 'NJ';
  return 'SC';
}

export function deriveIntakeFromClientAndDocs(
  client: DemoClient,
  submittedDocs: DemoDocument[],
  taxYear: number
): IntakeResponses {
  const primaryState = extractStateCode(client.primaryJurisdiction, client.address);
  const workStates: ('CA' | 'NY' | 'NC' | 'SC' | 'VA' | 'TN' | 'FL' | 'NJ')[] = [primaryState];

  if (client.secondaryJurisdictions && Array.isArray(client.secondaryJurisdictions)) {
    client.secondaryJurisdictions.forEach(j => {
      const code = extractStateCode(j);
      if (code && !workStates.includes(code)) {
        workStates.push(code);
      }
    });
  }

  const entityLower = (client.entityType || '').toLowerCase();
  const businessLower = (client.businessName || '').toLowerCase();
  const isSCorp = entityLower.includes('s corporation') || entityLower.includes('s-corp');
  const isPartnership = entityLower.includes('partnership') || entityLower.includes('llp') || entityLower.includes('1065');
  const isCCorp = entityLower.includes('c corporation') || entityLower.includes('c-corp');
  const isSoleProp = entityLower.includes('sole proprietor') || entityLower.includes('carpentry') || entityLower.includes('schedule c');
  const isBusinessOwner = isSCorp || isPartnership || isCCorp || isSoleProp || !!client.businessName;

  // Scan submitted docs for specific signals
  const hasW2Submitted = submittedDocs.some(d =>
    d.category?.toLowerCase().includes('w-2') ||
    d.fileName?.toLowerCase().includes('w2') ||
    d.fileName?.toLowerCase().includes('w-2')
  );
  const has1099Submitted = submittedDocs.some(d =>
    d.category?.toLowerCase().includes('1099') ||
    d.fileName?.toLowerCase().includes('1099')
  );
  const hasRentalSignal = businessLower.includes('rental') || businessLower.includes('property') || entityLower.includes('individual');

  return {
    taxYear,
    residenceState: primaryState,
    workStates,
    hasOtherStateIncome: workStates.length > 1,
    filingStatus: 'Married Filing Jointly',
    hadW2Employment: true, // Form W-2
    w2Count: 1,
    hadFreelanceOrContract: true, // Form 1099-NEC
    received1099MISC: true, // Form 1099-MISC
    receivedInterest: true, // Form 1099-INT
    receivedDividends: true, // Form 1099-DIV
    receivedInterestOrDividends: true,
    soldInvestments: true, // Form 1099-B
    received1099K: true, // Form 1099-K
    receivedRetirementDistributions: true, // Form 1099-R
    receivedGovernmentPayments: true, // Form 1099-G
    receivedSocialSecurity: true, // Form SSA-1099 / RRB-1099
    hasPassThroughK1: true, // Form Schedule K-1
    hasMortgage: true, // Form 1098
    hasCollegeOrTuition: true, // Form 1098-T
    paysStudentLoanInterest: true, // Form 1098-E
    hasForeclosureOrAbandonment: true, // Form 1099-A
    hasCancelledDebt: true, // Form 1099-C
    hasCancelledDebtOrForeclosure: true,
    soldRealEstate: true, // Form 1099-S
    hasHSAorMSA: true, // Form 1099-SA / 5498-SA
    contributedToIRA: true, // Form 5498
    hasMarketplaceInsurance: true, // Form 1095-A
    hasLongTermCare: true, // Form 1099-LTC
    hasABLEAccount: true, // Form 1099-QA / 5498-QA
    hasEducationPlans: true, // Form 1099-Q
    hasOwnBusiness: isBusinessOwner,
    hasCryptoTransactions: false,
    ownsRealEstate: true,
    ownsRentalProperty: true,
    hasForeignAccountsOrIncome: false,
    madeEstimatedTaxPayments: true,
    hasDependents: true,
    paidChildcare: false,
    receivedUnemployment: true
  };
}

export function reconcileChecklistWithClientVaultDocs(
  items: PersonalizedDocItem[],
  client: DemoClient,
  submittedDocs: DemoDocument[],
  taxYear: number
): { reconciledItems: PersonalizedDocItem[]; matchedCount: number } {
  let matchedCount = 0;
  const matchedDocIds = new Set<string>();

  const reconciledItems = items.map(item => {
    // Only check items for active tax year
    if (item.taxYear !== taxYear && item.taxYear !== 0) {
      return item;
    }

    const formNum = (item.formNumber || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    const title = (item.title || '').toLowerCase();

    // Look for matching document among submitted documents
    const matchingDoc = submittedDocs.find(d => {
      if (matchedDocIds.has(d.id)) return false;
      const dCat = (d.category || '').toLowerCase();
      const dFile = (d.fileName || '').toLowerCase();

      // W-2 match
      if (formNum.includes('w-2') || cat === 'employment') {
        return dCat.includes('w-2') || dFile.includes('w2') || dFile.includes('w-2');
      }

      // Bank or business expense statement
      if (formNum.includes('business expense') || cat.includes('deductions') || title.includes('bank') || title.includes('operating')) {
        return dCat.includes('bank') || dFile.includes('operating') || dFile.includes('bank') || dFile.includes('statement');
      }

      // 1120-S or Pass-through K-1
      if (formNum.includes('k-1') || formNum.includes('1120') || title.includes('s-corporation') || title.includes('k-1')) {
        return dCat.includes('tax return') || dFile.includes('1120') || dFile.includes('k1') || dFile.includes('k-1');
      }

      // Depreciation & Fixed Assets
      if (title.includes('depreciation') || title.includes('fixed asset') || cat.includes('depreciation')) {
        return dCat.includes('depreciation') || dFile.includes('fixed_asset') || dFile.includes('assets');
      }

      // IRS Notice / Examination
      if (formNum.includes('notice') || title.includes('notice') || title.includes('cp2000')) {
        return dCat.includes('notice') || dFile.includes('notice') || dFile.includes('cp2000');
      }

      return false;
    });

    if (matchingDoc) {
      matchedDocIds.add(matchingDoc.id);
      matchedCount++;
      return {
        ...item,
        status: (matchingDoc.status === 'Verified' ? 'Accepted' : 'Accepted') as DocumentStatus,
        uploadedFileName: matchingDoc.fileName,
        uploadedFileSize: matchingDoc.fileSize,
        uploadedDate: new Date(matchingDoc.uploadedAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }),
        fileHash: matchingDoc.sha256Hash,
        confidenceScore: 99,
        confidenceTier: 'High' as const,
        autoMatchedFromVault: true,
        matchedVaultDocumentId: matchingDoc.id,
        accountantApproved: matchingDoc.status === 'Verified',
        reviewedBy: matchingDoc.status === 'Verified' ? (client.assignedReviewerName || 'Elena Rostova, CPA') : undefined,
        ocrData: item.ocrData || (formNum.includes('w-2') ? {
          payerName: client.businessName || 'Perotti Capital Holdings, LLC',
          box1Wages: 175000,
          box2FederalWithholding: 34200,
          box16StateWages: 175000,
          box17StateTax: 10850,
          employeeSSN: client.einOrSsnMasked || '•••-••-4819'
        } : undefined)
      };
    }

    return item;
  });

  return { reconciledItems, matchedCount };
}

export function generateAutomaticClientChecklist(
  client: DemoClient,
  submittedDocs: DemoDocument[],
  taxYear: number
): {
  intake: IntakeResponses;
  items: PersonalizedDocItem[];
  matchedCount: number;
  stateCode: 'CA' | 'NY' | 'NC' | 'SC' | 'VA' | 'TN' | 'FL' | 'NJ';
} {
  const intake = deriveIntakeFromClientAndDocs(client, submittedDocs, taxYear);
  const baseItems = generatePersonalizedChecklist(intake, []);
  const { reconciledItems, matchedCount } = reconcileChecklistWithClientVaultDocs(baseItems, client, submittedDocs, taxYear);

  return {
    intake,
    items: reconciledItems,
    matchedCount,
    stateCode: intake.residenceState
  };
}

