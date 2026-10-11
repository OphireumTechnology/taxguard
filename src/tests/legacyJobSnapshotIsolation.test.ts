import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => vi.useRealTimers());
import { DurableJobQueueService } from '../server/taxguard/operations/durableJobQueue.service';
const params = () => ({ tenantId: 'synthetic_tenant', clientId: 'synthetic_client', caseId: 'synthetic_case',
  jobType: 'OCR_REQUEST' as const, payload: { nested: { value: 'synthetic' } }, idempotencyKey: 'synthetic_key' });
it('isolates enqueue inputs and outputs from job ownership and payload state', async () => {
  const queue = new DurableJobQueueService(); const input = params(); const job = await queue.enqueue(input);
  input.payload.nested.value = 'changed'; job.payload.nested.value = 'forged'; job.status = 'CLAIMED'; job.lockedBy = 'forged_worker';
  expect(queue.getJob(job.id, input.tenantId)).toMatchObject({ status: 'PENDING', payload: { nested: { value: 'synthetic' } } });
  await expect(queue.completeJob(job.id, 'forged_worker')).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
});
it('does not let claimed snapshots replace the worker identity', async () => {
  const queue = new DurableJobQueueService(); const job = await queue.enqueue(params());
  const claimed = await queue.claimNextJob('synthetic_tenant', 'original_worker'); claimed!.lockedBy = 'forged_worker';
  await expect(queue.completeJob(job.id, 'forged_worker')).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
  expect((await queue.completeJob(job.id, 'original_worker')).status).toBe('COMPLETED');
});
it('isolates get/list snapshots and keeps cross-tenant reads denied', async () => {
  const queue = new DurableJobQueueService(); const job = await queue.enqueue(params());
  queue.getJob(job.id, 'synthetic_tenant')!.tenantId = 'other';
  queue.queryJobs({ tenantId: 'synthetic_tenant' }).jobs[0].status = 'COMPLETED';
  expect(queue.getJob(job.id, 'synthetic_tenant')?.status).toBe('PENDING');
  expect(queue.getJob(job.id, 'other')).toBeUndefined();
});
it.each([{ clientId: 'different' }, { caseId: 'different' }, { jobType: 'EMAIL_SEND' }, { payload: { nested: { value: 'different' } } }])('rejects same-key changed scope/type/payload %j', async patch => {
  const queue = new DurableJobQueueService(); const job = await queue.enqueue(params());
  await expect(queue.enqueue({ ...params(), ...patch } as any)).rejects.toThrow('JOB_IDEMPOTENCY_CONFLICT');
  expect(queue.queryJobs({ tenantId: 'synthetic_tenant' }).total).toBe(1);
  expect(queue.getJob(job.id, 'synthetic_tenant')?.status).toBe('PENDING');
});
it('replays the same scoped request using an isolated snapshot', async () => {
  const queue = new DurableJobQueueService(); const job = await queue.enqueue(params()); const replay = await queue.enqueue(params());
  expect(replay.id).toBe(job.id); replay.payload.nested.value = 'changed';
  expect(queue.getJob(job.id, 'synthetic_tenant')?.payload).toEqual(params().payload);
});
it('isolates dead-letter inspection and failure return values', async () => {
  const queue = new DurableJobQueueService(); const job = await queue.enqueue(params()); await queue.claimNextJob('synthetic_tenant', 'worker');
  const failed = await queue.failJob(job.id, 'worker', { code: 'VALIDATION_SYNTHETIC', message: 'synthetic' });
  failed.status = 'COMPLETED'; queue.getDeadLetterJobs('synthetic_tenant')[0].retryHistory.length = 0;
  expect(queue.getJob(job.id, 'synthetic_tenant')).toMatchObject({ status: 'DEAD_LETTER', retryHistory: [{ attemptNumber: 1 }] });
});
it('binds cancelled request keys to the original scope while allowing an identical requeue', async () => {
  const queue = new DurableJobQueueService(); const job = await queue.enqueue(params());
  await queue.cancelJob(job.id, 'synthetic_operator');
  await expect(queue.enqueue({ ...params(), clientId: 'different' })).rejects.toThrow('JOB_IDEMPOTENCY_CONFLICT');
  const requeued = await queue.enqueue(params());
  expect(requeued.id).not.toBe(job.id); expect(requeued.status).toBe('PENDING');
  expect((await queue.enqueue(params())).id).toBe(requeued.id);
});
it.each([{ maxAttempts: 0 }, { maxAttempts: -1 }, { maxAttempts: 1.5 }, { maxAttempts: NaN }, { availableAt: 'invalid' }, { priority: NaN }])('rejects invalid scheduling %j before enqueuing', async patch => {
  const queue = new DurableJobQueueService();
  await expect(queue.enqueue({ ...params(), ...patch })).rejects.toThrow('JOB_INVALID_SCHEDULE');
  expect(queue.queryJobs({ tenantId: 'synthetic_tenant' }).total).toBe(0);
});
it.each([0, -1, NaN, Infinity])('rejects an invalid lease %j without claiming the job', async lease => {
  const queue = new DurableJobQueueService(); const job = await queue.enqueue(params());
  await expect(queue.claimNextJob('synthetic_tenant', 'worker', lease)).rejects.toThrow('JOB_INVALID_CLAIM');
  expect(queue.getJob(job.id, 'synthetic_tenant')?.status).toBe('PENDING');
});
it.each([['', 'worker'], ['synthetic_tenant', ' ']])('rejects missing tenant/worker identity %j', async (tenant, worker) => {
  const queue = new DurableJobQueueService(); await queue.enqueue(params());
  await expect(queue.claimNextJob(tenant, worker)).rejects.toThrow('JOB_INVALID_CLAIM');
  expect(queue.queryJobs({ tenantId: 'synthetic_tenant' }).jobs[0].status).toBe('PENDING');
});
it('does not let a new worker shorten or extend the originally granted lease', async () => {
  vi.useFakeTimers(); const queue = new DurableJobQueueService(); const job = await queue.enqueue(params());
  await queue.claimNextJob('synthetic_tenant', 'first_worker', 60); vi.advanceTimersByTime(2000);
  expect(await queue.claimNextJob('synthetic_tenant', 'second_worker', 1)).toBeNull();
  vi.advanceTimersByTime(58000);
  expect((await queue.claimNextJob('synthetic_tenant', 'second_worker', 300))?.id).toBe(job.id);
});
it('refuses completion/failure from an expired lease before another worker reclaims it', async () => {
  vi.useFakeTimers(); const queue = new DurableJobQueueService(); const job = await queue.enqueue(params());
  await queue.claimNextJob('synthetic_tenant', 'worker', 1); vi.advanceTimersByTime(1000);
  await expect(queue.completeJob(job.id, 'worker')).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
  await expect(queue.failJob(job.id, 'worker', { code: 'SYNTHETIC', message: 'synthetic' })).rejects.toThrow('JOB_WORKER_CLAIM_REQUIRED');
  expect(queue.getJob(job.id, 'synthetic_tenant')?.attemptCount).toBe(1);
});
it('rejects overflowed lease deadlines and unsafe attempt counters without enqueuing/claiming', async () => {
  const queue = new DurableJobQueueService();
  await expect(queue.enqueue({ ...params(), maxAttempts: Number.MAX_SAFE_INTEGER + 1 })).rejects.toThrow('JOB_INVALID_SCHEDULE');
  const job = await queue.enqueue(params());
  await expect(queue.claimNextJob('synthetic_tenant', 'worker', Number.MAX_VALUE)).rejects.toThrow('JOB_INVALID_CLAIM');
  expect(queue.getJob(job.id, 'synthetic_tenant')?.status).toBe('PENDING');
});
