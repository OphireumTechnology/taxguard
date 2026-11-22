/** Browser client for the durable background job queue (/api/jobs, proposal 20261019240000). Staff operations only. */
import { getStoredToken } from './api';
import { apiEndpoint } from '../config/apiEndpoint';

export class JobRequestError extends Error {
  constructor(public readonly status: number, public readonly code?: string) { super(code || 'JOB_REQUEST_FAILED'); }
}
export type JobStatus = 'PENDING' | 'CLAIMED' | 'RUNNING' | 'RETRY_SCHEDULED' | 'COMPLETED' | 'FAILED' | 'DEAD_LETTER' | 'CANCELLED';
export const JOB_STATUSES: readonly JobStatus[] = ['PENDING', 'CLAIMED', 'RUNNING', 'RETRY_SCHEDULED', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED'];
export interface DurableJob { id: string; clientId: string | null; caseId: string | null; jobType: string; status: JobStatus; priority: number; attemptCount: number;
  maxAttempts: number; availableAt: string; lockedBy: string | null; leaseExpiresAt: string | null; lastErrorCode: string | null; lastErrorMessage: string | null;
  createdBy: string | null; cancelledBy: string | null; createdAt: string; updatedAt: string }

async function request<T>(method: 'GET' | 'POST', path: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw new JobRequestError(401, 'AUTH_REQUIRED');
  const response = await fetch(apiEndpoint('/api/jobs' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
  const data = await response.json().catch(() => null);
  if (getStoredToken() !== token) throw new JobRequestError(409, 'SESSION_CHANGED');
  if (!response.ok) throw new JobRequestError(response.status, typeof data?.code === 'string' ? data.code : undefined);
  return data as T;
}

export const jobService = {
  list: (filter: { status?: JobStatus; clientId?: string; limit?: number; offset?: number } = {}) => {
    const q = new URLSearchParams(Object.entries(filter).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
    return request<{ total: number; jobs: DurableJob[] }>('GET', q.toString() ? '?' + q : '');
  },
  retry: (jobId: string) => request<DurableJob>('POST', '/' + encodeURIComponent(jobId) + '/retry'),
  cancel: (jobId: string) => request<DurableJob>('POST', '/' + encodeURIComponent(jobId) + '/cancel'),
};

const MESSAGES: Record<string, string> = {
  JOB_ADMIN_REQUIRED: 'Only an administrator can re-queue a job.',
  JOB_CANCEL_NOT_AUTHORIZED: 'Only an administrator or an accountant in scope can cancel a job.',
  JOB_STATE_INVALID: 'The job is no longer in a state that allows this. Refresh to see its current status.',
  JOB_NOT_FOUND: 'That job was not found or is not in your scope.',
  JOB_SCOPE_REQUIRED: 'Listing every job of the practice is for administrators only.',
  JOB_STORE_UNAVAILABLE: 'The durable job queue is not enabled in this environment.',
};
export function jobMessage(error: unknown): string {
  if (error instanceof JobRequestError && error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error instanceof JobRequestError && error.status === 403) return 'Your role is not authorized for this action.';
  return 'The job queue did not confirm this action. Refresh and try again.';
}
/** Which administrator actions a job's status allows, as the database enforces them. */
export const jobActions = (status: JobStatus) => ({ retry: status === 'DEAD_LETTER' || status === 'FAILED', cancel: status !== 'COMPLETED' && status !== 'CANCELLED' });
