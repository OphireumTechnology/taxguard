import { apiRequest } from './api';

export interface CaseQueueItem {
  id: string;
  clientId: string;
  clientName?: string;
  taxYear?: number;
  stage?: string | number;
  status: string;
  assignedAccountantId?: string;
  assignedReviewerId?: string;
  [key: string]: any;
}

export interface CaseDetail extends CaseQueueItem {
  workpapers?: any[];
  checks?: any[];
  dependencies?: any[];
  history?: any[];
}

export const STAGE_NAMES: Record<string, string> = {
  '1': 'Client Identity & Onboarding',
  '2': 'Document Collection',
  '3': 'Document Validation',
  '4': 'Transaction Recording',
  '5': 'Account Reconciliation',
  '6': 'Accounting Review',
  '7': 'Financial Reporting',
  '8': 'Tax Strategy & Planning',
  '9': 'Draft Return Preparation',
  '10': 'CPA Review & Approval',
  '11': 'Client Signature Authorization',
  '12': 'Electronic Filing',
  '13': 'Acknowledgement & Feedback',
  '14': 'Notice Resolution',
  '15': 'Post-Filing Monitoring',
  '16': 'Tax Archive',
  '17': 'Engagement Renewal',
  '18': 'Continuous Tax Cycle',
};

export function stageLabel(stage: string | number | undefined): string {
  if (stage === undefined || stage === null) return 'Unknown Stage';
  return STAGE_NAMES[String(stage)] || `Stage ${stage}`;
}

export function checkLabel(code: string): string {
  return code.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function dependencyLabel(code: string): string {
  return checkLabel(code);
}

export function caseMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Case workflow service is unavailable.';
}

export function restaffCandidates(staff: any[], currentId?: string, _role?: string): any[] {
  return (staff || []).filter((s) => s?.id !== currentId && s?.status !== 'disabled');
}

export const caseService: any = new Proxy(
  {
    list: () => apiRequest('/api/cases'),
    get: (id: string) => apiRequest(`/api/cases/${encodeURIComponent(id)}`),
    advanceStage: (id: string, payload: any) =>
      apiRequest(`/api/cases/${encodeURIComponent(id)}/advance`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    restaff: (id: string, payload: any) =>
      apiRequest(`/api/cases/${encodeURIComponent(id)}/restaff`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/cases/${prop}`);
    },
  }
);
