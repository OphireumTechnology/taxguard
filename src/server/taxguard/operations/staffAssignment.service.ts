class StaffAssignmentService {
  getClientAssignments(_tenantId?: string, _clientId?: string): any[] {
    return [];
  }

  assignStaff(..._args: any[]): any {
    throw Object.assign(new Error('DURABLE_STAFF_ASSIGNMENT_STORE_REQUIRED'), {
      code: 'DURABLE_STAFF_ASSIGNMENT_STORE_REQUIRED',
      status: 503,
    });
  }

  getStaffWorkload(_tenantId?: string, _staffUserId?: string, _role?: string): any {
    return {
      assignedClients: 0,
      activeCases: 0,
      openTasks: 0,
      staff: [],
    };
  }
}

export const globalStaffAssignmentService = new StaffAssignmentService();
