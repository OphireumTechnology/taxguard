
import type { PracticeTask } from "./types";
export class PracticeTaskService {
  private tasks: PracticeTask[] = [];
  queryTasks(filter: any): { tasks: PracticeTask[] } { return { tasks: this.tasks }; }
  async createTask(task: any): Promise<PracticeTask> {
    const t: PracticeTask = { taskId: "task-" + Date.now(), version: 1, status: "OPEN", ...task };
    this.tasks.push(t);
    return t;
  }
  async updateStatus(taskId: string, status: string, version: number): Promise<any> { return { taskId, status, version: version + 1 }; }
  async reassignTask(taskId: string, assignedTo: string): Promise<any> { return { taskId, assignedTo }; }
}
export const globalPracticeTaskService = new PracticeTaskService();
