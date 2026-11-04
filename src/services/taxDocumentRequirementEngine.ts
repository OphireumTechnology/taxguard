export type FilingStatus = 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household' | 'qualifying_widow';

export interface TaxDocumentRequirementItem {
  id: string;
  category: string;
  title: string;
  description: string;
  isRequired: boolean;
  forms: string[];
}

export type CategoryQuestionnaireAnswers = Record<string, boolean | string | number>;

export class TaxDocumentRequirementEngine {
  static evaluateRequirements(filingStatus?: FilingStatus, answers?: CategoryQuestionnaireAnswers): TaxDocumentRequirementItem[] {
    return [
      { id: 'req_w2', category: 'income', title: 'W-2 Wage Statements', description: 'From all employers active during the tax year.', isRequired: true, forms: ['W-2'] },
      { id: 'req_1099', category: 'income', title: '1099 Investment & Contractor Statements', description: '1099-INT, 1099-DIV, 1099-B, 1099-NEC.', isRequired: false, forms: ['1099'] }
    ];
  }
}
