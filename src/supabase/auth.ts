import { isSupabaseConfigured, supabase } from './config';

export type AuthLifecycleState =
  | 'UNAUTHENTICATED'
  | 'AUTHENTICATED'
  | 'INITIALIZING'
  | 'MFA_REQUIRED'
  | 'EMAIL_VERIFICATION_REQUIRED';

export type RegistrationResultState =
  | 'IDLE'
  | 'SUBMITTING'
  | 'ACCOUNT_CREATED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'ESTABLISHING_SESSION'
  | 'INITIALIZING_CLIENT'
  | 'INITIALIZING_CASE'
  | 'READY';

export type ControlledAuthErrorCode =
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'CLIENT_INITIALIZATION_FAILED'
  | 'CASE_INITIALIZATION_FAILED'
  | 'INVALID_CREDENTIALS'
  | 'MFA_REQUIRED'
  | 'EMAIL_NOT_VERIFIED'
  | 'GENERIC_ERROR';

export function sanitizeAuthErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Authentication service error.';
}

export function validateRegistrationInput(input: any): { valid: boolean; error?: string } {
  if (!input?.email || !input.email.includes('@')) {
    return { valid: false, error: 'A valid email address is required.' };
  }
  if (!input?.password || input.password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  return { valid: true };
}

export async function loginWithEmail(email: string, password: string) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  return supabase.auth.signInWithPassword({ email, password });
}

export async function registerWithEmail(email: string, password: string, metadata?: any) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  return supabase.auth.signUp({
    email,
    password,
    options: { data: metadata }
  });
}

export async function logout(): Promise<void> {
  if (isSupabaseConfigured()) {
    await supabase.auth.signOut().catch(() => {});
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const { data } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  return data?.session?.access_token || null;
}

export async function resendVerificationEmail(email: string) {
  if (!isSupabaseConfigured()) return null;
  return supabase.auth.resend({ type: 'signup', email });
}

export async function requestPasswordReset(email: string) {
  if (!isSupabaseConfigured()) return null;
  return supabase.auth.resetPasswordForEmail(email);
}

export async function supabaseMfaStatus(_token?: string) {
  return { mfaEnabled: false };
}

export async function verifySupabaseMfa(_factorId: string, _code: string) {
  return { success: true };
}
