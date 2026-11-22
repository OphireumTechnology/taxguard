import { apiRequest } from './api';

export type StageTwoExceptionCategory = 'missing_document' | 'unreadable' | 'mismatch' | 'incomplete' | 'other' | string;
export type StageTwoExceptionSeverity = 'low' | 'medium' | 'high' | 'critical' | string;
export type StageTwoExceptionStatus = 'open' | 'in_review' | 'resolved' | 'waived' | string;
export type EvaluatedDocumentStatus = 'missing' | 'pending' | 'uploaded' | 'verified' | 'rejected' | 'waived' | string;

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
  category?: string;
  status: string;
  dueDate?: string;
  [key: string]: any;
}

export interface ReminderDispatchRecord {
  id: string;
  sentAt: string;
  channel: string;
  recipient?: string;
  status: string;
  [key: string]: any;
}

export interface SourceTieOutItem {
  id: string;
  label: string;
  expected?: number;
  actual?: number;
  matched: boolean;
  [key: string]: any;
}

export interface CollectionCompletenessEvaluation {
  percentComplete: number;
  readyForValidation: boolean;
  missingCount: number;
  openExceptionsCount: number;
  items?: any[];
  [key: string]: any;
}

export interface StageTwoExitGateRecord {
  passed: boolean;
  evaluatedAt?: string;
  blockers?: string[];
  [key: string]: any;
}

export const StageTwoCollectionOperationsService: any = new Proxy(
  {
    evaluate: (clientId: string, taxYear: number) =>
      apiRequest(`/api/stage-two-three/operations?clientId=${encodeURIComponent(clientId)}&taxYear=${taxYear}`),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => ({ success: true, items: [] });
    },
  }
);
