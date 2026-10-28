
export class DurableJobQueueService {
  async enqueue(job: any): Promise<any> { return { jobId: "job-" + Date.now(), ...job }; }
  async getJob(tenantId: string, jobId: string): Promise<any> { return { jobId, tenantId, status: "COMPLETED" }; }
  async queryJobs(filter: any): Promise<any> { return { jobs: [] }; }
  async retryDeadLetterJob(jobId: string): Promise<any> { return { jobId, retried: true }; }
  async cancelJob(jobId: string): Promise<any> { return { jobId, cancelled: true }; }
}
export const globalDurableJobQueueService = new DurableJobQueueService();
