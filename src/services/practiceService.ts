import { apiRequest, ApiRequestError } from './api';

export class PracticeRequestError extends ApiRequestError {}

export const DEADLINE_AUTHORITIES = ['IRS', 'STATE', 'LOCAL', 'INTERNAL'] as const;
export const DEADLINE_CATEGORIES = ['filing', 'extension', 'estimated_tax', 'payroll', 'information_return'] as const;
export const ENGAGEMENT_TRANSITIONS: Record<string, string[]> = {
  onboarding: ['in_progress', 'document_collection'],
  document_collection: ['in_progress', 'under_review'],
  in_progress: ['under_review', 'ready_for_signature'],
  under_review: ['in_progress', 'ready_for_signature'],
  ready_for_signature: ['filed', 'completed'],
  filed: ['completed', 'archived'],
};

export type EscalationLevelName = 'normal' | 'warning' | 'urgent' | 'critical' | 'overdue' | string;

export interface PracticeClientRow {
  id: string;
  clientId?: string;
  name: string;
  email?: string;
  status: string;
  entityType?: string;
  assignedAccountantId?: string;
  [key: string]: any;
}

export interface PracticeClientDetail extends PracticeClientRow {
  engagements?: any[];
  tasks?: any[];
  deadlines?: any[];
}

export interface PracticeSummary {
  totalClients: number;
  activeClients?: number;
  openCases?: number;
  upcomingDeadlines?: number;
  [key: string]: any;
}

export interface MyWork {
  tasks: any[];
  deadlines: any[];
  cases?: any[];
  [key: string]: any;
}

export interface Workload {
  staff: any[];
  unassignedTasks?: any[];
  [key: string]: any;
}

export interface DeadlineEscalations {
  items: any[];
  summary?: Record<string, number>;
  [key: string]: any;
}

export interface StaffNotifications {
  items: any[];
  unreadCount: number;
  [key: string]: any;
}

export interface PracticeSearch {
  clients: any[];
  cases: any[];
  documents?: any[];
  [key: string]: any;
}

export function newPracticeKey(prefix = 'prac'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function practiceMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Practice operations service is unavailable.';
}

export const practiceService: any = new Proxy(
  {
    getSummary: () => apiRequest('/api/practice/summary'),
    listClients: () => apiRequest('/api/practice/clients'),
    getClient: (id: string) => apiRequest(`/api/practice/clients/${encodeURIComponent(id)}`),
    getMyWork: () => apiRequest('/api/practice/my-work'),
    getWorkload: () => apiRequest('/api/practice/workload'),
    getEscalations: () => apiRequest('/api/practice/escalations'),
    getNotifications: () => apiRequest('/api/practice/notifications'),
    search: (q: string) => apiRequest(`/api/practice/search?q=${encodeURIComponent(q)}`),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/practice/${prop}`);
    },
  }
);
