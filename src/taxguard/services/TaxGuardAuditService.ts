export interface TaxGuardAuditEvent {
  id?: string;
  timestamp?: string;
  tenantId?: string;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  ipAddress?: string;
  action: string;
  recordType?: string;
  recordId?: string;
  result?: string;
  riskLevel?: string;
  details?: string;
  [key: string]: any;
}

const auditEvents: TaxGuardAuditEvent[] = [];

export const TaxGuardAuditService = {
  logEvent(event: TaxGuardAuditEvent): TaxGuardAuditEvent {
    const entry: TaxGuardAuditEvent = {
      ...event,
      id: event.id || `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: event.timestamp || new Date().toISOString(),
    };
    auditEvents.unshift(entry);
    if (auditEvents.length > 500) {
      auditEvents.length = 500;
    }
    return entry;
  },

  getEvents(): TaxGuardAuditEvent[] {
    return [...auditEvents];
  },

  clear(): void {
    auditEvents.length = 0;
  },
};
