
export class StaffAssignmentService {
  async assignStaff(payload: any): Promise<any> { return { assignmentId: "asg-" + Date.now(), ...payload }; }
  async getClientAssignments(clientId: string): Promise<any> { return { assignments: [] }; }
  async getStaffWorkload(staffId?: string): Promise<any> { return { workload: [] }; }
}
export const globalStaffAssignmentService = new StaffAssignmentService();
