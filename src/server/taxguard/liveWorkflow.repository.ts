export interface LiveWorkflowCaseRecord {
  clientId: string;
  taxYear: number;
  activeStage: number;
  stage1?: {
    status?: string;
    completedAt?: string;
  };
  stages?: Record<number, { status: string; completedAt?: string; completedBy?: string }>;
  updatedAt: string;
}

const workflowStore = new Map<string, LiveWorkflowCaseRecord>();

export class LiveWorkflowRepository {
  static async getCase(clientId: string, taxYear: number): Promise<LiveWorkflowCaseRecord | null> {
    return workflowStore.get(`${clientId}:${taxYear}`) ?? null;
  }

  static async upsertCase(record: LiveWorkflowCaseRecord): Promise<LiveWorkflowCaseRecord> {
    workflowStore.set(`${record.clientId}:${record.taxYear}`, record);
    return record;
  }
}
