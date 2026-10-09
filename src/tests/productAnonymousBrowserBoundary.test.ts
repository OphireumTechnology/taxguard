import { expect, it } from 'vitest';
import { requireAnonymousProductMode, allowAnonymousProductRequest as allow } from '../../qa/product-browser/boundary.mjs';
it.each([undefined, '', 'true', true, 'PRODUCTION'])('defaults product automation disabled for %j', mode => {
  expect(() => requireAnonymousProductMode(mode)).toThrow('PRODUCT_ANONYMOUS_QA_DISABLED');
});
it('limits enabled preparation to a fixed loopback target without certifying acceptance', () => {
  expect(requireAnonymousProductMode('SYNTHETIC_ANONYMOUS_ONLY')).toEqual({ origin: 'http://127.0.0.1:4180', releaseAuthorized: false, fullProductAcceptance: 'NOT VERIFIED' });
});
it.each(['/portal/login', '/portal/dashboard', '/portal/profile', '/staff/workspace', '/assets/app.js', '/assets/app.css', '/logo.svg', '/api/auth/me'])('permits real anonymous local read %s', path => {
  expect(allow('http://127.0.0.1:4180' + path, 'GET')).toBe(true);
});
it.each([
  ['https://production.invalid/portal/login', 'GET'], ['http://127.0.0.1:4179/', 'GET'],
  ['http://127.0.0.1:4180/api/auth/login', 'POST'], ['http://127.0.0.1:4180/api/documents', 'GET'],
  ['http://127.0.0.1:4180/api/auth/me?token=synthetic', 'GET'], ['http://127.0.0.1:4180/.env', 'GET'],
  ['http://user:synthetic@127.0.0.1:4180/', 'GET'], ['invalid', 'GET'],
])('blocks external/fixture/private/write request %s %s', (url, method) => expect(allow(url, method)).toBe(false));
