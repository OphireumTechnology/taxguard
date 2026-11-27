/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Administrator Password Recovery Callback
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React, { useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { supabase } from '../../../supabase/config';
import {
  ADMIN_PASSWORD_MIN_LENGTH,
  validateAdminPasswordStrength
} from '../../../supabase/auth';
import {
  isAdminRecoveryCallback,
  parseAdminRecoveryCallback,
  type ParsedAdminRecoveryCallback
} from '../../../config/authRecoveryPolicy';
import { BrandLogo } from '../../common/BrandLogo';
import { AdminPortalLoginLayout } from './AdminPortalLoginLayout';

export { isAdminRecoveryCallback, parseAdminRecoveryCallback };
export type { ParsedAdminRecoveryCallback };

const RESET_PATH = '/admin/reset-password';
const LOGIN_PATH = '/admin/login';
const RECOVERY_REQUEST_PATH = '/admin/login?mode=recovery';

export interface AdminRecoveryAuthClient {
  onAuthStateChange: (
    callback: (event: string, session: { access_token?: string } | null) => void
  ) => { data: { subscription: { unsubscribe: () => void } } };
  getSession: () => Promise<{
    data: { session: { access_token?: string } | null };
    error: unknown;
  }>;
  getUser?: () => Promise<{
    data: { user: { id?: string; email?: string } | null };
    error: unknown;
  }>;
  exchangeCodeForSession?: (code: string) => Promise<{
    data: { session: { access_token?: string } | null };
    error: unknown;
  }>;
  verifyOtp?: (params: {
    token_hash: string;
    type: 'recovery';
  }) => Promise<{
    data: { session: { access_token?: string } | null; user?: { id?: string } | null };
    error: unknown;
  }>;
  updateUser: (attributes: { password: string }) => Promise<{ error: unknown }>;
  signOut: () => Promise<unknown>;
}

export type RecoveryContextOutcome = 'ready' | 'expired' | 'invalid';

const ADMIN_RECOVERY_MARKER_KEY = 'taxguard_admin_recovery_verified';
const ADMIN_RECOVERY_MARKER_TTL_MS = 15 * 60 * 1000;

interface VerifiedRecoveryMarker {
  uid: string;
  sessionId: string;
  expiresAt: number;
}

// Decode only for session correlation; provider getUser remains the identity check.
export function recoverySessionId(token?: string): string | null {
  try {
    const parts = token?.split('.');
    if (!parts || parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.session_id === 'string' && payload.session_id.trim() ? payload.session_id : null;
  } catch {
    return null;
  }
}

function readVerifiedRecoveryMarker(now = Date.now()): VerifiedRecoveryMarker | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(ADMIN_RECOVERY_MARKER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VerifiedRecoveryMarker>;
    if (
      typeof parsed?.uid !== 'string' ||
      !parsed.uid ||
      typeof parsed.sessionId !== 'string' || !parsed.sessionId ||
      typeof parsed?.expiresAt !== 'number' ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= now
    ) {
      window.sessionStorage.removeItem(ADMIN_RECOVERY_MARKER_KEY);
      return null;
    }
    return { uid: parsed.uid, sessionId: parsed.sessionId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function writeVerifiedRecoveryMarker(uid: string | undefined, sessionId: string | null, now = Date.now()): boolean {
  if (!uid || !sessionId || typeof window === 'undefined' || !window.sessionStorage) return false;
  try {
    // Store only the non-secret user id + short expiry so refreshing /admin/reset-password
    // after URL scrubbing preserves an already-verified recovery flow without storing tokens.
    const marker: VerifiedRecoveryMarker = {
      uid,
      sessionId,
      expiresAt: now + ADMIN_RECOVERY_MARKER_TTL_MS
    };
    window.sessionStorage.setItem(ADMIN_RECOVERY_MARKER_KEY, JSON.stringify(marker));
    return true;
  } catch {
    return false;
  }
}

export function clearVerifiedRecoveryMarker(): void {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.removeItem(ADMIN_RECOVERY_MARKER_KEY);
  } catch {
    // Ignore storage errors
  }
}

/**
 * Verifies that the browser holds a genuine Supabase password recovery context
 * (implicit fragment, PKCE code, token_hash OTP, or same-tab refreshed verified recovery).
 * Rejects generic signed-in sessions so ordinary logins can never be confused with recovery authorization.
 */
export async function resolveAdminRecoverySession(
  authClient: AdminRecoveryAuthClient,
  parsed: ParsedAdminRecoveryCallback,
  options?: { recoveryEventObserved?: boolean }
): Promise<RecoveryContextOutcome> {
  if (parsed.hasExplicitError) {
    clearVerifiedRecoveryMarker();
    await authClient.signOut().catch(() => {});
    return parsed.isExpiredError ? 'expired' : 'invalid';
  }

  // 1. Direct OTP token_hash callback (?token_hash=...&type=recovery)
  if (parsed.tokenHash && typeof authClient.verifyOtp === 'function') {
    const { data, error } = await authClient.verifyOtp({
      token_hash: parsed.tokenHash,
      type: 'recovery'
    });
    if (error || (!data?.session && !data?.user)) {
      clearVerifiedRecoveryMarker();
      const msg = String((error as any)?.message || '').toLowerCase();
      return msg.includes('expired') ? 'expired' : 'invalid';
    }
    let verifiedUid = data?.user?.id;
    if (typeof authClient.getUser === 'function') {
      const userCheck = await authClient.getUser();
      if (userCheck.error || !userCheck.data?.user) {
        clearVerifiedRecoveryMarker();
        return 'invalid';
      }
      verifiedUid = userCheck.data.user.id ?? verifiedUid;
    }
    return writeVerifiedRecoveryMarker(verifiedUid, recoverySessionId(data.session?.access_token)) ? 'ready' : 'invalid';
  }

  // 2. PKCE authorization code callback (/admin/reset-password?code=...)
  if (parsed.pkceCode) {
    // Never authorize a recovery callback merely because an unrelated session exists.
    let session: { access_token?: string } | null = null;
    if (typeof authClient.exchangeCodeForSession === 'function') {
      const exchanged = await authClient.exchangeCodeForSession(parsed.pkceCode);
      if (exchanged.error) {
        clearVerifiedRecoveryMarker();
        const msg = String((exchanged.error as any)?.message || '').toLowerCase();
        return msg.includes('expired') ? 'expired' : 'invalid';
      }
      session = exchanged.data?.session ?? null;
    }
    if (!session) {
      clearVerifiedRecoveryMarker();
      return 'invalid';
    }
    let verifiedUid: string | undefined;
    if (typeof authClient.getUser === 'function') {
      const userCheck = await authClient.getUser();
      if (userCheck.error || !userCheck.data?.user) {
        clearVerifiedRecoveryMarker();
        return 'invalid';
      }
      verifiedUid = userCheck.data.user.id;
    }
    return writeVerifiedRecoveryMarker(verifiedUid, recoverySessionId(session.access_token)) ? 'ready' : 'invalid';
  }

  // 3. Implicit recovery fragment (#access_token=...&type=recovery), SDK PASSWORD_RECOVERY event,
  // or same-tab refresh after an already-verified recovery callback scrubbed URL parameters.
  const { data, error } = await authClient.getSession();
  if (error || !data?.session) {
    clearVerifiedRecoveryMarker();
    return 'invalid';
  }

  const fragmentMatches =
    Boolean(parsed.hashAccessToken) &&
    data.session.access_token === parsed.hashAccessToken;

  let verifiedUid: string | undefined;
  if (typeof authClient.getUser === 'function') {
    const userCheck = await authClient.getUser();
    if (userCheck.error || !userCheck.data?.user) {
      clearVerifiedRecoveryMarker();
      return 'invalid';
    }
    verifiedUid = userCheck.data.user.id;
  }

  const sessionId = recoverySessionId(data.session.access_token);
  if (!sessionId || !verifiedUid) { clearVerifiedRecoveryMarker(); return 'invalid'; }
  const marker = parsed.isResetPath ? readVerifiedRecoveryMarker() : null;
  const refreshedVerifiedRecovery = Boolean(
    marker && verifiedUid && marker.uid === verifiedUid && marker.sessionId === sessionId
  );

  if (!fragmentMatches && !options?.recoveryEventObserved && !refreshedVerifiedRecovery) {
    return 'invalid';
  }

  // Refreshing a verified callback must not extend its original authorization window.
  if (!refreshedVerifiedRecovery && !writeVerifiedRecoveryMarker(verifiedUid, sessionId)) return 'invalid';
  return 'ready';
}

export async function submitAdminPasswordReset(
  authClient: Pick<AdminRecoveryAuthClient, 'updateUser' | 'signOut'>,
  password: string,
  confirmPassword: string
): Promise<{ success: boolean; error?: string; message?: string; sessionExpired?: boolean }> {
  const policy = validateAdminPasswordStrength(password);
  if (!policy.valid) {
    return {
      success: false,
      error: policy.message || `Use a unique password of at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`
    };
  }

  if (password !== confirmPassword) {
    return {
      success: false,
      error: 'Password confirmation does not match.'
    };
  }

  const { error } = await authClient.updateUser({ password });
  if (error) {
    const rawMsg = String((error as any)?.message || '').toLowerCase();
    const isSamePassword =
      rawMsg.includes('same password') || rawMsg.includes('different from the old');
    if (isSamePassword) {
      return {
        success: false,
        error: 'Choose a new password that differs from your previous password.'
      };
    }
    clearVerifiedRecoveryMarker();
    await authClient.signOut().catch(() => {});
    return {
      success: false,
      sessionExpired: true,
      error:
        'Unable to update the password because this recovery session is invalid, expired, or already used. Request a fresh recovery link.'
    };
  }

  // Always terminate the recovery session so it can never be reused or mistaken for an active admin session.
  clearVerifiedRecoveryMarker();
  let terminationConfirmed = false;
  try {
    const result = await authClient.signOut();
    terminationConfirmed = Boolean(result && typeof result === 'object' && 'error' in result && result.error === null);
  } catch {
    // Password update already succeeded; do not retry the mutation or claim sign-out succeeded.
  }
  return {
    success: true,
    message: terminationConfirmed
      ? 'Administrator password updated securely. Your recovery session has been terminated. Sign in again with your new password and mandatory MFA.'
      : 'Administrator password updated. Recovery session termination could not be confirmed. Sign out before signing in again with your new password and mandatory MFA.'
  };
}

/**
 * Administrator password recovery callback (/admin/reset-password).
 * Password recovery never assigns roles, provisions memberships, or bypasses MFA.
 */
export default function AdminPasswordResetPage() {
  const fieldPrefix = useId();
  const [state, setState] = useState<
    'checking' | 'ready' | 'expired' | 'invalid' | 'saving' | 'complete'
  >('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const completedRef = useRef(false);
  const verificationRef = useRef<Promise<RecoveryContextOutcome> | null>(null);
  const submittingRef = useRef(false);
  const initialCallbackRef = useRef<ParsedAdminRecoveryCallback | null>(null);
  if (!initialCallbackRef.current && typeof window !== 'undefined') {
    initialCallbackRef.current = parseAdminRecoveryCallback(window.location);
  }

  const policy = validateAdminPasswordStrength(password);
  const passwordsMatch = password.length > 0 && password === confirm;

  // Enforce noindex, nofollow on recovery callback route
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = 'Administrator Password Recovery | DESTRIA TAX SERVICES, LLC';
    let robotsMeta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta');
      robotsMeta.name = 'robots';
      document.head.appendChild(robotsMeta);
    }
    robotsMeta.content = 'noindex, nofollow';
  }, []);

  useEffect(() => {
    let mounted = true;
    const authClient = supabase?.auth as unknown as AdminRecoveryAuthClient | undefined;
    if (!authClient) {
      setState('invalid');
      return;
    }

    // Use the callback captured on mount before history scrubbing (safe under React StrictMode).
    const parsed = initialCallbackRef.current ?? parseAdminRecoveryCallback(window.location);
    let recoveryEventObserved = false;

    const scrubUrl = () => {
      try {
        window.history.replaceState(null, '', RESET_PATH);
      } catch {
        // fallback
      }
    };

    // Keep one callback resolution across StrictMode effect replay. Never call
    // Supabase auth methods from inside its synchronous auth event callback.
    const verify = () => {
      if (!verificationRef.current) {
        verificationRef.current = Promise.resolve().then(() =>
          resolveAdminRecoverySession(authClient, parsed, { recoveryEventObserved })
        ).catch(() => {
          clearVerifiedRecoveryMarker();
          return 'invalid' as const;
        });
      }
      void verificationRef.current.then(outcome => {
        if (!mounted || completedRef.current) return;
        if (outcome === 'ready' || parsed.hasExplicitError) scrubUrl();
        setState(outcome);
      });
    };

    const { data: { subscription } } = authClient.onAuthStateChange((event) => {
      if (!mounted || completedRef.current || event !== 'PASSWORD_RECOVERY') return;
      recoveryEventObserved = true;
      // Explicit callbacks are consumed only by the initial verification.
      // Event-only callbacks may be retried after the initial lookup settles.
      if (parsed.pkceCode || parsed.tokenHash || parsed.hashAccessToken || parsed.hasExplicitError) return;
      const pending = verificationRef.current;
      if (pending) {
        void pending.then(outcome => {
          if (!mounted || completedRef.current || outcome === 'ready' || verificationRef.current !== pending) return;
          verificationRef.current = null;
          verify();
        });
      } else {
        verify();
      }
    });

    verify();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (completedRef.current || submittingRef.current || state !== 'ready') return;
    const authClient = supabase?.auth as unknown as AdminRecoveryAuthClient | undefined;
    if (!authClient) {
      setState('invalid');
      return;
    }

    setMessage('');
    if (!policy.valid) {
      setMessage(policy.message || `Use at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (!passwordsMatch) {
      setMessage('Password confirmation does not match.');
      return;
    }

    submittingRef.current = true;
    setState('saving');
    let result: Awaited<ReturnType<typeof submitAdminPasswordReset>>;
    try {
      // Recheck the recovery marker and provider identity immediately before mutation.
      // A stale ready screen is not sufficient authorization.
      const marker = readVerifiedRecoveryMarker();
      const session = await authClient.getSession();
      const user = await authClient.getUser?.();
      const latestSession = await authClient.getSession();
      const currentMarker = readVerifiedRecoveryMarker();
      if (!marker || !currentMarker || currentMarker.uid !== marker.uid ||
          currentMarker.expiresAt !== marker.expiresAt || currentMarker.sessionId !== marker.sessionId || session.error ||
          latestSession.error || recoverySessionId(session.data?.session?.access_token) !== marker.sessionId ||
          recoverySessionId(latestSession.data?.session?.access_token) !== marker.sessionId ||
          !session.data?.session?.access_token || !user || user.error ||
          user.data?.user?.id !== marker.uid) {
        clearVerifiedRecoveryMarker();
        result = { success: false, sessionExpired: true, error: 'Recovery authorization is no longer valid. Request a fresh recovery link.' };
      } else {
        result = await submitAdminPasswordReset(authClient, password, confirm);
      }
    } catch {
      clearVerifiedRecoveryMarker();
      result = { success: false, sessionExpired: true, error: 'The password update outcome could not be confirmed. Do not retry this link. Sign in or request a fresh recovery link.' };
    } finally {
      submittingRef.current = false;
    }
    setPassword('');
    setConfirm('');

    if (!result.success) {
      setMessage(result.error || 'Unable to update the password.');
      setState(result.sessionExpired ? 'invalid' : 'ready');
      return;
    }

    completedRef.current = true;
    try {
      window.history.replaceState(null, '', RESET_PATH);
    } catch {
      // fallback
    }
    setState('complete');
    setMessage(result.message || 'Administrator password updated securely.');
  }

  const strengthLabelMap: Record<typeof policy.strength, { label: string; color: string; width: string }> = {
    weak: { label: 'Weak', color: 'bg-rose-500', width: 'w-1/4' },
    fair: { label: 'Needs Policy Requirements', color: 'bg-amber-400', width: 'w-2/4' },
    strong: { label: 'Strong (Policy Compliant)', color: 'bg-[#00C2D1]', width: 'w-3/4' },
    very_strong: { label: 'Very Strong (Executive Grade)', color: 'bg-emerald-400', width: 'w-full' }
  };
  const strengthMeta = strengthLabelMap[policy.strength];

  return (
    <AdminPortalLoginLayout>
      <section
        data-testid="admin-password-reset-card"
        aria-live="polite"
        className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-[#0B1F36]/90 p-6 sm:p-7 shadow-[0_28px_72px_rgba(2,10,22,0.74)] backdrop-blur-xl space-y-5"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
        >
          <div className="staff-card-border-sheen h-full w-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        </div>

        <div className="flex flex-col items-center text-center space-y-2.5">
          <BrandLogo variant="emblem" size="md" />
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Destria Secure Administration
            </p>
            <h1 className="font-serif text-2xl font-extrabold tracking-tight text-white">
              Set Administrator Password
            </h1>
            <p className="text-xs leading-relaxed text-[#A8B8CC] max-w-sm mx-auto">
              Authorized credential recovery. Role authorization and mandatory MFA remain strictly enforced upon sign-in.
            </p>
          </div>
        </div>

        {state === 'checking' && (
          <div
            data-testid="admin-reset-checking"
            className="flex flex-col items-center justify-center gap-3 rounded-xl border border-white/10 bg-[#061426]/85 px-4 py-8 text-center"
          >
            <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#E2EAF4]">
              Verifying encrypted recovery authorization…
            </p>
          </div>
        )}

        {state === 'expired' && (
          <div
            role="alert"
            data-testid="admin-reset-expired"
            className="space-y-4 rounded-xl border border-amber-400/40 bg-amber-950/50 p-4 text-xs text-amber-100"
          >
            <div className="flex items-start gap-2.5">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden="true" />
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-bold text-white">Recovery Link Expired</p>
                <p>
                  This administrator password recovery link has expired for your protection. Request
                  a new recovery email and open the latest link promptly.
                </p>
              </div>
            </div>
            <a
              href={RECOVERY_REQUEST_PATH}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2.5 text-xs font-bold text-[#061426] transition-all hover:brightness-105"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Request New Recovery Link</span>
            </a>
          </div>
        )}

        {state === 'invalid' && (
          <div
            role="alert"
            data-testid="admin-reset-invalid"
            className="space-y-4 rounded-xl border border-rose-400/35 bg-rose-950/55 p-4 text-xs text-rose-100"
          >
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-bold text-white">Invalid or Already Used Recovery Link</p>
                <p>
                  {message ||
                    'This recovery link is invalid, expired, or has already been used. Request a fresh password recovery email from the Administrator Account Recovery tab.'}
                </p>
              </div>
            </div>
            <a
              href={RECOVERY_REQUEST_PATH}
              className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2.5 text-xs font-bold text-[#061426] transition-all hover:brightness-105"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Restart Administrator Recovery</span>
            </a>
          </div>
        )}

        {state === 'complete' && (
          <div
            role="status"
            data-testid="admin-reset-complete"
            className="space-y-4 rounded-xl border border-emerald-400/35 bg-emerald-950/45 p-4 text-xs text-emerald-100"
          >
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <div className="space-y-1.5 leading-relaxed">
                <p className="font-bold text-white">Password Updated Securely</p>
                <p>{message}</p>
              </div>
            </div>
            <a
              href={LOGIN_PATH}
              data-testid="admin-reset-continue-login"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-4 py-2.5 text-xs font-bold text-[#061426] transition-all hover:brightness-105"
            >
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Continue to Administrator Sign In</span>
            </a>
          </div>
        )}

        {(state === 'ready' || state === 'saving') && (
          <form
            onSubmit={handleSubmit}
            data-testid="admin-password-reset-form"
            className="space-y-4 text-xs"
            noValidate
          >
            {message && (
              <div
                role="alert"
                data-testid="admin-reset-error"
                className="flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-950/55 p-3 text-rose-100"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span className="leading-relaxed">{message}</span>
              </div>
            )}

            {/* New Password */}
            <div>
              <label
                htmlFor={`${fieldPrefix}-new-password`}
                className="mb-1.5 block font-semibold text-white"
              >
                New administrator password
              </label>
              <div className="flex items-stretch gap-2">
                <div className="relative min-w-0 flex-1">
                  <KeyRound
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B8CC]"
                    aria-hidden="true"
                  />
                  <input
                    id={`${fieldPrefix}-new-password`}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={ADMIN_PASSWORD_MIN_LENGTH}
                    required
                    disabled={state === 'saving'}
                    aria-invalid={password.length > 0 && !policy.valid}
                    aria-describedby={`${fieldPrefix}-policy`}
                    placeholder="Minimum 16 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setMessage('');
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-white/15 bg-[#061426]/90 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-[#7F94AD] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-controls={`${fieldPrefix}-new-password`}
                  aria-label={showPassword ? 'Hide new password' : 'Show new password'}
                  className="inline-flex min-h-[44px] min-w-[74px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#061426]/90 px-3 text-xs font-semibold text-[#E2EAF4] hover:border-[#00C2D1]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5 text-[#00C2D1]" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-[#A8B8CC]" aria-hidden="true" />
                  )}
                  <span>{showPassword ? 'Hide' : 'Show'}</span>
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label
                htmlFor={`${fieldPrefix}-confirm-password`}
                className="mb-1.5 block font-semibold text-white"
              >
                Confirm new password
              </label>
              <div className="flex items-stretch gap-2">
                <div className="relative min-w-0 flex-1">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B8CC]"
                    aria-hidden="true"
                  />
                  <input
                    id={`${fieldPrefix}-confirm-password`}
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    minLength={ADMIN_PASSWORD_MIN_LENGTH}
                    required
                    disabled={state === 'saving'}
                    aria-invalid={confirm.length > 0 && !passwordsMatch}
                    placeholder="Re-enter new password"
                    value={confirm}
                    onChange={(e) => {
                      setConfirm(e.target.value);
                      setMessage('');
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-white/15 bg-[#061426]/90 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-[#7F94AD] focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  aria-pressed={showConfirm}
                  aria-controls={`${fieldPrefix}-confirm-password`}
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  className="inline-flex min-h-[44px] min-w-[74px] shrink-0 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#061426]/90 px-3 text-xs font-semibold text-[#E2EAF4] hover:border-[#00C2D1]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
                >
                  {showConfirm ? (
                    <EyeOff className="h-3.5 w-3.5 text-[#00C2D1]" aria-hidden="true" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-[#A8B8CC]" aria-hidden="true" />
                  )}
                  <span>{showConfirm ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              {confirm.length > 0 && !passwordsMatch && (
                <p className="mt-1.5 text-[11px] text-rose-300">
                  Passwords do not match.
                </p>
              )}
            </div>

            {/* Password Strength Meter & Policy Checklist */}
            <div
              id={`${fieldPrefix}-policy`}
              className="space-y-2.5 rounded-xl border border-white/10 bg-[#061426]/80 p-3.5"
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#E2EAF4]">Password strength</span>
                <span className="font-semibold text-[#D4AF37]">
                  {password.length === 0 ? 'Enter password' : strengthMeta.label}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full transition-all duration-200 ${
                    password.length === 0 ? 'w-0' : `${strengthMeta.width} ${strengthMeta.color}`
                  }`}
                />
              </div>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px]">
                {[
                  { ok: policy.checks.minLength, text: `At least ${ADMIN_PASSWORD_MIN_LENGTH} characters` },
                  { ok: policy.checks.uppercase, text: 'Uppercase letter (A-Z)' },
                  { ok: policy.checks.lowercase, text: 'Lowercase letter (a-z)' },
                  { ok: policy.checks.number, text: 'Numeric digit (0-9)' },
                  { ok: policy.checks.special, text: 'Special character (!@#$...)' },
                  { ok: passwordsMatch, text: 'Confirmation matches' }
                ].map((item) => (
                  <li
                    key={item.text}
                    className={`flex items-center gap-1.5 ${
                      item.ok ? 'text-emerald-300' : 'text-[#A8B8CC]'
                    }`}
                  >
                    <CheckCircle2
                      className={`h-3.5 w-3.5 shrink-0 ${
                        item.ok ? 'text-emerald-400' : 'text-white/25'
                      }`}
                      aria-hidden="true"
                    />
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <button
              disabled={state === 'saving'}
              aria-busy={state === 'saving'}
              type="submit"
              className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-5 py-3 text-[13px] font-bold tracking-wide text-[#061426] shadow-[0_12px_28px_rgba(212,175,55,0.24)] transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
            >
              {state === 'saving' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{state === 'saving' ? 'Updating Password…' : 'Save New Password'}</span>
            </button>
          </form>
        )}

        <div className="border-t border-white/10 pt-4 text-center">
          <a
            href={LOGIN_PATH}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#061426]/80 px-4 py-2 text-xs font-semibold text-[#E2EAF4] transition-colors hover:border-[#00C2D1]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[#00C2D1]" aria-hidden="true" />
            <span>Return to Administrator Sign In</span>
          </a>
        </div>
      </section>
    </AdminPortalLoginLayout>
  );
}
