export interface TaxQuestionnaireAnswers {
  filingStatus?: string;
  hasW2?: boolean;
  has1099?: boolean;
  hasBusiness?: boolean;
  hasInvestments?: boolean;
  hasRental?: boolean;
  hasMortgage?: boolean;
  hasCrypto?: boolean;
  hasForeignAccounts?: boolean;
  notes?: string;
  [key: string]: any;
}

export interface GeneratedDocumentRequirement {
  id: string;
  title: string;
  category: string;
  required: boolean;
  status?: string;
  description?: string;
  [key: string]: any;
}

export interface StoredQuestionnaireRecord {
  id?: string;
  clientId: string;
  taxYear: number;
  answers: TaxQuestionnaireAnswers;
  generatedRequirements?: GeneratedDocumentRequirement[];
  completedAt?: string;
  updatedAt?: string;
  [key: string]: any;
}
