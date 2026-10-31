/**
 * Worker side of the durable job queue (proposal 20261019240000): claim, complete and fail over the service RPCs.
 * The lease token returned by claim fences complete and fail, so a worker whose lease expired and was taken over
 * cannot overwrite the new claimant's result. No worker process is commissioned; this is the adapter one would use.
 */
import type { PracticeRpcClient } from '../practice/practiceStore';

export class JobWorkerError extends Error {
  constructor(readonly code: string) { super(code); }
}

export interface ClaimedJob { id: string; tenantId: string; jobType: string; payload: Record<string, unknown>; attemptCount: number; leaseToken: string; [k: string]: unknown }

export class DurableJobWorker {
  constructor(private readonly client: PracticeRpcClient, private readonly tenantId: string, private readonly workerId: string) {}

  private async call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    const r = await this.client.rpc(name, { p_tenant: this.tenantId, ...args });
    if (r?.error) {
      const m = r.error.message;
      throw new JobWorkerError(r.error.code === 'P0001' && typeof m === 'string' && /^[A-Z_]{3,64}$/.test(m) ? m : 'JOB_STORE_UNAVAILABLE');
    }
    return r?.data as T;
  }

  claim(leaseSeconds = 300): Promise<ClaimedJob | null> {
    return this.call('taxguard_job_claim', { p_worker: this.workerId, p_lease_seconds: leaseSeconds });
  }
  complete(job: Pick<ClaimedJob, 'id' | 'leaseToken'>) {
    return this.call<Record<string, unknown>>('taxguard_job_complete', { p_job: job.id, p_worker: this.workerId, p_lease_token: job.leaseToken });
  }
  fail(job: Pick<ClaimedJob, 'id' | 'leaseToken'>, error: { code: string; message: string; permanent?: boolean }) {
    return this.call<Record<string, unknown>>('taxguard_job_fail', { p_job: job.id, p_worker: this.workerId, p_lease_token: job.leaseToken,
      p_error_code: error.code, p_error_message: error.message, p_permanent: error.permanent ?? false });
  }
}
