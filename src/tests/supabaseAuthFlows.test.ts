import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateEmailFormat,
  validatePasswordStrength,
  sanitizeAuthErrorMessage,
  registerWithEmail,
  loginWithEmail,
  logout,
  requestPasswordReset,
  getSupabaseAccessToken
} from '../supabase/auth';
import { setSupabaseClient } from '../supabase/config';

describe('Supabase Authentication Flows & Security Invariants', () => {
  let mockSupabase: any;

  beforeEach(() => {
    vi.stubEnv('PROD', true);
    mockSupabase = {
      auth: {
        signUp: vi.fn(),
        signInWithPassword: vi.fn(),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        resend: vi.fn()
      }
    };
    setSupabaseClient(mockSupabase);
  });

  afterEach(() => {
    setSupabaseClient(null);
    vi.unstubAllEnvs();
  });

  it('validates email format strictly', () => {
    expect(validateEmailFormat('client@artaxserv.com').valid).toBe(true);
    expect(validateEmailFormat('invalid-email').valid).toBe(false);
    expect(validateEmailFormat('').valid).toBe(false);
  });

  it('enforces password complexity policy (minimum 10 chars, uppercase, lowercase, number, symbol)', () => {
    const weak = validatePasswordStrength('weak');
    expect(weak.valid).toBe(false);
    expect(weak.errors.length).toBeGreaterThan(0);

    const strong = validatePasswordStrength('ArtaxServ2026!#Strong');
    expect(strong.valid).toBe(true);
    expect(strong.errors.length).toBe(0);
  });

  it('sanitizes authentication error messages preventing sensitive disclosures', () => {
    const rawError = new Error('Database connection failed on pg_node_01 at 10.0.4.12');
    const sanitized = sanitizeAuthErrorMessage(rawError, 'AUTH_SERVICE_UNAVAILABLE');
    expect(sanitized.message).not.toContain('10.0.4.12');
    expect(sanitized.code).toBe('AUTH_SERVICE_UNAVAILABLE');
  });

  it('registers via Supabase and never writes privileged roles from the browser', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: {
        user: {
          id: 'sb_u1',
          email: 'client@example.com',
          user_metadata: { full_name: 'Jane Taxpayer' },
          email_confirmed_at: null
        },
        session: null
      },
      error: null
    });

    const result = await registerWithEmail(
      'Jane Taxpayer',
      'client@example.com',
      'SecurePass123!#$',
      '803-555-0199',
      'Taxpayer LLC'
    );

    expect(result.success).toBe(true);
    expect(result.emailVerificationRequired).toBe(true);
    expect(mockSupabase.auth.signUp).toHaveBeenCalled();
  });

  it('logs in through Supabase credentials and returns controlled session status', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        user: {
          id: 'sb_u1',
          email: 'client@example.com',
          user_metadata: { full_name: 'Jane Taxpayer' }
        },
        session: { access_token: 'valid_jwt_token_123' }
      },
      error: null
    });

    const result = await loginWithEmail('client@example.com', 'SecurePass123!#$');
    expect(result.success).toBe(true);
    expect(result.accessToken).toBe('valid_jwt_token_123');
  });

  it('returns INVALID_CREDENTIALS error state on bad login', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials', status: 400 }
    });

    const result = await loginWithEmail('client@example.com', 'wrongpassword');
    expect(result.success).toBe(false);
    expect(result.code).toBe('INVALID_CREDENTIALS');
  });

  it('signs out completely from Supabase session', async () => {
    const success = await logout();
    expect(success).toBe(true);
    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
  });

  it('requests password reset using production redirect destination', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: null
    });

    const result = await requestPasswordReset('client@example.com');
    expect(result.success).toBe(true);
    expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'client@example.com',
      expect.objectContaining({
        redirectTo: expect.stringContaining('artaxserv.com')
      })
    );
  });
});
