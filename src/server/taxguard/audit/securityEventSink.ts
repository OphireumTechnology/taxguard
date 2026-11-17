/**
 * Durable sink for legacy security events (proposal 048). db.logSecurityEvent keeps its bounded
 * in-memory list for the local console; when a durable store is configured, each event is also
 * handed to this sink, which records a redacted row through taxguard_security_event_record.
 *
 * Guarantees:
 * - never blocks or fails the request that produced the event: record() only enqueues;
 * - bounded memory: at most MAX_QUEUE pending events, the excess is dropped and counted;
 * - no free text leaves the process: the legacy `details` message and the network address are
 *   never sent. The address becomes an HMAC fingerprint under a configured secret; identifiers are
 *   sent only when they match a strict pattern (the database re-validates everything);
 * - events with no security category (operational notices) are not recorded durably.
 */
import { createHmac } from 'node:crypto';
import type { PracticeRpcClient } from '../practice/practiceStore';

export type SecurityCategory = 'AUTH' | 'SESSION' | 'MFA' | 'MEMBERSHIP' | 'PRIVILEGE' | 'ACCESS' | 'ABUSE' | 'ADMIN' | 'AI' | 'INTEGRITY' | 'MALWARE';
export interface LegacySecurityEvent {
  eventType: string; ipAddress?: string; userId?: string; resourceType?: string; authorizationResult?: 'allowed' | 'denied'; requestId?: string;
  details?: string; severity?: 'info' | 'warning' | 'critical';
}

/** Legacy event types and their durable category. Anything not listed stays in memory only. */
export const SECURITY_EVENT_CATEGORIES: Readonly<Record<string, SecurityCategory>> = Object.freeze({
  AUTH_FAILURE_TELEMETRY: 'AUTH', BRUTE_FORCE_LOCKOUT_TRIGGERED: 'AUTH', LOGIN_ATTEMPT_DURING_LOCKOUT: 'AUTH', DISABLED_USER_LOGIN_ATTEMPT: 'AUTH',
  PASSWORD_RESET_THROTTLED: 'AUTH', SUPER_ADMIN_BOOTSTRAP_REJECTED: 'ADMIN',
  DISABLED_USER_SESSION_BLOCKED: 'SESSION', EXPIRED_SIGNED_URL_ACCESS_ATTEMPT: 'SESSION', SESSION_AUTHORIZATION_DENIED: 'SESSION',
  STAFF_MFA_REQUIRED: 'MFA', MFA_VERIFICATION_UNAVAILABLE: 'MFA',
  MEMBERSHIP_DENIED: 'MEMBERSHIP',
  RBAC_ACCESS_DENIED: 'ACCESS', CLIENT_RESOURCE_ACCESS_DENIED: 'ACCESS', CROSS_TENANT_ACCESS_ATTEMPT: 'ACCESS', CLIENT_ISOLATION_VIOLATION_ATTEMPT: 'ACCESS',
  ACCOUNTANT_SCOPE_RESTRICTION: 'ACCESS', RECRUITER_TAX_ACCESS_ATTEMPT: 'ACCESS', UNAUTHORIZED_INVOICE_PAYMENT_ATTEMPT: 'ACCESS',
  SUSPICIOUS_ACCESS_ANOMALY: 'ABUSE', STRIPE_WEBHOOK_SIGNATURE_MISMATCH: 'ABUSE', SCANNER_CALLBACK_REJECTED: 'ABUSE',
  MAKER_CHECKER_JOURNAL_SELF_APPROVAL_BLOCKED: 'INTEGRITY', MAKER_CHECKER_SELF_APPROVAL_ATTEMPT: 'INTEGRITY', MAKER_CHECKER_SELF_APPROVAL_VIOLATION: 'INTEGRITY',
  MAKER_CHECKER_VIOLATION_ATTEMPT: 'INTEGRITY',
  MALWARE_SIGNATURE_DETECTED: 'MALWARE',
});

const ID = /^[A-Za-z0-9_-]{1,128}$/;
const SHORT = /^[A-Za-z0-9_./:-]{1,96}$/;
export const MAX_QUEUE = 200;
export interface SecurityEventSinkStats { recorded: number; suppressed: number; rejected: number; failed: number; dropped: number; skipped: number; pending: number }

export class SecurityEventSink {
  private queue: Array<Record<string, unknown>> = [];
  private draining = false;
  private readonly counts = { recorded: 0, suppressed: 0, rejected: 0, failed: 0, dropped: 0, skipped: 0 };
  constructor(private readonly client: () => PracticeRpcClient, private readonly tenant: string, private readonly fingerprintSecret: string) {
    if (!ID.test(tenant)) throw new Error('SECURITY_EVENT_TENANT_INVALID');
    if (fingerprintSecret.length < 32) throw new Error('SECURITY_EVENT_SECRET_TOO_SHORT');
  }

  /** The RPC arguments for an event, or null when it is not a durable security event. Exposed for tests. */
  toRecord(event: LegacySecurityEvent): Record<string, unknown> | null {
    const category = SECURITY_EVENT_CATEGORIES[event?.eventType];
    if (!category) return null;
    const address = typeof event.ipAddress === 'string' && event.ipAddress && event.ipAddress !== 'unknown' ? event.ipAddress : null;
    const detail: Record<string, string> = {};
    if (typeof event.resourceType === 'string' && SHORT.test(event.resourceType)) detail.resourceType = event.resourceType;
    if (event.authorizationResult === 'allowed' || event.authorizationResult === 'denied') detail.authorizationResult = event.authorizationResult;
    if (typeof event.requestId === 'string' && SHORT.test(event.requestId)) detail.requestId = event.requestId;
    return {
      p_tenant: this.tenant, p_category: category, p_event: event.eventType,
      p_severity: ['info', 'warning', 'critical'].includes(event.severity as string) ? event.severity : 'info',
      p_actor: typeof event.userId === 'string' && ID.test(event.userId) ? event.userId : null,
      p_fingerprint: address ? createHmac('sha256', this.fingerprintSecret).update(this.tenant + '|' + address).digest('hex').slice(0, 32) : null,
      p_detail: detail,
    };
  }

  /** Enqueues an event; never throws and never waits for the database. */
  record(event: LegacySecurityEvent): void {
    try {
      const args = this.toRecord(event);
      if (!args) { this.counts.skipped++; return; }
      if (this.queue.length >= MAX_QUEUE) { this.counts.dropped++; return; }
      this.queue.push(args);
      if (!this.draining) { this.draining = true; setImmediate(() => { void this.drain(); }); }
    } catch { this.counts.failed++; }
  }

  /** Resolves when the queue is empty (tests and graceful shutdown). */
  async flush(): Promise<void> { while (this.queue.length || this.draining) await new Promise(r => setTimeout(r, 5)); }

  stats(): SecurityEventSinkStats { return { ...this.counts, pending: this.queue.length }; }

  private async drain() {
    try {
      while (this.queue.length) {
        const args = this.queue.shift()!;
        try {
          const response = await this.client().rpc('taxguard_security_event_record', args);
          const result = response?.error ? null : response?.data?.result;
          if (result === 'RECORDED') this.counts.recorded++;
          else if (result === 'SUPPRESSED') this.counts.suppressed++;
          else if (result === 'REJECTED') this.counts.rejected++;
          else this.counts.failed++;
        } catch { this.counts.failed++; }
      }
    } finally { this.draining = false; }
  }
}

let installed: SecurityEventSink | null = null;
/** The process-wide sink used by db.logSecurityEvent (null: memory only). */
export function securityEventSink(): SecurityEventSink | null { return installed; }
export function installSecurityEventSink(sink: SecurityEventSink | null) { installed = sink; }

/**
 * Installs the durable sink when a durable store is configured and a fingerprint secret of at least
 * 32 characters is set. Returns a status code only (never configuration values).
 */
export function configureDurableSecurityEvents(env: NodeJS.ProcessEnv, durableConfigured: boolean, client: () => PracticeRpcClient):
  'DURABLE' | 'MEMORY_ONLY_NOT_CONFIGURED' | 'MEMORY_ONLY_SECRET_MISSING' | 'MEMORY_ONLY_TENANT_INVALID' {
  if (!durableConfigured) { installed = null; return 'MEMORY_ONLY_NOT_CONFIGURED'; }
  const secret = (env.TAXGUARD_SECURITY_EVENT_FINGERPRINT_SECRET || '').trim();
  if (secret.length < 32) { installed = null; return 'MEMORY_ONLY_SECRET_MISSING'; }
  const tenant = (env.TAXGUARD_TENANT_ID || '').trim();
  if (!ID.test(tenant)) { installed = null; return 'MEMORY_ONLY_TENANT_INVALID'; }
  installed = new SecurityEventSink(client, tenant, secret);
  return 'DURABLE';
}
