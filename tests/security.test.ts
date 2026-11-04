import { describe, it, expect } from 'vitest';
import { INITIAL_USERS } from '../src/data/mockData';
import { EnvironmentConfigService } from '../src/config/environmentConfig';

describe('Security, Roles & Tenant Isolation', () => {
  it('ensures mock users have valid roles and MFA enforced where required', () => {
    expect(INITIAL_USERS.length).toBeGreaterThan(0);
    for (const user of INITIAL_USERS) {
      expect(['active', 'disabled', 'suspended']).toContain(user.status);
      expect(user.role).toBeDefined();
      if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'senior_reviewer') {
        expect(user.mfaEnabled).toBe(true);
      }
    }
  });

  it('separates client accounts from practitioner roles', () => {
    const clients = INITIAL_USERS.filter(u => u.role === 'client');
    const practitioners = INITIAL_USERS.filter(u => ['accountant', 'senior_reviewer', 'admin', 'super_admin'].includes(u.role));

    expect(clients.length).toBeGreaterThan(0);
    expect(practitioners.length).toBeGreaterThan(0);

    for (const client of clients) {
      expect(client.name).toBeDefined();
      expect(client.email).toBeDefined();
    }
  });

  it('masks sensitive taxpayer identification numbers (TIN/SSN/EIN)', () => {
    const ssnMasked = EnvironmentConfigService.maskTIN('123-45-6789', 'ssn');
    expect(ssnMasked).toBe('***-**-6789');

    const einMasked = EnvironmentConfigService.maskTIN('12-3456789', 'ein');
    expect(einMasked).toBe('XX-XXX6789');
  });

  it('enforces demo environment constraints: blocks live filings and enforces fictional data', () => {
    const config = EnvironmentConfigService.getConfig();
    expect(config.allowLiveFilings).toBe(false);
    expect(config.fictionalDataOnly).toBe(true);
    expect(config.maskSensitiveFields).toBe(true);
    expect(config.requireHardExitGate).toBe(true);
  });
});
