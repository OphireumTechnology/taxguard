export type StageTwoExceptionCategory = 'missing_doc' | 'unreadable' | 'wrong_year' | 'mismatch' | 'duplicate' | string;
export type StageTwoExceptionSeverity = 'low' | 'medium' | 'high' | 'critical' | string;
export type StageTwoExceptionStatus = 'open' | 'in_review' | 'resolved' | 'waived' | string;
export type EvaluatedDocumentStatus = 'complete' | 'partial' | 'missing' | 'exception' | 'waived' | string;

export interface StageTwoExceptionItem {
  id: string;
  category: StageTwoExceptionCategory;
  severity: StageTwoExceptionSeverity;
  status: StageTwoExceptionStatus;
  title: string;
  description?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface DocumentRequest {
  id: string;
  clientId?: string;
  title: string;
  description?: string;
  status: string;
  dueDate?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface ReminderDispatchRecord {
  id: string;
  sentAt: string;
  channel?: string;
  status?: string;
  [key: string]: any;
}

export interface SourceTieOutItem {
  id: string;
  sourceName: string;
  expected?: number;
  actual?: number;
  matched: boolean;
  [key: string]: any;
}

export interface CollectionCompletenessEvaluation {
  complete: boolean;
  score: number;
  status: EvaluatedDocumentStatus;
  openExceptions: StageTwoExceptionItem[];
  [key: string]: any;
}

export interface StageTwoExitGateRecord {
  passed: boolean;
  evaluatedAt: string;
  blockers: string[];
  [key: string]: any;
}

export const StageTwoCollectionOperationsService: any = {
  getExceptions: () => [] as StageTwoExceptionItem[],
  getRequests: () => [] as DocumentRequest[],
  getReminders: () => [] as ReminderDispatchRecord[],
  evaluateExitGate: (): StageTwoExitGateRecord => ({
    passed: false,
    evaluatedAt: new Date().toISOString(),
    blockers: [],
  }),
};
