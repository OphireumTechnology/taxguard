import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import {
  requestPasswordReset as requestSupabasePasswordReset,
  validateRegistrationInput,
  ControlledAuthErrorCode,
  RegistrationResultState
} from '../../supabase/auth';
import {
  Lock,
  Mail,
  Key,
  Fingerprint,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Loader2
} from 'lucide-react';

const REGISTRATION_STATE_LABELS: Record<RegistrationResultState, string> = {
  IDLE: 'Ready to Register',
  SUBMITTING: 'Creating Your TaxGuard Account...',
  ACCOUNT_CREATED: 'Account Created — Verifying Session Policy...',
  EMAIL_VERIFICATION_REQUIRED: 'Email Verification Required',
  ESTABLISHING_SESSION: 'Establishing Server-Authoritative Session...',
  INITIALIZING_CLIENT: 'Provisioning Client Profile & Tenant Membership...',
  INITIALIZING_CASE: 'Initializing Tax Year & Stage 01 Onboarding Case...',
  READY: 'Onboarding Workspace Ready — Redirecting...',
  FAILED: 'Registration Could Not Be Completed'
};

export const ClientLoginPage: React.FC = () => {
  const {
    login,
    setCurrentPage,
    resendVerificationEmail,
    setRegistrationState,
    setPendingVerificationEmail
  } = useApp();

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname !== '/portal/login' || window.location.hash)
    ) {
      try {
        window.history.replaceState(null, '', '/portal/login');
      } catch {
        // fallback
      }
    }
  }, []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ControlledAuthErrorCode | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendingVerification, setResendingVerification] = useState(false);

  // Forgot Password State
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setResendNotice(null);
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      setCurrentPage('portal');
      return;
    }

    if (result.emailVerificationRequired || result.code === 'EMAIL_VERIFICATION_REQUIRED') {
      setPendingVerificationEmail(email.trim().toLowerCase());
      setRegistrationState('EMAIL_VERIFICATION_REQUIRED');
      setErrorCode('EMAIL_VERIFICATION_REQUIRED');
      setError(
        result.error ||
          'Your TaxGuard account has been created. Please verify your email address to securely activate your Client Tax Center.'
      );
      return;
    }

    setErrorCode(result.code || 'INVALID_CREDENTIALS');
    setError(result.error || 'Invalid client credentials. Please check your email and password.');
  };

  const handleResendVerification = async () => {
    if (!email.trim()) return;
    setResendingVerification(true);
    setResendNotice(null);
    const res = await resendVerificationEmail(email.trim());
    setResendingVerification(false);
    if (res.success) {
      setResendNotice(res.message);
    } else {
      setError(res.error || 'Could not resend verification email. Please try again shortly.');
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setError(null);
    setResetSuccess(null);
    const result = await requestSupabasePasswordReset(resetEmail.trim());
    setResetLoading(false);
    setResetSuccess(
      result.message ||
        'If an account exists for this email address, password recovery instructions have been sent.'
    );
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-slate-100 space-y-8">
      <div className="text-center space-y-3">
        <BrandLogo variant="emblem" size="md" />
        <h1 className="font-serif text-3xl font-extrabold text-white">
          {isForgotPasswordMode ? 'Reset Password' : 'Client Portal Login'}
        </h1>
        <p className="text-xs text-slate-300">
          {isForgotPasswordMode
            ? 'Enter your registered email address to receive an authorized password recovery link.'
            : 'Access your encrypted tax documents, live return status, and CPA messages.'}
        </p>
      </div>

      <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl space-y-6">
        {error && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-2"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span>{error}</span>
                {errorCode && (
                  <div className="text-[10px] font-mono text-rose-300/80">
                    Code: {errorCode}
                  </div>
                )}
              </div>
            </div>
            {errorCode === 'EMAIL_VERIFICATION_REQUIRED' && (
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendingVerification}
                  className="px-3 py-1.5 rounded-lg bg-[#C6A15B] text-[#07172B] font-bold text-[11px] hover:bg-[#D9BF7A] transition-colors disabled:opacity-50"
                >
                  {resendingVerification ? 'Sending...' : 'Resend Verification Email'}
                </button>
              </div>
            )}
          </div>
        )}

        {resendNotice && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{resendNotice}</span>
          </div>
        )}

        {resetSuccess && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{resetSuccess}</span>
          </div>
        )}

        {isForgotPasswordMode ? (
          <form onSubmit={handlePasswordResetSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Registered Account Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-[#C6A15B]"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                {resetLoading ? 'Dispatching Reset Link...' : 'Send Password Reset Email'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsForgotPasswordMode(false);
                  setError(null);
                  setErrorCode(null);
                  setResetSuccess(null);
                }}
                className="w-full py-2.5 rounded-xl bg-[#07172B] hover:bg-[#132E52] border border-[#1E3A5F] text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
            </div>
          </form>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPasswordMode(true);
                      setResetEmail(email);
                      setError(null);
                      setErrorCode(null);
                      setResetSuccess(null);
                    }}
                    className="text-[11px] text-[#C6A15B] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg pl-9 pr-3 py-2.5 text-white focus:outline-none focus:border-[#C6A15B]"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  {loading ? 'Authenticating...' : 'Sign In Securely'}
                </button>
              </div>
            </form>

            {/* Biometric / Passkey Hardware Authentication (Uncommissioned) */}
            <div className="pt-4 border-t border-[#1E3A5F] space-y-2 text-center opacity-65">
              <div className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-slate-400 text-xs select-none">
                <Fingerprint className="w-4 h-4 text-slate-400" />
                <span>Touch ID / Face ID Biometric Login (Not Configured)</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Hardware WebAuthn is unavailable. Please authenticate securely with your password.
              </p>
            </div>

            <div className="text-center text-xs text-slate-400 pt-2">
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => {
                  setRegistrationState('IDLE');
                  setCurrentPage('client_register');
                }}
                className="text-[#C6A15B] font-semibold hover:underline"
              >
                Register Client Account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const ClientRegisterPage: React.FC = () => {
  const {
    register,
    setCurrentPage,
    registrationState,
    setRegistrationState,
    pendingVerificationEmail,
    setPendingVerificationEmail,
    resendVerificationEmail
  } = useApp();

  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('individual');
  const [contactMethod, setContactMethod] = useState('portal');
  const [timeZone, setTimeZone] = useState('America/New_York');
  const [referralSource, setReferralSource] = useState('Client Referral');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ControlledAuthErrorCode | null>(null);
  const [duplicateAccountDetected, setDuplicateAccountDetected] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [resendingEmail, setResendingEmail] = useState(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname !== '/portal/register' || window.location.hash)
    ) {
      try {
        window.history.replaceState(null, '', '/portal/register');
      } catch {
        // fallback
      }
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setErrorCode(null);
    setDuplicateAccountDetected(false);
    setResendMessage(null);

    const validation = validateRegistrationInput({
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword,
      requireConfirmPassword: true,
      acceptedTerms,
      requireTerms: true,
      category,
      company
    });

    if (!validation.valid) {
      setRegistrationState('FAILED');
      setErrorCode(validation.code || 'VALIDATION_FAILED');
      setError(validation.message || 'Please review your registration details and try again.');
      return;
    }

    setLoading(true);

    const fullName = [firstName.trim(), middleName.trim(), lastName.trim()].filter(Boolean).join(' ');

    const result = await register({
      name: fullName,
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim(),
      company: category !== 'individual' ? company.trim() : '',
      role: 'client',
      clientType: category === 'individual' ? 'individual' : 'business',
      taxFilingType:
        category === 'scorp'
          ? 'Form 1120-S (S-Corporation)'
          : category === 'llc'
            ? 'LLC (Schedule C / Partnership)'
            : 'Form 1040 (Individual)'
    });

    setLoading(false);

    // CASE B — User created, but Supabase requires email verification before issuing an active session
    if (result.emailVerificationRequired || result.status === 'EMAIL_VERIFICATION_REQUIRED') {
      setPendingVerificationEmail(email.trim().toLowerCase());
      setRegistrationState('EMAIL_VERIFICATION_REQUIRED');
      return;
    }

    // CASE A — Authenticated session established and Stage 01 initialized
    if (result.success && result.status === 'READY') {
      setCurrentPage('portal');
      return;
    }

    // CASE C — Registration or session/case initialization failed
    setRegistrationState('FAILED');
    setErrorCode(result.code || 'REGISTRATION_FAILED');
    setDuplicateAccountDetected(Boolean(result.duplicateRegistration));
    setError(
      result.error ||
        'Registration could not be completed at this time. Please verify your information and try again.'
    );
  };

  const handleResendVerification = async () => {
    const targetEmail = (pendingVerificationEmail || email).trim().toLowerCase();
    if (!targetEmail) return;
    setResendingEmail(true);
    setError(null);
    setResendMessage(null);
    const res = await resendVerificationEmail(targetEmail);
    setResendingEmail(false);
    if (res.success) {
      setResendMessage(res.message);
    } else {
      setError(res.error || 'Unable to resend verification email right now. Please try again shortly.');
    }
  };

  const handleReturnToRegistration = () => {
    setRegistrationState('IDLE');
    setPendingVerificationEmail(null);
    setError(null);
    setErrorCode(null);
    setResendMessage(null);
  };

  const handleReturnToSignIn = () => {
    setRegistrationState('IDLE');
    setPendingVerificationEmail(null);
    setError(null);
    setErrorCode(null);
    setResendMessage(null);
    setCurrentPage('client_login');
  };

  // Dedicated VERIFY YOUR EMAIL screen when email confirmation is required
  if (registrationState === 'EMAIL_VERIFICATION_REQUIRED') {
    const targetEmail = pendingVerificationEmail || email.trim().toLowerCase();
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-slate-100 space-y-8" data-testid="verify-email-screen">
        <div className="text-center space-y-3">
          <BrandLogo variant="emblem" size="md" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#07172B] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
            <ShieldCheck className="w-3 h-3" />
            <span>ACCOUNT ACTIVATION REQUIRED</span>
          </div>
          <h1 className="font-serif text-3xl font-extrabold text-white">Verify Your Email</h1>
        </div>

        <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl space-y-6">
          <div className="p-4 rounded-2xl bg-[#07172B] border border-[#C6A15B]/30 space-y-2 text-center">
            <Mail className="w-8 h-8 text-[#C6A15B] mx-auto" />
            <p className="text-sm text-white font-semibold">
              Your TaxGuard account has been created. Please verify your email address to securely activate your Client Tax Center.
            </p>
            {targetEmail && (
              <p className="text-xs text-slate-300">
                Verification link sent to <strong className="text-[#C6A15B]">{targetEmail}</strong>
              </p>
            )}
          </div>

          {resendMessage && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{resendMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={handleResendVerification}
              disabled={resendingEmail}
              className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${resendingEmail ? 'animate-spin' : ''}`} />
              <span>{resendingEmail ? 'Resending Verification Email...' : 'Resend Verification Email'}</span>
            </button>

            <button
              type="button"
              onClick={handleReturnToRegistration}
              className="w-full py-2.5 rounded-xl bg-[#07172B] hover:bg-[#132E52] border border-[#1E3A5F] text-slate-200 text-xs font-semibold transition-colors"
            >
              Change Email / Return to Registration
            </button>

            <button
              type="button"
              onClick={handleReturnToSignIn}
              className="w-full py-2.5 rounded-xl bg-transparent hover:bg-[#07172B] border border-[#1E3A5F]/60 text-slate-300 text-xs font-semibold transition-colors"
            >
              Return to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isProcessingState =
    loading ||
    ['SUBMITTING', 'ACCOUNT_CREATED', 'ESTABLISHING_SESSION', 'INITIALIZING_CLIENT', 'INITIALIZING_CASE'].includes(
      registrationState
    );

  return (
    <div className="max-w-xl mx-auto px-4 py-12 text-slate-100 space-y-8">
      <div className="text-center space-y-3">
        <BrandLogo variant="emblem" size="md" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#07172B] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
          <ShieldCheck className="w-3 h-3" />
          <span>STAGE 01: ONBOARD &bull; UNIFIED 18-STAGE WORKFLOW</span>
        </div>
        <h1 className="font-serif text-3xl font-extrabold text-white">Client Registration</h1>
        <p className="text-xs text-slate-300">
          Minimal intake creates your internal Client ID and automatically initiates the Identity Verification Wizard.
        </p>
      </div>

      <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl">
        {isProcessingState && (
          <div
            aria-live="polite"
            className="mb-4 p-3.5 rounded-xl bg-[#07172B] border border-[#C6A15B]/40 text-[#C6A15B] text-xs flex items-center gap-2.5"
          >
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <div>
              <div className="font-bold">{REGISTRATION_STATE_LABELS[registrationState] || 'Processing...'}</div>
              <div className="text-[11px] text-slate-300">
                Please wait while TaxGuard provisions your encrypted Client Tax Center.
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-lg bg-red-900/40 border border-red-500/40 text-red-200 text-xs space-y-2"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span>{error}</span>
                {errorCode && (
                  <div className="text-[10px] font-mono text-red-300/80">
                    Status: {registrationState} &bull; Code: {errorCode}
                  </div>
                )}
              </div>
            </div>

            {duplicateAccountDetected && (
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleReturnToSignIn}
                  className="px-3 py-1.5 rounded-lg bg-[#C6A15B] text-[#07172B] font-bold text-[11px] hover:bg-[#D9BF7A] transition-colors"
                >
                  Sign In to Existing Account
                </button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">First Name *</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Eleanor"
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Middle Name</label>
              <input
                type="text"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                placeholder="Marie"
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Last Name *</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Vance"
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="eleanor@example.com"
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Mobile Telephone *</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="678-205-9486"
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Client Classification</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              >
                <option value="individual">Individual / Household (Form 1040)</option>
                <option value="sole_prop">Sole Proprietorship / 1099</option>
                <option value="llc">Limited Liability Company (LLC)</option>
                <option value="scorp">S-Corporation (1120-S)</option>
                <option value="ccorp">C-Corporation (1120)</option>
                <option value="partnership">Partnership (1065)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Preferred Channel</label>
              <select
                value={contactMethod}
                onChange={(e) => setContactMethod(e.target.value)}
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              >
                <option value="portal">Secure Portal Message (Recommended)</option>
                <option value="email">Direct Email</option>
                <option value="phone">Direct Phone Call</option>
                <option value="sms">SMS Text Alert</option>
              </select>
            </div>
          </div>

          {category !== 'individual' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Entity / Business Legal Name *</label>
              <input
                type="text"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. Vance Global Logistics LLC"
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Time Zone</label>
              <select
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              >
                <option value="America/New_York">Eastern Time (US & Canada)</option>
                <option value="America/Chicago">Central Time (US & Canada)</option>
                <option value="America/Denver">Mountain Time (US & Canada)</option>
                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Referral Source</label>
              <select
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              >
                <option value="Client Referral">Existing Client Referral</option>
                <option value="Google Search">Online / Search Engine</option>
                <option value="LinkedIn">Professional Colleague / LinkedIn</option>
                <option value="Community / In-Person">Columbia, SC Local Business</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Secure Password *</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, upper, lower & number"
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Confirm Password *</label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#07172B] border border-[#1E3A5F] cursor-pointer text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              className="mt-0.5 rounded text-[#C6A15B] focus:ring-[#C6A15B]"
            />
            <span>
              I agree to the <strong>Terms of Service</strong>, <strong>Privacy Policy</strong>, and acknowledge disclosure under <strong>IRC § 7216</strong> regarding taxpayer data protection and electronic communications.
            </span>
          </label>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isProcessingState}
              className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all shadow-lg disabled:opacity-50"
            >
              {isProcessingState
                ? REGISTRATION_STATE_LABELS[registrationState] || 'Initializing Encrypted Account...'
                : 'Register & Begin Onboarding Dossier'}
            </button>
          </div>

          <div className="text-center text-xs text-slate-400 pt-2">
            Already registered?{' '}
            <button
              type="button"
              onClick={handleReturnToSignIn}
              className="text-[#C6A15B] font-semibold hover:underline"
            >
              Sign In Here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const StaffLoginPage: React.FC = () => {
  const { login, setCurrentPage } = useApp();
  const [loginMode, setLoginMode] = useState<'signin' | 'accept_invitation'>('signin');

  // Sign in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetRole, setTargetRole] = useState<'accountant' | 'admin'>('accountant');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Accept Invitation state
  const [invitationToken, setInvitationToken] = useState('');
  const [invitationDetails, setInvitationDetails] = useState<any | null>(null);
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteChecking, setInviteChecking] = useState(false);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      (window.location.pathname !== '/staff/login' || window.location.hash)
    ) {
      try {
        window.history.replaceState(null, '', '/staff/login');
      } catch {
        // fallback
      }
    }
  }, []);

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result: any = await login(email, password, targetRole);
    setLoading(false);
    if (result === true || (result && result.success)) {
      setCurrentPage('staff');
    } else {
      setError(result?.error || 'Invalid staff credentials. Please check your credentials or contact firm compliance.');
    }
  };

  const handleLookupInvitation = async () => {
    if (!invitationToken.trim()) return;
    setInviteChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/onboarding/staff/invitations/${invitationToken.trim()}`);
      if (!res.ok) throw new Error('Invitation token not found or already consumed');
      const data = await res.json();
      setInvitationDetails(data.invitation);
    } catch (err: any) {
      setError(err.message);
      setInvitationDetails(null);
    } finally {
      setInviteChecking(false);
    }
  };

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitationToken || !invitePassword) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding/staff/accept-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: invitationToken.trim(),
          password: invitePassword
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to accept invitation');
      }
      const data = await res.json();
      localStorage.setItem('token', data.sessionToken);
      setCurrentPage('staff_onboarding');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-slate-100 space-y-8">
      <div className="text-center space-y-3">
        <BrandLogo variant="emblem" size="md" />
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#07172B] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
          <Lock className="w-3 h-3" />
          <span>Internal Staff Access Only</span>
        </div>
        <h1 className="font-serif text-3xl font-extrabold text-white">Staff Practice Portal</h1>
        <p className="text-xs text-slate-300">
          A/R Tax Services, LLC practitioner workspace and single-use staff onboarding invitations.
        </p>
      </div>

      <div className="p-8 rounded-3xl bg-[#0D2340] border border-[#1E3A5F] shadow-2xl space-y-6">
        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
          <button
            type="button"
            onClick={() => {
              setLoginMode('signin');
              setError(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              loginMode === 'signin' ? 'bg-[#C6A15B] text-[#07172B]' : 'text-slate-300 hover:text-white'
            }`}
          >
            Staff Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('accept_invitation');
              setError(null);
            }}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              loginMode === 'accept_invitation' ? 'bg-[#C6A15B] text-[#07172B]' : 'text-slate-300 hover:text-white'
            }`}
          >
            Accept Staff Invite
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-900/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loginMode === 'signin' ? (
          <>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
              <button
                type="button"
                onClick={() => setTargetRole('accountant')}
                className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  targetRole === 'accountant' ? 'bg-[#C6A15B] text-[#07172B]' : 'text-slate-400 hover:text-white'
                }`}
              >
                Staff Accountant
              </button>
              <button
                type="button"
                onClick={() => setTargetRole('admin')}
                className={`py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  targetRole === 'admin' ? 'bg-[#C6A15B] text-[#07172B]' : 'text-slate-400 hover:text-white'
                }`}
              >
                Compliance Admin
              </button>
            </div>

            <form onSubmit={handleStaffLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Staff Work Email</label>
                <input
                  type="text"
                  required
                  placeholder="practitioner@artaxservices.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#C6A15B]"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Staff Security Token / Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#C6A15B]"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  {loading ? 'Validating Token...' : `Enter ${targetRole === 'admin' ? 'Admin Control' : 'Staff Workspace'}`}
                </button>
              </div>
            </form>

            <div className="pt-2 border-t border-[#1E3A5F] text-center space-y-1">
              <p className="text-[11px] text-slate-400">
                Authorized practitioners and compliance reviewers only.
              </p>
              <p className="text-[10px] text-slate-500">
                Lost your security token or password? Contact firm IT or request an administrator invite re-issue.
              </p>
            </div>
          </>
        ) : (
          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Administrative Invitation Token *</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="inv_seed_marcus_2026"
                  value={invitationToken}
                  onChange={(e) => setInvitationToken(e.target.value)}
                  className="flex-1 bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 font-mono text-white focus:outline-none focus:border-[#C6A15B]"
                />
                <button
                  type="button"
                  onClick={handleLookupInvitation}
                  disabled={inviteChecking}
                  className="px-3 py-2 bg-[#1E3A5F] hover:bg-[#2B4E7E] text-white font-bold rounded-lg text-xs"
                >
                  Verify
                </button>
              </div>
            </div>

            {invitationDetails && (
              <div className="p-3 bg-[#07172B] rounded-xl border border-emerald-500/40 text-[11px] space-y-1.5 text-slate-300">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Verified Invitation from Desmond Hinds</span>
                </div>
                <div>Invited Email: <strong className="text-white">{invitationDetails.email}</strong></div>
                <div>Role: <strong className="text-amber-400 capitalize">{invitationDetails.role}</strong></div>
                <div>Department: <strong className="text-white">{invitationDetails.department}</strong></div>
              </div>
            )}

            <form onSubmit={handleAcceptInvitation} className="space-y-4 pt-2">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Set Staff Password *</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Create your practitioner password"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2.5 text-white focus:outline-none focus:border-[#C6A15B]"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !invitationToken || !invitePassword}
                className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{loading ? 'Activating Credentials...' : 'Accept Invitation & Launch Onboarding'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
