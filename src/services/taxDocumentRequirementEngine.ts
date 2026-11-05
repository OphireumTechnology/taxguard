export type FilingStatus = 'single' | 'married_filing_jointly' | 'married_filing_separately' | 'head_of_household' | 'qualifying_widow';

export interface TaxDocumentRequirementItem {
  id: string;
  category: string;
  title: string;
  description: string;
  isRequired: boolean;
  forms: string[];
  requestedAt?: string;
  applicability?: string;
  whatIsThis?: string;
  whyDoWeNeedIt?: string;
  whereCanIGetIt?: string;
  statutoryBasis?: string;
  [key: string]: any;
}

export type CategoryQuestionnaireAnswers = Record<string, any>;
export type TaxDiscoveryQuestionnaireAnswers = {
  filingStatus?: string;
  residentState?: string;
  hasDependents?: boolean;
  hasPriorYearTaxReturn?: boolean;
  [key: string]: any;
};

export class TaxDocumentRequirementEngine {
  static evaluateRequirements(_filingStatus?: FilingStatus, _answers?: CategoryQuestionnaireAnswers): TaxDocumentRequirementItem[] {
    return [
      { id: 'req_w2', category: 'income', title: 'W-2 Wage Statements', description: 'From all employers active during the tax year.', isRequired: true, forms: ['W-2'] },
      { id: 'req_1099', category: 'income', title: '1099 Investment & Contractor Statements', description: '1099-INT, 1099-DIV, 1099-B, 1099-NEC.', isRequired: false, forms: ['1099'] }
    ];
  }

  static generatePreparationPackage(_input?: any, _taxYear?: number): any {
    return {
      status: 'READY',
      documents: []
    };
  }

  static evaluateMissingDocuments(_input?: any, _taxYear?: number, _uploadedDocs?: any[]): any {
    return {
      categories: [],
      receivedCount: 0,
      totalRequirements: 0,
      missingCount: 0
    };
  }

  static getQuestionnaire(_clientId?: string, _taxYear?: number): TaxDiscoveryQuestionnaireAnswers {
    return {
      filingStatus: 'single',
      residentState: 'SC',
      hasDependents: false,
      hasPriorYearTaxReturn: true
    };
  }

  static saveQuestionnaire(_clientId?: string, _taxYear?: number, _answers?: any): any {
    return { success: true };
  }
}
