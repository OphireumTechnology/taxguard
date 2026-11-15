export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse'
  | string;

export interface TaxDiscoveryQuestionnaireAnswers {
  filingStatus?: FilingStatus;
  residentState?: string;
  hasW2Employment?: boolean;
  hasSelfEmployment?: boolean;
  hasInterestOrDividends?: boolean;
  hasBrokerageOrCrypto?: boolean;
  hasRetirementDistributions?: boolean;
  hasRealEstateOrMortgage?: boolean;
  hasEducationExpenses?: boolean;
  hasHsaOrMedical?: boolean;
  hasCharitableContributions?: boolean;
  hasEstimatedPayments?: boolean;
  hasForeignAccounts?: boolean;
  states?: string[];
  [key: string]: any;
}

export type TaxRequirementCategory =
  | 'Federal Documents'
  | 'State Documents'
  | 'Prior-Year Tax Records'
  | 'Business / Accounting Records'
  | 'Additional Accountant Requests'
  | string;

export interface TaxDocumentRequirementItem {
  id: string;
  title: string;
  category: TaxRequirementCategory;
  formNumber: string;
  taxYear: number;
  required: boolean;
  status: 'Uploaded' | 'Missing' | 'missing' | 'requested' | 'received' | 'verified' | 'not_applicable' | string;
  description: string;
  jurisdiction: string;
  authority?: string;
  whatIsThis?: string;
  whyDoWeNeedIt?: string;
  statutoryBasis?: string;
  whereCanIGetIt?: string;
  [key: string]: any;
}

export interface PreparationPackageSummary {
  status: string;
  packageId: string;
  generatedAt: string;
  statutoryFramework: string;
  auditProvenance: {
    ruleEngineVersion: string;
    makerCheckerBoundary: string;
  };
  clientSummary: {
    clientName: string;
    filingStatus: string;
    residentState: string;
  };
  requirementsSummary: {
    received: number;
    total: number;
  };
  missingDocuments: TaxDocumentRequirementItem[];
  items: TaxDocumentRequirementItem[];
  missingCount: number;
}

export interface MissingDocumentsEvaluation {
  receivedCount: number;
  totalRequirements: number;
  missingCount: number;
  categories: Record<
    string,
    {
      items: TaxDocumentRequirementItem[];
      received: number;
      required: number;
      missing: number;
    }
  >;
}

const questionnaireStore = new Map<string, TaxDiscoveryQuestionnaireAnswers>();

function buildRequirements(
  clientId: string,
  taxYear: number,
  uploadedDocs: Array<{
    id?: string;
    documentId?: string;
    associatedRequirementId?: string;
    claimedCategory?: string;
    status?: string;
    isVerified?: boolean;
  }> = [],
): TaxDocumentRequirementItem[] {
  const hasMatch = (reqId: string, keywords: string[]) =>
    uploadedDocs.some(
      d =>
        d.associatedRequirementId === reqId ||
        keywords.some(k => (d.claimedCategory || '').toLowerCase().includes(k)),
    );

  const reqW2Id = `req_${clientId}_${taxYear}_w2`;
  const reqPriorId = `req_${clientId}_${taxYear}_prior`;
  const reqStateId = `req_${clientId}_${taxYear}_sc`;

  return [
    {
      id: reqW2Id,
      title: 'Form W-2 Wage & Tax Statement',
      category: 'Federal Documents',
      formNumber: 'W-2',
      taxYear,
      required: true,
      status: hasMatch(reqW2Id, ['w-2', 'w2', 'wage']) ? 'Uploaded' : 'Missing',
      jurisdiction: 'Federal (IRS)',
      authority: 'IRC § 6051',
      description: 'All employer wage and tax withholding statements for the tax year.',
      whatIsThis: 'Official annual employer statement reporting gross wages and federal/state tax withholdings.',
      whyDoWeNeedIt: 'Required by the IRS to reconcile reported taxable compensation and payroll withholdings.',
      statutoryBasis: 'IRC § 6051 / Form 1040 Line 1a',
      whereCanIGetIt: 'Your employer payroll portal (ADP, Gusto, Workday) or mailed January tax packet.',
    },
    {
      id: reqStateId,
      title: 'South Carolina Withholding / Residency Verification',
      category: 'State Documents',
      formNumber: 'SC1040',
      taxYear,
      required: true,
      status: hasMatch(reqStateId, ['state', 'sc1040']) ? 'Uploaded' : 'Missing',
      jurisdiction: 'South Carolina',
      authority: 'SC Code § 12-6',
      description: 'State income and residency support for South Carolina filing.',
      whatIsThis: 'State-level tax withholding and residency documentation.',
      whyDoWeNeedIt: 'Supports state credits, withholdings, and residency allocation.',
      statutoryBasis: 'SC Code Title 12 Chapter 6',
      whereCanIGetIt: 'Employer W-2 Box 15-17 or SC MyDORWAY account.',
    },
    {
      id: reqPriorId,
      title: 'Prior Year Federal & State Tax Return',
      category: 'Prior-Year Tax Records',
      formNumber: '1040',
      taxYear,
      required: true,
      status: hasMatch(reqPriorId, ['prior', '1040']) ? 'Uploaded' : 'Missing',
      jurisdiction: 'Federal & State',
      authority: 'Circular 230 § 10.22',
      description: 'Complete copy of prior year filed return for carryforward and continuity verification.',
      whatIsThis: 'Signed PDF copy of your prior tax year federal and state returns.',
      whyDoWeNeedIt: 'Ensures accurate capital loss, charitable, and AMT carryforwards.',
      statutoryBasis: 'IRS Circular 230 Due Diligence',
      whereCanIGetIt: 'Your prior CPA portal or IRS Get Transcript online.',
    },
  ];
}

export class TaxDocumentRequirementEngine {
  static getQuestionnaire(clientId: string, taxYear: number): TaxDiscoveryQuestionnaireAnswers {
    const key = `${clientId}:${taxYear}`;
    return (
      questionnaireStore.get(key) ?? {
        filingStatus: 'single',
        residentState: 'SC',
        hasW2Employment: true,
        hasSelfEmployment: false,
        hasInterestOrDividends: false,
        hasBrokerageOrCrypto: false,
        hasRetirementDistributions: false,
        hasRealEstateOrMortgage: false,
        hasEducationExpenses: false,
        hasHsaOrMedical: false,
        hasCharitableContributions: false,
        hasEstimatedPayments: false,
        hasForeignAccounts: false,
        states: ['SC'],
      }
    );
  }

  static saveQuestionnaire(
    clientId: string,
    taxYear: number,
    answers: TaxDiscoveryQuestionnaireAnswers,
  ): TaxDiscoveryQuestionnaireAnswers {
    const key = `${clientId}:${taxYear}`;
    const saved = { ...answers };
    questionnaireStore.set(key, saved);
    return saved;
  }

  static generatePreparationPackage(input: {
    clientId: string;
    taxYear: number;
    clientName?: string;
    uploadedDocs?: any[];
  }): PreparationPackageSummary {
    const questionnaire = this.getQuestionnaire(input.clientId, input.taxYear);
    const items = buildRequirements(input.clientId, input.taxYear, input.uploadedDocs ?? []);
    const missingDocuments = items.filter(i => i.required && i.status !== 'Uploaded');
    const received = items.length - missingDocuments.length;
    return {
      status: missingDocuments.length === 0 ? 'PENDING_PROFESSIONAL_REVIEW' : 'AWAITING_SOURCE_DOCUMENTS',
      packageId: `pkg_${input.clientId}_${input.taxYear}`,
      generatedAt: new Date().toISOString(),
      statutoryFramework: 'Circular 230 / IRC § 6694',
      auditProvenance: {
        ruleEngineVersion: '2026.1',
        makerCheckerBoundary: 'ENFORCED_HUMAN_REVIEW',
      },
      clientSummary: {
        clientName: input.clientName || 'Client Taxpayer',
        filingStatus: String(questionnaire.filingStatus || 'Single'),
        residentState: String(questionnaire.residentState || questionnaire.states?.[0] || 'SC'),
      },
      requirementsSummary: {
        received,
        total: items.length,
      },
      missingDocuments,
      items,
      missingCount: missingDocuments.length,
    };
  }

  static evaluateMissingDocuments(input: {
    clientId: string;
    taxYear: number;
    uploadedDocs?: Array<{
      id?: string;
      associatedRequirementId?: string;
      claimedCategory?: string;
      status?: string;
      isVerified?: boolean;
    }>;
  }): MissingDocumentsEvaluation {
    const items = buildRequirements(input.clientId, input.taxYear, input.uploadedDocs ?? []);
    const categories: MissingDocumentsEvaluation['categories'] = {};
    for (const item of items) {
      if (!categories[item.category]) {
        categories[item.category] = { items: [], received: 0, required: 0, missing: 0 };
      }
      const bucket = categories[item.category];
      bucket.items.push(item);
      if (item.required) bucket.required += 1;
      if (item.status === 'Uploaded') {
        bucket.received += 1;
      } else if (item.required) {
        bucket.missing += 1;
      }
    }
    const receivedCount = items.filter(i => i.status === 'Uploaded').length;
    const missingCount = items.filter(i => i.required && i.status !== 'Uploaded').length;
    return {
      receivedCount,
      totalRequirements: items.length,
      missingCount,
      categories,
    };
  }
}
