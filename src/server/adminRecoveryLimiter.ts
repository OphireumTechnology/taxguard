/**
 * Server-Side Administrator Password Recovery Abuse Protection
 *
 * Enforces authoritative dual-key (per-IP + per-account) rate limiting,
 * strict redirect allowlist validation, anti-enumeration neutral responses,
 * and sanitized security/audit metadata (never logging passwords, raw emails,
 * or recovery tokens).
 *
 * Security Invariants:
 * - Unauthenticated recovery requests can NEVER assign roles, modify memberships,
 *   mint sessions, or return recovery links/tokens to the caller.
 * - Per-IP bursts return HTTP 429 with Retry-After without revealing account existence.
 * - Per-account cooldown / window limits suppress provider dispatch while returning
 *   the identical neutral HTTP 200 confirmation so attackers cannot enumerate accounts.
 * - In-process map capacity is strictly bounded; multi-instance deployments should
 *   pair this with edge/WAF limits and Supabase Auth's provider-level rate limits.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  CANONICAL_ADMIN_RECOVERY_URL,
  getAuthorizedAdminRecoveryRedirectUrl
} from '../config/authRecoveryPolicy';

export const NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE =
  'If the email address belongs to an authorized Destria Tax Services administrator account, password recovery instructions have been sent.';

export const SERVER_ADMIN_RECOVERY_COOLDOWN_MS = 60_000;
export const SERVER_ADMIN_RECOVERY_WINDOW_MS = 15 * 60 * 1000;
export const SERVER_ADMIN_RECOVERY_MAX_PER_ACCOUNT = 3;
export const SERVER_ADMIN_RECOVERY_MAX_PER_IP = 5;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashRecoveryIdentifier(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex').slice(0, 16);
}

export type AdminRecoveryLimitDecision =
  | {
      allowed: true;
      emailHash: string;
      ipHash: string;
      emailDomain: string;
      cooldownSeconds: number;
    }
  | {
      allowed: false;
      reason: 'ip_rate_limited' | 'account_cooldown' | 'account_window_limited';
      retryAfterSeconds: number;
      emailHash: string;
      ipHash: string;
      emailDomain: string;
    };

export class AdminRecoveryRateLimiter {
  private readonly ipHits = new Map<string, number[]>();
  private readonly accountHits = new Map<string, number[]>();

  constructor(
    private readonly options: {
      ipLimit?: number;
      ipWindowMs?: number;
      accountLimit?: number;
      accountWindowMs?: number;
      accountCooldownMs?: number;
      capacity?: number;
      now?: () => number;
    } = {}
  ) {}

  private get ipLimit() {
    return this.options.ipLimit ?? SERVER_ADMIN_RECOVERY_MAX_PER_IP;
  }

  private get ipWindowMs() {
    return this.options.ipWindowMs ?? SERVER_ADMIN_RECOVERY_WINDOW_MS;
  }

  private get accountLimit() {
    return this.options.accountLimit ?? SERVER_ADMIN_RECOVERY_MAX_PER_ACCOUNT;
  }

  private get accountWindowMs() {
    return this.options.accountWindowMs ?? SERVER_ADMIN_RECOVERY_WINDOW_MS;
  }

  private get accountCooldownMs() {
    return this.options.accountCooldownMs ?? SERVER_ADMIN_RECOVERY_COOLDOWN_MS;
  }

  private get capacity() {
    return this.options.capacity ?? 10_000;
  }

  private get now() {
    return this.options.now ?? (() => Date.now());
  }

  private pruneMap(store: Map<string, number[]>, windowMs: number, currentNow: number): void {
    if (store.size < this.capacity) return;
    for (const [key, timestamps] of store) {
      const live = timestamps.filter((ts) => currentNow - ts < windowMs);
      if (live.length === 0) store.delete(key);
      else store.set(key, live);
    }
    while (store.size >= this.capacity) {
      const oldestKey = store.keys().next().value;
      if (oldestKey === undefined) break;
      store.delete(oldestKey);
    }
  }

  evaluate(ip: string, normalizedEmail: string, explicitNow?: number): AdminRecoveryLimitDecision {
    const currentNow = explicitNow ?? this.now();
    const safeIp = (ip || 'unknown').trim() || 'unknown';
    const ipHash = hashRecoveryIdentifier(`ip:${safeIp}`);
    const emailHash = hashRecoveryIdentifier(`acct:${normalizedEmail}`);
    const emailDomain = normalizedEmail.split('@')[1] || 'unknown';

    // 1. Evaluate per-IP sliding window first (purely network-scoped, zero account leakage)
    const recentIp = (this.ipHits.get(ipHash) || []).filter((ts) => currentNow - ts < this.ipWindowMs);
    if (recentIp.length >= this.ipLimit) {
      this.ipHits.set(ipHash, recentIp);
      const oldestIp = recentIp[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((this.ipWindowMs - (currentNow - oldestIp)) / 1000));
      return {
        allowed: false,
        reason: 'ip_rate_limited',
        retryAfterSeconds,
        emailHash,
        ipHash,
        emailDomain
      };
    }

    // Record IP attempt once validated as within burst threshold
    this.pruneMap(this.ipHits, this.ipWindowMs, currentNow);
    this.ipHits.set(ipHash, [...recentIp, currentNow]);

    // 2. Evaluate per-account cooldown and sliding window
    const recentAccount = (this.accountHits.get(emailHash) || []).filter(
      (ts) => currentNow - ts < this.accountWindowMs
    );

    const lastAccountAttempt = recentAccount.length > 0 ? recentAccount[recentAccount.length - 1] : 0;
    if (lastAccountAttempt > 0 && currentNow - lastAccountAttempt < this.accountCooldownMs) {
      this.accountHits.set(emailHash, recentAccount);
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((this.accountCooldownMs - (currentNow - lastAccountAttempt)) / 1000)
      );
      return {
        allowed: false,
        reason: 'account_cooldown',
        retryAfterSeconds,
        emailHash,
        ipHash,
        emailDomain
      };
    }

    if (recentAccount.length >= this.accountLimit) {
      this.accountHits.set(emailHash, recentAccount);
      const oldestAccount = recentAccount[0];
      const retryAfterSeconds = Math.max(
        60,
        Math.ceil((this.accountWindowMs - (currentNow - oldestAccount)) / 1000)
      );
      return {
        allowed: false,
        reason: 'account_window_limited',
        retryAfterSeconds,
        emailHash,
        ipHash,
        emailDomain
      };
    }

    this.pruneMap(this.accountHits, this.accountWindowMs, currentNow);
    this.accountHits.set(emailHash, [...recentAccount, currentNow]);

    return {
      allowed: true,
      emailHash,
      ipHash,
      emailDomain,
      cooldownSeconds: Math.ceil(this.accountCooldownMs / 1000)
    };
  }

  reset(): void {
    this.ipHits.clear();
    this.accountHits.clear();
  }
}

export const adminRecoveryLimiter = new AdminRecoveryRateLimiter();

export interface AdminRecoveryRequestOutcome {
  status: number;
  retryAfterSeconds?: number;
  body: {
    accepted?: boolean;
    message?: string;
    cooldownSeconds?: number;
    requestId: string;
    error?: string;
    code?: string;
    retryAfterSeconds?: number;
  };
  outcome:
    | 'invalid_email'
    | 'unauthorized_redirect'
    | 'ip_rate_limited'
    | 'account_throttled'
    | 'dispatched'
    | 'provider_rate_limited'
    | 'provider_error_suppressed';
  metadata: {
    requestId: string;
    emailHash?: string;
    emailDomain?: string;
    ipHash?: string;
    redirectTarget?: string;
    timestamp: string;
  };
}

export interface AdminRecoveryHandlerDeps {
  limiter?: AdminRecoveryRateLimiter;
  dispatchRecovery: (email: string, redirectTo: string) => Promise<{ error?: { message?: string; status?: number } | null }>;
  onSecurityEvent?: (event: {
    eventType: 'PASSWORD_RESET_THROTTLED' | 'SUSPICIOUS_ACCESS_ANOMALY';
    details: string;
    severity: 'warning' | 'info';
  }) => void;
  onAuditEvent?: (event: {
    action: 'ADMIN_PASSWORD_RECOVERY_REQUESTED' | 'ADMIN_PASSWORD_RECOVERY_THROTTLED';
    details: string;
    metadata: Record<string, string>;
    severity: 'info' | 'warning';
  }) => void;
  now?: () => number;
  isProduction?: boolean;
}

/**
 * Authoritative server-side processor for POST /api/auth/admin-recovery-request.
 * Strictly validates email & redirect allowlist, enforces per-IP + per-account limits,
 * never leaks account existence, and never exposes tokens or modifies roles.
 */
export async function processAdminRecoveryRequest(
  input: { email?: unknown; redirectTo?: unknown; ip?: string },
  deps: AdminRecoveryHandlerDeps
): Promise<AdminRecoveryRequestOutcome> {
  const requestId = randomUUID();
  const now = deps.now ? deps.now() : Date.now();
  const timestamp = new Date(now).toISOString();
  const limiter = deps.limiter ?? adminRecoveryLimiter;

  if (typeof input.email !== 'string') {
    return {
      status: 400,
      body: { error: 'A valid administrator email address is required.', code: 'INVALID_EMAIL', requestId },
      outcome: 'invalid_email',
      metadata: { requestId, timestamp }
    };
  }

  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail || normalizedEmail.length > 254 || !EMAIL_PATTERN.test(normalizedEmail)) {
    return {
      status: 400,
      body: { error: 'A valid administrator email address is required.', code: 'INVALID_EMAIL', requestId },
      outcome: 'invalid_email',
      metadata: { requestId, timestamp }
    };
  }

  // Always enforce the canonical administrator recovery redirect allowlist on the server.
  // Never trust an arbitrary caller-supplied redirectTo URL.
  let redirectTarget: string;
  try {
    if (deps.isProduction) {
      if (input.redirectTo !== undefined) {
        const candidate = typeof input.redirectTo === 'string' ? input.redirectTo.trim() : '';
        if (candidate !== CANONICAL_ADMIN_RECOVERY_URL) {
          throw new Error('UNAUTHORIZED_REDIRECT_URL');
        }
      }
      redirectTarget = CANONICAL_ADMIN_RECOVERY_URL;
    } else if (input.redirectTo !== undefined) {
      if (typeof input.redirectTo !== 'string') throw new Error('UNAUTHORIZED_REDIRECT_URL');
      redirectTarget = getAuthorizedAdminRecoveryRedirectUrl(input.redirectTo);
    } else {
      redirectTarget = CANONICAL_ADMIN_RECOVERY_URL;
    }
  } catch {
    deps.onSecurityEvent?.({
      eventType: 'SUSPICIOUS_ACCESS_ANOMALY',
      details: `Rejected unauthorized admin recovery redirect target; requestId=${requestId}.`,
      severity: 'warning'
    });
    return {
      status: 400,
      body: {
        error: 'Recovery redirect destination is not authorized.',
        code: 'UNAUTHORIZED_REDIRECT_URL',
        requestId
      },
      outcome: 'unauthorized_redirect',
      metadata: { requestId, timestamp }
    };
  }

  const decision = limiter.evaluate(input.ip || 'unknown', normalizedEmail, now);

  if (decision.allowed === false) {
    const denied = decision as Extract<AdminRecoveryLimitDecision, { allowed: false }>;
    if (denied.reason === 'ip_rate_limited') {
      deps.onSecurityEvent?.({
        eventType: 'PASSWORD_RESET_THROTTLED',
        details: `Admin password recovery IP rate limit triggered; requestId=${requestId}; ipHash=${denied.ipHash}.`,
        severity: 'warning'
      });
      deps.onAuditEvent?.({
        action: 'ADMIN_PASSWORD_RECOVERY_THROTTLED',
        details: `IP rate limit enforced for admin recovery request (${requestId}).`,
        metadata: {
          requestId,
          ipHash: denied.ipHash,
          reason: denied.reason,
          redirectTarget,
          timestamp
        },
        severity: 'warning'
      });
      return {
        status: 429,
        retryAfterSeconds: denied.retryAfterSeconds,
        body: {
          error: 'Too many recovery requests from this network. Please wait before trying again.',
          code: 'ADMIN_RECOVERY_RATE_LIMITED',
          retryAfterSeconds: denied.retryAfterSeconds,
          requestId
        },
        outcome: 'ip_rate_limited',
        metadata: {
          requestId,
          emailHash: denied.emailHash,
          emailDomain: denied.emailDomain,
          ipHash: denied.ipHash,
          redirectTarget,
          timestamp
        }
      };
    }

    // Per-account cooldown or window limit: suppress provider email dispatch,
    // record abuse telemetry, and return the IDENTICAL neutral 200 response
    // so callers cannot enumerate account existence or request timing.
    deps.onSecurityEvent?.({
      eventType: 'PASSWORD_RESET_THROTTLED',
      details: `Admin password recovery account throttle (${denied.reason}); requestId=${requestId}; domain=${denied.emailDomain}; emailHash=${denied.emailHash}.`,
      severity: 'warning'
    });
    deps.onAuditEvent?.({
      action: 'ADMIN_PASSWORD_RECOVERY_THROTTLED',
      details: `Per-account throttle suppressed duplicate admin recovery dispatch (${requestId}).`,
      metadata: {
        requestId,
        emailHash: denied.emailHash,
        emailDomain: denied.emailDomain,
        ipHash: denied.ipHash,
        reason: denied.reason,
        redirectTarget,
        timestamp
      },
      severity: 'warning'
    });
    return {
      status: 200,
      body: {
        accepted: true,
        message: NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE,
        cooldownSeconds: Math.ceil(SERVER_ADMIN_RECOVERY_COOLDOWN_MS / 1000),
        requestId
      },
      outcome: 'account_throttled',
      metadata: {
        requestId,
        emailHash: denied.emailHash,
        emailDomain: denied.emailDomain,
        ipHash: denied.ipHash,
        redirectTarget,
        timestamp
      }
    };
  }

  let outcome: AdminRecoveryRequestOutcome['outcome'] = 'dispatched';
  try {
    const result = await deps.dispatchRecovery(normalizedEmail, redirectTarget);
    const err = result?.error;
    if (err) {
      const msg = (err.message || '').toLowerCase();
      if (err.status === 429 || msg.includes('rate') || msg.includes('too many')) {
        outcome = 'provider_rate_limited';
        deps.onSecurityEvent?.({
          eventType: 'PASSWORD_RESET_THROTTLED',
          details: `Identity provider rate-limited admin recovery dispatch; requestId=${requestId}; domain=${decision.emailDomain}; emailHash=${decision.emailHash}.`,
          severity: 'warning'
        });
      } else {
        outcome = 'provider_error_suppressed';
      }
    }
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    if (err?.status === 429 || msg.includes('rate') || msg.includes('too many')) {
      outcome = 'provider_rate_limited';
      deps.onSecurityEvent?.({
        eventType: 'PASSWORD_RESET_THROTTLED',
        details: `Identity provider throttled admin recovery dispatch; requestId=${requestId}; domain=${decision.emailDomain}; emailHash=${decision.emailHash}.`,
        severity: 'warning'
      });
    } else {
      outcome = 'provider_error_suppressed';
    }
  }

  deps.onAuditEvent?.({
    action: 'ADMIN_PASSWORD_RECOVERY_REQUESTED',
    details: `Administrator password recovery processed (${outcome}); requestId=${requestId}; domain=${decision.emailDomain}.`,
    metadata: {
      requestId,
      emailHash: decision.emailHash,
      emailDomain: decision.emailDomain,
      ipHash: decision.ipHash,
      redirectTarget,
      outcome,
      timestamp
    },
    severity: outcome === 'provider_rate_limited' ? 'warning' : 'info'
  });

  return {
    status: 200,
    body: {
      accepted: true,
      message: NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE,
      cooldownSeconds: decision.cooldownSeconds,
      requestId
    },
    outcome,
    metadata: {
      requestId,
      emailHash: decision.emailHash,
      emailDomain: decision.emailDomain,
      ipHash: decision.ipHash,
      redirectTarget,
      timestamp
    }
  };
}
