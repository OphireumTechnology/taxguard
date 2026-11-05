export type AuthLifecycleState = 'INITIALIZING' | 'UNAUTHENTICATED' | 'MFA_REQUIRED' | 'AUTHENTICATED' | 'OFFLINE';

export type RegistrationResultState =
  | 'IDLE'
  | 'READY'
  | 'SUBMITTING'
  | 'ACCOUNT_CREATED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'ESTABLISHING_SESSION'
  | 'INITIALIZING_CLIENT'
  | 'INITIALIZING_CASE'
  | 'FAILED'
  | 'SUCCESS'
  | 'ALREADY_EXISTS'
  | 'INVALID_INPUT'
  | 'ERROR';

export type ControlledAuthErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'MFA_CODE_INVALID'
  | 'USER_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'VALIDATION_FAILED'
  | 'EMAIL_VERIFICATION_REQUIRED'
  | 'CLIENT_INITIALIZATION_FAILED'
  | 'CASE_INITIALIZATION_FAILED'
  | 'REGISTRATION_FAILED'
  | 'SESSION_ESTABLISHMENT_FAILED'
  | 'UNKNOWN';

export function sanitizeAuthErrorMessage(
  error: unknown,
  fallbackCode: ControlledAuthErrorCode = 'UNKNOWN'
): { code: ControlledAuthErrorCode; message: string } {
  let message = 'An authentication error occurred. Please try again.';
  let code = fallbackCode;

  if (typeof error === 'string') {
    message = error;
  } else if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as any).message === 'string') {
      message = (error as any).message;
    }
    if ('code' in error && typeof (error as any).code === 'string') {
      code = (error as any).code as ControlledAuthErrorCode;
    }
  }

  return { code, message };
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

export async function loginWithEmail(
  email: string,
  password: string,
  ..._rest: any[]
): Promise<{
  success: boolean;
  accessToken?: string;
  emailVerificationRequired?: boolean;
  code?: ControlledAuthErrorCode;
  error?: string;
  user?: any;
}> {
  return {
    success: true,
    accessToken: 'mock-sb-access-token-' + Date.now(),
    user: { email, role: 'client' }
  };
}

export async function supabaseMfaStatus(
  _userId?: string
): Promise<{ enrolled: boolean; factors: any[]; needsChallenge?: boolean }> {
  return { enrolled: false, factors: [], needsChallenge: false };
}

export async function verifySupabaseMfa(
  _codeOrFactor: string,
  _code?: string
): Promise<{ success: boolean; accessToken?: string; error?: string }> {
  return {
    success: true,
    accessToken: 'mock-sb-verified-token-' + Date.now()
  };
}

export async function registerWithEmail(
  name?: string,
  email?: string,
  password?: string,
  phone?: string,
  company?: string,
  ..._rest: any[]
): Promise<{
  success: boolean;
  accessToken?: string;
  emailVerificationRequired?: boolean;
  duplicateRegistration?: boolean;
  code?: ControlledAuthErrorCode;
  error?: string;
}> {
  return {
    success: true,
    accessToken: 'mock-sb-access-token-' + Date.now()
  };
}

export async function logout(): Promise<void> {}
export const signOutProvider = logout;

export function getSupabaseAccessToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('tg_auth_token');
  }
  return null;
}

export async function resendVerificationEmail(
  email: string
): Promise<{ success: boolean; message: string; error?: string }> {
  return { success: true, message: `Verification link dispatched to ${email}.` };
}

export async function requestPasswordReset(email: string): Promise<boolean> {
  return true;
}
