import { apiRequest, ApiRequestError } from './api';

export class JobRequestError extends ApiRequestError {}

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled', 'dead_letter'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number] | string;

export interface DurableJob {
  id: string;
  jobType: string;
  status: JobStatus;
  attempts?: number;
  maxAttempts?: number;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export function jobMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Background job queue is unavailable.';
}

export function jobActions(status: JobStatus): { retry: boolean; cancel: boolean } {
  const s = String(status).toLowerCase();
  return {
    retry: s === 'failed' || s === 'dead_letter',
    cancel: s === 'queued' || s === 'pending',
  };
}

export const jobService: any = new Proxy(
  {
    list: () => apiRequest('/api/jobs'),
    retry: (id: string) => apiRequest(`/api/jobs/${encodeURIComponent(id)}/retry`, { method: 'POST' }),
    cancel: (id: string) => apiRequest(`/api/jobs/${encodeURIComponent(id)}/cancel`, { method: 'POST' }),
  },
  {
    get(target: any, prop: string) {
      if (prop in target) return target[prop];
      return async () => apiRequest(`/api/jobs/${prop}`);
    },
  }
);
