import { api } from './api';

export type EscalationLevelName = 'none' | 'warning' | 'urgent' | 'critical' | string;

export const DEADLINE_AUTHORITIES = ['IRS', 'STATE', 'LOCAL', 'INTERNAL'] as const;
export const DEADLINE_CATEGORIES = ['FILING', 'ESTIMATED_TAX', 'EXTENSION', 'PAYROLL', 'NOTICE_RESPONSE'] as const;
export const ENGAGEMENT_TRANSITIONS: Record<string, string[]> = {
  onboarding: ['active', 'on_hold'],
  active: ['in_review', 'completed', 'on_hold'],
  in_review: ['active', 'completed'],
  on_hold: ['active'],
  completed: ['archived'],
};

export interface PracticeClientRow {
  id: string;
  clientId?: string;
  name: string;
  email?: string;
  entityType?: string;
  status: string;
  [key: string]: any;
}

export interface PracticeClientDetail extends PracticeClientRow {
  engagements?: any[];
  assignments?: any[];
  notes?: any[];
}

export interface PracticeSummary {
  activeClients: number;
  openTasks: number;
  upcomingDeadlines: number;
  overdueDeadlines?: number;
  [key: string]: any;
}

export interface MyWork {
  tasks: any[];
  deadlines: any[];
  cases?: any[];
  [key: string]: any;
}

export interface Workload {
  staff: Array<{ uid: string; name?: string; role?: string; activeTasks: number; activeCases: number; [key: string]: any }>;
  [key: string]: any;
}

export interface DeadlineEscalations {
  items: any[];
  [key: string]: any;
}

export interface StaffNotifications {
  items: any[];
  unreadCount?: number;
  [key: string]: any;
}

export interface PracticeSearch {
  clients: any[];
  cases: any[];
  documents?: any[];
  [key: string]: any;
}

export class PracticeRequestError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'PracticeRequestError';
  }
}

export function newPracticeKey(): string {
  return `prac_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function practiceMessage(err: unknown, fallback = 'Practice management service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const practiceService: any = {
  summary: (signal?: AbortSignal) => api.request('/api/practice/summary', { signal }),
  clients: (query?: Record<string, any>, signal?: AbortSignal) =>
    api.request('/api/practice/clients', { query, signal }),
  clientDetail: (id: string, signal?: AbortSignal) =>
    api.request(`/api/practice/clients/${encodeURIComponent(id)}`, { signal }),
  myWork: (signal?: AbortSignal) => api.request('/api/practice/my-work', { signal }),
  workload: (signal?: AbortSignal) => api.request('/api/practice/workload', { signal }),
  escalations: (signal?: AbortSignal) => api.request('/api/practice/escalations', { signal }),
  notifications: (signal?: AbortSignal) => api.request('/api/practice/notifications', { signal }),
  search: (q: string, signal?: AbortSignal) => api.request('/api/practice/search', { query: { q }, signal }),
  reassignTask: (taskId: string, payload: Record<string, any>) =>
    api.request(`/api/practice/tasks/${encodeURIComponent(taskId)}/reassign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
