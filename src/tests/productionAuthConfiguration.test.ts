import { expect, it } from 'vitest';
import { resolveApiBaseUrl } from '../config/apiEndpoint';
import { passwordResetSettings } from '../firebase/passwordResetPolicy';
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
it.each(['http://api.artaxserv.com', 'https://user:password@api.artaxserv.com', 'https://api.artaxserv.com/api', 'https://x.github.io', 'https://api.artaxserv.com/?token=secret'])('rejects unsafe API origin %s', url => {
  expect(() => resolveApiBaseUrl(url, true)).toThrow();
});
it('uses Firebase hosted reset without an arbitrary continuation by default', () => {
  expect(passwordResetSettings()).toBeUndefined();
});
it('supports the canonical explicitly authorized production login continuation', () => {
  expect(passwordResetSettings('https://artaxserv.com/#/client/login')).toEqual({ url: 'https://artaxserv.com/#/client/login', handleCodeInApp: false });
});
it.each(['https://evil.example/#/client/login', 'http://artaxserv.com/#/client/login', 'https://artaxserv.com/stage_one_onboard', 'https://artaxserv.com/#/login'])('rejects wrong continuation %s', url => {
  expect(() => passwordResetSettings(url)).toThrow();
});

it('supports the Cloud Functions Express URL prefix', () => {
  expect(resolveApiBaseUrl('https://us-central1-taxguard2026.cloudfunctions.net/taxguardApi/', true)).toBe('https://us-central1-taxguard2026.cloudfunctions.net/taxguardApi');
});
it.each(['https://artaxserv.com', 'https://www.artaxserv.com', 'https://x.github.io'])('rejects static production host %s even with same-origin opt-in', origin => {
  expect(() => resolveApiBaseUrl(origin, true)).toThrow();
  expect(() => resolveApiBaseUrl('', true, true, origin)).toThrow();
});
it('requires a known origin for same-origin mode', () => {
  expect(() => resolveApiBaseUrl('', true, true)).toThrow();
});
it.each(['https://x.cloudfunctions.net/a/b', 'https://x.cloudfunctions.net/a%2fb', 'https://x.cloudfunctions.net/a?key=x'])('rejects unsafe function paths %s', value => {
  expect(() => resolveApiBaseUrl(value, true)).toThrow();
});
