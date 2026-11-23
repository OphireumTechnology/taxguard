import { describe, expect, it } from 'vitest';
import { isAdminRecoveryCallback } from '../components/auth/admin-portal/AdminPasswordResetPage';
import { sanitizeAndValidateRecoveryUrl } from '../config/authRecoveryPolicy';

describe('administrator password recovery routing', () => {
  it('recognizes the dedicated administrator reset route', () => {
    expect(isAdminRecoveryCallback({ pathname: '/admin/reset-password', hash: '' })).toBe(true);
  });
  it('recognizes Supabase recovery callback fragments on the production root', () => {
    expect(isAdminRecoveryCallback({ pathname: '/', hash: '#access_token=example&type=recovery' })).toBe(true);
  });
  it('does not treat arbitrary access tokens or ordinary sign-ins as password recovery', () => {
    expect(isAdminRecoveryCallback({ pathname: '/', hash: '#access_token=example&type=signup' })).toBe(false);
    expect(isAdminRecoveryCallback({ pathname: '/', hash: '#access_token=example' })).toBe(false);
    expect(isAdminRecoveryCallback({ pathname: '/admin/login', hash: '' })).toBe(false);
  });
  it('allows only the approved production administrator recovery endpoint', () => {
    expect(sanitizeAndValidateRecoveryUrl('https://destriataxservices.com/admin/reset-password'))
      .toBe('https://destriataxservices.com/admin/reset-password');
    expect(() => sanitizeAndValidateRecoveryUrl('https://evil.example/admin/reset-password')).toThrow();
    expect(() => sanitizeAndValidateRecoveryUrl('http://destriataxservices.com/admin/reset-password')).toThrow();
  });
});
