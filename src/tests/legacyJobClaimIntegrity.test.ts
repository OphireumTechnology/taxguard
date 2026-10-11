import { afterEach, describe, expect, it, vi } from 'vitest';
import { DurableJobQueueService } from '../server/taxguard/operations/durableJobQueue.service';
afterEach(() => vi.useRealTimers());
const enqueue = (service: DurableJobQueueService) => service.enqueue({ tenantId: 'synthetic_tenant', jobType: 'OCR_REQUEST', payload: { synthetic: true } });
const failure = { code: 'SYNTHETIC_TIMEOUT', message: 'Synthetic timeout' };
describe('legacy job simulation owner/state integrity', () => {
  it('rejects completion/failure without a claimed job', async () => {
    const s = new DurableJobQueueService(); const job = await enqueue(s);
    await expect(s.completeJob(job.id, 'synthetic_worker')).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
    await expect(s.failJob(job.id, 'synthetic_worker', failure)).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
    expect(s.getJob(job.id, 'synthetic_tenant')?.status).toBe('PENDING');
  });
  it('refuses a different worker without changing lease/history', async () => {
    const s = new DurableJobQueueService(); const job = await enqueue(s); await s.claimNextJob('synthetic_tenant', 'worker_one');
    const before = structuredClone(s.getJob(job.id, 'synthetic_tenant'));
    await expect(s.completeJob(job.id, 'worker_two')).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
    await expect(s.failJob(job.id, 'worker_two', failure)).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
    expect(s.getJob(job.id, 'synthetic_tenant')).toEqual(before);
  });
  it('does not let an old worker settle work reclaimed by a new worker', async () => {
    vi.useFakeTimers(); const s = new DurableJobQueueService(); const job = await enqueue(s);
    await s.claimNextJob('synthetic_tenant', 'worker_one', 1); vi.advanceTimersByTime(2000);
    await s.claimNextJob('synthetic_tenant', 'worker_two', 1);
    await expect(s.failJob(job.id, 'worker_one', failure)).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
    expect((await s.completeJob(job.id, 'worker_two')).status).toBe('COMPLETED');
  });
  it.each(['COMPLETED', 'CANCELLED', 'RETRY_SCHEDULED'])('preserves terminal/unclaimed %s state', async status => {
    const s = new DurableJobQueueService(); const job = await enqueue(s); await s.claimNextJob('synthetic_tenant', 'worker');
    if (status === 'COMPLETED') await s.completeJob(job.id, 'worker');
    if (status === 'CANCELLED') await s.cancelJob(job.id, 'synthetic_user');
    if (status === 'RETRY_SCHEDULED') await s.failJob(job.id, 'worker', failure);
    await expect(s.completeJob(job.id, 'worker')).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
    await expect(s.failJob(job.id, 'worker', failure)).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
    expect(s.getJob(job.id, 'synthetic_tenant')?.status).toBe(status);
  });
});
