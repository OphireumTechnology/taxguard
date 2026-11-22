export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse'
  | string;

export interface TaxDiscoveryQuestionnaireAnswers {
  filingStatus?: FilingStatus;
  hasW2?: boolean;
  has1099?: boolean;
  hasBusinessIncome?: boolean;
  hasRentalProperty?: boolean;
  hasInvestments?: boolean;
  hasMortgage?: boolean;
  hasForeignAccounts?: boolean;
  states?: string[];
  [key: string]: any;
}

export interface TaxDocumentRequirementItem {
  id: string;
  code?: string;
  name: string;
  title?: string;
  category: string;
  required: boolean;
  status: 'missing' | 'pending' | 'uploaded' | 'verified' | 'not_applicable' | string;
  description?: string;
  citation?: string;
  taxYear?: number;
  uploadedDocumentId?: string;
  [key: string]: any;
}

export const TaxDocumentRequirementEngine: any = {
  generateRequirements(
    answers: TaxDiscoveryQuestionnaireAnswers = {},
    taxYear = 2025
  ): TaxDocumentRequirementItem[] {
    const items: TaxDocumentRequirementItem[] = [
      {
        id: `req_id_${taxYear}`,
        name: 'Government-Issued Photo ID',
        category: 'identity',
        required: true,
        status: 'missing',
        description: 'Valid driver license or passport for identity verification.',
        taxYear,
      },
      {
        id: `req_prior_${taxYear}`,
        name: `Prior-Year Tax Return (${taxYear - 1})`,
        category: 'tax_return',
        required: true,
        status: 'missing',
        description: 'Complete copy of prior federal and state filings for carryover continuity.',
        taxYear,
      },
    ];
    if (answers.hasW2 !== false) {
      items.push({
        id: `req_w2_${taxYear}`,
        name: 'Form W-2 Wage and Tax Statements',
        category: 'w2',
        required: true,
        status: 'missing',
        description: 'All W-2 forms received from employers.',
        taxYear,
      });
    }
    if (answers.has1099) {
      items.push({
        id: `req_1099_${taxYear}`,
        name: 'Forms 1099 (NEC, MISC, INT, DIV, B)',
        category: '1099',
        required: true,
        status: 'missing',
        description: 'Nonemployee compensation, brokerage, and bank interest statements.',
        taxYear,
      });
    }
    if (answers.hasBusinessIncome) {
      items.push({
        id: `req_books_${taxYear}`,
        name: 'Year-End Profit & Loss and Balance Sheet',
        category: 'financial_statement',
        required: true,
        status: 'missing',
        description: 'Accounting statements and trial balance for business entity reporting.',
        taxYear,
      });
    }
    return items;
  },
  getDefaultAnswers(): TaxDiscoveryQuestionnaireAnswers {
    return {
      filingStatus: 'single',
      hasW2: true,
      has1099: false,
      hasBusinessIncome: false,
      hasRentalProperty: false,
      hasInvestments: false,
      hasMortgage: false,
      hasForeignAccounts: false,
      states: ['SC'],
    };
  },
};
