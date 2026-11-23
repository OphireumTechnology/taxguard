/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Phase P0.2 Administrator Auth & Recovery Security Regression Suite
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  AdminRecoveryRateLimiter,
  NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE,
  hashRecoveryIdentifier,
  processAdminRecoveryRequest
} from '../server/adminRecoveryLimiter';
import { staffMfaDenial, clientMfaDenial, requiresStaffMfa } from '../server/staffMfa';
import {
  clearAdminRecoveryThrottle,
  requestAdminPasswordRecovery
} from '../supabase/auth';
import {
  CANONICAL_ADMIN_RECOVERY_URL,
  isAdminRecoveryCallback,
  parseAdminRecoveryCallback
} from '../config/authRecoveryPolicy';
import { resolveAdminRecoverySession } from '../components/auth/admin-portal/AdminPasswordResetPage';

describe('Phase P0.2 — Server-Side Recovery Abuse Protection & Security Regressions', () => {
  beforeEach(() => {
    clearAdminRecoveryThrottle();
  });

  it('enforces per-IP sliding window rate limiting with 429 and Retry-After without revealing account existence', async () => {
    let now = 1_780_000_000_000;
    const limiter = new AdminRecoveryRateLimiter({
      ipLimit: 5,
      ipWindowMs: 15 * 60 * 1000,
      accountLimit: 3,
      accountWindowMs: 15 * 60 * 1000,
      accountCooldownMs: 60_000,
      now: () => now
    });
    const dispatch = vi.fn().mockResolvedValue({ error: null });
    const securityEvents: Array<{ eventType: string; details: string; severity: string }> = [];
    const auditEvents: Array<{ action: string; details: string; metadata: Record<string, string> }> = [];

    for (let i = 1; i <= 5; i++) {
      const outcome = await processAdminRecoveryRequest(
        { email: `synthetic.admin.${i}@destria-test.invalid`, ip: '198.51.100.42' },
        {
          limiter,
          isProduction: true,
          dispatchRecovery: dispatch,
          onSecurityEvent: (e) => securityEvents.push(e),
          onAuditEvent: (e) => auditEvents.push(e),
          now: () => now
        }
      );
      expect(outcome.status).toBe(200);
      expect(outcome.body.accepted).toBe(true);
      expect(outcome.body.message).toBe(NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE);
    }

    expect(dispatch).toHaveBeenCalledTimes(5);

    // 6th request from same IP must be blocked with HTTP 429 and Retry-After
    const blocked = await processAdminRecoveryRequest(
      { email: 'synthetic.admin.6@destria-test.invalid', ip: '198.51.100.42' },
      {
        limiter,
        isProduction: true,
        dispatchRecovery: dispatch,
        onSecurityEvent: (e) => securityEvents.push(e),
        onAuditEvent: (e) => auditEvents.push(e),
        now: () => now
      }
    );

    expect(blocked.status).toBe(429);
    expect(blocked.outcome).toBe('ip_rate_limited');
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.body.code).toBe('ADMIN_RECOVERY_RATE_LIMITED');
    expect(dispatch).toHaveBeenCalledTimes(5);
    expect(securityEvents.some((e) => e.eventType === 'PASSWORD_RESET_THROTTLED')).toBe(true);
    // Ensure raw email never leaks into security/audit events
    expect(JSON.stringify(securityEvents)).not.toContain('synthetic.admin.6@destria-test.invalid');
    expect(JSON.stringify(auditEvents)).not.toContain('synthetic.admin.6@destria-test.invalid');
  });

  it('enforces per-account cooldown & window limit across rotated IPs while returning identical neutral 200 responses', async () => {
    let now = 1_780_000_000_000;
    const limiter = new AdminRecoveryRateLimiter({
      ipLimit: 10,
      accountCooldownMs: 60_000,
      accountLimit: 3,
      accountWindowMs: 15 * 60 * 1000,
      now: () => now
    });
    const dispatch = vi.fn().mockResolvedValue({ error: null });
    const securityEvents: Array<{ eventType: string; details: string }> = [];

    const targetEmail = 'synthetic.superadmin@destria-test.invalid';

    // Attempt 1 from IP 1 -> dispatched
    const first = await processAdminRecoveryRequest(
      { email: targetEmail, ip: '203.0.113.1' },
      { limiter, isProduction: true, dispatchRecovery: dispatch, onSecurityEvent: (e) => securityEvents.push(e), now: () => now }
    );
    expect(first.status).toBe(200);
    expect(first.outcome).toBe('dispatched');
    expect(dispatch).toHaveBeenCalledTimes(1);

    // Attempt 2 after 20s from DIFFERENT IP -> suppressed by per-account cooldown, still neutral 200
    now += 20_000;
    const cooled = await processAdminRecoveryRequest(
      { email: targetEmail, ip: '203.0.113.2' },
      { limiter, isProduction: true, dispatchRecovery: dispatch, onSecurityEvent: (e) => securityEvents.push(e), now: () => now }
    );
    expect(cooled.status).toBe(200);
    expect(cooled.outcome).toBe('account_throttled');
    expect(cooled.body.message).toBe(first.body.message);
    expect(dispatch).toHaveBeenCalledTimes(1);

    // Attempts 2 & 3 spaced >60s apart from rotated IPs -> dispatched
    now += 65_000;
    await processAdminRecoveryRequest(
      { email: targetEmail, ip: '203.0.113.3' },
      { limiter, isProduction: true, dispatchRecovery: dispatch, onSecurityEvent: (e) => securityEvents.push(e), now: () => now }
    );
    now += 65_000;
    await processAdminRecoveryRequest(
      { email: targetEmail, ip: '203.0.113.4' },
      { limiter, isProduction: true, dispatchRecovery: dispatch, onSecurityEvent: (e) => securityEvents.push(e), now: () => now }
    );
    expect(dispatch).toHaveBeenCalledTimes(3);

    // 4th attempt within 15 minutes from yet another rotated IP -> suppressed by account window limit, still neutral 200
    now += 65_000;
    const fourth = await processAdminRecoveryRequest(
      { email: targetEmail, ip: '203.0.113.5' },
      { limiter, isProduction: true, dispatchRecovery: dispatch, onSecurityEvent: (e) => securityEvents.push(e), now: () => now }
    );
    expect(fourth.status).toBe(200);
    expect(fourth.outcome).toBe('account_throttled');
    expect(fourth.body.message).toBe(NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE);
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(securityEvents.filter((e) => e.eventType === 'PASSWORD_RESET_THROTTLED').length).toBeGreaterThanOrEqual(2);
  });

  it('rejects untrusted redirectTo URLs, suppresses provider errors, and never leaks recovery tokens or elevates privileges', async () => {
    const limiter = new AdminRecoveryRateLimiter();
    const dispatch = vi.fn().mockRejectedValue(new Error('User not found in auth.users'));
    const securityEvents: Array<{ eventType: string; details: string }> = [];

    for (const maliciousRedirect of [
      'https://evil.example/admin/reset-password',
      'https://destriataxservices.com/client/reset-password',
      'javascript:alert(1)',
      'http://127.0.0.1:3000/admin/reset-password'
    ]) {
      const rejected = await processAdminRecoveryRequest(
        { email: 'admin.test@destria-test.invalid', redirectTo: maliciousRedirect, ip: '198.51.100.7' },
        { limiter, isProduction: true, dispatchRecovery: dispatch, onSecurityEvent: (e) => securityEvents.push(e) }
      );
      expect(rejected.status).toBe(400);
      expect(rejected.body.code).toBe('UNAUTHORIZED_REDIRECT_URL');
    }
    expect(dispatch).not.toHaveBeenCalled();

    // Valid production request with unknown account still yields neutral 200 and canonical redirect
    const unknownOutcome = await processAdminRecoveryRequest(
      { email: 'nonexistent.user@destria-test.invalid', redirectTo: CANONICAL_ADMIN_RECOVERY_URL, ip: '198.51.100.8' },
      { limiter, isProduction: true, dispatchRecovery: dispatch, onSecurityEvent: (e) => securityEvents.push(e) }
    );
    expect(unknownOutcome.status).toBe(200);
    expect(unknownOutcome.body.message).toBe(NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE);
    expect(JSON.stringify(unknownOutcome.body)).not.toContain('User not found');
    expect(JSON.stringify(unknownOutcome.body)).not.toContain('token');
    expect(unknownOutcome.body).not.toHaveProperty('role');
    expect(unknownOutcome.body).not.toHaveProperty('session');
    expect(dispatch).toHaveBeenCalledWith('nonexistent.user@destria-test.invalid', CANONICAL_ADMIN_RECOVERY_URL);
    expect(hashRecoveryIdentifier('acct:nonexistent.user@destria-test.invalid')).toMatch(/^[a-f0-9]{16}$/);
  });

  it('routes client requestAdminPasswordRecovery through server endpoint when available and respects 429 responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        accepted: true,
        message: NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE,
        cooldownSeconds: 60,
        requestId: 'req-synthetic-1'
      })
    });
    const fallbackAuth = { resetPasswordForEmail: vi.fn() };

    const okResult = await requestAdminPasswordRecovery('synthetic.admin@destria-test.invalid', {
      redirectTo: CANONICAL_ADMIN_RECOVERY_URL,
      useServerEndpoint: true,
      fetchImpl: fetchMock as unknown as typeof fetch,
      authClient: fallbackAuth,
      now: 1_780_000_000_000
    });

    expect(okResult.success).toBe(true);
    expect(okResult.message).toBe(NEUTRAL_SERVER_ADMIN_RECOVERY_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fallbackAuth.resetPasswordForEmail).not.toHaveBeenCalled();

    clearAdminRecoveryThrottle();
    const rateLimitedFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: 'Too many recovery requests from this network. Please wait before trying again.',
        code: 'ADMIN_RECOVERY_RATE_LIMITED',
        retryAfterSeconds: 300
      })
    });

    const limitedResult = await requestAdminPasswordRecovery('synthetic.admin@destria-test.invalid', {
      redirectTo: CANONICAL_ADMIN_RECOVERY_URL,
      useServerEndpoint: true,
      fetchImpl: rateLimitedFetch as unknown as typeof fetch,
      authClient: fallbackAuth,
      now: 1_780_000_000_000
    });

    expect(limitedResult.success).toBe(false);
    expect(limitedResult.rateLimited).toBe(true);
    expect(limitedResult.cooldownSeconds).toBe(300);
    expect(fallbackAuth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('enforces mandatory MFA (AAL2) for all staff/super-admin roles and blocks reused recovery tokens', async () => {
    expect(requiresStaffMfa('super_admin')).toBe(true);
    expect(requiresStaffMfa('super_administrator')).toBe(true);
    expect(requiresStaffMfa('admin')).toBe(true);
    expect(requiresStaffMfa('client')).toBe(false);

    // Super admin without MFA enrollment -> blocked
    expect(staffMfaDenial('super_admin', { aal: 'aal1', verifiedFactorCount: 0 })).toBe(
      'STAFF_MFA_ENROLLMENT_REQUIRED'
    );
    // Super admin with enrolled factor but only AAL1 -> blocked
    expect(staffMfaDenial('super_admin', { aal: 'aal1', verifiedFactorCount: 1 })).toBe(
      'STAFF_MFA_REQUIRED'
    );
    // Super admin with verified AAL2 -> allowed
    expect(staffMfaDenial('super_admin', { aal: 'aal2', verifiedFactorCount: 1 })).toBeNull();
    // Client with enrolled MFA factor at AAL1 -> blocked (Contract C2)
    expect(clientMfaDenial('client', { aal: 'aal1', verifiedFactorCount: 1 })).toBe('CLIENT_MFA_REQUIRED');

    // Reused OTP recovery link must be rejected and never grant session
    const parsedReused = parseAdminRecoveryCallback({
      pathname: '/admin/reset-password',
      search: '?token_hash=reused_hash_123&type=recovery',
      hash: ''
    });
    expect(isAdminRecoveryCallback({
      pathname: '/admin/reset-password',
      search: '?token_hash=reused_hash_123&type=recovery',
      hash: ''
    })).toBe(true);

    const reusedResult = await resolveAdminRecoverySession(
      {
        verifyOtp: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: { message: 'Token has expired or is invalid' }
        }),
        exchangeCodeForSession: vi.fn(),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
        updateUser: vi.fn().mockResolvedValue({ error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null })
      },
      parsedReused
    );
    expect(reusedResult).toBe('expired');
  });

  it('verifies server RBAC, tenant isolation, client isolation, and audit immutability contracts', () => {
    const authServerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/server/auth.ts'), 'utf8');
    const authRoutesSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/server/routes/auth.routes.ts'), 'utf8');
    const supabaseDbSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/server/supabase-db.ts'), 'utf8');

    // Server enforces AAL2 staff MFA, RBAC, tenant isolation, client isolation, and maker-checker
    expect(authServerSrc).toContain("sessionAssuranceLevel(user) !== 'aal2'");
    expect(authServerSrc).toContain('TENANT_ISOLATION_VIOLATION');
    expect(authServerSrc).toContain('CLIENT_ISOLATION_VIOLATION');
    expect(authServerSrc).toContain('ADMIN_TAX_APPROVAL_FORBIDDEN');
    expect(authServerSrc).toContain('SESSION_EXPIRED');

    // Server recovery endpoint never touches taxguard_members or elevates roles
    expect(authRoutesSrc).toContain("'/admin-recovery-request'");
    expect(authRoutesSrc).toContain('processAdminRecoveryRequest');
    expect(authRoutesSrc).not.toMatch(/admin-recovery-request[\s\S]*taxguard_members/);

    // Durable session creation enforces staff MFA and membership status
    expect(supabaseDbSrc).toContain('staffMfaDenial(resolvedMember?.role, verified)');
    expect(supabaseDbSrc).toContain("resolvedMember.status !== 'active'");
    expect(supabaseDbSrc).toContain('STAFF_MEMBERSHIP_REQUIRED');

    // Verify core schema RLS protects taxguard_audit_log from ordinary user mutations when migrations are present
    const coreMigration = path.resolve(process.cwd(), 'supabase/migrations/20260928000000_taxguard_core_schema.sql');
    if (fs.existsSync(coreMigration)) {
      const sql = fs.readFileSync(coreMigration, 'utf8');
      expect(sql).toContain('ALTER TABLE taxguard_audit_log ENABLE ROW LEVEL SECURITY');
      expect(sql).toContain('CREATE POLICY service_role_all_audit ON taxguard_audit_log FOR ALL TO service_role');
      // Authenticated users must NOT have UPDATE or DELETE policies on taxguard_audit_log
      expect(sql).not.toMatch(/CREATE POLICY .* ON taxguard_audit_log FOR (ALL|UPDATE|DELETE) TO authenticated/i);
    }
  });

  it('tracks explicit internal delivery statuses and surfaces provider/SMTP/DNS outages as 503 without masking failures', async () => {
    const limiter = new AdminRecoveryRateLimiter({ ipLimit: 20, accountLimit: 20, accountCooldownMs: 1 });
    const auditEvents: Array<{ action: string; metadata: Record<string, string> }> = [];

    // 1. Provider accepted -> REQUEST_ACCEPTED > PROVIDER_DISPATCH_ATTEMPTED > PROVIDER_ACCEPTED > DELIVERY_UNCONFIRMED
    const okOutcome = await processAdminRecoveryRequest(
      { email: 'accepted.admin@destria-test.invalid', ip: '198.51.100.20' },
      {
        limiter,
        isProduction: true,
        dispatchRecovery: vi.fn().mockResolvedValue({ error: null }),
        onAuditEvent: (e) => auditEvents.push({ action: e.action, metadata: e.metadata })
      }
    );
    expect(okOutcome.status).toBe(200);
    expect(okOutcome.internalStatus).toBe('PROVIDER_ACCEPTED');
    expect(okOutcome.deliveryStatus).toBe('DELIVERY_UNCONFIRMED');
    expect(okOutcome.statusTrail).toEqual([
      'REQUEST_ACCEPTED',
      'PROVIDER_DISPATCH_ATTEMPTED',
      'PROVIDER_ACCEPTED',
      'DELIVERY_UNCONFIRMED'
    ]);

    // 2. Unconfigured / DNS / network outage -> HTTP 503 AUTH_PROVIDER_UNAVAILABLE (never fake 200)
    const dnsOutage = await processAdminRecoveryRequest(
      { email: 'dns.outage@destria-test.invalid', ip: '198.51.100.21' },
      {
        limiter,
        isProduction: true,
        dispatchRecovery: vi.fn().mockRejectedValue(new TypeError('fetch failed: getaddrinfo ENOTFOUND dead.supabase.co')),
        onAuditEvent: (e) => auditEvents.push({ action: e.action, metadata: e.metadata })
      }
    );
    expect(dnsOutage.status).toBe(503);
    expect(dnsOutage.body.accepted).toBe(false);
    expect(dnsOutage.body.code).toBe('AUTH_PROVIDER_UNAVAILABLE');
    expect(dnsOutage.internalStatus).toBe('AUTH_PROVIDER_UNAVAILABLE');
    expect(dnsOutage.deliveryStatus).toBe('NOT_DISPATCHED');
    expect(JSON.stringify(dnsOutage.body)).not.toContain('dead.supabase.co');

    // 3. Explicit SMTP delivery failure -> HTTP 503 with internalStatus PROVIDER_REJECTED
    const smtpFailure = await processAdminRecoveryRequest(
      { email: 'smtp.outage@destria-test.invalid', ip: '198.51.100.22' },
      {
        limiter,
        isProduction: true,
        dispatchRecovery: vi.fn().mockResolvedValue({
          error: { message: 'Error sending recovery email: SMTP connection refused', status: 500 }
        }),
        onAuditEvent: (e) => auditEvents.push({ action: e.action, metadata: e.metadata })
      }
    );
    expect(smtpFailure.status).toBe(503);
    expect(smtpFailure.body.code).toBe('AUTH_PROVIDER_UNAVAILABLE');
    expect(smtpFailure.internalStatus).toBe('PROVIDER_REJECTED');
    expect(JSON.stringify(smtpFailure.body)).not.toContain('SMTP connection refused');

    // 4. Provider rate limit (429) -> HTTP 429 RATE_LIMITED with Retry-After
    const providerLimited = await processAdminRecoveryRequest(
      { email: 'provider.limit@destria-test.invalid', ip: '198.51.100.23' },
      {
        limiter,
        isProduction: true,
        dispatchRecovery: vi.fn().mockResolvedValue({
          error: { message: 'over_email_send_rate_limit', status: 429 }
        }),
        onAuditEvent: (e) => auditEvents.push({ action: e.action, metadata: e.metadata })
      }
    );
    expect(providerLimited.status).toBe(429);
    expect(providerLimited.internalStatus).toBe('RATE_LIMITED');
    expect(providerLimited.retryAfterSeconds).toBeGreaterThan(0);

    // 5. Client requestAdminPasswordRecovery never fakes success on DNS/network outage or backend 503
    clearAdminRecoveryThrottle();
    const clientDnsFail = await requestAdminPasswordRecovery('client.outage@destria-test.invalid', {
      redirectTo: CANONICAL_ADMIN_RECOVERY_URL,
      authClient: {
        resetPasswordForEmail: vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
      }
    });
    expect(clientDnsFail.success).toBe(false);
    expect(clientDnsFail.providerUnavailable).toBe(true);
    expect(clientDnsFail.code).toBe('AUTH_PROVIDER_UNAVAILABLE');
    expect(clientDnsFail.internalStatus).toBe('AUTH_PROVIDER_UNAVAILABLE');
    expect(clientDnsFail.cooldownSeconds).toBeUndefined();

    // 6. Client propagates backend 503 AUTH_PROVIDER_UNAVAILABLE without falling back to fake confirmation
    clearAdminRecoveryThrottle();
    const fallbackSpy = { resetPasswordForEmail: vi.fn().mockResolvedValue({ data: {}, error: null }) };
    const backendOutage = await requestAdminPasswordRecovery('backend.outage@destria-test.invalid', {
      redirectTo: CANONICAL_ADMIN_RECOVERY_URL,
      useServerEndpoint: true,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({
          accepted: false,
          code: 'AUTH_PROVIDER_UNAVAILABLE',
          error: 'Recovery service unavailable.'
        })
      }) as unknown as typeof fetch,
      authClient: fallbackSpy
    });
    expect(backendOutage.success).toBe(false);
    expect(backendOutage.providerUnavailable).toBe(true);
    expect(backendOutage.internalStatus).toBe('AUTH_PROVIDER_UNAVAILABLE');
    expect(fallbackSpy.resetPasswordForEmail).not.toHaveBeenCalled();

    // 7. Production vs staging separation: protectedDestination rejects production hosts in non-production
    const protectedDestSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/supabase/protectedDestination.ts'),
      'utf8'
    );
    expect(protectedDestSrc).toContain('isProtectedIdentityDestination');
    const supabaseServerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/server/supabase.ts'),
      'utf8'
    );
    expect(supabaseServerSrc).toContain('SUPABASE_PRODUCTION_PROJECT_BLOCKED');
  });
});
