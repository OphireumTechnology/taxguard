export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse';

export type TaxRequirementCategory =
  | 'Federal Documents'
  | 'State Documents'
  | 'Prior-Year Tax Records'
  | 'Business / Accounting Records'
  | 'Additional Accountant Requests';

export interface TaxDocumentRequirementItem {
  id: string;
  requirementId: string;
  title: string;
  formNumber: string;
  category: TaxRequirementCategory;
  status:
    | 'Missing'
    | 'Uploaded'
    | 'Under Review'
    | 'Processing'
    | 'Accepted'
    | 'Replace Required'
    | 'Needs Your Attention'
    | 'Complete'
    | string;
  applicability?: 'APPLICABLE' | 'NOT_APPLICABLE' | string;
  description: string;
  requirementReason?: string;
  jurisdiction: string;
  authority: string;
  whatIsThis: string;
  whyDoWeNeedIt: string;
  whereCanIGetIt: string;
  statutoryBasis: string;
  priority: 'Required' | 'Recommended' | 'Optional';
  requestedAt?: string;
}

export interface TaxDiscoveryQuestionnaireAnswers {
  filingStatus: FilingStatus;
  residentState: string;
  hasDependents: boolean;
  hasPriorYearTaxReturn: boolean;
  hasW2Employment: boolean;
  workedInMultipleStates: boolean;
  hasSelfEmployment: boolean;
  has1099NEC: boolean;
  has1099K: boolean;
  hasBusinessVehicle: boolean;
  hasBankInterest: boolean;
  hasDividends: boolean;
  hasStockSalesBrokerage: boolean;
  hasDigitalAssetsCrypto: boolean;
  ownsHomeWithMortgage: boolean;
  ownsRentalProperty: boolean;
  hasMarketplaceHealthInsurance: boolean;
  hasHsaAccount: boolean;
  paidHigherEducationTuition: boolean;
}

const DEFAULT_QUESTIONNAIRE: TaxDiscoveryQuestionnaireAnswers = {
  filingStatus: 'single',
  residentState: 'SC',
  hasDependents: false,
  hasPriorYearTaxReturn: true,
  hasW2Employment: true,
  workedInMultipleStates: false,
  hasSelfEmployment: false,
  has1099NEC: false,
  has1099K: false,
  hasBusinessVehicle: false,
  hasBankInterest: false,
  hasDividends: false,
  hasStockSalesBrokerage: false,
  hasDigitalAssetsCrypto: false,
  ownsHomeWithMortgage: false,
  ownsRentalProperty: false,
  hasMarketplaceHealthInsurance: false,
  hasHsaAccount: false,
  paidHigherEducationTuition: false,
};

const questionnaireStore = new Map<string, TaxDiscoveryQuestionnaireAnswers>();

function makeKey(clientId: string, taxYear: number): string {
  return `${clientId || 'default'}_${taxYear}`;
}

function buildRequirements(
  answers: TaxDiscoveryQuestionnaireAnswers,
  taxYear: number,
  uploadedDocs: Array<{
    id?: string;
    documentId?: string;
    associatedRequirementId?: string;
    claimedCategory?: string;
    status?: string;
    processingStatus?: string;
    isVerified?: boolean;
  }>
): TaxDocumentRequirementItem[] {
  const items: TaxDocumentRequirementItem[] = [];
  const resolveStatus = (reqId: string, categoryHints: string[]): TaxDocumentRequirementItem['status'] => {
    const match = uploadedDocs.find(
      d =>
        d.associatedRequirementId === reqId ||
        (d.claimedCategory && categoryHints.some(h => d.claimedCategory!.toLowerCase().includes(h)))
    );
    if (!match) return 'Missing';
    if (match.isVerified || match.status === 'Accepted' || match.processingStatus === 'VERIFIED') return 'Uploaded';
    return 'Uploaded';
  };

  if (answers.hasW2Employment) {
    items.push({
      id: 'req_w2',
      requirementId: 'REQ-FED-W2',
      title: 'Wage and Tax Statement (All Employers)',
      formNumber: 'Form W-2',
      category: 'Federal Documents',
      status: resolveStatus('REQ-FED-W2', ['w-2', 'w2', 'wage']),
      applicability: 'APPLICABLE',
      description: `Annual wages and federal/state withholdings for ${taxYear}.`,
      jurisdiction: 'Federal',
      authority: 'IRS',
      whatIsThis: 'Official statement issued by your employer showing gross taxable wages and taxes withheld.',
      whyDoWeNeedIt: 'Required under IRC § 6051 to report Box 1 wages and substantiate federal/state withholding credits.',
      whereCanIGetIt: 'Your employer HR/payroll portal (ADP, Gusto, Workday) or mailed paper copy by Jan 31.',
      statutoryBasis: 'IRC § 6051',
      priority: 'Required',
    });
  }

  if (answers.hasSelfEmployment || answers.has1099NEC) {
    items.push({
      id: 'req_1099nec',
      requirementId: 'REQ-FED-1099NEC',
      title: 'Nonemployee Compensation Statements',
      formNumber: 'Form 1099-NEC',
      category: 'Business / Accounting Records',
      status: resolveStatus('REQ-FED-1099NEC', ['1099-nec', '1099', 'business']),
      applicability: 'APPLICABLE',
      description: 'Independent contractor and consulting income statements ($600+).',
      jurisdiction: 'Federal',
      authority: 'IRS',
      whatIsThis: 'Report of independent contractor payments made to you during the tax year.',
      whyDoWeNeedIt: 'Reconciles Schedule C gross receipts against IRS Information Return transcripts.',
      whereCanIGetIt: 'Clients or payers who paid you $600 or more during the year.',
      statutoryBasis: 'IRC § 6041A',
      priority: 'Required',
    });
  }

  if (answers.hasBankInterest) {
    items.push({
      id: 'req_1099int',
      requirementId: 'REQ-FED-1099INT',
      title: 'Interest Income Statements',
      formNumber: 'Form 1099-INT',
      category: 'Federal Documents',
      status: resolveStatus('REQ-FED-1099INT', ['1099-int', 'interest']),
      applicability: 'APPLICABLE',
      description: 'Taxable and tax-exempt interest paid by financial institutions.',
      jurisdiction: 'Federal',
      authority: 'IRS',
      whatIsThis: 'Annual summary of interest earned from savings, CDs, and Treasury accounts.',
      whyDoWeNeedIt: 'Must match Schedule B and IRS payer matching records.',
      whereCanIGetIt: 'Your bank or credit union tax documents center.',
      statutoryBasis: 'IRC § 6049',
      priority: 'Required',
    });
  }

  if (answers.hasPriorYearTaxReturn) {
    items.push({
      id: 'req_prior_return',
      requirementId: 'REQ-PRIOR-1040',
      title: `Prior-Year Tax Return (${taxYear - 1})`,
      formNumber: 'Form 1040',
      category: 'Prior-Year Tax Records',
      status: resolveStatus('REQ-PRIOR-1040', ['prior', '1040', 'return']),
      applicability: 'APPLICABLE',
      description: `Complete signed federal and state returns for tax year ${taxYear - 1}.`,
      jurisdiction: 'Federal',
      authority: 'IRS',
      whatIsThis: `Your filed ${taxYear - 1} federal and state income tax returns.`,
      whyDoWeNeedIt: 'Establishes carryforwards (capital losses, charitable deductions, passive losses) and prior-year AGI.',
      whereCanIGetIt: 'Your previous tax preparer or IRS Get Transcript portal.',
      statutoryBasis: 'IRC § 6001',
      priority: 'Required',
    });
  }

  items.push({
    id: 'req_state_res',
    requirementId: `REQ-ST-${answers.residentState || 'SC'}`,
    title: `${answers.residentState || 'SC'} State Residency & Withholding Verification`,
    formNumber: `${answers.residentState || 'SC'}-1040`,
    category: 'State Documents',
    status: resolveStatus(`REQ-ST-${answers.residentState || 'SC'}`, ['state', 'residency', 'sc']),
    applicability: 'APPLICABLE',
    description: `State residency, local tax, and state withholding records for ${answers.residentState || 'SC'}.`,
    jurisdiction: answers.residentState || 'SC',
    authority: 'State DOR',
    whatIsThis: 'State-level withholding statements and residency verification.',
    whyDoWeNeedIt: 'Ensures accurate state tax credit calculations and nexus compliance.',
    whereCanIGetIt: 'State Department of Revenue portal or employer payroll summary.',
    statutoryBasis: 'State Revenue Code',
    priority: 'Required',
  });

  return items;
}

export class TaxDocumentRequirementEngine {
  static getQuestionnaire(clientId: string, taxYear: number): TaxDiscoveryQuestionnaireAnswers {
    return questionnaireStore.get(makeKey(clientId, taxYear)) ?? { ...DEFAULT_QUESTIONNAIRE };
  }

  static saveQuestionnaire(
    clientId: string,
    taxYear: number,
    answers: TaxDiscoveryQuestionnaireAnswers
  ): TaxDiscoveryQuestionnaireAnswers {
    const saved = { ...answers };
    questionnaireStore.set(makeKey(clientId, taxYear), saved);
    return saved;
  }

  static evaluateMissingDocuments(params: {
    clientId: string;
    taxYear: number;
    uploadedDocs?: Array<{
      id?: string;
      documentId?: string;
      associatedRequirementId?: string;
      claimedCategory?: string;
      status?: string;
      processingStatus?: string;
      isVerified?: boolean;
    }>;
  }) {
    const answers = this.getQuestionnaire(params.clientId, params.taxYear);
    const items = buildRequirements(answers, params.taxYear, params.uploadedDocs ?? []);
    const categories: Record<
      TaxRequirementCategory,
      { items: TaxDocumentRequirementItem[]; required: number; received: number; missing: number }
    > = {
      'Federal Documents': { items: [], required: 0, received: 0, missing: 0 },
      'State Documents': { items: [], required: 0, received: 0, missing: 0 },
      'Prior-Year Tax Records': { items: [], required: 0, received: 0, missing: 0 },
      'Business / Accounting Records': { items: [], required: 0, received: 0, missing: 0 },
      'Additional Accountant Requests': { items: [], required: 0, received: 0, missing: 0 },
    };

    for (const item of items) {
      const bucket = categories[item.category];
      bucket.items.push(item);
      bucket.required += 1;
      if (item.status === 'Uploaded' || item.status === 'Accepted') {
        bucket.received += 1;
      } else {
        bucket.missing += 1;
      }
    }

    const receivedCount = items.filter(i => i.status === 'Uploaded' || i.status === 'Accepted').length;
    return {
      totalRequirements: items.length,
      receivedCount,
      missingCount: items.length - receivedCount,
      categories,
      items,
    };
  }

  static generatePreparationPackage(params: {
    clientId: string;
    taxYear: number;
    clientName?: string;
    uploadedDocs?: any[];
  }) {
    const answers = this.getQuestionnaire(params.clientId, params.taxYear);
    const evalResult = this.evaluateMissingDocuments({
      clientId: params.clientId,
      taxYear: params.taxYear,
      uploadedDocs: params.uploadedDocs,
    });
    const missingDocuments = evalResult.items.filter(i => i.status === 'Missing');
    return {
      packageId: `PKG-${params.taxYear}-${(params.clientId || 'CLIENT').slice(0, 8).toUpperCase()}`,
      status: missingDocuments.length === 0 ? 'READY FOR PREPARER REVIEW' : 'PENDING CLIENT EVIDENCE',
      generatedAt: new Date().toISOString(),
      statutoryFramework: 'IRC § 6694 / Circular 230 § 10.34',
      clientSummary: {
        filingStatus: answers.filingStatus,
        residentState: answers.residentState,
      },
      requirementsSummary: {
        total: evalResult.totalRequirements,
        received: evalResult.receivedCount,
        missing: evalResult.missingCount,
      },
      missingDocuments,
      auditProvenance: {
        ruleEngineVersion: '2025.2-DETERMINISTIC',
        makerCheckerBoundary: 'ENFORCED (Preparer / Independent Reviewer Separated)',
      },
    };
  }
}
