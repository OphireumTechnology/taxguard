class PracticeTaskService {
  private tasks = new Map<string, any>();

  queryTasks(filter?: {
    tenantId?: string;
    clientId?: string;
    assigneeId?: string;
    status?: string;
    limit?: number;
    offset?: number;
    [key: string]: any;
  }): { tasks: any[]; total: number } {
    const all = Array.from(this.tasks.values()).filter((task) => {
      if (filter?.tenantId && task.tenantId !== filter.tenantId) return false;
      if (filter?.clientId && task.clientId !== filter.clientId) return false;
      if (filter?.assigneeId && task.assigneeId !== filter.assigneeId) return false;
      if (filter?.status && task.status !== filter.status) return false;
      return true;
    });
    const offset = filter?.offset ?? 0;
    const limit = filter?.limit ?? 50;
    return {
      tasks: all.slice(offset, offset + limit),
      total: all.length,
    };
  }

  createTask(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_TASK_STORE_REQUIRED'), {
      code: 'DURABLE_TASK_STORE_REQUIRED',
      status: 503,
    });
  }

  updateStatus(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_TASK_STORE_REQUIRED'), {
      code: 'DURABLE_TASK_STORE_REQUIRED',
      status: 503,
    });
  }

  reassignTask(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_TASK_STORE_REQUIRED'), {
      code: 'DURABLE_TASK_STORE_REQUIRED',
      status: 503,
    });
  }
}

export const globalPracticeTaskService = new PracticeTaskService();
