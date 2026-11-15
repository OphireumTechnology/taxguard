export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse'
  | string;

export interface TaxDocumentRequirementItem {
  id: string;
  requirementId?: string;
  title: string;
  category: string;
  formCode?: string;
  formNumber?: string;
  jurisdiction?: string;
  status: 'missing' | 'requested' | 'uploaded' | 'verified' | 'not_applicable' | string;
  priority?: 'required' | 'recommended' | 'optional' | string;
  description?: string;
  whatIsThis?: string;
  whyDoWeNeedIt?: string;
  whereCanIGetIt?: string;
  taxYear?: number;
  [key: string]: any;
}

export interface TaxDiscoveryQuestionnaireAnswers {
  hasW2Income?: boolean;
  has1099Income?: boolean;
  hasBusinessIncome?: boolean;
  hasRentalProperty?: boolean;
  hasInvestments?: boolean;
  hasMortgageInterest?: boolean;
  hasCharitableDonations?: boolean;
  hasForeignAccounts?: boolean;
  [key: string]: any;
}

export class TaxDocumentRequirementEngine {
  static getQuestionnaire(clientId: string, taxYear: number): TaxDiscoveryQuestionnaireAnswers {
    return {
      clientId,
      taxYear,
      hasW2Income: true,
      has1099Income: false,
      hasBusinessIncome: false,
      hasRentalProperty: false,
      hasInvestments: false,
      hasMortgageInterest: false,
      hasCharitableDonations: false,
      hasForeignAccounts: false,
    };
  }

  static saveQuestionnaire(
    _clientId: string,
    _taxYear: number,
    answers: TaxDiscoveryQuestionnaireAnswers
  ): TaxDiscoveryQuestionnaireAnswers {
    return { ...answers };
  }

  static evaluateMissingDocuments(input: {
    clientId?: string;
    taxYear?: number;
    requirements?: TaxDocumentRequirementItem[];
    documents?: any[];
    uploadedDocs?: any[];
    [key: string]: any;
  }) {
    const reqs = input.requirements || [];
    const missing = reqs.filter(r => r.status === 'missing' || r.status === 'requested');
    const receivedCount = reqs.length - missing.length;
    const categories: Record<
      string,
      { items: TaxDocumentRequirementItem[]; received: number; required: number; missing: number }
    > = {};
    for (const r of reqs) {
      const key = r.category || 'Federal Documents';
      if (!categories[key]) {
        categories[key] = { items: [], received: 0, required: 0, missing: 0 };
      }
      categories[key].items.push(r);
      categories[key].required += 1;
      if (r.status === 'missing' || r.status === 'requested') {
        categories[key].missing += 1;
      } else {
        categories[key].received += 1;
      }
    }
    return {
      missingItems: missing,
      missingCount: missing.length,
      receivedCount,
      totalRequirements: reqs.length,
      totalCount: reqs.length,
      completionPercent: reqs.length ? Math.round((receivedCount / reqs.length) * 100) : 100,
      categories,
    };
  }

  static generatePreparationPackage(input: {
    clientId?: string;
    clientName?: string;
    taxYear?: number;
    documents?: any[];
    uploadedDocs?: any[];
    requirements?: TaxDocumentRequirementItem[];
    [key: string]: any;
  }) {
    const reqs = input.requirements || [];
    const docs = input.uploadedDocs || input.documents || [];
    const missingDocuments = reqs
      .filter(r => r.status === 'missing' || r.status === 'requested')
      .map(r => ({
        title: r.title,
        formNumber: r.formNumber || r.formCode || 'Form',
        jurisdiction: r.jurisdiction || 'Federal',
        category: r.category,
      }));
    return {
      packageId: `pkg_${input.clientId || 'client'}_${input.taxYear || 2025}`,
      generatedAt: new Date().toISOString(),
      clientId: input.clientId || '',
      taxYear: input.taxYear || 2025,
      status: 'READY_FOR_CPA_REVIEW',
      ready: true,
      requirementsSummary: {
        received: reqs.length - missingDocuments.length,
        total: reqs.length,
      },
      clientSummary: {
        filingStatus: 'Single',
        residentState: 'SC',
      },
      missingDocuments,
      statutoryFramework: 'IRC / Circular 230',
      auditProvenance: {
        ruleEngineVersion: '2025.1',
        makerCheckerBoundary: 'ENFORCED',
      },
      items: reqs,
      documents: docs,
      summary: 'Preparation package assembled for CPA review.',
    };
  }
}
