/**
 * Outcome of a staff sign-in the server refused with STAFF_MFA_ENROLLMENT_REQUIRED.
 * Staff self-enrolment runs only where the development identity configuration enables it; production
 * builds never do. Where it cannot run, the provider session is not kept and the member is told to
 * contact an administrator instead of being shown a setup panel that cannot complete.
 */
export const STAFF_ENROLLMENT_UNAVAILABLE_MESSAGE =
  'This staff account has no authenticator enrolled, and authenticator setup is not available in this environment. Contact your administrator.';

export function staffEnrollmentOutcome(enrollmentAvailable: boolean):
  { keepProviderSession: boolean; result: { success: false; mfaEnrollmentRequired?: true; error: string } } {
  return enrollmentAvailable
    ? { keepProviderSession: true, result: { success: false, mfaEnrollmentRequired: true, error: 'Set up an authenticator to continue.' } }
    : { keepProviderSession: false, result: { success: false, error: STAFF_ENROLLMENT_UNAVAILABLE_MESSAGE } };
}
