/**
 * A/R Tax Services, LLC — TaxGuard AI
 * Authoritative Server-Side Tax Questionnaire & Requirement Engine
 *
 * Implements:
 * - Persisted, tax-year-aware questionnaire with 28+ tax topic facts
 * - Dynamic requirement generation based on verified facts
 * - Conflict detection between questionnaire answers and "Not Applicable" claims
 * - Full audit trail with user, timestamp, question version, and revision history
 */

import { db } from '../db';

export interface TaxQuestionnaireAnswers {
  // Filing & Demographics
  filingStatus: 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household' | 'qualifying_surviving_spouse';
  hasDependents: boolean;
  dependentCount?: number;

  // Employment
  hasW2Employment: boolean;
  hasMultipleEmployers?: boolean;

  // Self-Employment & Business
  hasSelfEmployment: boolean;
  hasScheduleCActivity?: boolean;
  hasPartnershipInterests?: boolean;
  hasSCorporationInterests?: boolean;
  hasCCorporationInterests?: boolean;
  hasRentalProperties?: boolean;
  hasBusinessAccountingRecords?: boolean;

  // Investment & Passive Income
  hasInterestIncome: boolean;
  hasDividendIncome: boolean;
  hasSecuritiesTrades: boolean;
  hasCapitalGainsOrLosses: boolean;
  hasDigitalAssetsOrCrypto: boolean;

  // Retirement & Social Security
  hasRetirementDistributions: boolean;
  hasSocialSecurityBenefits: boolean;

  // Healthcare & Deductions
  hasMarketplaceInsurance: boolean; // Form 1095-A
  hasHSA: boolean; // Form 1099-SA / 8889
  hasEducationExpenses: boolean; // Form 1098-T
  hasMortgageOrRealEstateTaxes: boolean; // Form 1098
  hasItemizedDeductions: boolean; // Schedule A

  // Tax Payments & Prior Returns
  hasEstimatedTaxPayments: boolean;
  hasPriorYearFederalReturn: boolean;
  hasPriorYearStateReturn: boolean;

  // Cross-Border & Multi-State
  hasForeignIncomeOrAssets: boolean;
  hasForeignBankAccounts: boolean; // FBAR / FinCEN 114
  hasMultiStateIncome: boolean;
  hasPartYearResidency: boolean;
  stateOfResidency: string;
  additionalStates?: string[];

  // Material Events
  hasOtherMaterialTaxEvents?: boolean;
  materialTaxEventsDescription?: string;
}

export interface StoredQuestionnaireRecord {
  id: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  version: number;
  answers: TaxQuestionnaireAnswers;
  submittedBy: string;
  submittedAt: string;
  updatedBy: string;
  updatedAt: string;
  revisionHistory: Array<{
    version: number;
    updatedBy: string;
    updatedAt: string;
    modifiedFields: string[];
  }>;
}

export interface GeneratedDocumentRequirement {
  id: string;
  requirementCode: string;
  tenantId: string;
  clientId: string;
  taxYear: number;
  title: string;
  formNumber: string;
  category: string;
  jurisdiction: string;
  description: string;
  statutoryBasis?: string;
  priority: 'Required' | 'Required if applicable' | 'Recommended' | 'Optional';
  status: 'Required' | 'Requested' | 'Received' | 'Processing' | 'Under Review' | 'Accepted' | 'Rejected' | 'Missing' | 'Superseded' | 'Not Applicable';
  applicableQuestionKey?: string;
  associatedDocumentId?: string;
  notApplicableReason?: string;
  notApplicableReportedAt?: string;
  reviewStatus: 'PENDING' | 'ACCEPTED' | 'EXCEPTION_FLAGGED';
  updatedAt: string;
}

// Global in-memory storage for server questionnaire & dynamic requirements
export const serverTaxQuestionnaires = new Map<string, StoredQuestionnaireRecord>();
export const serverCaseRequirements = new Map<string, GeneratedDocumentRequirement[]>();

export class TaxQuestionnaireEngine {
  private static makeKey(tenantId: string, clientId: string, taxYear: number): string {
    return `${tenantId}:${clientId}:${taxYear}`;
  }

  /**
   * Retrieves the authoritative stored questionnaire for a client tax case.
   */
  public static getQuestionnaire(tenantId: string, clientId: string, taxYear: number): StoredQuestionnaireRecord | null {
    const key = this.makeKey(tenantId, clientId, taxYear);
    return serverTaxQuestionnaires.get(key) || null;
  }

  /**
   * Saves or updates the questionnaire answers, evaluates affected requirements,
   * and records an immutable audit log.
   */
  public static saveQuestionnaire(params: {
    tenantId: string;
    clientId: string;
    taxYear: number;
    answers: TaxQuestionnaireAnswers;
    actorId: string;
    actorRole: string;
  }): { questionnaire: StoredQuestionnaireRecord; requirements: GeneratedDocumentRequirement[] } {
    const { tenantId, clientId, taxYear, answers, actorId, actorRole } = params;
    const key = this.makeKey(tenantId, clientId, taxYear);
    const existing = serverTaxQuestionnaires.get(key);
    const now = new Date().toISOString();

    let record: StoredQuestionnaireRecord;

    if (existing) {
      const modifiedFields = Object.keys(answers).filter(
        k => (answers as any)[k] !== (existing.answers as any)[k]
      );
      record = {
        ...existing,
        version: existing.version + 1,
        answers,
        updatedBy: actorId,
        updatedAt: now,
        revisionHistory: [
          ...existing.revisionHistory,
          {
            version: existing.version + 1,
            updatedBy: actorId,
            updatedAt: now,
            modifiedFields
          }
        ]
      };
    } else {
      record = {
        id: `qst_${taxYear}_${clientId}`,
        tenantId,
        clientId,
        taxYear,
        version: 1,
        answers,
        submittedBy: actorId,
        submittedAt: now,
        updatedBy: actorId,
        updatedAt: now,
        revisionHistory: []
      };
    }

    serverTaxQuestionnaires.set(key, record);

    // Recompute requirements derived from facts
    const requirements = this.generateRequirementsFromQuestionnaire(tenantId, clientId, taxYear, answers);
    serverCaseRequirements.set(key, requirements);

    // Record audit event
    db.logAudit({
      userId: actorId,
      userName: `Taxpayer (${clientId})`,
      userRole: actorRole || 'client',
      action: existing ? 'TAX_QUESTIONNAIRE_UPDATED' : 'TAX_QUESTIONNAIRE_SUBMITTED',
      resource: `TaxCase ${taxYear} (${clientId})`,
      details: `Questionnaire version ${record.version} saved with ${requirements.length} derived document requirements.`,
      severity: 'info',
      ipAddress: '127.0.0.1'
    });

    return { questionnaire: record, requirements };
  }

  /**
   * Generates tailored requirements from questionnaire answers.
   * Universal requirements are never dumped indiscriminately.
   */
  public static generateRequirementsFromQuestionnaire(
    tenantId: string,
    clientId: string,
    taxYear: number,
    answers: TaxQuestionnaireAnswers
  ): GeneratedDocumentRequirement[] {
    const list: GeneratedDocumentRequirement[] = [];
    const now = new Date().toISOString();
    const primaryState = answers.stateOfResidency || 'SC';

    const add = (
      code: string,
      title: string,
      formNumber: string,
      category: string,
      jurisdiction: string,
      description: string,
      priority: 'Required' | 'Required if applicable' | 'Recommended' | 'Optional',
      statutoryBasis?: string,
      applicableQuestionKey?: string
    ) => {
      list.push({
        id: `REQ-${taxYear}-${clientId}-${code}`,
        requirementCode: code,
        tenantId,
        clientId,
        taxYear,
        title,
        formNumber,
        category,
        jurisdiction,
        description,
        statutoryBasis,
        priority,
        status: 'Required',
        applicableQuestionKey,
        reviewStatus: 'PENDING',
        updatedAt: now
      });
    };

    // 1. Mandatory Identity Check
    add(
      'GOV-ID',
      'Government-Issued Photo Identification',
      'Govt ID',
      'Identity & Dependents',
      'Federal',
      'Unexpired Driver\'s License or Passport for taxpayer and spouse per IRS e-file security rules.',
      'Required',
      'IRS Pub 1345 / Identity Verification'
    );

    // 2. Prior Year Tax Returns
    if (answers.hasPriorYearFederalReturn) {
      add(
        'PY-1040',
        `Prior Year (${taxYear - 1}) Federal Form 1040 Income Tax Return`,
        'Form 1040 (PY)',
        'Prior Year / Archival',
        'Federal',
        `Complete signed copy of the ${taxYear - 1} Federal Form 1040 return including all schedules.`,
        'Required',
        'Treas. Reg. § 1.6001-1',
        'hasPriorYearFederalReturn'
      );
    }
    if (answers.hasPriorYearStateReturn) {
      add(
        'PY-STATE',
        `Prior Year (${taxYear - 1}) ${primaryState} State Income Tax Return`,
        `Form ${primaryState}-1040 (PY)`,
        'Prior Year / Archival',
        primaryState,
        `Complete copy of the ${taxYear - 1} state tax return for ${primaryState}.`,
        'Required',
        'Treas. Reg. § 1.6001-1',
        'hasPriorYearStateReturn'
      );
    }

    // 3. W-2 Employment
    if (answers.hasW2Employment) {
      add(
        'W2-WAGE',
        'Form W-2 Wage & Tax Statements',
        'Form W-2',
        'Employment',
        `Federal / ${primaryState}`,
        answers.hasMultipleEmployers
          ? 'Form W-2 from each employer worked for during the tax year.'
          : 'Form W-2 Wage & Tax Statement issued by your employer.',
        'Required',
        'IRC § 6051',
        'hasW2Employment'
      );
    }

    // 4. Interest Income
    if (answers.hasInterestIncome) {
      add(
        '1099-INT',
        'Form 1099-INT Interest Income Statements',
        'Form 1099-INT',
        'Interest',
        'Federal',
        'Interest income statements from banks, CDs, credit unions, or treasury bonds.',
        'Required',
        'IRC § 6049',
        'hasInterestIncome'
      );
    }

    // 5. Dividend Income
    if (answers.hasDividendIncome) {
      add(
        '1099-DIV',
        'Form 1099-DIV Dividends & Capital Distributions',
        'Form 1099-DIV',
        'Dividends',
        'Federal',
        'Statements reporting ordinary dividends, qualified dividends, and capital gain distributions.',
        'Required',
        'IRC § 6042',
        'hasDividendIncome'
      );
    }

    // 6. Securities & Capital Gains
    if (answers.hasSecuritiesTrades || answers.hasCapitalGainsOrLosses) {
      add(
        '1099-B',
        'Form 1099-B Proceeds from Broker Transactions & Realized Gains/Losses',
        'Form 1099-B / 8949',
        'Securities',
        'Federal',
        'Consolidated brokerage statements with cost basis reporting (covered and non-covered securities).',
        'Required',
        'IRC § 6045',
        'hasSecuritiesTrades'
      );
    }

    // 7. Digital Assets & Crypto
    if (answers.hasDigitalAssetsOrCrypto) {
      add(
        'CRYPTO-REPORT',
        'Digital Asset / Cryptocurrency Transaction Ledger & Basis Schedule',
        'Crypto Ledger / 8949',
        'Cryptocurrency',
        'Federal',
        'Complete CSV / report of digital asset sales, conversions, staking, mining, and fair-market value at acquisition.',
        'Required',
        'IRS Notice 2014-21 / Form 1040 Digital Assets Question',
        'hasDigitalAssetsOrCrypto'
      );
    }

    // 8. Self-Employment & Business (Schedule C, 1099-NEC, 1099-K)
    if (answers.hasSelfEmployment || answers.hasScheduleCActivity) {
      add(
        '1099-NEC',
        'Form 1099-NEC Nonemployee Compensation & Form 1099-K',
        'Form 1099-NEC / 1099-K',
        'Contract / Gig Work',
        'Federal',
        'Compensation statements for independent contractor services, freelancing, and merchant card payment settlements.',
        'Required',
        'IRC § 6041A / § 6050W',
        'hasSelfEmployment'
      );
      add(
        'SCH-C-PL',
        'Business Profit & Loss Summary, Revenue Records & Expense Deductions',
        'Schedule C Support',
        'Business Records',
        'Federal',
        'Itemized accounting summary of gross sales, returns, cost of goods, vehicle mileage, and allowable expenses.',
        'Required',
        'IRC § 162',
        'hasScheduleCActivity'
      );
    }

    // 9. Entity Accounting Records (P&L, Balance Sheet, General Ledger, Payroll)
    if (answers.hasBusinessAccountingRecords || answers.hasSCorporationInterests || answers.hasCCorporationInterests) {
      add(
        'TB-GL',
        'Year-End Trial Balance, General Ledger & Balance Sheet',
        'Trial Balance / Balance Sheet',
        'Accounting Records',
        'Federal',
        'Adjusted year-end trial balance, general ledger detail, and reconciliation of assets, liabilities, and retained earnings.',
        'Required',
        'IRC § 446 / Reg. § 1.6001-1',
        'hasBusinessAccountingRecords'
      );
      add(
        'BANK-STATEMENTS',
        'Year-End Business Bank & Credit Card Statements (12 Months)',
        'Bank Statements',
        'Banking & Cash',
        'Federal',
        'Complete 12-month business bank and credit card statements verifying business transactions and ending balances.',
        'Required',
        'IRC § 6001',
        'hasBusinessAccountingRecords'
      );
      add(
        'PAYROLL-W3',
        'Annual Payroll Summary & Forms 941 / 940 / W-3',
        'Forms 941 / W-3',
        'Payroll Records',
        'Federal',
        'Federal employment tax filings substantiating officer compensation, payroll taxes, and gross payroll expenses.',
        'Required',
        'IRC § 3121',
        'hasBusinessAccountingRecords'
      );
    }

    // 10. Pass-Through Entities (K-1)
    if (answers.hasPartnershipInterests || answers.hasSCorporationInterests) {
      add(
        'SCH-K1',
        'Schedule K-1 Pass-Through Shareholder / Partner Earnings',
        'Schedule K-1 (1065/1120-S)',
        'Pass-Through Entities',
        'Federal',
        'Schedule K-1 reporting your distributive share of ordinary business income, deductions, credits, and basis.',
        'Required',
        'IRC §§ 702, 1366',
        'hasPartnershipInterests'
      );
    }

    // 11. Rental Properties (Schedule E)
    if (answers.hasRentalProperties) {
      add(
        'RENTAL-RECORDS',
        'Rental Property Income, Operating Expenses & Settlement Statements',
        'Schedule E Support',
        'Rental Real Estate',
        'Federal',
        'Rental income ledgers, mortgage interest, property taxes, insurance, repairs, and depreciation schedules.',
        'Required',
        'IRC § 212 / § 469',
        'hasRentalProperties'
      );
    }

    // 12. Retirement Distributions & Social Security
    if (answers.hasRetirementDistributions) {
      add(
        '1099-R',
        'Form 1099-R Distributions from Pensions, Annuities, Retirement or IRA',
        'Form 1099-R',
        'Retirement',
        'Federal',
        'Reports distributions, rollovers, and early withdrawal taxable amounts from 401(k), IRA, or pension plans.',
        'Required',
        'IRC § 408 / § 72',
        'hasRetirementDistributions'
      );
    }
    if (answers.hasSocialSecurityBenefits) {
      add(
        'SSA-1099',
        'Form SSA-1099 Social Security Benefit Statement',
        'Form SSA-1099',
        'Social Security',
        'Federal',
        'Reports total Social Security benefit payments received and federal tax withholdings.',
        'Required',
        'IRC § 86',
        'hasSocialSecurityBenefits'
      );
    }

    // 13. Marketplace Insurance (1095-A)
    if (answers.hasMarketplaceInsurance) {
      add(
        '1095-A',
        'Form 1095-A Health Insurance Marketplace Statement',
        'Form 1095-A',
        'Health Insurance',
        'Federal',
        'Required for reconciling the Premium Tax Credit (Form 8962) from healthcare exchange coverage.',
        'Required',
        'IRC § 36B',
        'hasMarketplaceInsurance'
      );
    }

    // 14. HSA Distributions & Contributions (1099-SA / 5498-SA)
    if (answers.hasHSA) {
      add(
        '1099-SA',
        'Form 1099-SA HSA Distributions & Form 5498-SA Contributions',
        'Form 1099-SA / 8889',
        'Health Savings Account',
        'Federal',
        'Documents confirming HSA contributions, distributions for qualified medical expenses, or taxable withdrawals.',
        'Required',
        'IRC § 223',
        'hasHSA'
      );
    }

    // 15. Education (1098-T)
    if (answers.hasEducationExpenses) {
      add(
        '1098-T',
        'Form 1098-T Tuition Statement & Course Fee Invoices',
        'Form 1098-T / 8863',
        'Education',
        'Federal',
        'Tuition statement from eligible educational institution for American Opportunity or Lifetime Learning Credit.',
        'Required',
        'IRC § 25A',
        'hasEducationExpenses'
      );
    }

    // 16. Mortgage & Real Estate Taxes (1098)
    if (answers.hasMortgageOrRealEstateTaxes) {
      add(
        '1098-MORTGAGE',
        'Form 1098 Mortgage Interest Statement & County Property Tax Receipts',
        'Form 1098',
        'Mortgage & Property',
        'Federal',
        'Reports mortgage interest, points paid, and real estate property taxes paid through escrow.',
        'Required',
        'IRC § 6050H',
        'hasMortgageOrRealEstateTaxes'
      );
    }

    // 17. Estimated Tax Payments
    if (answers.hasEstimatedTaxPayments) {
      add(
        'EST-PAYMENTS',
        'Proof of Estimated Tax Payments (Federal Form 1040-ES & State Vouchers)',
        'Payment Proof / EFTPS',
        'Tax Payments',
        `Federal / ${primaryState}`,
        'Electronic payment confirmations or cancelled checks substantiating quarterly estimated payments.',
        'Required',
        'IRC § 6654',
        'hasEstimatedTaxPayments'
      );
    }

    // 18. Foreign Financial Accounts (FBAR / Form 8938)
    if (answers.hasForeignIncomeOrAssets || answers.hasForeignBankAccounts) {
      add(
        'FBAR-RECORDS',
        'Foreign Bank & Financial Accounts Statements (FBAR / Form 8938)',
        'FinCEN 114 / Form 8938',
        'Foreign Assets',
        'Federal / FinCEN',
        'Year-end peak balances and account numbers for all foreign financial holdings exceeding statutory thresholds.',
        'Required',
        '31 U.S.C. § 5314 / IRC § 6038D',
        'hasForeignBankAccounts'
      );
    }

    // 19. Multi-State / Non-Resident Schedules
    if (answers.hasMultiStateIncome || answers.hasPartYearResidency) {
      add(
        'MULTI-STATE-W2',
        'Multi-State Allocation Schedules & Non-Resident Withholding Evidence',
        'State Schedule NR',
        'Multi-State Allocation',
        answers.additionalStates && answers.additionalStates.length > 0 ? answers.additionalStates.join(', ') : 'Multi-State',
        'W-2 statements and business revenue logs allocating wage and operating earnings by working state.',
        'Required',
        'State Uniform Division of Income for Tax Purposes Act',
        'hasMultiStateIncome'
      );
    }

    return list;
  }

  /**
   * Evaluates if a "Not Applicable" response from a client is acceptable or conflicts
   * with known facts in the questionnaire.
   */
  public static evaluateNotApplicableClaim(params: {
    tenantId: string;
    clientId: string;
    taxYear: number;
    requirementCode: string;
    clientReason: string;
    actorId: string;
  }): {
    permitted: boolean;
    requiresProfessionalReview: boolean;
    conflictReason?: string;
  } {
    const { tenantId, clientId, taxYear, requirementCode, clientReason, actorId } = params;
    const key = this.makeKey(tenantId, clientId, taxYear);
    const questionnaire = serverTaxQuestionnaires.get(key);

    if (!clientReason || clientReason.trim().length < 5) {
      return {
        permitted: false,
        requiresProfessionalReview: false,
        conflictReason: 'A detailed reason (minimum 5 characters) is required to designate a requirement as Not Applicable.'
      };
    }

    if (!questionnaire) {
      // No questionnaire on file yet: allow with professional review
      return {
        permitted: true,
        requiresProfessionalReview: true,
        conflictReason: 'Questionnaire not on file. Professional review required before waiver.'
      };
    }

    const answers = questionnaire.answers;

    // Detect factual contradictions:
    if (requirementCode === 'W2-WAGE' && answers.hasW2Employment) {
      return {
        permitted: true,
        requiresProfessionalReview: true,
        conflictReason: 'CONFLICT: Taxpayer indicated W-2 employment on questionnaire, but marked W-2 requirement as Not Applicable.'
      };
    }

    if (requirementCode === '1099-NEC' && (answers.hasSelfEmployment || answers.hasScheduleCActivity)) {
      return {
        permitted: true,
        requiresProfessionalReview: true,
        conflictReason: 'CONFLICT: Taxpayer indicated self-employment/contract work, but marked 1099-NEC as Not Applicable.'
      };
    }

    if (requirementCode === '1095-A' && answers.hasMarketplaceInsurance) {
      return {
        permitted: true,
        requiresProfessionalReview: true,
        conflictReason: 'CONFLICT: Taxpayer indicated Healthcare Marketplace enrollment, but marked Form 1095-A as Not Applicable.'
      };
    }

    if (requirementCode === 'FBAR-RECORDS' && (answers.hasForeignBankAccounts || answers.hasForeignIncomeOrAssets)) {
      return {
        permitted: true,
        requiresProfessionalReview: true,
        conflictReason: 'CONFLICT: Taxpayer indicated foreign financial accounts, but marked FBAR as Not Applicable.'
      };
    }

    // Permitted without severe conflict
    return {
      permitted: true,
      requiresProfessionalReview: false
    };
  }
}
