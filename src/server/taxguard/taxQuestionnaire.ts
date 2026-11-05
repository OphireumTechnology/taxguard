export interface GeneratedDocumentRequirement {
  id: string;
  name: string;
  category?: string;
  description?: string;
  status?: string;
  [key: string]: any;
}

export interface StoredQuestionnaireRecord {
  id: string;
  clientId: string;
  taxYear: number;
  tenantId?: string;
  answers?: Record<string, any>;
  status?: string;
  [key: string]: any;
}

export interface TaxQuestionnaireCategory {
  id: string;
  name: string;
  description: string;
  questions: Array<{ id: string; text: string; type: 'boolean' | 'text' | 'number'; answer?: any }>;
}

export const TAX_QUESTIONNAIRE_CATEGORIES: TaxQuestionnaireCategory[] = [
  {
    id: 'general',
    name: 'General Information & Marital Status',
    description: 'Basic taxpayer details, filing status and address changes.',
    questions: [
      { id: 'q_marital', text: 'Did your marital status change during the tax year?', type: 'boolean' },
      { id: 'q_dependents', text: 'Did you gain or lose any dependents?', type: 'boolean' }
    ]
  },
  {
    id: 'income',
    name: 'Income & Investment Statements',
    description: 'W-2s, 1099s, capital gains, interest and business distributions.',
    questions: [
      { id: 'q_foreign', text: 'Did you have financial interest in or signature authority over a foreign account?', type: 'boolean' },
      { id: 'q_crypto', text: 'Did you buy, sell, exchange, or receive digital assets (cryptocurrency)?', type: 'boolean' }
    ]
  }
];

export const taxQuestionnaire = {
  getCategories: () => TAX_QUESTIONNAIRE_CATEGORIES
};
