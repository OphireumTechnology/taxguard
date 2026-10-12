import { describe, expect, it } from 'vitest';
import { accountStatusMessage, securityEventLabel } from '../components/auth/StaffAccountSecurityPage';
import { resolveCanonicalPageRoute } from '../config/canonicalRouting';

describe('staff account security page', () => {
  it('labels events for people and marks administrator actions', () => {
    expect(securityEventLabel({ action: 'SESSIONS_OTHER_REVOKED_BY_OWNER', byAdministrator: false })).toBe('You signed out other sessions');
    expect(securityEventLabel({ action: 'STAFF_MEMBERSHIP_SUSPENDED', byAdministrator: true })).toBe('Staff membership suspended (by an administrator)');
  });
  it('explains suspension, re-enrolment and fresh sign-in states without exposing internals', () => {
    expect(accountStatusMessage('STAFF_MFA_REENROLLMENT_REQUIRED')).toMatch(/re-enrolled/);
    expect(accountStatusMessage('SESSION_AUTHORITY_DENIED')).toMatch(/not active/);
    expect(accountStatusMessage('ANYTHING_ELSE')).toBeNull();
  });
  it('is routed at /staff/account-security', () => {
    expect(resolveCanonicalPageRoute('/staff/account-security')).toBe('staff_account_security');
  });
});
