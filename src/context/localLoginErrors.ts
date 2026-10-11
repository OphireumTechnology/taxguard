/**
 * Maps local (non-production) server login failures to sign-in page results, by server code.
 * Only a genuine INVALID_CREDENTIALS response is reported as a wrong e-mail or password;
 * any other failure keeps its own message so it is not mistaken for a credential problem.
 */
export interface LocalLoginFailure {
  success: false;
  mfaRequired?: boolean;
  code?: 'INVALID_CREDENTIALS';
  error: string;
  /** Server request ID (present only when local diagnostics are enabled). */
  reference?: string;
}

export function mapLocalLoginError(err: { status?: number; code?: string; message?: string; requestId?: string } | null | undefined): LocalLoginFailure {
  const mapped = mapLocalLoginErrorMessage(err);
  return err?.requestId ? { ...mapped, reference: err.requestId } : mapped;
}

function mapLocalLoginErrorMessage(err: { status?: number; code?: string; message?: string } | null | undefined): LocalLoginFailure {
  const code = err?.code;
  const status = err?.status;
  if (code === 'MFA_CODE_INVALID' || code === 'MFA_CODE_REPLAYED') {
    return { success: false, mfaRequired: true, error: err?.message || 'Invalid authenticator code.' };
  }
  if (code === 'INVALID_CREDENTIALS' || (status === 401 && !code)) {
    return { success: false, code: 'INVALID_CREDENTIALS', error: 'Invalid email or password.' };
  }
  if (status === 429 || code === 'ACCOUNT_DISABLED' || code === 'MFA_VERIFICATION_UNAVAILABLE') {
    return { success: false, error: err?.message || 'Sign-in is temporarily unavailable.' };
  }
  if (status === undefined) {
    return { success: false, error: 'The local TaxGuard server could not be reached. Check that it is running, then try again.' };
  }
  return { success: false, error: `Sign-in failed (server response ${status}${code ? `, ${code}` : ''}). This is not a password result; check the server terminal for details.` };
}
