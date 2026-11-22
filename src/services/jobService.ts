import { api } from './api';

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number] | string;

export interface DurableJob {
  id: string;
  jobType: string;
  status: JobStatus;
  attempts: number;
  maxAttempts?: number;
  createdAt: string;
  updatedAt?: string;
  lastError?: string | null;
  [key: string]: any;
}

export class JobRequestError extends Error {
  constructor(public readonly code: string, message?: string, public readonly status?: number) {
    super(message || code);
    this.name = 'JobRequestError';
  }
}

export function jobActions(jobOrStatus: string | DurableJob): { retry: boolean; cancel: boolean } {
  const status = typeof jobOrStatus === 'string' ? jobOrStatus : jobOrStatus.status;
  return {
    retry: status === 'failed' || status === 'dead_letter',
    cancel: status === 'queued',
  };
}

export function jobMessage(err: unknown, fallback = 'Job queue service unavailable.'): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const jobService: any = {
  list: (query?: Record<string, any>, signal?: AbortSignal) =>
    api.request('/api/jobs', { query, signal }),
  retry: (id: string) => api.request(`/api/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
  cancel: (id: string) => api.request(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
};
