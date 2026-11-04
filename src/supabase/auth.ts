export type AuthLifecycleState = 'INITIALIZING' | 'UNAUTHENTICATED' | 'MFA_REQUIRED' | 'AUTHENTICATED' | 'OFFLINE';

export type RegistrationResultState = 'SUCCESS' | 'ALREADY_EXISTS' | 'INVALID_INPUT' | 'ERROR';

export type ControlledAuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'MFA_CODE_INVALID'
  | 'USER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

export function sanitizeAuthErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as any).message);
  }
  return 'An authentication error occurred. Please try again.';
}

export function validateRegistrationInput(data: any): { valid: boolean; error?: string } {
  if (!data?.email || !data.email.includes('@')) {
    return { valid: false, error: 'A valid email address is required.' };
  }
  if (!data?.password || data.password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long.' };
  }
  return { valid: true };
}

export async function loginWithEmail(email: string, password: string): Promise<any> {
  // Uses local server login or mock authentication
  return { success: true, session: { token: 'mock-token' }, user: { email, role: 'client' } };
}

export async function supabaseMfaStatus(userId?: string): Promise<{ enrolled: boolean; factors: any[] }> {
  return { enrolled: false, factors: [] };
}

export async function verifySupabaseMfa(factorId: string, code: string): Promise<boolean> {
  return code.length === 6;
}

export async function registerWithEmail(email: string, password: string, metadata?: any): Promise<any> {
  return { success: true, user: { email, ...metadata } };
}

export async function logout(): Promise<void> {}
export const signOutProvider = logout;

export function getSupabaseAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tg_auth_token');
  }
  return null;
}

export async function resendVerificationEmail(email: string): Promise<boolean> {
  return true;
}

export async function requestPasswordReset(email: string): Promise<boolean> {
  return true;
}
