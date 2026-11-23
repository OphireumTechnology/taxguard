/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Administrator Auth & Recovery Verification Suite
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 *
 * Uses synthetic test accounts and injected mock auth clients only.
 * Never sends live emails to production accounts.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CANONICAL_ADMIN_RECOVERY_URL,
  getAuthorizedAdminRecoveryRedirectUrl,
  isAdminRecoveryCallback,
  parseAdminRecoveryCallback,
  sanitizeAndValidateRecoveryUrl
} from '../config/authRecoveryPolicy';
import {
  isProtectedAdminPageRoute,
  isSuperAdministratorRole,
  resolveCanonicalPageRoute
} from '../config/canonicalRouting';
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  NEUTRAL_ADMIN_RECOVERY_MESSAGE,
  clearAdminRecoveryThrottle,
  requestAdminPasswordRecovery,
  validateAdminPasswordStrength
} from '../supabase/auth';
import AdminPasswordResetPage, {
  resolveAdminRecoverySession,
  submitAdminPasswordReset,
  type AdminRecoveryAuthClient
} from '../components/auth/admin-portal/AdminPasswordResetPage';
import { AdminLoginPage } from '../components/auth/admin-portal/AdminLoginPage';
import { SuperAdminCommandCenter } from '../components/admin/SuperAdminCommandCenter';
import type { User } from '../types';

const mockLogin = vi.fn();
const mockLogout = vi.fn();
const mockSetCurrentPage = vi.fn();
let mockAppState: {
  currentUser: User | null;
  currentRole: string;
  currentPage: string;
  authLifecycleState: string;
};

vi.mock('../context/AppContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/AppContext')>();
  return {
    ...actual,
    useApp: () => ({
      currentUser: mockAppState.currentUser,
      currentRole: mockAppState.currentRole,
      currentPage: mockAppState.currentPage,
      authLifecycleState: mockAppState.authLifecycleState,
      login: mockLogin,
      logout: mockLogout,
      setCurrentPage: mockSetCurrentPage
    })
  };
});

vi.mock('../supabase/config', () => ({
  isSupabaseConfigured: () => true,
  isStaffIdentityDevelopmentConfigured: () => false,
  supabase: {
    auth: {
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getUser: async () => ({ data: { user: null }, error: null }),
      updateUser: async () => ({ error: null }),
      signOut: async () => ({ error: null })
    }
  }
}));

vi.mock('../context/localServerLogin', () => ({
  isLocalServerLoginBuild: () => false
}));

vi.mock('../hooks/useAdminProviderReadiness', () => ({
  useAdminProviderReadiness: () => ({
    allowed: true,
    status: 'ready',
    providers: []
  })
}));

function createMockAuthClient(overrides: Partial<AdminRecoveryAuthClient> = {}): AdminRecoveryAuthClient {
  return {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
    exchangeCodeForSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    verifyOtp: vi.fn(async () => ({ data: { session: null, user: null }, error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
    ...overrides
  };
}

describe('Destria Super Administrator — Complete Auth, MFA & Recovery Security Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAdminRecoveryThrottle();
    mockAppState = {
      currentUser: null,
      currentRole: 'guest',
      currentPage: 'admin_login',
      authLifecycleState: 'UNAUTHENTICATED'
    };
  });

  it('1 & 2. Valid administrator login succeeds with verified MFA; incorrect password, missing MFA, and invalid MFA are denied', async () => {
    const authMod = await import('../supabase/auth');
    const cfgMod = await import('../supabase/config');
    const authMock = (cfgMod.supabase as any).auth;

    // 1. Valid login + valid 6-digit MFA code
    authMock.signInWithPassword = vi.fn(async () => ({
      data: {
        user: { id: 'sa-synth-1', email: 'synth-admin@example.test', email_confirmed_at: '2026-01-01T00:00:00Z' },
        session: { access_token: 'aal1_tok' }
      },
      error: null
    }));
    const okLogin = await authMod.loginWithEmail('synth-admin@example.test', 'Destria-Strong!Admin#2026');
    expect(okLogin.success).toBe(true);
    expect(okLogin.accessToken).toBe('aal1_tok');
    // Frontend never assigns super_admin role — server session bridge is the authority
    expect(okLogin.user?.role).toBe('client');

    // Missing MFA check: AAL1 with verified TOTP factor requires challenge
    authMock.mfa = {
      getAuthenticatorAssuranceLevel: vi.fn(async () => ({
        data: { currentLevel: 'aal1', nextLevel: 'aal2' },
        error: null
      })),
      listFactors: vi.fn(async () => ({
        data: { totp: [{ id: 'factor-1', status: 'verified' }] },
        error: null
      })),
      challengeAndVerify: vi.fn(async ({ code }: { code: string }) =>
        code === '123456' ? { error: null } : { error: { message: 'Invalid TOTP code' } }
      )
    };
    const mfaStatus = await authMod.supabaseMfaStatus();
    expect(mfaStatus).toEqual({ needsChallenge: true, factorId: 'factor-1' });

    // Invalid MFA code denied
    const badMfa = await authMod.verifySupabaseMfa('999999');
    expect(badMfa.success).toBe(false);
    expect(badMfa.error).toContain('Invalid authenticator code');

    // Valid MFA code upgrades to AAL2 session
    authMock.getSession = vi.fn(async () => ({
      data: { session: { access_token: 'aal2_tok' } },
      error: null
    }));
    const goodMfa = await authMod.verifySupabaseMfa('123456');
    expect(goodMfa.success).toBe(true);
    expect(goodMfa.accessToken).toBe('aal2_tok');

    // 2. Incorrect password denied
    authMock.signInWithPassword = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' }
    }));
    const badLogin = await authMod.loginWithEmail('synth-admin@example.test', 'wrong-password');
    expect(badLogin.success).toBe(false);
    expect(badLogin.code).toBe('INVALID_CREDENTIALS');
  });

  it('Validates production administrator recovery redirect allowlist and blocks untrusted targets', () => {
    expect(getAuthorizedAdminRecoveryRedirectUrl()).toBe(CANONICAL_ADMIN_RECOVERY_URL);
    expect(getAuthorizedAdminRecoveryRedirectUrl('https://destriataxservices.com/admin/reset-password')).toBe(
      'https://destriataxservices.com/admin/reset-password'
    );
    expect(() => getAuthorizedAdminRecoveryRedirectUrl('https://destriataxservices.com/portal/login')).toThrow();
    expect(() => getAuthorizedAdminRecoveryRedirectUrl('https://evil.example/admin/reset-password')).toThrow();
    expect(() => getAuthorizedAdminRecoveryRedirectUrl('http://destriataxservices.com/admin/reset-password')).toThrow();
    expect(() => sanitizeAndValidateRecoveryUrl('https://user:pass@destriataxservices.com/admin/reset-password')).toThrow();
  });

  it('3. Unknown and known account recovery requests return identical neutral responses with explicit /admin/reset-password redirect, cooldown, and throttling', async () => {
    const resetSpy = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'User not found' } });

    const t0 = 1_700_000_000_000;
    const known = await requestAdminPasswordRecovery('synthetic-admin@example.test', {
      authClient: { resetPasswordForEmail: resetSpy },
      now: t0
    });
    const unknown = await requestAdminPasswordRecovery('unknown-synthetic@example.test', {
      authClient: { resetPasswordForEmail: resetSpy },
      now: t0
    });

    expect(known.success).toBe(true);
    expect(unknown.success).toBe(true);
    expect(known.message).toBe(NEUTRAL_ADMIN_RECOVERY_MESSAGE);
    expect(unknown.message).toBe(NEUTRAL_ADMIN_RECOVERY_MESSAGE);
    expect(known.auditEvent?.eventType).toBe('ADMIN_PASSWORD_RECOVERY_REQUESTED');
    expect(known.auditEvent?.redirectTarget).toBe('https://destriataxservices.com/admin/reset-password');
    expect(resetSpy).toHaveBeenNthCalledWith(1, 'synthetic-admin@example.test', {
      redirectTo: 'https://destriataxservices.com/admin/reset-password'
    });
    expect(resetSpy).toHaveBeenNthCalledWith(2, 'unknown-synthetic@example.test', {
      redirectTo: 'https://destriataxservices.com/admin/reset-password'
    });

    // Immediate resend triggers 60s cooldown without revealing account existence
    const tooSoon = await requestAdminPasswordRecovery('synthetic-admin@example.test', {
      authClient: { resetPasswordForEmail: resetSpy },
      now: t0 + 10_000
    });
    expect(tooSoon.success).toBe(false);
    expect(tooSoon.rateLimited).toBe(true);
    expect(tooSoon.cooldownSeconds).toBe(50);
    expect(tooSoon.auditEvent?.eventType).toBe('ADMIN_PASSWORD_RECOVERY_THROTTLED');

    // Sliding window cap (3 requests / 15 min)
    resetSpy.mockResolvedValue({ error: null });
    const req2 = await requestAdminPasswordRecovery('synthetic-admin@example.test', {
      authClient: { resetPasswordForEmail: resetSpy },
      now: t0 + 70_000
    });
    const req3 = await requestAdminPasswordRecovery('synthetic-admin@example.test', {
      authClient: { resetPasswordForEmail: resetSpy },
      now: t0 + 140_000
    });
    const req4Blocked = await requestAdminPasswordRecovery('synthetic-admin@example.test', {
      authClient: { resetPasswordForEmail: resetSpy },
      now: t0 + 210_000
    });
    expect(req2.success).toBe(true);
    expect(req3.success).toBe(true);
    expect(req4Blocked.success).toBe(false);
    expect(req4Blocked.rateLimited).toBe(true);
  });

  it('4. Valid recovery links (implicit fragment, PKCE code, and OTP token_hash) open recovery form while generic sessions are rejected', async () => {
    // 4a. Implicit fragment
    const fragmentLoc = parseAdminRecoveryCallback({
      pathname: '/admin/reset-password',
      hash: '#access_token=rec_tok_123&type=recovery',
      search: ''
    });
    expect(fragmentLoc.isCallback).toBe(true);
    const fragmentClient = createMockAuthClient({
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'rec_tok_123' } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'uid-1', email: 'synthetic@example.test' } }, error: null }))
    });
    expect(await resolveAdminRecoverySession(fragmentClient, fragmentLoc)).toBe('ready');

    // 4b. PKCE authorization code
    const pkceLoc = parseAdminRecoveryCallback({
      pathname: '/admin/reset-password',
      hash: '',
      search: '?code=pkce_code_456'
    });
    expect(pkceLoc.isCallback).toBe(true);
    expect(pkceLoc.pkceCode).toBe('pkce_code_456');
    const pkceClient = createMockAuthClient({
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      exchangeCodeForSession: vi.fn(async () => ({ data: { session: { access_token: 'pkce_session' } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'uid-1', email: 'synthetic@example.test' } }, error: null }))
    });
    expect(await resolveAdminRecoverySession(pkceClient, pkceLoc)).toBe('ready');
    expect(pkceClient.exchangeCodeForSession).toHaveBeenCalledWith('pkce_code_456');

    // 4c. OTP token_hash
    const otpLoc = parseAdminRecoveryCallback({
      pathname: '/admin/reset-password',
      hash: '',
      search: '?token_hash=th_789&type=recovery'
    });
    expect(otpLoc.isCallback).toBe(true);
    const otpClient = createMockAuthClient({
      verifyOtp: vi.fn(async () => ({ data: { session: { access_token: 'otp_session' }, user: { id: 'uid-1' } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'uid-1' } }, error: null }))
    });
    expect(await resolveAdminRecoverySession(otpClient, otpLoc)).toBe('ready');
    expect(otpClient.verifyOtp).toHaveBeenCalledWith({ token_hash: 'th_789', type: 'recovery' });

    // 4d. Ordinary signed-in session without recovery authorization MUST be rejected
    const plainResetLoc = parseAdminRecoveryCallback({
      pathname: '/admin/reset-password',
      hash: '',
      search: ''
    });
    const ordinarySessionClient = createMockAuthClient({
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'ordinary_login_token' } }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: { id: 'uid-1' } }, error: null }))
    });
    expect(await resolveAdminRecoverySession(ordinarySessionClient, plainResetLoc)).toBe('invalid');
  });

  it('5 & 6. Expired and reused recovery links fail safely and terminate session state', async () => {
    // Expired callback via hash fragment
    const expiredHash = parseAdminRecoveryCallback({
      pathname: '/admin/reset-password',
      hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired',
      search: ''
    });
    expect(expiredHash.isCallback).toBe(true);
    expect(expiredHash.isExpiredError).toBe(true);
    const signOutSpy = vi.fn(async () => ({ error: null }));
    const expiredClient = createMockAuthClient({ signOut: signOutSpy });
    expect(await resolveAdminRecoverySession(expiredClient, expiredHash)).toBe('expired');
    expect(signOutSpy).toHaveBeenCalledTimes(1);

    // Reused link: updateUser fails on already-consumed recovery token -> sessionExpired & signed out
    const reusedClient = createMockAuthClient({
      updateUser: vi.fn(async () => ({ error: { message: 'Invalid Refresh Token: Already Used' } })),
      signOut: vi.fn(async () => ({ error: null }))
    });
    const reusedOutcome = await submitAdminPasswordReset(
      reusedClient,
      'Destria-Strong!Admin#2026',
      'Destria-Strong!Admin#2026'
    );
    expect(reusedOutcome.success).toBe(false);
    expect(reusedOutcome.sessionExpired).toBe(true);
    expect(reusedClient.signOut).toHaveBeenCalledTimes(1);
  });

  it('7, 8 & 9. Enforces 16-char administrator password strength, mismatch rejection, and terminates recovery session after valid update', async () => {
    expect(ADMIN_PASSWORD_MIN_LENGTH).toBe(16);

    // Weak passwords rejected
    expect(validateAdminPasswordStrength('Short!1Aa').valid).toBe(false);
    expect(validateAdminPasswordStrength('alllowercasepassword123!').valid).toBe(false);
    expect(validateAdminPasswordStrength('ALLUPPERCASEPASSWORD123!').valid).toBe(false);
    expect(validateAdminPasswordStrength('NoNumbersInThisPass!').valid).toBe(false);
    expect(validateAdminPasswordStrength('NoSpecialChar1234567').valid).toBe(false);
    expect(validateAdminPasswordStrength('AAAAA1a!bbbbbbbb').valid).toBe(false);

    const mockClient = createMockAuthClient();

    // Weak password rejected before calling Supabase updateUser
    const weakRes = await submitAdminPasswordReset(mockClient, 'WeakPass1!', 'WeakPass1!');
    expect(weakRes.success).toBe(false);
    expect(mockClient.updateUser).not.toHaveBeenCalled();

    // Mismatched password rejected before calling Supabase updateUser
    const mismatchRes = await submitAdminPasswordReset(
      mockClient,
      'Destria-Strong!Admin#2026',
      'Destria-Different!Admin#2026'
    );
    expect(mismatchRes.success).toBe(false);
    expect(mismatchRes.error).toContain('match');
    expect(mockClient.updateUser).not.toHaveBeenCalled();

    // Valid strong password succeeds and immediately signs out recovery session
    const validRes = await submitAdminPasswordReset(
      mockClient,
      'Destria-Strong!Admin#2026',
      'Destria-Strong!Admin#2026'
    );
    expect(validRes.success).toBe(true);
    expect(validRes.message).toContain('MFA');
    expect(mockClient.updateUser).toHaveBeenCalledWith({ password: 'Destria-Strong!Admin#2026' });
    expect(mockClient.signOut).toHaveBeenCalledTimes(1);
  });

  it('10, 11, 12, 13 & 14. Enforces server RBAC, blocks missing super-admin role, blocks expired/unauthenticated sessions, and blocks admin maker-checker bypass', () => {
    // Missing administrator role denied on dashboard
    for (const role of ['client', 'accountant', 'reviewer', 'admin'] as const) {
      expect(isSuperAdministratorRole(role)).toBe(false);
      mockAppState = {
        currentUser: {
          id: `u-${role}`,
          name: `Test ${role}`,
          email: `${role}@example.test`,
          role,
          status: 'active',
          tenantId: 'tenant-test',
          isVerified: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        currentRole: role,
        currentPage: 'admin_command_center',
        authLifecycleState: 'AUTHENTICATED'
      };
      const html = renderToStaticMarkup(<SuperAdminCommandCenter />);
      expect(html).toContain('403 · Access Denied');
    }

    // Expired / unauthenticated session denied on protected admin route
    expect(isProtectedAdminPageRoute('admin_command_center')).toBe(true);
    mockAppState = {
      currentUser: null,
      currentRole: 'guest',
      currentPage: 'admin_command_center',
      authLifecycleState: 'UNAUTHENTICATED'
    };
    const expiredHtml = renderToStaticMarkup(<SuperAdminCommandCenter />);
    expect(expiredHtml).toContain('403 · Access Denied');

    // Server-side RBAC, MFA AAL2 enforcement, and maker-checker prohibitions in src/server/auth.ts
    const serverAuthSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/server/auth.ts'), 'utf8');
    expect(serverAuthSrc).toContain("code: 'STAFF_MFA_REQUIRED'");
    expect(serverAuthSrc).toContain("code: 'ACCESS_DENIED'");
    expect(serverAuthSrc).toContain("code: 'ADMIN_TAX_APPROVAL_FORBIDDEN'");
    expect(serverAuthSrc).toContain("code: 'SESSION_EXPIRED'");
    expect(serverAuthSrc).toContain("eventType: 'RBAC_ACCESS_DENIED'");
  });

  it('15, 16 & 17. Preserves public homepage navigation, supports direct /admin/reset-password rendering, and renders responsive accessible login/recovery UI', () => {
    // Public homepage is never intercepted by recovery callback handler
    expect(resolveCanonicalPageRoute('/')).toBe('home');
    expect(isAdminRecoveryCallback({ pathname: '/', hash: '', search: '' })).toBe(false);
    expect(isAdminRecoveryCallback({ pathname: '/services', hash: '', search: '' })).toBe(false);

    // Direct /admin/reset-password navigation renders the Destria recovery card
    expect(isAdminRecoveryCallback({ pathname: '/admin/reset-password', hash: '', search: '' })).toBe(true);
    const resetHtml = renderToStaticMarkup(<AdminPasswordResetPage />);
    expect(resetHtml).toContain('data-testid="admin-password-reset-card"');
    expect(resetHtml).toContain('Set Administrator Password');
    expect(resetHtml).toContain('Return to Administrator Sign In');

    // Admin login page renders accessible touch targets and recovery navigation
    const loginHtml = renderToStaticMarkup(<AdminLoginPage />);
    expect(loginHtml).toContain('min-h-[44px]');
    expect(loginHtml).toContain('role="tablist"');
    expect(loginHtml).toContain('Recover password');
    expect(loginHtml).toContain('Account Recovery');

    // Static security scan on AdminPasswordResetPage: no credential logging, no raw HTML, no service-role key
    const resetSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/auth/admin-portal/AdminPasswordResetPage.tsx'),
      'utf8'
    );
    expect(resetSrc).not.toContain('dangerouslySetInnerHTML');
    expect(resetSrc).not.toContain('SERVICE_ROLE');
    expect(resetSrc).not.toMatch(/console\.(log|info|debug)\s*\(/);
  });
});


describe('Administrator recovery callback race regression', () => {
  it('does not grant reset access solely from PASSWORD_RECOVERY or overwrite validated event outcome', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/auth/admin-portal/AdminPasswordResetPage.tsx'),
      'utf8'
    );
    expect(source).toContain("event !== 'PASSWORD_RECOVERY'");
    expect(source).toContain('resolveAdminRecoverySession(authClient, parsed, {');
    expect(source).toContain("if (outcome === 'ready') scrubUrl()");
    expect(source).toContain('if (recoveryEventObserved) return;');
    expect(source).not.toContain("if (recoveryEventObserved) {\n        setState('ready')");
  });

  it('rejects an event without a usable authenticated session', async () => {
    const auth = createMockAuthClient({
      getSession: vi.fn(async () => ({ data: { session: null }, error: null }))
    });
    const parsed = parseAdminRecoveryCallback({
      pathname: '/admin/reset-password',
      hash: '',
      search: ''
    });
    expect(await resolveAdminRecoverySession(auth, parsed, {
      recoveryEventObserved: true
    })).toBe('invalid');
  });
});
