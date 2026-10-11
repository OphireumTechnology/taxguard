/**
 * TaxGuard Durable Background Job Queue & Dead-Letter Service
 * Legacy process-local scheduling simulation; not distributed durable authority.
 * Production leases/fencing/worker recovery require a verified durable adapter.
 */

import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { DurableJob, JobStatus, JobType, RetryAttempt } from './types';

export class DurableJobQueueService {
  private jobs = new Map<string, DurableJob>();
  private leaseDeadlines = new Map<string, number>();

  /**
   * Enqueue a new durable background job
   */
  async enqueue<T = Record<string, unknown>>(params: {
    tenantId: string;
    jobType: JobType;
    payload: T;
    clientId?: string;
    caseId?: string;
    priority?: number;
    maxAttempts?: number;
    availableAt?: string;
    idempotencyKey?: string;
  }): Promise<DurableJob<T>> {
    if ((params.maxAttempts !== undefined && (!Number.isSafeInteger(params.maxAttempts) || params.maxAttempts < 1)) ||
        (params.priority !== undefined && !Number.isFinite(params.priority)) ||
        (params.availableAt !== undefined && (typeof params.availableAt !== 'string' || !Number.isFinite(Date.parse(params.availableAt))))) {
      throw new Error('JOB_INVALID_SCHEDULE');
    }
    // If idempotencyKey provided, prevent duplicate enqueue
    if (params.idempotencyKey) {
      for (const existing of this.jobs.values()) {
        if (
          existing.tenantId === params.tenantId &&
          existing.idempotencyKey === params.idempotencyKey
        ) {
          if (existing.jobType !== params.jobType || existing.clientId !== params.clientId ||
              existing.caseId !== params.caseId || !isDeepStrictEqual(existing.payload, params.payload)) {
            throw new Error('JOB_IDEMPOTENCY_CONFLICT');
          }
          if (existing.status !== 'CANCELLED' && existing.status !== 'FAILED') {
            return structuredClone(existing) as unknown as DurableJob<T>;
          }
        }
      }
    }

    const id = `job_${randomUUID()}`;
    const now = new Date().toISOString();

    const job: DurableJob<T> = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      caseId: params.caseId,
      jobType: params.jobType,
      payload: structuredClone(params.payload),
      status: 'PENDING',
      priority: Math.min(10, Math.max(1, params.priority ?? 5)),
      attemptCount: 0,
      maxAttempts: params.maxAttempts ?? 5,
      availableAt: params.availableAt ?? now,
      retryHistory: [],
      idempotencyKey: params.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    this.jobs.set(id, job as unknown as DurableJob);
    return structuredClone(job);
  }

  /**
   * Concurrently claim the next available job for worker execution
   * Safe claiming: locks job to workerId with lease time.
   */
  async claimNextJob(
    tenantId: string,
    workerId: string,
    leaseSeconds = 300
  ): Promise<DurableJob | null> {
    if (typeof tenantId !== 'string' || !tenantId.trim() || typeof workerId !== 'string' || !workerId.trim() ||
        !Number.isFinite(leaseSeconds) || leaseSeconds <= 0 ||
        !Number.isFinite(Date.now() + leaseSeconds * 1000)) throw new Error('JOB_INVALID_CLAIM');
    const now = new Date();
    const nowIso = now.toISOString();

    // Find candidate jobs: status PENDING or RETRY_SCHEDULED, availableAt <= now
    // Recovery uses the originally granted expiry, never the next claimant's requested duration.
    const candidates = Array.from(this.jobs.values()).filter((j) => {
      if (j.tenantId !== tenantId) return false;

      if (j.status === 'PENDING' || j.status === 'RETRY_SCHEDULED') {
        return new Date(j.availableAt).getTime() <= now.getTime();
      }

      if (j.status === 'CLAIMED' || j.status === 'RUNNING') {
        const deadline = this.leaseDeadlines.get(j.id);
        return deadline !== undefined && now.getTime() >= deadline;
      }

      return false;
    });

    if (candidates.length === 0) return null;

    // Sort by priority (1 is highest), then availableAt ascending
    candidates.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(a.availableAt).getTime() - new Date(b.availableAt).getTime();
    });

    const claimed = candidates[0];
    claimed.status = 'CLAIMED';
    claimed.lockedAt = nowIso;
    claimed.lockedBy = workerId;
    claimed.startedAt = nowIso;
    claimed.attemptCount += 1;
    claimed.updatedAt = nowIso;

    this.jobs.set(claimed.id, claimed);
    this.leaseDeadlines.set(claimed.id, now.getTime() + leaseSeconds * 1000);
    return structuredClone(claimed);
  }

  /**
   * Mark a claimed job as COMPLETED
   */
  async completeJob(
    jobId: string,
    workerId: string
  ): Promise<DurableJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`JOB_NOT_FOUND: ${jobId}`);
    if (!['CLAIMED', 'RUNNING'].includes(job.status) || !job.lockedBy || job.lockedBy !== workerId ||
        (this.leaseDeadlines.get(jobId) ?? 0) <= Date.now()) throw new Error('JOB_WORKER_CLAIM_REQUIRED');

    const now = new Date().toISOString();
    job.status = 'COMPLETED';
    job.completedAt = now;
    job.lockedAt = undefined;
    job.lockedBy = undefined;
    job.updatedAt = now;

    this.leaseDeadlines.delete(jobId);

    this.jobs.set(jobId, job);
    return structuredClone(job);
  }

  /**
   * Fail a job with retry policy evaluation
   * Transient errors: exponential backoff retry
   * Permanent errors or max attempts exceeded: DEAD_LETTER
   */
  async failJob(
    jobId: string,
    workerId: string,
    error: { code: string; message: string; isPermanent?: boolean }
  ): Promise<DurableJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`JOB_NOT_FOUND: ${jobId}`);
    if (!['CLAIMED', 'RUNNING'].includes(job.status) || !job.lockedBy || job.lockedBy !== workerId ||
        (this.leaseDeadlines.get(jobId) ?? 0) <= Date.now()) throw new Error('JOB_WORKER_CLAIM_REQUIRED');

    const now = new Date();
    const nowIso = now.toISOString();

    const isPermanent = Boolean(
      error.isPermanent ||
      error.code.startsWith('VALIDATION_') ||
      error.code.startsWith('AUTH_') ||
      error.code === 'INVALID_PAYLOAD'
    );

    const retryRecord: RetryAttempt = {
      attemptNumber: job.attemptCount,
      timestamp: nowIso,
      errorCode: error.code,
      errorMessage: error.message,
    };

    job.lastErrorCode = error.code;
    job.lastErrorMessage = error.message;
    job.lockedAt = undefined;
    job.lockedBy = undefined;
    job.updatedAt = nowIso;
    this.leaseDeadlines.delete(jobId);

    if (isPermanent || job.attemptCount >= job.maxAttempts) {
      // Transition to DEAD_LETTER
      job.status = 'DEAD_LETTER';
      job.failedAt = nowIso;
      job.retryHistory.push(retryRecord);
      this.jobs.set(jobId, job);
      return structuredClone(job);
    }

    // Schedule bounded exponential retry: 2^(attempt-1) * 30 seconds + jitter
    const backoffSeconds = Math.min(3600, Math.pow(2, job.attemptCount - 1) * 30);
    const jitter = Math.floor(Math.random() * 5);
    const nextAvailable = new Date(now.getTime() + (backoffSeconds + jitter) * 1000).toISOString();

    retryRecord.nextAvailableAt = nextAvailable;
    job.retryHistory.push(retryRecord);
    job.status = 'RETRY_SCHEDULED';
    job.availableAt = nextAvailable;

    this.jobs.set(jobId, job);
    return structuredClone(job);
  }

  /**
   * Admin inspection of dead-letter or failed jobs
   */
  getDeadLetterJobs(tenantId: string): DurableJob[] {
    return structuredClone(Array.from(this.jobs.values()).filter(
      (j) => j.tenantId === tenantId && (j.status === 'DEAD_LETTER' || j.status === 'FAILED')
    ));
  }

  /**
   * Re-queue a dead-letter job for authorized retry
   */
  async retryDeadLetterJob(jobId: string, authorizedAdminId: string): Promise<DurableJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`JOB_NOT_FOUND: ${jobId}`);
    if (job.status !== 'DEAD_LETTER' && job.status !== 'FAILED') {
      throw new Error(`INVALID_JOB_STATE: Only DEAD_LETTER or FAILED jobs can be re-queued, current: ${job.status}`);
    }

    const now = new Date().toISOString();
    job.status = 'PENDING';
    job.availableAt = now;
    job.maxAttempts += 3; // Grant additional bounded retry window
    job.lockedAt = undefined;
    job.lockedBy = undefined;
    job.updatedAt = now;
    this.leaseDeadlines.delete(jobId);

    this.jobs.set(jobId, job);
    return structuredClone(job);
  }

  /**
   * Cancel an enqueued or pending job
   */
  async cancelJob(jobId: string, authorizedUserId: string): Promise<DurableJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`JOB_NOT_FOUND: ${jobId}`);
    if (job.status === 'COMPLETED') {
      throw new Error('CANNOT_CANCEL_COMPLETED_JOB');
    }

    const now = new Date().toISOString();
    job.status = 'CANCELLED';
    job.lockedAt = undefined;
    job.lockedBy = undefined;
    job.updatedAt = now;
    this.leaseDeadlines.delete(jobId);

    this.jobs.set(jobId, job);
    return structuredClone(job);
  }

  /**
   * Filter jobs by tenant, client, case, status, or type
   */
  getJob(jobId: string, tenantId: string): DurableJob | undefined {
    const job = this.jobs.get(jobId);
    return job?.tenantId === tenantId ? structuredClone(job) : undefined;
  }

  queryJobs(params: {
    tenantId: string;
    clientId?: string;
    caseId?: string;
    status?: JobStatus;
    jobType?: JobType;
    limit?: number;
    offset?: number;
  }): { jobs: DurableJob[]; total: number } {
    let list = Array.from(this.jobs.values()).filter((j) => j.tenantId === params.tenantId);

    if (params.clientId) list = list.filter((j) => j.clientId === params.clientId);
    if (params.caseId) list = list.filter((j) => j.caseId === params.caseId);
    if (params.status) list = list.filter((j) => j.status === params.status);
    if (params.jobType) list = list.filter((j) => j.jobType === params.jobType);

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = list.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;

    return {
      jobs: structuredClone(list.slice(offset, offset + limit)),
      total,
    };
  }

  /**
   * Clear store for testing
   */
  clear(): void {
    this.jobs.clear();
    this.leaseDeadlines.clear();
  }
}

export const globalDurableJobQueueService = new DurableJobQueueService();
