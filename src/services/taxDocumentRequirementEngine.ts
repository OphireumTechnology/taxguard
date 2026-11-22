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
  hasSelfEmployment?: boolean;
  hasBusinessEntity?: boolean;
  hasInvestments?: boolean;
  hasRentalProperty?: boolean;
  hasMortgage?: boolean;
  hasEducationExpenses?: boolean;
  hasHealthSavings?: boolean;
  hasForeignAccounts?: boolean;
  [key: string]: any;
}

export interface TaxDocumentRequirementItem {
  id: string;
  title: string;
  category: string;
  description?: string;
  required: boolean;
  status: string;
  formCode?: string;
  [key: string]: any;
}

export const TaxDocumentRequirementEngine: any = {
  generateRequirements(answers: TaxDiscoveryQuestionnaireAnswers = {}): TaxDocumentRequirementItem[] {
    const items: TaxDocumentRequirementItem[] = [
      {
        id: 'req-id',
        title: 'Government-Issued Photo ID',
        category: 'Identity',
        description: 'Valid driver license or passport for primary taxpayer.',
        required: true,
        status: 'pending',
      },
      {
        id: 'req-prior-return',
        title: 'Prior-Year Federal & State Tax Returns',
        category: 'Prior Year',
        description: 'Complete copy of last filed federal and state returns.',
        required: true,
        status: 'pending',
      },
    ];
    if (answers.hasW2 !== false) {
      items.push({
        id: 'req-w2',
        title: 'Form W-2 Wage & Tax Statements',
        category: 'Income',
        formCode: 'W-2',
        required: true,
        status: 'pending',
      });
    }
    if (answers.hasSelfEmployment || answers.hasBusinessEntity) {
      items.push({
        id: 'req-business-pnl',
        title: 'Business Profit & Loss Statement and Balance Sheet',
        category: 'Business',
        required: true,
        status: 'pending',
      });
    }
    if (answers.hasInvestments) {
      items.push({
        id: 'req-1099-brokerage',
        title: 'Consolidated Form 1099 (INT / DIV / B)',
        category: 'Investments',
        formCode: '1099',
        required: true,
        status: 'pending',
      });
    }
    if (answers.hasMortgage) {
      items.push({
        id: 'req-1098',
        title: 'Form 1098 Mortgage Interest Statement',
        category: 'Deductions',
        formCode: '1098',
        required: false,
        status: 'pending',
      });
    }
    return items;
  },
};
