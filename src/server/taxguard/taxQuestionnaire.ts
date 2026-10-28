export interface TaxQuestionnaireAnswers {
  hasWageIncome?: boolean;
  hasBusinessIncome?: boolean;
  hasInvestments?: boolean;
  hasRealEstate?: boolean;
  hasCrypto?: boolean;
  filingStatus?: string;
  dependentsCount?: number;
  [key: string]: any;
}

export interface TaxQuestionnaireRecord {
  tenantId: string;
  clientId: string;
  taxYear: number;
  answers: TaxQuestionnaireAnswers;
  updatedAt: string;
}

export const serverCaseRequirements = new Map<string, any[]>();

const inMemoryQuestionnaires = new Map<string, TaxQuestionnaireRecord>();

export class TaxQuestionnaireEngine {
  static getQuestionnaire(tenantId: string, clientId: string, taxYear: number): TaxQuestionnaireRecord | null {
    const key = `${tenantId}:${clientId}:${taxYear}`;
    return inMemoryQuestionnaires.get(key) || null;
  }

  static saveQuestionnaire(params: { tenantId: string; clientId: string; taxYear: number; answers: TaxQuestionnaireAnswers }): TaxQuestionnaireRecord {
    const key = `${params.tenantId}:${params.clientId}:${params.taxYear}`;
    const record: TaxQuestionnaireRecord = {
      tenantId: params.tenantId,
      clientId: params.clientId,
      taxYear: params.taxYear,
      answers: params.answers,
      updatedAt: new Date().toISOString()
    };
    inMemoryQuestionnaires.set(key, record);
    return record;
  }

  static generateRequirementsFromQuestionnaire(_tenantId: string, _clientId: string, _taxYear: number, _answers: TaxQuestionnaireAnswers): any[] {
    return [
      { requirementId: 'REQ_W2', category: 'Federal Documents', title: 'Form W-2', status: 'REQUIRED' },
      { requirementId: 'REQ_1099NEC', category: 'Federal Documents', title: 'Form 1099-NEC', status: 'REQUIRED' }
    ];
  }

  static evaluateNotApplicableClaim(params: any): { allowed: boolean; reason?: string } {
    return { allowed: true };
  }
}
