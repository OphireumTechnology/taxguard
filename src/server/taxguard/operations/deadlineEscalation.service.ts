/**
 * TaxGuard Deadlines & Escalation Engine Service
 * Authoritative deadline governance: statutory, provider, client-commitment, and internal.
 * Automated escalation triggers without fabricating external events.
 */

import { randomUUID } from 'node:crypto';
import {
  PracticeDeadline,
  DeadlineCategory,
  DeadlineAuthority,
  DeadlineStatus
} from './types';

export class DeadlineEscalationService {
  private deadlines = new Map<string, PracticeDeadline>();

  /**
   * Register a new deadline with authoritative provenance
   */
  async createDeadline(params: {
    tenantId: string;
    clientId?: string;
    caseId?: string;
    taxYear?: number;
    category: DeadlineCategory;
    title: string;
    dueDate: string;
    authorityType: DeadlineAuthority;
    provenance?: Record<string, unknown>;
  }): Promise<PracticeDeadline> {
    const id = `dl_${randomUUID()}`;
    const now = new Date().toISOString();

    const deadline: PracticeDeadline = {
      id,
      tenantId: params.tenantId,
      clientId: params.clientId,
      caseId: params.caseId,
      taxYear: params.taxYear,
      category: params.category,
      title: params.title,
      dueDate: params.dueDate,
      authorityType: params.authorityType,
      status: 'PENDING',
      escalationLevel: 0,
      provenance: params.provenance || {},
      createdAt: now,
      updatedAt: now,
    };

    // Calculate initial escalation level
    this.evaluateSingleDeadline(deadline, new Date());
    this.deadlines.set(id, deadline);
    return deadline;
  }

  /**
   * Evaluate escalation level for a single deadline
   */
  private evaluateSingleDeadline(deadline: PracticeDeadline, now: Date): boolean {
    if (deadline.status === 'MET' || deadline.status === 'WAIVED') return false;

    const dueTime = new Date(deadline.dueDate).getTime();
    const diffHours = (dueTime - now.getTime()) / (1000 * 60 * 60);

    let newLevel = 0;
    let newStatus: DeadlineStatus = 'PENDING';

    if (diffHours < 0) {
      // Overdue
      newStatus = 'OVERDUE';
      if (Math.abs(diffHours) > 168 || deadline.authorityType === 'STATUTORY') {
        newLevel = 4; // Critical
      } else {
        newLevel = 3; // Overdue
      }
    } else if (diffHours <= 48) {
      newLevel = 2; // Due Soon (<= 48h)
    } else if (diffHours <= 168) {
      newLevel = 1; // Approaching (<= 7 days)
    } else {
      newLevel = 0;
    }

    const changed = deadline.escalationLevel !== newLevel || deadline.status !== newStatus;
    deadline.escalationLevel = newLevel;
    deadline.status = newStatus;
    if (changed) {
      deadline.lastEscalatedAt = now.toISOString();
      deadline.updatedAt = now.toISOString();
    }
    return changed;
  }

  /**
   * Run escalation sweep across all pending deadlines for a tenant
   */
  runEscalationSweep(tenantId: string): {
    evaluatedCount: number;
    escalatedCount: number;
    overdueCount: number;
  } {
    const now = new Date();
    let evaluatedCount = 0;
    let escalatedCount = 0;
    let overdueCount = 0;

    for (const deadline of this.deadlines.values()) {
      if (deadline.tenantId === tenantId && deadline.status !== 'MET' && deadline.status !== 'WAIVED') {
        evaluatedCount++;
        const changed = this.evaluateSingleDeadline(deadline, now);
        if (changed && deadline.escalationLevel > 0) {
          escalatedCount++;
        }
        if ((deadline.status as string) === 'OVERDUE') {
          overdueCount++;
        }
      }
    }

    return { evaluatedCount, escalatedCount, overdueCount };
  }

  /**
   * Mark a deadline as MET
   */
  async markMet(deadlineId: string): Promise<PracticeDeadline> {
    const deadline = this.deadlines.get(deadlineId);
    if (!deadline) throw new Error(`DEADLINE_NOT_FOUND: ${deadlineId}`);

    deadline.status = 'MET';
    deadline.escalationLevel = 0;
    deadline.updatedAt = new Date().toISOString();
    this.deadlines.set(deadlineId, deadline);
    return deadline;
  }

  /**
   * Mark a deadline as WAIVED
   */
  async markWaived(deadlineId: string, reason: string): Promise<PracticeDeadline> {
    const deadline = this.deadlines.get(deadlineId);
    if (!deadline) throw new Error(`DEADLINE_NOT_FOUND: ${deadlineId}`);

    deadline.status = 'WAIVED';
    deadline.escalationLevel = 0;
    deadline.provenance = { ...deadline.provenance, waiverReason: reason, waivedAt: new Date().toISOString() };
    deadline.updatedAt = new Date().toISOString();
    this.deadlines.set(deadlineId, deadline);
    return deadline;
  }

  /**
   * Query deadlines
   */
  queryDeadlines(params: {
    tenantId: string;
    clientId?: string;
    caseId?: string;
    category?: DeadlineCategory;
    status?: DeadlineStatus;
    minEscalationLevel?: number;
  }): PracticeDeadline[] {
    let list = Array.from(this.deadlines.values()).filter((d) => d.tenantId === params.tenantId);

    if (params.clientId) list = list.filter((d) => d.clientId === params.clientId);
    if (params.caseId) list = list.filter((d) => d.caseId === params.caseId);
    if (params.category) list = list.filter((d) => d.category === params.category);
    if (params.status) list = list.filter((d) => d.status === params.status);
    if (params.minEscalationLevel !== undefined) {
      list = list.filter((d) => d.escalationLevel >= params.minEscalationLevel!);
    }

    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  }

  clear(): void {
    this.deadlines.clear();
  }
}

export const globalDeadlineEscalationService = new DeadlineEscalationService();
