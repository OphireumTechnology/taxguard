import { afterEach, describe, expect, it, vi } from 'vitest';
import { CANONICAL_PRODUCTION_ORIGIN, CANONICAL_RECOVERY_URL, PRODUCTION_SITE_HOSTS, sanitizeAndValidateRecoveryUrl } from '../config/authRecoveryPolicy';
import { resolveApiBaseUrl } from '../config/apiEndpoint';
import { PRODUCTION_HOSTS } from '../server/config/stagingEnvironmentValidator';

// Production domain migration to destriataxservices.com (2026-11-22). The legacy artaxserv.com hosts remain authorized
// during the transition (owner decision to retire them); nothing else is widened.
afterEach(() => vi.unstubAllGlobals());

describe('production domain', () => {
  it('recovery links point at destriataxservices.com', () => {
    expect(CANONICAL_PRODUCTION_ORIGIN).toBe('https://destriataxservices.com');
    expect(CANONICAL_RECOVERY_URL.startsWith('https://destriataxservices.com/')).toBe(true);
    expect([...PRODUCTION_SITE_HOSTS]).toEqual(['destriataxservices.com', 'www.destriataxservices.com', 'artaxserv.com', 'www.artaxserv.com']);
  });
  it('recovery redirects accept the production hosts and refuse look-alikes, plain HTTP and credentials', () => {
    for (const host of PRODUCTION_SITE_HOSTS) expect(sanitizeAndValidateRecoveryUrl(`https://${host}/portal/reset-password`)).toBe(`https://${host}/portal/reset-password`);
    for (const bad of ['https://destriataxservices.com.evil.example/portal/login', 'https://evil-destriataxservices.com/portal/login',
      'http://destriataxservices.com/portal/login', 'https://user:pw@destriataxservices.com/portal/login', 'https://destriataxservices.com/admin'])
      expect(() => sanitizeAndValidateRecoveryUrl(bad), bad).toThrow();
  });
  it('the static production site can never be used as the API origin', () => {
    for (const host of ['destriataxservices.com', 'www.destriataxservices.com', 'artaxserv.com']) {
      expect(() => resolveApiBaseUrl(`https://${host}`, true), host).toThrow('GitHub Pages cannot host the TaxGuard API.');
      // with no explicit API origin, a production build served from the static site must refuse same-origin API calls
      expect(() => resolveApiBaseUrl('', true, true, `https://${host}`), host).toThrow();
    }
    expect(resolveApiBaseUrl('https://api.example.test', true)).toBe('https://api.example.test');
  });
  it('staging validation treats every production host as production', () => {
    expect(PRODUCTION_HOSTS).toEqual(['destriataxservices.com', 'www.destriataxservices.com', 'artaxserv.com', 'www.artaxserv.com']);
  });
});
