/**
 * TaxGuard Practice Task Engine & Dependency Resolution Service
 * Enforces task dependencies (e.g., document request unresolved -> reconciliation blocked),
 * prevents UI bypass, tracks staff assignment, and provides status gates.
 */

import { randomUUID } from 'node:crypto';
import { PracticeTask, TaskPriority, TaskStatus } from './types';

export class PracticeTaskService {
  private tasks = new Map<string, PracticeTask>();

  /**
   * Create a new practice task
   */
  async createTask(params: {
    tenantId: string;
    clientId?: string;
    engagementId?: string;
    taxYear?: number;
    caseId?: string;
    stage?: number;
    taskType: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    assignedUserId?: string;
    assignedRole?: string;
    createdBy: string;
    dueDate?: string;
    dependencies?: string[];
    relatedResource?: PracticeTask['relatedResource'];
    metadata?: Record<string, unknown>;
  }): Promise<PracticeTask> {
    const id = `task_${randomUUID()}`;
    const now = new Date().toISOString();

    const dependencies = params.dependencies || [];
    let initialStatus: TaskStatus = 'OPEN';

    // If initial dependencies are not all completed, mark as BLOCKED
    if (dependencies.length > 0) {
      const hasUnresolvedDeps = dependencies.some((depId) => {
        const dep = this.tasks.get(depId);
        return !dep || dep.status !== 'COMPLETED';
      });
      if (hasUnresolvedDeps) {
        initialStatus = 'BLOCKED';
      }
    }

    const task: PracticeTask = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      engagementId: params.engagementId,
      taxYear: params.taxYear,
      caseId: params.caseId,
      stage: params.stage,
      taskType: params.taskType,
      title: params.title,
      description: params.description,
      priority: params.priority || 'MEDIUM',
      status: initialStatus,
      assignedUserId: params.assignedUserId,
      assignedRole: params.assignedRole,
      createdBy: params.createdBy,
      dueDate: params.dueDate,
      dependencies,
      relatedResource: params.relatedResource,
      metadata: params.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    this.tasks.set(id, task);
    return task;
  }

  /**
   * Evaluate whether a task's dependencies are satisfied
   */
  checkDependencies(task: PracticeTask): { isBlocked: boolean; unsatisfiedDepIds: string[] } {
    if (!task.dependencies || task.dependencies.length === 0) {
      return { isBlocked: false, unsatisfiedDepIds: [] };
    }

    const unsatisfied: string[] = [];
    for (const depId of task.dependencies) {
      const dep = this.tasks.get(depId);
      if (!dep || dep.status !== 'COMPLETED') {
        unsatisfied.push(depId);
      }
    }

    return {
      isBlocked: unsatisfied.length > 0,
      unsatisfiedDepIds: unsatisfied,
    };
  }

  /**
   * Authoritative task state transition
   */
  async updateStatus(
    taskId: string,
    newStatus: TaskStatus,
    actorId: string
  ): Promise<PracticeTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`TASK_NOT_FOUND: ${taskId}`);

    // If trying to complete or move into active review, check dependencies
    if (newStatus === 'COMPLETED' || newStatus === 'READY_FOR_REVIEW') {
      const { isBlocked, unsatisfiedDepIds } = this.checkDependencies(task);
      if (isBlocked) {
        throw new Error(
          `TASK_DEPENDENCY_BLOCKED: Cannot advance task while dependencies are incomplete: [${unsatisfiedDepIds.join(', ')}]`
        );
      }
    }

    const now = new Date().toISOString();
    task.status = newStatus;
    task.updatedAt = now;

    if (newStatus === 'COMPLETED') {
      task.completedAt = now;
      task.completedBy = actorId;
      // Auto-unblock any dependent tasks whose other dependencies are met
      this.recheckDownstreamDependencies(task.id);
    } else {
      task.completedAt = undefined;
      task.completedBy = undefined;
    }

    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Cascade unblock check for tasks waiting on this completed task
   */
  private recheckDownstreamDependencies(completedTaskId: string): void {
    for (const other of this.tasks.values()) {
      if (other.dependencies && other.dependencies.includes(completedTaskId)) {
        if (other.status === 'BLOCKED') {
          const { isBlocked } = this.checkDependencies(other);
          if (!isBlocked) {
            other.status = 'OPEN';
            other.updatedAt = new Date().toISOString();
            this.tasks.set(other.id, other);
          }
        }
      }
    }
  }

  /**
   * Reassign task to a different user or role
   */
  async reassignTask(
    taskId: string,
    assignedUserId: string | undefined,
    assignedRole: string | undefined,
    actorId: string
  ): Promise<PracticeTask> {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`TASK_NOT_FOUND: ${taskId}`);

    task.assignedUserId = assignedUserId;
    task.assignedRole = assignedRole;
    task.updatedAt = new Date().toISOString();
    this.tasks.set(taskId, task);
    return task;
  }

  /**
   * Query practice tasks with filtering and pagination
   */
  queryTasks(params: {
    tenantId: string;
    clientId?: string;
    caseId?: string;
    assignedUserId?: string;
    assignedRole?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    limit?: number;
    offset?: number;
  }): { tasks: PracticeTask[]; total: number } {
    let list = Array.from(this.tasks.values()).filter((t) => t.tenantId === params.tenantId);

    if (params.clientId) list = list.filter((t) => t.clientId === params.clientId);
    if (params.caseId) list = list.filter((t) => t.caseId === params.caseId);
    if (params.assignedUserId) list = list.filter((t) => t.assignedUserId === params.assignedUserId);
    if (params.assignedRole) list = list.filter((t) => t.assignedRole === params.assignedRole);
    if (params.status) list = list.filter((t) => t.status === params.status);
    if (params.priority) list = list.filter((t) => t.priority === params.priority);

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const total = list.length;
    const offset = params.offset ?? 0;
    const limit = params.limit ?? 50;

    return {
      tasks: list.slice(offset, offset + limit),
      total,
    };
  }

  getTask(taskId: string): PracticeTask | undefined {
    return this.tasks.get(taskId);
  }

  clear(): void {
    this.tasks.clear();
  }
}

export const globalPracticeTaskService = new PracticeTaskService();
