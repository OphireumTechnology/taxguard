export const JOB_STATUSES = ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'CANCELLED'] as const;
export type JobStatus = typeof JOB_STATUSES[number];

export class JobRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'JobRequestError';
    this.status = status;
    this.code = code;
  }
}

export interface DurableJob {
  id: string;
  jobType: string;
  clientId?: string;
  caseId?: string;
  status: JobStatus;
  attemptCount: number;
  maxAttempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export function jobActions(status: JobStatus): { retry: boolean; cancel: boolean } {
  return {
    retry: status === 'FAILED' || status === 'DEAD_LETTER',
    cancel: status === 'QUEUED' || status === 'RUNNING'
  };
}

export function jobMessage(error: unknown): string {
  if (error instanceof JobRequestError) {
    return error.message;
  }
  return 'The background job service could not complete the operation.';
}

export const jobService = {
  async list(params?: { status?: JobStatus; limit?: number; offset?: number }): Promise<{ total: number; jobs: DurableJob[] }> {
    const allJobs: DurableJob[] = [
      {
        id: 'job_001',
        jobType: 'TAXGUARD_EFILE_TRANSMISSION',
        clientId: 'client_acme_corp',
        caseId: 'case_2025_1120s',
        status: 'COMPLETED',
        attemptCount: 1,
        maxAttempts: 3,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        updatedAt: new Date(Date.now() - 3500000).toISOString()
      },
      {
        id: 'job_002',
        jobType: 'OCR_FORM_1099_INGESTION',
        clientId: 'client_vanguard_holdings',
        caseId: 'case_2025_1040',
        status: 'QUEUED',
        attemptCount: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    const filtered = params?.status ? allJobs.filter(j => j.status === params.status) : allJobs;
    const offset = params?.offset || 0;
    const limit = params?.limit || 25;
    return {
      total: filtered.length,
      jobs: filtered.slice(offset, offset + limit)
    };
  },

  async retry(jobId: string): Promise<DurableJob> {
    return {
      id: jobId,
      jobType: 'RETRY_JOB',
      status: 'QUEUED',
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  async cancel(jobId: string): Promise<DurableJob> {
    return {
      id: jobId,
      jobType: 'CANCELLED_JOB',
      status: 'CANCELLED',
      attemptCount: 1,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  },

  getQueuedJobs: async () => [],
  retryJob: async (jobId: string) => ({ success: true }),
  cancelJob: async (jobId: string) => ({ success: true })
};
