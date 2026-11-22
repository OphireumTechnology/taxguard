import { api } from './api';

export const STAGE_NAMES: Record<number, string> = {
  1: 'Onboard',
  2: 'Collect',
  3: 'Validate',
  4: 'Record',
  5: 'Reconcile',
  6: 'Review Books',
  7: 'Report',
  8: 'Plan',
  9: 'Prepare Taxes',
  10: 'Approve',
  11: 'Sign',
  12: 'File',
  13: 'Feedback',
  14: 'Resolve',
  15: 'Monitor',
  16: 'Archive',
  17: 'Renew',
  18: 'Repeat',
};

export interface CaseQueueItem {
  id: string;
  clientId: string;
  clientName?: string;
  taxYear: number;
  activeStage: number;
  status: string;
  preparerUid?: string;
  reviewerUid?: string;
  dueDate?: string;
  [key: string]: any;
}

export interface CaseDetail extends CaseQueueItem {
  workpapers?: any[];
  checks?: any[];
  dependencies?: any[];
  history?: any[];
}

export function stageLabel(stage: number): string {
  return `Stage ${String(stage).padStart(2, '0')} — ${STAGE_NAMES[stage] || 'Workflow'}`;
}

export function checkLabel(code: string): string {
  return (code || '').replace(/_/g, ' ');
}

export function dependencyLabel(code: string): string {
  return (code || '').replace(/_/g, ' ');
}

export function restaffCandidates(staff: any[], caseOrRole?: any, role?: string): any[] {
  if (!Array.isArray(staff)) return [];
  const effectiveRole = typeof role === 'string' ? role : typeof caseOrRole === 'string' ? caseOrRole : undefined;
  if (!effectiveRole) return staff;
  return staff.filter((s) => s?.role === effectiveRole || s?.assignmentRole === effectiveRole);
}

export function caseMessage(err: unknown, fallback = 'Case workflow service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const caseService: any = {
  list: (query?: Record<string, any>, signal?: AbortSignal) =>
    api.request('/api/cases', { query, signal }),
  get: (id: string, signal?: AbortSignal) =>
    api.request(`/api/cases/${encodeURIComponent(id)}`, { signal }),
  advance: (id: string, payload?: Record<string, any>) =>
    api.request(`/api/cases/${encodeURIComponent(id)}/advance`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    }),
  restaff: (id: string, payload: Record<string, any>) =>
    api.request(`/api/cases/${encodeURIComponent(id)}/restaff`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
