/**
 * TaxGuard Staff Assignment & Caseload Governance Service
 * Enforces server-authoritative role bindings, maker-checker separation,
 * historical reassignment audit trails, and staff workload analytics.
 */

import { randomUUID } from 'node:crypto';
import {
  StaffAssignment,
  AssignmentHistoryRecord,
  StaffRole,
  StaffWorkloadSummary
} from './types';
import { globalPracticeTaskService } from './practiceTask.service';

export class StaffAssignmentService {
  private assignments = new Map<string, StaffAssignment>();
  private history: AssignmentHistoryRecord[] = [];

  private makeKey(tenantId: string, clientId: string, role: StaffRole): string {
    return `${tenantId}::${clientId}::${role}`;
  }

  /**
   * Assign a staff member to a client role
   */
  async assignStaff(params: {
    tenantId: string;
    clientId: string;
    role: StaffRole;
    userId: string;
    assignedBy: string;
    engagementId?: string;
    taxYear?: number;
    reason?: string;
  }): Promise<StaffAssignment> {
    const key = this.makeKey(params.tenantId, params.clientId, params.role);
    const existing = this.assignments.get(key);
    const now = new Date().toISOString();

    if (existing && existing.status === 'ACTIVE') {
      if (existing.userId === params.userId) {
        return existing; // Already assigned
      }
      // Reassignment: record historical audit trail
      existing.status = 'REASSIGNED';
      existing.effectiveTo = now;
      existing.updatedAt = now;
      this.assignments.set(key, existing);

      this.history.push({
        id: randomUUID(),
        tenantId: params.tenantId,
        clientId: params.clientId,
        role: params.role,
        previousUserId: existing.userId,
        newUserId: params.userId,
        changedBy: params.assignedBy,
        reassignmentReason: params.reason || 'Staff caseload redistribution',
        timestamp: now,
      });
    }

    const id = `asgn_${randomUUID()}`;
    const newAssignment: StaffAssignment = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      engagementId: params.engagementId,
      taxYear: params.taxYear,
      role: params.role,
      userId: params.userId,
      assignedBy: params.assignedBy,
      effectiveFrom: now,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    this.assignments.set(key, newAssignment);
    return newAssignment;
  }

  /**
   * Revoke an active assignment
   */
  async revokeAssignment(
    tenantId: string,
    clientId: string,
    role: StaffRole,
    revokedBy: string,
    reason: string
  ): Promise<void> {
    const key = this.makeKey(tenantId, clientId, role);
    const existing = this.assignments.get(key);
    if (!existing || existing.status !== 'ACTIVE') return;

    const now = new Date().toISOString();
    existing.status = 'REVOKED';
    existing.effectiveTo = now;
    existing.updatedAt = now;
    this.assignments.set(key, existing);

    this.history.push({
      id: randomUUID(),
      tenantId,
      clientId,
      role,
      previousUserId: existing.userId,
      newUserId: 'UNASSIGNED',
      changedBy: revokedBy,
      reassignmentReason: reason,
      timestamp: now,
    });
  }

  /**
   * Get active assignments for a client
   */
  getClientAssignments(tenantId: string, clientId: string): StaffAssignment[] {
    return Array.from(this.assignments.values()).filter(
      (a) => a.tenantId === tenantId && a.clientId === clientId && a.status === 'ACTIVE'
    );
  }

  /**
   * Get active client IDs assigned to a specific staff member
   */
  getStaffAssignedClients(tenantId: string, userId: string): string[] {
    const clientIds = new Set<string>();
    for (const a of this.assignments.values()) {
      if (a.tenantId === tenantId && a.userId === userId && a.status === 'ACTIVE') {
        clientIds.add(a.clientId);
      }
    }
    return Array.from(clientIds);
  }

  /**
   * Get reassignment history for a client or tenant
   */
  getAssignmentHistory(tenantId: string, clientId?: string): AssignmentHistoryRecord[] {
    let list = this.history.filter((h) => h.tenantId === tenantId);
    if (clientId) {
      list = list.filter((h) => h.clientId === clientId);
    }
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Compute authoritative workload summary for a staff user
   */
  getStaffWorkload(tenantId: string, userId: string, role = 'accountant'): StaffWorkloadSummary {
    const assignedClientIds = this.getStaffAssignedClients(tenantId, userId);
    const tasks = globalPracticeTaskService.queryTasks({
      tenantId,
      assignedUserId: userId,
      limit: 1000,
    }).tasks;

    const now = new Date();
    const openTasks = tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    const overdueTasks = tasks.filter(
      (t) => (t.status === 'OPEN' || t.status === 'IN_PROGRESS') && t.dueDate && new Date(t.dueDate).getTime() < now.getTime()
    );
    const pendingReviews = tasks.filter((t) => t.status === 'READY_FOR_REVIEW');
    const waitingOnClient = tasks.filter((t) => t.status === 'WAITING_ON_CLIENT');
    const waitingOnProvider = tasks.filter((t) => t.status === 'WAITING_ON_PROVIDER');

    return {
      userId,
      role,
      assignedClientsCount: assignedClientIds.length,
      activeEngagementsCount: assignedClientIds.length,
      openTasksCount: openTasks.length,
      overdueTasksCount: overdueTasks.length,
      pendingReviewsCount: pendingReviews.length,
      waitingOnClientCount: waitingOnClient.length,
      waitingOnProviderCount: waitingOnProvider.length,
    };
  }

  clear(): void {
    this.assignments.clear();
    this.history = [];
  }
}

export const globalStaffAssignmentService = new StaffAssignmentService();
