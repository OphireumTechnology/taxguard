class DurableJobQueueService {
  private jobs = new Map<string, any>();

  queryJobs(filter?: {
    tenantId?: string;
    clientId?: string;
    status?: string;
    jobType?: string;
    limit?: number;
    offset?: number;
    [key: string]: any;
  }): { jobs: any[]; total: number } {
    const all = Array.from(this.jobs.values()).filter((job) => {
      if (filter?.tenantId && job.tenantId !== filter.tenantId) return false;
      if (filter?.clientId && job.clientId !== filter.clientId) return false;
      if (filter?.status && job.status !== filter.status) return false;
      if (filter?.jobType && job.jobType !== filter.jobType) return false;
      return true;
    });
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 50;
    return {
      jobs: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  enqueue(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_JOB_QUEUE_UNAVAILABLE'), {
      code: 'DURABLE_JOB_QUEUE_UNAVAILABLE',
      status: 503,
    });
  }

  getJob(jobId: string, _tenantId?: string): any | null {
    return this.jobs.get(jobId) ?? null;
  }

  retryDeadLetterJob(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_JOB_QUEUE_UNAVAILABLE'), {
      code: 'DURABLE_JOB_QUEUE_UNAVAILABLE',
      status: 503,
    });
  }

  cancelJob(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_JOB_QUEUE_UNAVAILABLE'), {
      code: 'DURABLE_JOB_QUEUE_UNAVAILABLE',
      status: 503,
    });
  }
}

export const globalDurableJobQueueService = new DurableJobQueueService();
