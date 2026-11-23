/*
 * OPHIREUM-IP | Proprietary Source Code
 * Project: Destria Tax Services LLC / TaxGuard — Secure Super Administrator Portal
 * Notice: Unauthorized copying, redistribution, or derivative use is prohibited.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Eye,
  EyeOff,
  Fingerprint,
  Key,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Send,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { isLocalServerLoginBuild } from '../../../context/localServerLogin';
import { isSuperAdministratorRole } from '../../../config/canonicalRouting';
import { isStaffIdentityDevelopmentConfigured, isSupabaseConfigured } from '../../../supabase/config';
import {
  logout as signOutProvider,
  requestAdminPasswordRecovery
} from '../../../supabase/auth';
import { BrandLogo } from '../../common/BrandLogo';
import { AuthConfigurationNotice } from '../AuthConfigurationNotice';
import { TotpEnrollmentPanel } from '../TotpEnrollmentPanel';
import { StaffMfaRecoveryEnrollmentFlow } from '../StaffMfaRecoveryEnrollmentFlow';
import { AdminPortalLoginLayout } from './AdminPortalLoginLayout';

/**
 * Dedicated Super Administrator Authentication Gateway (/admin/login).
 *
 * Security invariants:
 * - Public administrator self-registration is strictly disabled.
 * - Mandatory server-verified MFA (TOTP) is preserved; no client bypass exists.
 * - Role authorization is strictly server-authoritative: browser state or URL never elevates privilege.
 * - Password recovery updates credentials only and never assigns privileges or bypasses MFA.
 * - Credentials and authenticator codes are never logged to the browser console or persisted in storage.
 */
export const AdminLoginPage: React.FC = () => {
  const fieldPrefix = React.useId();
  const { login, setCurrentPage, logout } = useApp();

  const [mode, setMode] = useState<'signin' | 'recovery'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'recovery' || params.get('tab') === 'recovery') {
        return 'recovery';
      }
    }
    return 'signin';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorReference, setErrorReference] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  // Account Recovery Request state
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryConfirmation, setRecoveryConfirmation] = useState<string | null>(null);
  const [recoveryCooldown, setRecoveryCooldown] = useState(0);
  const [recoveryAuditTimestamp, setRecoveryAuditTimestamp] = useState<string | null>(null);

  const localBuild = isLocalServerLoginBuild();
  const [localLoginAvailable, setLocalLoginAvailable] = useState(false);
  const recoveryEnrollmentAvailable = isStaffIdentityDevelopmentConfigured();
  const formRef = useRef<HTMLFormElement>(null);
  const submittingRef = useRef(false);
  const recoverySubmittingRef = useRef(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname !== '/admin/login' || window.location.hash || window.location.search)
    ) {
      try {
        window.history.replaceState({ page: 'admin_login' }, '', '/admin/login');
      } catch {
        // fallback
      }
    }
  }, []);

  useEffect(() => {
    if (recoveryCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setRecoveryCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [recoveryCooldown]);

  useEffect(() => {
    if (!localBuild) return;
    let active = true;
    const check = () =>
      fetch('/api/auth/local-login-status', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((status) => {
          if (active) setLocalLoginAvailable(status?.localLoginAvailable === true);
        })
        .catch(() => {
          if (active) setLocalLoginAvailable(false);
        });
    void check();
    window.addEventListener('focus', check);
    return () => {
      active = false;
      window.removeEventListener('focus', check);
    };
  }, [localBuild]);

  const clearFeedback = () => {
    setError(null);
    setErrorReference(null);
    setStatusNote(null);
  };

  const openRecoveryTab = () => {
    if (!recoveryEmail && email.trim()) {
      setRecoveryEmail(email.trim());
    }
    setMode('recovery');
    clearFeedback();
    setRecoveryError(null);
  };

  const submitOnEnter = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    formRef.current?.requestSubmit();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    setErrorReference(null);
    setStatusNote(null);

    try {
      // Authenticate via the existing server-authoritative staff/admin channel (never auto-provisions a client).
      const result = await login(email, password, mfaStep ? mfaCode : undefined, {
        portal: 'staff',
        navigateOnSuccess: false
      });

      if (result.success) {
        setMfaCode('');
        setMfaStep(false);

        // Enforce server-assigned Super Administrator role before entering /admin/dashboard.
        if (result.user && isSuperAdministratorRole(result.user.role)) {
          setCurrentPage('admin_command_center');
        } else {
          // Non-super-administrator accounts cannot enter the Super Administrator Command Center.
          await logout().catch(() => {});
          setPassword('');
          setError(
            'Access Denied: This portal is restricted to authorized Super Administrator accounts. Use the Staff Practice Portal or Client Portal for your assigned role.'
          );
        }
        return;
      }

      if (result.mfaEnrollmentRequired) {
        setMfaEnrollmentRequired(true);
        setMfaStep(false);
        setMfaCode('');
        return;
      }

      if (result.mfaRequired) {
        setMfaStep(true);
        setMfaCode('');
        setError(mfaStep ? result.error || 'Invalid authenticator code.' : null);
        setErrorReference(mfaStep ? result.reference || null : null);
        if (!mfaStep) {
          setStatusNote('Primary credentials accepted. Complete multifactor verification to continue.');
        }
        return;
      }

      setMfaCode('');
      setError(
        result.error ||
          'Authentication failed. Verify your administrator credentials or contact Destria Security Administration.'
      );
      setErrorReference(result.reference || null);
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recoverySubmittingRef.current || recoveryCooldown > 0) return;
    recoverySubmittingRef.current = true;
    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryConfirmation(null);

    try {
      const result = await requestAdminPasswordRecovery(recoveryEmail);
      if (result.cooldownSeconds && result.cooldownSeconds > 0) {
        setRecoveryCooldown(result.cooldownSeconds);
      }
      if (result.auditEvent?.timestamp) {
        setRecoveryAuditTimestamp(result.auditEvent.timestamp);
      }
      if (result.success) {
        setRecoveryConfirmation(
          result.message ||
            'Recovery request processed. Email delivery is not confirmed. If an authorized account exists, check your inbox and spam folder.'
        );
      } else {
        setRecoveryError(
          result.error ||
            'Unable to process your recovery request right now. Please try again shortly.'
        );
      }
    } finally {
      recoverySubmittingRef.current = false;
      setRecoveryLoading(false);
    }
  };

  const submitDisabled =
    loading || mfaEnrollmentRequired || (!isSupabaseConfigured() && !localBuild);
  const recoveryDisabled =
    recoveryLoading || recoveryCooldown > 0 || !isSupabaseConfigured();

  return (
    <AdminPortalLoginLayout>
      <div
        data-testid="admin-login-card"
        className="relative overflow-hidden rounded-2xl border border-[#D4AF37]/30 bg-[#0B1F36]/86 p-6 sm:p-7 shadow-[0_28px_72px_rgba(2,10,22,0.74)] backdrop-blur-xl space-y-5"
      >
        {/* Top Metallic Gold Border Illumination */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden"
        >
          <div className="staff-card-border-sheen h-full w-full bg-gradient-to-r from-transparent via-[#D4AF37] to-transparent" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 bottom-0 h-px bg-gradient-to-r from-transparent via-[#00C2D1]/35 to-transparent"
        />

        {/* Brand Identity & Portal Title */}
        <div className="flex flex-col items-center text-center space-y-2.5">
          <BrandLogo variant="emblem" size="md" />
          <div className="space-y-1">
            <h1 className="font-serif text-2xl sm:text-[1.75rem] font-extrabold tracking-tight text-white">
              Destria Super Administrator
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Authorized Executive &amp; System Administration Access
            </p>
            <p className="text-xs leading-relaxed text-[#A8B8CC] max-w-sm mx-auto">
              Mandatory multifactor verification and server-enforced role authorization apply to every session.
            </p>
          </div>
        </div>

        {/* Mode Switcher: Sign In vs Approved Account Recovery (NO public self-registration) */}
        <div
          role="tablist"
          aria-label="Administrator authentication mode"
          className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#061426]/90 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signin'}
            onClick={() => {
              setMode('signin');
              clearFeedback();
            }}
            className={`min-h-[40px] whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] ${
              mode === 'signin'
                ? 'bg-[#D4AF37] font-bold text-[#061426] shadow-sm'
                : 'text-[#A8B8CC] hover:bg-white/5 hover:text-white'
            }`}
          >
            Admin Sign In
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'recovery'}
            disabled={loading || mfaEnrollmentRequired}
            onClick={openRecoveryTab}
            className={`min-h-[40px] whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] disabled:opacity-55 ${
              mode === 'recovery'
                ? 'bg-[#D4AF37] font-bold text-[#061426] shadow-sm'
                : 'text-[#A8B8CC] hover:bg-white/5 hover:text-white'
            }`}
          >
            Account Recovery
          </button>
        </div>

        {/* Error Alert (Sign In mode) */}
        {mode === 'signin' && error && (
          <div
            role="alert"
            data-testid="admin-login-error"
            className="flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-950/55 p-3.5 text-xs text-rose-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
            <div className="space-y-1 leading-relaxed">
              <span>{error}</span>
              {errorReference && (
                <span
                  data-testid="admin-login-error-reference"
                  className="block font-mono text-[10px] text-rose-200/80 tabular-nums"
                >
                  Reference: {errorReference}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Informational Status (Sign In mode) */}
        {mode === 'signin' && statusNote && !error && (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-xl border border-[#00C2D1]/35 bg-[#061426]/90 p-3.5 text-xs text-[#E2EAF4]"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00C2D1]" aria-hidden="true" />
            <span className="leading-relaxed">{statusNote}</span>
          </div>
        )}

        {mode === 'signin' ? (
          <>
            {localLoginAvailable ? (
              <div
                role="note"
                data-testid="admin-local-login-notice"
                className="rounded-xl border border-[#D4AF37]/30 bg-[#061426]/85 p-3 text-[11px] leading-relaxed text-[#E2EAF4]"
              >
                Local development sign-in active: password and TOTP authenticator codes are verified by this TaxGuard server.
              </div>
            ) : localBuild ? (
              <div
                role="status"
                data-testid="admin-local-unreachable-notice"
                className="rounded-xl border border-amber-400/35 bg-amber-950/60 p-3 text-[11px] leading-relaxed text-amber-100"
              >
                The local TaxGuard authentication server is not responding. Start the backend server before attempting sign-in.
              </div>
            ) : (
              <AuthConfigurationNotice />
            )}

            {mfaEnrollmentRequired && (
              <TotpEnrollmentPanel
                onComplete={() => {
                  setMfaEnrollmentRequired(false);
                  setMfaStep(true);
                  setStatusNote('Authenticator enrolled. Enter your current 6-digit code to finish signing in.');
                }}
                onCancel={() => {
                  void signOutProvider();
                  setMfaEnrollmentRequired(false);
                  setPassword('');
                }}
              />
            )}

            <form ref={formRef} onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate={false}>
              <fieldset disabled={mfaEnrollmentRequired} className="space-y-4">
                {/* Administrator Work Email */}
                <div>
                  <label
                    className="mb-1.5 block text-xs font-semibold text-white"
                    htmlFor={`${fieldPrefix}-admin-email`}
                  >
                    Administrator work email
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B8CC]"
                      aria-hidden="true"
                    />
                    <input
                      id={`${fieldPrefix}-admin-email`}
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="administrator@destriataxservices.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        clearFeedback();
                        setMfaStep(false);
                        setMfaCode('');
                      }}
                      className="min-h-[44px] w-full rounded-xl border border-white/15 bg-[#061426]/90 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-[#7F94AD] transition-all duration-150 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25"
                    />
                  </div>
                </div>

                {/* Password + Show/Hide Toggle */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label
                      className="block text-xs font-semibold text-white"
                      htmlFor={`${fieldPrefix}-admin-password`}
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={openRecoveryTab}
                      className="text-[11px] font-medium text-[#D4AF37] hover:text-[#E5C562] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] rounded"
                    >
                      Recover password
                    </button>
                  </div>
                  <div className="flex items-stretch gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Key
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B8CC]"
                        aria-hidden="true"
                      />
                      <input
                        id={`${fieldPrefix}-admin-password`}
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          clearFeedback();
                        }}
                        className="min-h-[44px] w-full rounded-xl border border-white/15 bg-[#061426]/90 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-[#7F94AD] transition-all duration-150 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25"
                      />
                    </div>
                    <button
                      type="button"
                      onKeyDown={submitOnEnter}
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-pressed={showPassword}
                      aria-controls={`${fieldPrefix}-admin-password`}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="inline-flex min-h-[44px] min-w-[76px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/15 bg-[#061426]/90 px-3 text-xs font-semibold text-[#E2EAF4] transition-colors hover:border-[#00C2D1]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
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

                {/* Mandatory MFA Verification Step */}
                {mfaStep && (
                  <div
                    role="group"
                    aria-labelledby={`${fieldPrefix}-mfa-label`}
                    className="space-y-2 rounded-xl border border-[#00C2D1]/35 bg-[#061426]/95 p-4"
                  >
                    <label
                      id={`${fieldPrefix}-mfa-label`}
                      className="block text-xs font-semibold text-white"
                      htmlFor={`${fieldPrefix}-admin-mfa`}
                    >
                      Authenticator Code (Mandatory MFA)
                    </label>
                    <div className="relative">
                      <Fingerprint
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00C2D1]"
                        aria-hidden="true"
                      />
                      <input
                        id={`${fieldPrefix}-admin-mfa`}
                        type="text"
                        required
                        autoFocus
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        placeholder="6-digit code"
                        value={mfaCode}
                        onChange={(e) => {
                          setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                          clearFeedback();
                        }}
                        className="min-h-[44px] w-full rounded-xl border border-[#00C2D1]/45 bg-[#0B1F36] py-2.5 pl-10 pr-3.5 font-mono text-sm tracking-[0.24em] text-white tabular-nums transition-all focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25"
                      />
                    </div>
                    <p className="text-[11px] leading-relaxed text-[#A8B8CC]">
                      Enter the time-based 6-digit code from your registered authenticator application.
                    </p>
                  </div>
                )}

                {/* Primary CTA — Continue securely */}
                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={submitDisabled}
                    aria-busy={loading}
                    className="flex min-h-[46px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-5 py-3 text-[13px] font-bold tracking-wide text-[#061426] shadow-[0_12px_28px_rgba(212,175,55,0.24)] transition-all duration-150 hover:brightness-105 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1F36] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Lock className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>
                      {loading
                        ? 'Verifying Authorization...'
                        : mfaStep
                          ? 'Verify MFA & Continue'
                          : 'Continue securely'}
                    </span>
                  </button>
                </div>
              </fieldset>
            </form>

            {/* Hardware Passkey / WebAuthn Posture Notice (Honest, No Fabrication) */}
            <div className="rounded-xl border border-white/10 bg-[#061426]/75 px-3.5 py-2.5 text-[11px] text-[#A8B8CC] flex items-start gap-2.5">
              <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D4AF37]" aria-hidden="true" />
              <span>
                <strong className="text-white">MFA Policy:</strong> Time-based authenticator (TOTP) is enforced server-side. Hardware passkey / WebAuthn ceremony is not yet provisioned in this environment.
              </span>
            </div>
          </>
        ) : (
          <div className="space-y-4" data-testid="admin-recovery-panel">
            {!isSupabaseConfigured() && <AuthConfigurationNotice />}

            {recoveryError && (
              <div
                role="alert"
                data-testid="admin-recovery-error"
                className="flex items-start gap-2.5 rounded-xl border border-rose-400/35 bg-rose-950/55 p-3.5 text-xs text-rose-100"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" aria-hidden="true" />
                <span className="leading-relaxed">{recoveryError}</span>
              </div>
            )}

            {recoveryConfirmation && (
              <div
                role="status"
                data-testid="admin-recovery-confirmation"
                className="space-y-2 rounded-xl border border-[#00C2D1]/40 bg-[#061426]/95 p-4 text-xs text-[#E2EAF4]"
              >
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#00C2D1]" aria-hidden="true" />
                  <div className="space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-white">Recovery Request Processed — Delivery Unverified</p>
                    <p>{recoveryConfirmation}</p>
                    <p className="text-[11px] text-[#A8B8CC]">
                      If a recovery email arrives, open its link promptly—links expire automatically and
                      can only be used once. If no email arrives, check spam and contact your administrator. If a link expires, wait for the cooldown to finish
                      and submit a new request.
                    </p>
                    {recoveryAuditTimestamp && (
                      <p className="font-mono text-[10px] text-[#7F94AD] tabular-nums">
                        Request timestamp (browser clock): {new Date(recoveryAuditTimestamp).toISOString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <form
              onSubmit={handleRecoverySubmit}
              data-testid="admin-recovery-form"
              className="space-y-4 text-xs"
            >
              <div>
                <label
                  className="mb-1.5 block text-xs font-semibold text-white"
                  htmlFor={`${fieldPrefix}-recovery-email`}
                >
                  Administrator email address
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A8B8CC]"
                    aria-hidden="true"
                  />
                  <input
                    id={`${fieldPrefix}-recovery-email`}
                    type="email"
                    required
                    autoComplete="username"
                    placeholder="administrator@destriataxservices.com"
                    value={recoveryEmail}
                    onChange={(e) => {
                      setRecoveryEmail(e.target.value);
                      setRecoveryError(null);
                    }}
                    className="min-h-[44px] w-full rounded-xl border border-white/15 bg-[#061426]/90 py-2.5 pl-10 pr-3.5 text-sm text-white placeholder:text-[#7F94AD] transition-all duration-150 focus:border-[#D4AF37] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/25"
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#A8B8CC]">
                  Enter your authorized administrator email to receive a time-limited password recovery link.
                </p>
              </div>

              <button
                type="submit"
                disabled={recoveryDisabled}
                aria-busy={recoveryLoading}
                data-testid="admin-recovery-submit"
                className="flex min-h-[46px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#E5C562] to-[#C89F2B] px-5 py-3 text-[13px] font-bold tracking-wide text-[#061426] shadow-[0_12px_28px_rgba(212,175,55,0.24)] transition-all duration-150 hover:brightness-105 active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1F36] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
              >
                {recoveryLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : recoveryCooldown > 0 ? (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {recoveryLoading
                    ? 'Sending Recovery Request...'
                    : recoveryCooldown > 0
                      ? `Resend available in ${recoveryCooldown}s`
                      : 'Request Recovery'}
                </span>
              </button>
            </form>

            {/* Governance & MFA Distinction Notice */}
            <div className="rounded-xl border border-[#D4AF37]/25 bg-[#061426]/85 p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-[#E6C96E]">
                <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Approved Administrator Account Recovery Policy</span>
              </div>
              <p className="leading-relaxed text-[#CBD6E4]">
                Password recovery restores authentication credentials only—it never assigns Super
                Administrator privileges or bypasses mandatory MFA. Lost authenticators require an
                approved MFA recovery workflow through Destria Security Governance.
              </p>
              <p className="text-[11px] text-[#A8B8CC]">
                Every recovery request and authentication event is subject to rate limiting and
                audit logging.
              </p>
            </div>

            {recoveryEnrollmentAvailable && (
              <StaffMfaRecoveryEnrollmentFlow
                onCancel={() => {
                  setMode('signin');
                  clearFeedback();
                }}
              />
            )}

            <button
              type="button"
              onClick={() => {
                setMode('signin');
                clearFeedback();
                setRecoveryError(null);
              }}
              className="flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#061426]/90 px-4 py-2 text-xs font-semibold text-white transition-colors hover:border-[#D4AF37]/45 hover:bg-[#0D2745] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Back to Administrator Sign In</span>
            </button>
          </div>
        )}

        {/* Footer Security Notice & Return to Staff Portal */}
        <div className="space-y-3 border-t border-white/10 pt-4 text-center">
          <p className="text-[11px] leading-relaxed text-[#A8B8CC]">
            Public administrator registration is disabled. All sign-in attempts and authorization
            decisions are monitored and recorded.
          </p>
          <button
            type="button"
            onClick={() => setCurrentPage('staff_login')}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-[#061426]/80 px-4 py-2 text-xs font-semibold text-[#E2EAF4] transition-colors hover:border-[#00C2D1]/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-[#00C2D1]" aria-hidden="true" />
            <span>Return to Staff Portal</span>
          </button>
        </div>
      </div>
    </AdminPortalLoginLayout>
  );
};
