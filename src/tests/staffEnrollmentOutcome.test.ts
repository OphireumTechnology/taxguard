import { describe, expect, it } from 'vitest';
import { STAFF_ENROLLMENT_UNAVAILABLE_MESSAGE, staffEnrollmentOutcome } from '../context/staffEnrollmentOutcome';

describe('staff sign-in when the server requires authenticator enrolment', () => {
  it('keeps only the provider session and opens setup where enrolment can run', () => {
    expect(staffEnrollmentOutcome(true)).toEqual({ keepProviderSession: true, result: { success: false, mfaEnrollmentRequired: true, error: 'Set up an authenticator to continue.' } });
  });
  it('signs the provider session out and explains the dead end where enrolment cannot run (production builds)', () => {
    const outcome = staffEnrollmentOutcome(false);
    expect(outcome.keepProviderSession).toBe(false);
    expect(outcome.result).toEqual({ success: false, error: STAFF_ENROLLMENT_UNAVAILABLE_MESSAGE });
    expect('mfaEnrollmentRequired' in outcome.result).toBe(false);
    expect(outcome.result.error).toMatch(/Contact your administrator/);
  });
});
