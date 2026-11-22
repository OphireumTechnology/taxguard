/**
 * Client-side audit event recorder interface for workflow modules.
 */
export interface TaxGuardAuditEventInput {
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  action: string;
  recordType?: string;
  recordId?: string;
  result?: 'success' | 'failure' | 'denied' | 'warning' | string;
  riskLevel?: 'routine' | 'low' | 'medium' | 'high' | 'critical' | string;
  details?: string;
  metadata?: Record<string, unknown>;
}

export interface TaxGuardAuditEventRecord extends TaxGuardAuditEventInput {
  id: string;
  timestamp: string;
}

const MAX_IN_MEMORY_EVENTS = 250;
const auditEvents: TaxGuardAuditEventRecord[] = [];

export const TaxGuardAuditService = {
  logEvent(input: TaxGuardAuditEventInput): TaxGuardAuditEventRecord {
    const record: TaxGuardAuditEventRecord = {
      ...input,
      id: `tg_audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    auditEvents.unshift(record);
    if (auditEvents.length > MAX_IN_MEMORY_EVENTS) {
      auditEvents.length = MAX_IN_MEMORY_EVENTS;
    }
    return record;
  },

  getEvents(): TaxGuardAuditEventRecord[] {
    return [...auditEvents];
  },

  clear(): void {
    auditEvents.length = 0;
  },
};
