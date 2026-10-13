/**
 * Local (non-production) server sign-in, as a pure decision function so it can be tested
 * without a browser. In a local build the browser must never fall through to Supabase: if the
 * local server cannot be reached, the user is told so instead of seeing a misleading
 * configuration or credential message.
 */
import { mapLocalLoginError, type LocalLoginFailure } from './localLoginErrors';
import { isSupabaseConfigured } from '../supabase/config';

/** Local server login is only offered by non-production builds with no Supabase configuration. */
export function isLocalServerLoginBuild(): boolean {
  return !import.meta.env.PROD && !isSupabaseConfigured();
}

export interface LocalLoginDeps<U> {
  /** Resolves true only when the server reports the local login as available. */
  checkAvailable: () => Promise<boolean>;
  login: (email: string, password: string, mfaCode?: string) => Promise<{ token?: string; user?: U; mfaRequired?: boolean }>;
}

export type LocalLoginOutcome<U> =
  | { kind: 'success'; token: string; user: U }
  | { kind: 'mfa_required'; result: { success: false; mfaRequired: true; error: string } }
  | { kind: 'failed'; result: LocalLoginFailure };

export const LOCAL_SERVER_UNREACHABLE =
  'The local TaxGuard sign-in server could not be reached, so nothing was sent. Check that the server is running, then try again.';

export async function attemptLocalServerLogin<U>(deps: LocalLoginDeps<U>, email: string, password: string, mfaCode?: string): Promise<LocalLoginOutcome<U>> {
  const available = await deps.checkAvailable().catch(() => false);
  if (!available) return { kind: 'failed', result: { success: false, error: LOCAL_SERVER_UNREACHABLE } };
  let res: { token?: string; user?: U; mfaRequired?: boolean };
  try {
    res = await deps.login(email, password, mfaCode || undefined);
  } catch (err: any) {
    return { kind: 'failed', result: mapLocalLoginError(err) };
  }
  if (res?.token && res.user) return { kind: 'success', token: res.token, user: res.user };
  if (res?.mfaRequired) {
    return { kind: 'mfa_required', result: { success: false, mfaRequired: true, error: 'Enter the 6-digit code from your authenticator app.' } };
  }
  return { kind: 'failed', result: { success: false, error: 'The server returned an unexpected sign-in response. Nothing was established; please try again.' } };
}

export async function checkLocalLoginAvailable(fetchImpl: typeof fetch = fetch): Promise<boolean> {
  const response = await fetchImpl('/api/auth/local-login-status', { cache: 'no-store' });
  if (!response.ok) return false;
  const status = await response.json().catch(() => null);
  return status?.localLoginAvailable === true;
}
