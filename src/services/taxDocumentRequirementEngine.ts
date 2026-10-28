export type FilingStatus =
  | 'SINGLE'
  | 'MARRIED_FILING_JOINTLY'
  | 'MARRIED_FILING_SEPARATELY'
  | 'HEAD_OF_HOUSEHOLD'
  | 'QUALIFYING_SURVIVING_SPOUSE';

export interface TaxDocumentRequirementItem {
  id: string;
  requirementId: string;
  title: string;
  category:
    | 'Federal Documents'
    | 'State Documents'
    | 'Prior-Year Tax Records'
    | 'Business / Accounting Records'
    | 'Additional Accountant Requests'
    | string;
  description: string;
  isRequired: boolean;
  status: 'missing' | 'fulfilled' | 'pending' | 'waived' | 'uploaded' | 'verified';
  formCode?: string;
  irsAuthority?: string;
  suggestedAction?: string;
  waiverAllowed?: boolean;
}

export interface TaxDiscoveryQuestionnaireAnswers {
  hasWageIncome?: boolean;
  hasBusinessIncome?: boolean;
  hasInvestments?: boolean;
  hasRealEstate?: boolean;
  hasCrypto?: boolean;
  filingStatus?: FilingStatus;
  dependentsCount?: number;
  [key: string]: any;
}

export interface MissingDocumentsEvaluation {
  totalRequired: number;
  fulfilledCount: number;
  missingCount: number;
  categories: Record<string, TaxDocumentRequirementItem[]>;
  items: TaxDocumentRequirementItem[];
}

const DEFAULT_REQUIREMENTS: TaxDocumentRequirementItem[] = [
  {
    id: 'req-w2',
    requirementId: 'REQ_W2',
    title: 'Form W-2 (Wage and Tax Statement)',
    category: 'Federal Documents',
    description: 'Statement of earnings and tax withheld from employers.',
    isRequired: true,
    status: 'fulfilled',
    formCode: 'W-2',
    irsAuthority: 'IRC § 6051'
  },
  {
    id: 'req-1099nec',
    requirementId: 'REQ_1099NEC',
    title: 'Form 1099-NEC (Nonemployee Compensation)',
    category: 'Federal Documents',
    description: 'Report payments of $600 or more made to non-employees.',
    isRequired: true,
    status: 'missing',
    formCode: '1099-NEC',
    irsAuthority: 'IRC § 6041A'
  },
  {
    id: 'req-1099int',
    requirementId: 'REQ_1099INT',
    title: 'Form 1099-INT (Interest Income)',
    category: 'Federal Documents',
    description: 'Interest earnings from banks, credit unions, and brokerage accounts.',
    isRequired: false,
    status: 'missing',
    formCode: '1099-INT'
  },
  {
    id: 'req-state-withholding',
    requirementId: 'REQ_STATE_W2',
    title: 'State Wage & Tax Reconciliation',
    category: 'State Documents',
    description: 'State tax return copy and local withholdings schedule.',
    isRequired: true,
    status: 'missing'
  },
  {
    id: 'req-prior-return',
    requirementId: 'REQ_PRIOR_YEAR',
    title: 'Prior-Year Tax Return (Form 1040/1120-S)',
    category: 'Prior-Year Tax Records',
    description: 'Complete federal and state tax package filed for the prior tax year.',
    isRequired: true,
    status: 'fulfilled'
  },
  {
    id: 'req-pnl',
    requirementId: 'REQ_PNL',
    title: 'Year-End Profit and Loss Statement',
    category: 'Business / Accounting Records',
    description: 'Full 12-month accrual or cash basis income statement.',
    isRequired: true,
    status: 'missing'
  },
  {
    id: 'req-addl-id',
    requirementId: 'REQ_GOV_ID',
    title: 'Government-Issued Photo ID',
    category: 'Additional Accountant Requests',
    description: 'Valid driver license or passport for identity compliance.',
    isRequired: true,
    status: 'fulfilled'
  }
];

export const TaxDocumentRequirementEngine = {
  getQuestionnaire(_clientId: string, _taxYear: number): TaxDiscoveryQuestionnaireAnswers {
    return {
      hasWageIncome: true,
      hasBusinessIncome: true,
      hasInvestments: true,
      filingStatus: 'MARRIED_FILING_JOINTLY',
      dependentsCount: 1
    };
  },

  saveQuestionnaire(_clientId: string, _taxYear: number, _answers: TaxDiscoveryQuestionnaireAnswers): boolean {
    return true;
  },

  evaluateMissingDocuments(options: {
    clientId: string;
    taxYear: number;
    uploadedDocs?: any[];
  }): MissingDocumentsEvaluation {
    const categories: Record<string, TaxDocumentRequirementItem[]> = {
      'Federal Documents': [],
      'State Documents': [],
      'Prior-Year Tax Records': [],
      'Business / Accounting Records': [],
      'Additional Accountant Requests': []
    };

    DEFAULT_REQUIREMENTS.forEach(item => {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    });

    const totalRequired = DEFAULT_REQUIREMENTS.filter(r => r.isRequired).length;
    const fulfilledCount = DEFAULT_REQUIREMENTS.filter(r => r.isRequired && (r.status === 'fulfilled' || r.status === 'verified')).length;

    return {
      totalRequired,
      fulfilledCount,
      missingCount: Math.max(0, totalRequired - fulfilledCount),
      categories,
      items: DEFAULT_REQUIREMENTS
    };
  }
};
