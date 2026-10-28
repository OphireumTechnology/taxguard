import { expect, it } from 'vitest';
import { resolveApiBaseUrl } from '../config/apiEndpoint';
import {
  getAuthorizedRecoveryRedirectUrl,
  sanitizeAndValidateRecoveryUrl,
  CANONICAL_RECOVERY_URL
} from '../config/authRecoveryPolicy';

it('fails closed without a production backend origin', () => {
  expect(() => resolveApiBaseUrl('', true)).toThrow('not configured');
});

it('allows explicitly configured same-origin backend and local development', () => {
  expect(resolveApiBaseUrl('', true, true, 'https://app.example.com')).toBe('');
  expect(resolveApiBaseUrl('', false)).toBe('');
});

it('supports an HTTPS API origin', () => {
  expect(resolveApiBaseUrl('https://api.artaxserv.com/', true)).toBe('https://api.artaxserv.com');
});

it.each([
  'http://api.artaxserv.com',
  'https://user:password@api.artaxserv.com',
  'https://api.artaxserv.com/api',
  'https://x.github.io',
  'https://api.artaxserv.com/?token=secret'
])('rejects unsafe API origin %s', url => {
  expect(() => resolveApiBaseUrl(url, true)).toThrow();
});

it('uses canonical artaxserv.com recovery destination by default', () => {
  expect(getAuthorizedRecoveryRedirectUrl()).toBe(CANONICAL_RECOVERY_URL);
});

it('supports canonical explicitly authorized production reset destination', () => {
  expect(sanitizeAndValidateRecoveryUrl('https://artaxserv.com/#/client/reset-password')).toBe(
    'https://artaxserv.com/#/client/reset-password'
  );
});

it.each([
  'https://evil.example/#/client/login',
  'http://artaxserv.com/#/client/reset-password',
  'https://unauthorized-domain.com/reset',
  'javascript:alert(1)'
])('rejects unauthorized or insecure recovery destination %s', url => {
  expect(() => sanitizeAndValidateRecoveryUrl(url)).toThrow();
});

it.each(['https://artaxserv.com', 'https://www.artaxserv.com', 'https://x.github.io'])(
  'rejects static production host %s even with same-origin opt-in',
  origin => {
    expect(() => resolveApiBaseUrl(origin, true)).toThrow();
    expect(() => resolveApiBaseUrl('', true, true, origin)).toThrow();
  }
);

it('requires a known origin for same-origin mode', () => {
  expect(() => resolveApiBaseUrl('', true, true)).toThrow();
});

it('fails closed in production when TAXGUARD_TENANT_ID is missing', async () => {
  const { SupabaseDurableSessions } = await import('../server/supabase-db');
  const prevEnv = process.env.NODE_ENV;
  const prevTenant = process.env.TAXGUARD_TENANT_ID;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.TAXGUARD_TENANT_ID;
    expect(() => new SupabaseDurableSessions()).toThrow('PRODUCTION_TENANT_REQUIRED');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevTenant) process.env.TAXGUARD_TENANT_ID = prevTenant;
  }
});

it('allows synthetic tenantA fallback only in development when TAXGUARD_TENANT_ID is missing', async () => {
  const { SupabaseDurableSessions } = await import('../server/supabase-db');
  const prevEnv = process.env.NODE_ENV;
  const prevTenant = process.env.TAXGUARD_TENANT_ID;
  try {
    process.env.NODE_ENV = 'development';
    delete process.env.TAXGUARD_TENANT_ID;
    const sessions = new SupabaseDurableSessions();
    expect(sessions.getTenantId()).toBe('tenantA');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevTenant) process.env.TAXGUARD_TENANT_ID = prevTenant;
  }
});

it('prevents initSeedPasswords from initializing demo passwords in production', async () => {
  const { initSeedPasswords } = await import('../server/auth');
  const { db } = await import('../server/db');
  const prevEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = 'production';
    db.userPasswords.clear();
    initSeedPasswords();
    expect(db.userPasswords.size).toBe(0);
  } finally {
    process.env.NODE_ENV = prevEnv;
  }
});
