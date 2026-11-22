/**
 * Opt-in local login diagnostics (non-production only).
 *
 * Enabled with TAXGUARD_LOCAL_AUTH_DIAGNOSTICS=true. On a refused local login it prints one
 * line to the server console naming the reason category, so an operator can tell an account
 * lookup failure from a password mismatch or a lockout.
 *
 * It never prints or returns the password, the hash, the e-mail address, a token or a TOTP
 * secret, never changes the HTTP response (which stays deliberately uniform) and never
 * changes an authentication decision.
 */
import { verifyPassword } from './auth';

export function localAuthDiagnosticsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== 'production' && env.TAXGUARD_LOCAL_AUTH_DIAGNOSTICS === 'true';
}

export interface PasswordFailureHints {
  /** Submitted password contains characters outside printable ASCII. */
  nonAscii: boolean;
  /** Submitted password starts or ends with whitespace (autofill / paste). */
  surroundingWhitespace: boolean;
  /** The stored hash matches after trimming surrounding whitespace. */
  matchesWhenTrimmed: boolean;
  /** The stored hash matches the NFC or NFKC Unicode form of the submitted password. */
  matchesUnicodeNormalized: boolean;
}

export type LocalLoginDiagnosis =
  | { reason: 'account_not_found' }
  | { reason: 'no_password_configured' }
  | { reason: 'password_mismatch'; hints: PasswordFailureHints };

/** Classifies a refused login. Called only after the normal check has already refused it. */
export function diagnoseRefusedLogin(user: unknown, storedHash: string | undefined, password: string): LocalLoginDiagnosis {
  if (!user) return { reason: 'account_not_found' };
  if (!storedHash) return { reason: 'no_password_configured' };
  const variants = (p: string) => [p.normalize('NFC'), p.normalize('NFKC')].filter(v => v !== p);
  return {
    reason: 'password_mismatch',
    hints: {
      nonAscii: /[^\x20-\x7e]/.test(password),
      surroundingWhitespace: password !== password.trim(),
      matchesWhenTrimmed: password !== password.trim() && verifyPassword(password.trim(), storedHash),
      matchesUnicodeNormalized: variants(password).some(v => verifyPassword(v, storedHash)),
    },
  };
}

export function logLocalAuthDiagnostic(entry: Record<string, unknown>, log: (line: string) => void = line => console.info(line)): void {
  if (!localAuthDiagnosticsEnabled()) return;
  log(`[auth-diagnostic] ${JSON.stringify(entry)}`);
}
