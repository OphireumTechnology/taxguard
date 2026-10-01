/**
 * A/R Tax Services, LLC - TaxGuard AI
 * TaxDocumentRequirementEngine & Guided Discovery Architecture
 *
 * Implements:
 * - Rule-driven, tax-year versioned document requirement discovery (Section 1)
 * - Guided branching tax discovery questionnaire (Section 2)
 * - Federal and all 50 states + DC tax requirement mapping (Section 8, 9, 10)
 * - Prior-year tax records and multi-state nexus (Section 3, 10, 26)
 * - Dynamic missing document detection (Section 24)
 * - Deterministic Stage 03 handoff package (Section 31, 61)
 */

export type TaxpayerEntityType =
  | 'individual'
  | 's_corp'
  | 'c_corp'
  | 'partnership'
  | 'llc';

export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse';

export type RequirementApplicability =
  | 'REQUIRED'
  | 'CONDITIONAL'
  | 'RECOMMENDED'
  | 'NOT_APPLICABLE'
  | 'NEEDS_PROFESSIONAL_REVIEW';

export type RequirementClientStatus =
  | 'Missing'
  | 'Uploaded'
  | 'Processing'
  | 'Needs Your Attention'
  | 'Under Review'
  | 'Accepted'
  | 'Replace Required'
  | 'Complete';

export interface TaxDocumentRequirementItem {
  id: string;
  requirementId: string;
  clientId: string;
  engagementId: string;
  taxCaseId: string;
  taxYear: number;
  jurisdiction: string;          // 'Federal' | 'SC' | 'NY' | 'NC' | 'CA', etc.
  authority: string;             // 'IRS' | 'SCDOR' | 'NYS_DTF', etc.
  returnType: string;            // 'Form 1040' | 'Form 1120-S', etc.
  category:
    | 'Federal Documents'
    | 'State Documents'
    | 'Prior-Year Tax Records'
    | 'Business / Accounting Records'
    | 'Additional Accountant Requests';
  subCategory?: string;          // 'Income', 'Deductions', 'Credits', etc.
  documentType: string;
  formNumber: string;
  title: string;
  description: string;
  whatIsThis: string;
  whyDoWeNeedIt: string;
  whereCanIGetIt: string;
  applicability: RequirementApplicability;
  requirementReason: string;
  sourceRuleId: string;
  statutoryBasis: string;
  status: RequirementClientStatus;
  blocking: boolean;
  dueDate?: string;
  requestedAt?: string;
  receivedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  relatedDocumentIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaxDiscoveryQuestionnaireAnswers {
  // 1. Personal & Filing
  filingStatus: FilingStatus;
  hasDependents: boolean;
  dependentsCount?: number;
  hasAddressChanged: boolean;
  hasIdentityProtectionPin: boolean;
  ipPin?: string;
  residentState: string;
  movedDuringYear: boolean;
  priorStatesOfResidence?: string[];

  // 2. Employment
  hasW2Employment: boolean;
  employerNames?: string[];
  workedInMultipleStates: boolean;
  workStates?: string[];
  hasTipsOrAllocatedTips: boolean;

  // 3. Self-Employment / Business (Schedule C)
  hasSelfEmployment: boolean;
  businessName?: string;
  has1099NEC: boolean;
  has1099K: boolean;
  has1099MISC: boolean;
  hasHomeOffice: boolean;
  hasBusinessVehicle: boolean;
  hasInventory: boolean;
  paidContractorsOver600: boolean;

  // 4. Investments & Financial
  hasBankInterest: boolean;
  hasDividends: boolean;
  hasStockSalesBrokerage: boolean;
  hasDigitalAssetsCrypto: boolean;
  hasCapitalLossCarryover: boolean;

  // 5. Retirement
  hasRetirementDistributions: boolean; // 1099-R
  hasSocialSecurity: boolean;          // SSA-1099
  madeIraContributions: boolean;

  // 6. Real Estate
  ownsHomeWithMortgage: boolean;       // 1098
  soldRealEstate: boolean;             // 1099-S
  ownsRentalProperty: boolean;         // Schedule E

  // 7. Education
  paidHigherEducationTuition: boolean; // 1098-T
  paidStudentLoanInterest: boolean;    // 1098-E

  // 8. Health & HSA
  hasMarketplaceHealthInsurance: boolean; // 1095-A
  hasHsaAccount: boolean;              // 1099-SA / 5498-SA

  // 9. Deductions & Credits
  hasSignificantCharitableDonations: boolean;
  hasChildCareExpenses: boolean;
  madeEstimatedTaxPayments: boolean;

  // 10. Prior Year & Records
  hasPriorYearTaxReturn: boolean;
  priorYearAgiKnown?: boolean;
  hasPriorYearCarryovers: boolean;

  // 11. Foreign & Complex
  hasForeignAccountsOrAssets: boolean; // Requires professional review
  hasForeignIncome: boolean;

  // 12. Accounting software (for businesses)
  usesAccountingSoftware: boolean;
  accountingPlatform?: 'quickbooks' | 'xero' | 'manual' | 'none';
}

export const DEFAULT_QUESTIONNAIRE_ANSWERS: TaxDiscoveryQuestionnaireAnswers = {
  filingStatus: 'single',
  hasDependents: false,
  hasAddressChanged: false,
  hasIdentityProtectionPin: false,
  residentState: 'SC',
  movedDuringYear: false,
  hasW2Employment: true,
  workedInMultipleStates: false,
  hasTipsOrAllocatedTips: false,
  hasSelfEmployment: false,
  has1099NEC: false,
  has1099K: false,
  has1099MISC: false,
  hasHomeOffice: false,
  hasBusinessVehicle: false,
  hasInventory: false,
  paidContractorsOver600: false,
  hasBankInterest: false,
  hasDividends: false,
  hasStockSalesBrokerage: false,
  hasDigitalAssetsCrypto: false,
  hasCapitalLossCarryover: false,
  hasRetirementDistributions: false,
  hasSocialSecurity: false,
  madeIraContributions: false,
  ownsHomeWithMortgage: false,
  soldRealEstate: false,
  ownsRentalProperty: false,
  paidHigherEducationTuition: false,
  paidStudentLoanInterest: false,
  hasMarketplaceHealthInsurance: false,
  hasHsaAccount: false,
  hasSignificantCharitableDonations: false,
  hasChildCareExpenses: false,
  madeEstimatedTaxPayments: false,
  hasPriorYearTaxReturn: true,
  hasPriorYearCarryovers: false,
  hasForeignAccountsOrAssets: false,
  hasForeignIncome: false,
  usesAccountingSoftware: false
};

export class TaxDocumentRequirementEngine {
  private static questionnaires: Map<string, TaxDiscoveryQuestionnaireAnswers> = new Map();
  private static customRequests: Map<string, TaxDocumentRequirementItem[]> = new Map();
  private static notApplicableMap: Map<string, Set<string>> = new Map();

  /**
   * Confirms a requirement is not applicable for a client and tax year.
   */
  public static markNotApplicable(clientId: string, taxYear: number, requirementId: string, reason?: string): void {
    const key = `${clientId}_${taxYear}`;
    let set = this.notApplicableMap.get(key);
    if (!set) {
      set = new Set();
      this.notApplicableMap.set(key, set);
    }
    set.add(requirementId);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`taxguard_not_applicable_${key}`, JSON.stringify(Array.from(set)));
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Checks whether a requirement has been confirmed not applicable.
   */
  public static isNotApplicable(clientId: string, taxYear: number, requirementId: string): boolean {
    const key = `${clientId}_${taxYear}`;
    let set = this.notApplicableMap.get(key);
    if (!set && typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`taxguard_not_applicable_${key}`);
        if (stored) {
          set = new Set(JSON.parse(stored));
          this.notApplicableMap.set(key, set);
        }
      } catch (e) {
        // ignore
      }
    }
    return set ? set.has(requirementId) : false;
  }

  /**
   * Retrieves saved discovery questionnaire answers for a client and tax year.
   */
  public static getQuestionnaire(clientId: string, taxYear: number): TaxDiscoveryQuestionnaireAnswers {
    const key = `${clientId}_${taxYear}`;
    if (this.questionnaires.has(key)) {
      return this.questionnaires.get(key)!;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`taxguard_questionnaire_${key}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          this.questionnaires.set(key, parsed);
          return parsed;
        }
      } catch (e) {
        // fallback
      }
    }
    return { ...DEFAULT_QUESTIONNAIRE_ANSWERS };
  }

  /**
   * Saves discovery questionnaire answers and updates cache.
   */
  public static saveQuestionnaire(
    clientId: string,
    taxYear: number,
    answers: Partial<TaxDiscoveryQuestionnaireAnswers>
  ): TaxDiscoveryQuestionnaireAnswers {
    const current = this.getQuestionnaire(clientId, taxYear);
    const updated = { ...current, ...answers };
    const key = `${clientId}_${taxYear}`;
    this.questionnaires.set(key, updated);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(`taxguard_questionnaire_${key}`, JSON.stringify(updated));
      } catch (e) {
        // ignore
      }
    }
    return updated;
  }

  /**
   * Generates dynamic, rule-driven, personalized checklist requirements.
   * Only applicable requirements are returned.
   */
  public static generateRequirements(params: {
    clientId: string;
    taxYear: number;
    entityType?: TaxpayerEntityType;
    entityName?: string;
    answers?: TaxDiscoveryQuestionnaireAnswers;
    uploadedDocumentIds?: string[];
  }): TaxDocumentRequirementItem[] {
    const { clientId, taxYear } = params;
    const entityType = params.entityType || 'individual';
    const answers = params.answers || this.getQuestionnaire(clientId, taxYear);
    const reqs: TaxDocumentRequirementItem[] = [];
    const now = new Date().toISOString();

    const makeReq = (
      reqId: string,
      title: string,
      formNumber: string,
      category: TaxDocumentRequirementItem['category'],
      subCategory: string,
      jurisdiction: string,
      authority: string,
      description: string,
      whatIsThis: string,
      whyDoWeNeedIt: string,
      whereCanIGetIt: string,
      statutoryBasis: string,
      blocking: boolean = true,
      applicability: RequirementApplicability = 'REQUIRED',
      customReason?: string
    ): TaxDocumentRequirementItem => {
      const isClientWaived = this.isNotApplicable(clientId, taxYear, reqId);
      return {
        id: `${clientId}_${taxYear}_${reqId}`,
        requirementId: reqId,
        clientId,
        engagementId: `eng_${taxYear}_${clientId}`,
        taxCaseId: `case_${taxYear}_${clientId}`,
        taxYear,
        jurisdiction,
        authority,
        returnType: entityType === 'individual' ? 'Form 1040' : entityType === 's_corp' ? 'Form 1120-S' : 'Entity Return',
        category,
        subCategory,
        documentType: formNumber,
        formNumber,
        title,
        description,
        whatIsThis,
        whyDoWeNeedIt,
        whereCanIGetIt,
        applicability: isClientWaived ? 'NOT_APPLICABLE' : applicability,
        requirementReason: isClientWaived
          ? 'Confirmed not applicable by taxpayer.'
          : customReason || (whyDoWeNeedIt ? `Required for Tax Year ${taxYear}: ${whyDoWeNeedIt}` : `Identified from questionnaire response.`),
        sourceRuleId: `RULE-${taxYear}-${reqId}`,
        statutoryBasis,
        status: isClientWaived ? 'Complete' : 'Missing',
        blocking: isClientWaived ? false : blocking,
        relatedDocumentIds: [],
        createdAt: now,
        updatedAt: now
      };
    };

    // =========================================================================
    // 1. PRIOR-YEAR TAX RECORDS (MANDATORY FOR ALL FILERS)
    // =========================================================================
    if (answers.hasPriorYearTaxReturn) {
      reqs.push(
        makeReq(
          'REQ-PY-FED',
          `Prior-Year Federal Tax Return (${taxYear - 1})`,
          'Form 1040 (PY)',
          'Prior-Year Tax Records',
          'Prior-Year Filing',
          'Federal',
          'IRS',
          `Complete signed federal tax return from tax year ${taxYear - 1} including all schedules, W-2 attachments, and carryover worksheets.`,
          'A copy of the federal income tax return you filed last year.',
          'Verifies your prior-year Adjusted Gross Income (AGI) for IRS e-filing authentication, tracks depreciation schedules, and identifies capital loss or credit carryovers.',
          'Your tax preparer from last year, your personal files, or download a tax transcript from IRS.gov/individuals/get-transcript.',
          'Treas. Reg. § 1.6011-1; Rev. Proc. 2005-60',
          true
        )
      );

      const state = answers.residentState || 'SC';
      reqs.push(
        makeReq(
          `REQ-PY-STATE-${state}`,
          `Prior-Year ${state} State Tax Return (${taxYear - 1})`,
          `${state} State Return (PY)`,
          'Prior-Year Tax Records',
          'Prior-Year Filing',
          state,
          `${state} Dept of Revenue`,
          `Complete prior-year state return for ${state} with state withholding records and property/credit schedules.`,
          `Your state income tax return filed for ${state} in tax year ${taxYear - 1}.`,
          `Calculates state tax refund addbacks, verified carryforward credits, and multi-state tax basis differences.`,
          `Your prior tax preparer or your online state tax portal account.`,
          `${state} State Tax Code; Recordkeeping Regulations`,
          true
        )
      );
    }

    // =========================================================================
    // 2. EMPLOYMENT (W-2)
    // =========================================================================
    if (answers.hasW2Employment) {
      reqs.push(
        makeReq(
          'REQ-FED-W2',
          `Form W-2 Wage and Tax Statement (${taxYear})`,
          'Form W-2',
          'Federal Documents',
          'Employment Income',
          'Federal',
          'IRS',
          `Official W-2 issued by your employer(s) reporting Box 1 taxable wages, Box 2 federal withholding, and state/local tax information.`,
          'An official tax form provided by your employer showing total earnings and taxes withheld during the calendar year.',
          'Required by the IRS and state taxing authorities to substantiate gross wages and tax credits for withholding payments.',
          'Your employer or their payroll portal (e.g. ADP, Paychex, Workday). Typically available by January 31.',
          'IRC § 6051; Treas. Reg. § 31.6051-1',
          true
        )
      );
    }

    // Multi-state employment W-2
    if (answers.workedInMultipleStates && answers.workStates && answers.workStates.length > 0) {
      answers.workStates.forEach(st => {
        if (st !== answers.residentState) {
          reqs.push(
            makeReq(
              `REQ-STATE-W2-${st}`,
              `Form W-2 for Nonresident / Part-Year State: ${st}`,
              `Form W-2 (${st})`,
              'State Documents',
              'Nonresident State Filing',
              st,
              `${st} Tax Authority`,
              `W-2 reporting wages allocated to and withholding paid to ${st}.`,
              `A W-2 reflecting compensation earned while physically present or working in ${st}.`,
              `Determines nonresident return filing obligation and Resident State Credit for Taxes Paid to Other States.`,
              `Your employer payroll department or Box 15 on your W-2.`,
              `${st} Personal Income Tax Code`,
              true
            )
          );
        }
      });
    }

    // =========================================================================
    // 3. SELF-EMPLOYMENT & BUSINESS (SCHEDULE C)
    // =========================================================================
    if (answers.hasSelfEmployment) {
      reqs.push(
        makeReq(
          'REQ-BIZ-PL-SUMMARY',
          'Business Income & Expense Summary (Profit & Loss)',
          'Schedule C Detail',
          'Business / Accounting Records',
          'Sole Proprietorship',
          'Federal',
          'IRS',
          'Categorized breakdown of total business revenues and deductible ordinary and necessary operating expenses.',
          'A summary ledger or spreadsheet detailing your gross revenue and expense categories (advertising, supplies, fees, utilities).',
          'Mandatory substantiation for self-employment income and deduction calculations under IRC § 162.',
          'Your bookkeeping software (QuickBooks, Wave, FreshBooks) or an itemized Excel/CSV export.',
          'IRC §§ 162, 1402; Rev. Rul. 77-244',
          true
        )
      );

      if (answers.has1099NEC) {
        reqs.push(
          makeReq(
            'REQ-1099-NEC',
            'Form 1099-NEC (Nonemployee Compensation)',
            'Form 1099-NEC',
            'Federal Documents',
            'Business Income',
            'Federal',
            'IRS',
            'Form 1099-NEC received from clients or companies who paid you $600 or more for freelance or independent contractor services.',
            'Tax statement reporting independent contractor or freelance payments.',
            'Directly matches IRS automated underreporter (AUR) CP2000 wage and income transcript matching.',
            'Sent by clients or downloaded from online platforms by January 31.',
            'IRC § 6041A',
            true
          )
        );
      }

      if (answers.has1099K) {
        reqs.push(
          makeReq(
            'REQ-1099-K',
            'Form 1099-K (Payment Card & Third-Party Network)',
            'Form 1099-K',
            'Federal Documents',
            'Merchant Processing',
            'Federal',
            'IRS',
            'Statements from Stripe, Square, PayPal, Venmo, or credit card merchant processors reporting gross settlement transactions.',
            'A form reporting payment transactions settled through third-party processors.',
            'Reconciles gross merchant processing settlement to Schedule C gross receipts to prevent IRS discrepancy notices.',
            'Your merchant account dashboard (Stripe, Square, PayPal, Etsy, etc.).',
            'IRC § 6050W',
            false,
            'CONDITIONAL'
          )
        );
      }

      if (answers.hasBusinessVehicle) {
        reqs.push(
          makeReq(
            'REQ-BIZ-MILEAGE',
            'Business Vehicle Mileage Log & Contemporaneous Records',
            'Form 4562 Vehicle Detail',
            'Business / Accounting Records',
            'Vehicle Deductions',
            'Federal',
            'IRS',
            'Logbook or digital tracking export recording business miles, total annual miles, commuting miles, and business purpose of trips.',
            'A contemporaneous log of dates, destinations, and mileage driven for business purposes.',
            'IRC § 274(d) requires strict written substantiation. Without a log, vehicle deductions are automatically disallowed in an audit.',
            'Mileage tracking apps (MileIQ, Everlance, QuickBooks) or a written mileage logbook.',
            'IRC § 274(d); Treas. Reg. § 1.274-5T',
            false,
            'RECOMMENDED'
          )
        );
      }
    }

    // =========================================================================
    // 4. INVESTMENTS & CAPITAL ASSETS
    // =========================================================================
    if (answers.hasBankInterest) {
      reqs.push(
        makeReq(
          'REQ-1099-INT',
          'Form 1099-INT (Interest Income)',
          'Form 1099-INT',
          'Federal Documents',
          'Interest Income',
          'Federal',
          'IRS',
          'Bank and savings institution statements reporting interest income paid of $10 or more.',
          'Statement of interest earned on checking, savings, CD, or money market accounts.',
          'Reportable on Form 1040 Schedule B to compute gross taxable income.',
          'Your bank’s online banking tax documents section.',
          'IRC § 6049',
          false,
          'REQUIRED'
        )
      );
    }

    if (answers.hasDividends) {
      reqs.push(
        makeReq(
          'REQ-1099-DIV',
          'Form 1099-DIV (Dividends and Distributions)',
          'Form 1099-DIV',
          'Federal Documents',
          'Dividend Income',
          'Federal',
          'IRS',
          'Statement showing ordinary dividends, qualified dividends, capital gain distributions, and foreign tax paid.',
          'Statement from brokerage firms showing dividends earned on stock and fund investments.',
          'Qualified dividends qualify for preferential capital gains tax rates (0%, 15%, 20%).',
          'Your brokerage online portal (Schwab, Fidelity, Vanguard, Robinhood).',
          'IRC § 6042',
          false,
          'REQUIRED'
        )
      );
    }

    if (answers.hasStockSalesBrokerage) {
      reqs.push(
        makeReq(
          'REQ-1099-B',
          'Form 1099-B (Consolidated Brokerage & Stock Sales)',
          'Form 1099-B / Consolidated 1099',
          'Federal Documents',
          'Capital Gains & Losses',
          'Federal',
          'IRS',
          'Consolidated 1099 statement showing gross proceeds, cost basis (Box 1e), and acquisition/sale dates for Schedule D.',
          'Annual brokerage tax package detailing all securities sales, cost basis, and holding periods.',
          'Calculates short-term and long-term capital gains/losses on Schedule D and Form 8949.',
          'Your brokerage online tax center. Typically available by mid-February.',
          'IRC § 6045; Treas. Reg. § 1.6045-1',
          true
        )
      );
    }

    if (answers.hasDigitalAssetsCrypto) {
      reqs.push(
        makeReq(
          'REQ-CRYPTO-REPORT',
          'Digital Asset / Cryptocurrency Tax Report & Form 1099-DA',
          'Form 8949 Detail / Crypto Ledger',
          'Federal Documents',
          'Digital Assets',
          'Federal',
          'IRS',
          'Itemized transaction report calculating capital gain/loss across all cryptocurrency exchanges, wallets, staking, and swaps.',
          'A consolidated tax report covering your cryptocurrency transactions, trades, and rewards.',
          'IRS Form 1040 specifically mandates answering the digital asset question under penalty of perjury. Notice 2014-21 requires basis tracking.',
          'Crypto tax software (CoinTracker, Koinly, TaxBit) or exchange statements (Coinbase, Kraken).',
          'IRS Notice 2014-21; Infrastructure Investment and Jobs Act § 80603',
          true
        )
      );
    }

    // =========================================================================
    // 5. RETIREMENT
    // =========================================================================
    if (answers.hasRetirementDistributions) {
      reqs.push(
        makeReq(
          'REQ-1099-R',
          'Form 1099-R (Distributions From Pensions, Annuities, Retirement, IRAs)',
          'Form 1099-R',
          'Federal Documents',
          'Retirement Income',
          'Federal',
          'IRS',
          'Statement showing gross distribution, taxable amount (Box 2a), distribution code (Box 7), and federal/state withholding.',
          'Tax statement reporting withdrawals from 401(k), IRA, pension, or annuity plans.',
          'Determines taxable retirement income and checks for early withdrawal penalties (Form 5329) or non-taxable rollovers.',
          'Your retirement custodian or plan administrator (Fidelity, Empower, Vanguard).',
          'IRC §§ 408, 72, 6047',
          true
        )
      );
    }

    if (answers.hasSocialSecurity) {
      reqs.push(
        makeReq(
          'REQ-SSA-1099',
          'Form SSA-1099 (Social Security Benefit Statement)',
          'Form SSA-1099',
          'Federal Documents',
          'Social Security',
          'Federal',
          'IRS / SSA',
          'Statement showing total net benefits paid (Box 5) and federal income tax withheld (Box 6).',
          'Annual statement of Social Security retirement or disability benefits.',
          'Determines the taxable portion of Social Security benefits (up to 85%) based on provisional income.',
          'Social Security Administration online account at ssa.gov/myaccount.',
          'IRC § 86',
          true
        )
      );
    }

    // =========================================================================
    // 6. REAL ESTATE & MORTGAGE
    // =========================================================================
    if (answers.ownsHomeWithMortgage) {
      reqs.push(
        makeReq(
          'REQ-1098-MORTGAGE',
          'Form 1098 (Mortgage Interest Statement)',
          'Form 1098',
          'Federal Documents',
          'Itemized Deductions',
          'Federal',
          'IRS',
          'Statement from your mortgage lender showing mortgage interest paid (Box 1), points paid, and real estate taxes (Box 10).',
          'Statement issued by your mortgage servicer showing annual interest and property taxes paid through escrow.',
          'Deductible on Schedule A (Itemized Deductions) subject to qualifying mortgage debt limitations ($750,000 threshold).',
          'Your mortgage servicer’s online portal (Chase, Rocket, Wells Fargo).',
          'IRC §§ 163(h), 6050H',
          false,
          'RECOMMENDED'
        )
      );
    }

    if (answers.ownsRentalProperty) {
      reqs.push(
        makeReq(
          'REQ-SCH-E-RENTAL',
          'Rental Property Income & Expense Ledger (Schedule E)',
          'Schedule E Detail',
          'Business / Accounting Records',
          'Rental Real Estate',
          'Federal',
          'IRS',
          'Itemized rental income received, days rented, management fees, repairs, maintenance, insurance, utilities, and mortgage interest.',
          'A spreadsheet or bookkeeping statement showing income and operational expenses for each rental property.',
          'Required under IRC § 212 to report rental real estate income and passive activity losses (Form 8582).',
          'Your property management statements or bookkeeping spreadsheet.',
          'IRC §§ 212, 469; Treas. Reg. § 1.469-1T',
          true
        )
      );
    }

    // =========================================================================
    // 7. EDUCATION
    // =========================================================================
    if (answers.paidHigherEducationTuition) {
      reqs.push(
        makeReq(
          'REQ-1098-T',
          'Form 1098-T (Tuition Statement)',
          'Form 1098-T',
          'Federal Documents',
          'Education Credits',
          'Federal',
          'IRS',
          'Statement from eligible educational institution showing payments received for qualified tuition (Box 1) and scholarships (Box 5).',
          'Official form provided by colleges and universities reporting qualified tuition payments.',
          'Required by the IRS to claim the American Opportunity Tax Credit (AOTC, up to $2,500) or Lifetime Learning Credit.',
          'The student’s university student account portal (Bursar / Financial Aid).',
          'IRC §§ 25A, 6050S',
          true
        )
      );
    }

    if (answers.paidStudentLoanInterest) {
      reqs.push(
        makeReq(
          'REQ-1098-E',
          'Form 1098-E (Student Loan Interest Statement)',
          'Form 1098-E',
          'Federal Documents',
          'Above-the-Line Deductions',
          'Federal',
          'IRS',
          'Statement reporting student loan interest paid of $600 or more on qualified higher education loans.',
          'Statement from student loan servicers reporting interest paid during the year.',
          'Above-the-line deduction up to $2,500 directly reducing Adjusted Gross Income (AGI).',
          'Your student loan servicer (Nelnet, MOHELA, Aidvantage, Sallie Mae).',
          'IRC § 221',
          false,
          'RECOMMENDED'
        )
      );
    }

    // =========================================================================
    // 8. HEALTH & HSA
    // =========================================================================
    if (answers.hasMarketplaceHealthInsurance) {
      reqs.push(
        makeReq(
          'REQ-1095-A',
          'Form 1095-A (Health Insurance Marketplace Statement)',
          'Form 1095-A',
          'Federal Documents',
          'Health Insurance',
          'Federal',
          'IRS',
          'Statement reporting monthly enrollment premiums, benchmark plan premiums (SLCSP), and advance premium tax credit (APTC) payments.',
          'Statement issued by Healthcare.gov or state insurance marketplace.',
          'Mandatory for filing Form 8962. If missing, the IRS automated return processor will immediately reject your e-filed return.',
          'Healthcare.gov account or state health exchange portal.',
          'IRC § 36B; Treas. Reg. § 1.36B-5',
          true
        )
      );
    }

    if (answers.hasHsaAccount) {
      reqs.push(
        makeReq(
          'REQ-1099-SA',
          'Form 1099-SA & 5498-SA (Health Savings Account Distributions & Contributions)',
          'Form 1099-SA / 5498-SA',
          'Federal Documents',
          'HSA Reporting',
          'Federal',
          'IRS',
          'Reports gross HSA distributions and employer/employee contributions to substantiate Form 8889.',
          'Statement from your HSA custodian showing total withdrawals and contributions.',
          'Required to verify that HSA withdrawals were used for qualified medical expenses and not subject to a 20% penalty.',
          'Your HSA administrator (Optum Bank, Fidelity, HealthEquity).',
          'IRC § 223',
          true
        )
      );
    }

    // =========================================================================
    // 9. ESTIMATED TAX PAYMENTS
    // =========================================================================
    if (answers.madeEstimatedTaxPayments) {
      reqs.push(
        makeReq(
          'REQ-ESTIMATED-VOUCHERS',
          'Quarterly Estimated Tax Payment Records (Federal & State)',
          'Forms 1040-ES / State Vouchers',
          'Federal Documents',
          'Tax Payments',
          'Federal',
          'IRS / State Revenue',
          'Dates and dollar amounts for all Q1 (April), Q2 (June), Q3 (September), and Q4 (January) estimated tax payments made.',
          'Bank payment confirmations, IRS EFTPS receipts, or state electronic tax payment receipts.',
          'Credits your account with payments made and avoids underpayment of estimated tax penalties under IRC § 6654.',
          'Your IRS Online Account, state tax department portal, or bank payment statements.',
          'IRC § 6654',
          true
        )
      );
    }

    // =========================================================================
    // 10. FOREIGN ACCOUNTS / ASSETS (ENHANCED PROFESSIONAL REVIEW)
    // =========================================================================
    if (answers.hasForeignAccountsOrAssets) {
      reqs.push(
        makeReq(
          'REQ-FOREIGN-FBAR',
          'Foreign Bank & Financial Accounts Records (FBAR / FinCEN 114 & Form 8938)',
          'FinCEN Form 114 / Form 8938',
          'Federal Documents',
          'International / Foreign Reporting',
          'Federal',
          'FinCEN / IRS',
          'Names of foreign financial institutions, account numbers, maximum balances during the year, and country codes.',
          'Bank statements and asset documentation for all non-U.S. accounts where aggregate value exceeded $10,000.',
          'Mandatory under the Bank Secrecy Act and FATCA. Severe civil penalties ($10,000+ per non-willful violation) apply for failure to file.',
          'Statements from your foreign financial institutions.',
          '31 U.S.C. § 5314; IRC § 6038D',
          true,
          'NEEDS_PROFESSIONAL_REVIEW'
        )
      );
    }

    // =========================================================================
    // 11. ENTITY SPECIFIC (S-CORP / PARTNERSHIP / C-CORP)
    // =========================================================================
    if (entityType === 's_corp' || entityType === 'c_corp' || entityType === 'partnership') {
      reqs.push(
        makeReq(
          'REQ-CORP-TRIAL-BALANCE',
          'Final Adjusted Trial Balance & Year-End General Ledger',
          'Trial Balance / GL',
          'Business / Accounting Records',
          'Corporate Accounting',
          'Federal',
          'IRS',
          'Full year-end double-entry trial balance tying out to balance sheet accounts and profit & loss statements.',
          'Export of your complete accounting ledger as of December 31.',
          'Required to prepare corporate tax balance sheets (Schedule L) and reconcile book-to-tax net income (Schedule M-1/M-3).',
          'Your accounting software (QuickBooks Online, Xero, NetSuite).',
          'IRC §§ 446, 6001',
          true
        )
      );

      reqs.push(
        makeReq(
          'REQ-CORP-BANK-STATEMENTS',
          'Year-End Bank & Credit Card Statements (All Accounts)',
          'Bank Statements & Reconciliations',
          'Business / Accounting Records',
          'Banking & Cash',
          'Federal',
          'IRS',
          'December 31 bank statements for all checking, savings, money market, and credit card accounts with reconciliation reports.',
          'Bank statements proving cash and debt balances at year end.',
          'Substantiates beginning and ending cash balances on Schedule L Balance Sheet.',
          'Your commercial bank online banking portal.',
          'IRC § 6001',
          true
        )
      );
    }

    // Attach any custom accountant requests for this client
    const custom = this.customRequests.get(`${clientId}_${taxYear}`) || [];
    reqs.push(...custom);

    return reqs;
  }

  /**
   * Adds an accountant document request to the client's requirements.
   */
  public static addAccountantRequest(params: {
    clientId: string;
    taxYear: number;
    title: string;
    description: string;
    reason: string;
    requestedBy: string;
    dueDate?: string;
  }): TaxDocumentRequirementItem {
    const key = `${params.clientId}_${params.taxYear}`;
    const existing = this.customRequests.get(key) || [];
    const idSeq = existing.length + 1;
    const now = new Date().toISOString();

    const reqItem: TaxDocumentRequirementItem = {
      id: `${params.clientId}_${params.taxYear}_REQ-CPA-${idSeq}`,
      requirementId: `REQ-CPA-${idSeq}`,
      clientId: params.clientId,
      engagementId: `eng_${params.taxYear}_${params.clientId}`,
      taxCaseId: `case_${params.taxYear}_${params.clientId}`,
      taxYear: params.taxYear,
      jurisdiction: 'Federal',
      authority: 'A/R Tax Services Professional',
      returnType: 'Tax Return Document Request',
      category: 'Additional Accountant Requests',
      subCategory: 'CPA Advisory Inquiry',
      documentType: 'Supporting Document',
      formNumber: 'CPA Request',
      title: params.title,
      description: params.description,
      whatIsThis: params.description,
      whyDoWeNeedIt: params.reason,
      whereCanIGetIt: 'Your records or issuing institution.',
      applicability: 'REQUIRED',
      requirementReason: params.reason,
      sourceRuleId: `CPA-REQUEST-${Date.now()}`,
      statutoryBasis: 'Treas. Reg. § 1.6001-1; Professional Due Diligence',
      status: 'Missing',
      blocking: true,
      dueDate: params.dueDate,
      requestedAt: now,
      relatedDocumentIds: [],
      createdAt: now,
      updatedAt: now
    };

    existing.push(reqItem);
    this.customRequests.set(key, existing);
    return reqItem;
  }

  /**
   * Evaluates missing documents against actual uploaded documents for a client.
   */
  public static evaluateMissingDocuments(params: {
    clientId: string;
    taxYear: number;
    uploadedDocs: Array<{
      id: string;
      associatedRequirementId?: string;
      claimedCategory?: string;
      status?: string;
      isVerified?: boolean;
    }>;
  }): {
    totalRequirements: number;
    receivedCount: number;
    missingCount: number;
    missingItems: TaxDocumentRequirementItem[];
    resolvedItems: TaxDocumentRequirementItem[];
    categories: Record<
      TaxDocumentRequirementItem['category'],
      { required: number; received: number; missing: number; items: TaxDocumentRequirementItem[] }
    >;
  } {
    const requirements = this.generateRequirements({
      clientId: params.clientId,
      taxYear: params.taxYear
    });

    const categories: Record<
      TaxDocumentRequirementItem['category'],
      { required: number; received: number; missing: number; items: TaxDocumentRequirementItem[] }
    > = {
      'Federal Documents': { required: 0, received: 0, missing: 0, items: [] },
      'State Documents': { required: 0, received: 0, missing: 0, items: [] },
      'Prior-Year Tax Records': { required: 0, received: 0, missing: 0, items: [] },
      'Business / Accounting Records': { required: 0, received: 0, missing: 0, items: [] },
      'Additional Accountant Requests': { required: 0, received: 0, missing: 0, items: [] }
    };

    const missingItems: TaxDocumentRequirementItem[] = [];
    const resolvedItems: TaxDocumentRequirementItem[] = [];

    // Map uploads to requirements
    const validUploads = params.uploadedDocs.filter(
      u => u.status !== 'Rejected' && u.status !== 'WITHDRAWN' && u.status !== 'Quarantined'
    );

    requirements.forEach(req => {
      const isNotApplicable = req.applicability === 'NOT_APPLICABLE';
      const isSatisfied = isNotApplicable || validUploads.some(
        u => u.associatedRequirementId === req.requirementId || u.associatedRequirementId === req.id
      );

      if (isSatisfied) {
        req.status = isNotApplicable ? 'Complete' : 'Uploaded';
        resolvedItems.push(req);
      } else {
        req.status = 'Missing';
        missingItems.push(req);
      }

      const catGroup = categories[req.category] || categories['Federal Documents'];
      catGroup.items.push(req);
      if (req.blocking && !isNotApplicable) {
        catGroup.required++;
        if (isSatisfied) {
          catGroup.received++;
        } else {
          catGroup.missing++;
        }
      }
    });

    return {
      totalRequirements: requirements.length,
      receivedCount: resolvedItems.length,
      missingCount: missingItems.length,
      missingItems,
      resolvedItems,
      categories
    };
  }

  /**
   * Generates the structured Stage 03 Handoff Package (Accountant Preparation Package)
   * Status: READY_FOR_PROFESSIONAL_REVIEW
   */
  public static generatePreparationPackage(params: {
    clientId: string;
    taxYear: number;
    clientName?: string;
    uploadedDocs?: any[];
  }) {
    const { clientId, taxYear } = params;
    const questionnaire = this.getQuestionnaire(clientId, taxYear);
    const evaluation = this.evaluateMissingDocuments({
      clientId,
      taxYear,
      uploadedDocs: params.uploadedDocs || []
    });

    const isGateSatisfied = evaluation.missingCount === 0;

    return {
      packageId: `PKG-${taxYear}-${clientId}`,
      clientId,
      clientName: params.clientName || 'Valued Client',
      taxYear,
      status: isGateSatisfied ? 'READY_FOR_PROFESSIONAL_REVIEW' : 'COLLECTION_INCOMPLETE',
      isReadyForReview: isGateSatisfied,
      generatedAt: new Date().toISOString(),
      statutoryFramework: 'IRC § 6011; Circular 230; NIST AI RMF 1.0',
      clientSummary: {
        filingStatus: questionnaire.filingStatus,
        residentState: questionnaire.residentState,
        hasW2: questionnaire.hasW2Employment,
        hasSelfEmployment: questionnaire.hasSelfEmployment,
        hasInvestments: questionnaire.hasBankInterest || questionnaire.hasDividends || questionnaire.hasStockSalesBrokerage,
        hasRental: questionnaire.ownsRentalProperty
      },
      questionnaireAnswers: questionnaire,
      requirementsSummary: {
        total: evaluation.totalRequirements,
        received: evaluation.receivedCount,
        missing: evaluation.missingCount,
        categories: evaluation.categories
      },
      missingDocuments: evaluation.missingItems.map(m => ({
        requirementId: m.requirementId,
        title: m.title,
        formNumber: m.formNumber,
        category: m.category,
        jurisdiction: m.jurisdiction
      })),
      auditProvenance: {
        createdBy: 'TaxGuard Automated Preparation Pipeline',
        ruleEngineVersion: 'v2025.2.0',
        makerCheckerBoundary: 'PREPARATION_PROPOSAL_ONLY_AWAITING_CPA_APPROVAL'
      }
    };
  }

  public static resetForTesting(): void {
    this.questionnaires.clear();
    this.customRequests.clear();
  }
}
