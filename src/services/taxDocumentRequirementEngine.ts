export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse'
  | string;

export interface TaxDiscoveryQuestionnaireAnswers {
  filingStatus?: FilingStatus;
  hasW2Income?: boolean;
  hasSelfEmployment?: boolean;
  hasInvestmentIncome?: boolean;
  hasRentalProperty?: boolean;
  hasMortgageInterest?: boolean;
  hasCharitableContributions?: boolean;
  hasRetirementDistributions?: boolean;
  hasPassThroughK1?: boolean;
  hasForeignAccounts?: boolean;
  hasHealthSavingsAccount?: boolean;
  hasEducationExpenses?: boolean;
  hasDependents?: boolean;
  hasBusinessEntity?: boolean;
  entityType?: string;
  stateOfResidence?: string;
  additionalStates?: string[];
  [key: string]: any;
}

export interface TaxDocumentRequirementItem {
  id: string;
  title: string;
  name?: string;
  formCode?: string;
  category: string;
  description?: string;
  required: boolean;
  mandatory?: boolean;
  status: 'missing' | 'requested' | 'uploaded' | 'verified' | 'accepted' | 'not_applicable' | string;
  taxYear?: number;
  priority?: 'high' | 'medium' | 'low' | string;
  reason?: string;
  documentId?: string;
  [key: string]: any;
}

const QUESTIONNAIRE_PREFIX = 'taxguard_questionnaire_';

export const TaxDocumentRequirementEngine = {
  getQuestionnaire(clientId: string, taxYear: number): TaxDiscoveryQuestionnaireAnswers | null {
    try {
      const raw = localStorage.getItem(`${QUESTIONNAIRE_PREFIX}${clientId}_${taxYear}`);
      return raw ? (JSON.parse(raw) as TaxDiscoveryQuestionnaireAnswers) : null;
    } catch {
      return null;
    }
  },

  saveQuestionnaire(
    clientId: string,
    taxYear: number,
    answers: TaxDiscoveryQuestionnaireAnswers
  ): TaxDiscoveryQuestionnaireAnswers {
    try {
      localStorage.setItem(`${QUESTIONNAIRE_PREFIX}${clientId}_${taxYear}`, JSON.stringify(answers));
    } catch {
      // ignore storage quota errors
    }
    return answers;
  },

  evaluateMissingDocuments(input: {
    clientId?: string;
    taxYear?: number;
    answers?: TaxDiscoveryQuestionnaireAnswers | null;
    uploadedDocuments?: Array<{ category?: string; fileName?: string; status?: string; [key: string]: unknown }>;
    requirements?: TaxDocumentRequirementItem[];
    [key: string]: any;
  }): {
    requirements: TaxDocumentRequirementItem[];
    missing: TaxDocumentRequirementItem[];
    completed: TaxDocumentRequirementItem[];
    completionRate: number;
    [key: string]: any;
  } {
    const items: TaxDocumentRequirementItem[] = input.requirements ? [...input.requirements] : [
      {
        id: 'req_id_verification',
        title: 'Government-Issued Photo ID',
        category: 'identity',
        required: true,
        status: 'missing',
        taxYear: input.taxYear,
      },
      {
        id: 'req_prior_return',
        title: 'Prior-Year Federal & State Tax Returns',
        category: 'prior_return',
        required: true,
        status: 'missing',
        taxYear: input.taxYear,
      },
    ];
    const uploaded = input.uploadedDocuments ?? [];
    const mapped = items.map(item => {
      const matched = uploaded.some(
        d => d.category && d.category.toLowerCase() === item.category.toLowerCase()
      );
      return matched && item.status === 'missing' ? { ...item, status: 'uploaded' } : item;
    });
    const missing = mapped.filter(i => i.required && (i.status === 'missing' || i.status === 'requested'));
    const completed = mapped.filter(i => ['uploaded', 'verified', 'accepted', 'not_applicable'].includes(i.status));
    const completionRate = mapped.length ? Math.round((completed.length / mapped.length) * 100) : 100;
    return { requirements: mapped, missing, completed, completionRate };
  },

  generatePreparationPackage(input: {
    clientId?: string;
    taxYear?: number;
    documents?: Array<Record<string, any>>;
    answers?: TaxDiscoveryQuestionnaireAnswers | null;
    [key: string]: any;
  }): {
    generatedAt: string;
    taxYear: number;
    readinessScore: number;
    requirements: TaxDocumentRequirementItem[];
    missingItems: TaxDocumentRequirementItem[];
    summary: string;
    [key: string]: any;
  } {
    const evalResult = this.evaluateMissingDocuments({
      clientId: input.clientId,
      taxYear: input.taxYear,
      answers: input.answers,
      uploadedDocuments: input.documents as any,
    });
    return {
      generatedAt: new Date().toISOString(),
      taxYear: input.taxYear ?? 2025,
      readinessScore: evalResult.completionRate,
      requirements: evalResult.requirements,
      missingItems: evalResult.missing,
      summary: `${evalResult.completed.length} of ${evalResult.requirements.length} required document items collected.`,
    };
  },
};
