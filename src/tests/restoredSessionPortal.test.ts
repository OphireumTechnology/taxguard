import { describe, expect, it } from 'vitest';
import { restoredSessionPortal } from '../context/AppContext';

// A provider session restored on a staff page carries staff intent, so it can never self-register a client
// (provider suite 15 covers the browser flows). Client and public pages keep client self-registration.
describe('portal intent for restored provider sessions', () => {
  it.each(['/staff', '/staff/', '/staff/login', '/staff/workspace', '/staff/account-security', '/STAFF/Login'])('treats %s as a staff page', path => {
    expect(restoredSessionPortal(path)).toBe('staff');
  });
  it.each(['/', '', '/portal', '/portal/login', '/portal/dashboard', '/staffing', '/staff-portal-info', '/careers', '/#/staff'])('does not treat %s as a staff page', path => {
    expect(restoredSessionPortal(path)).toBeUndefined();
  });
});
