/**
 * A/R Tax Services, LLC - Role-Based Practice & Client Login Page
 * Official brand identity: Deep Navy (#06172C, #0A2544, #0D2340), Classic Gold (#C99A32, #E8C66A).
 * Includes official company logo, company name, rate limiting, and password visibility toggle.
 */

import React, { useState, useEffect } from 'react';
import { DemoRole, DEMO_ROLES, DemoRoleConfig } from '../types';
import { DemoAuthService } from '../services/DemoAuthService';
import { useApp } from '../../context/AppContext';
import { DeveloperContactNotice } from './DeveloperContactNotice';
import { DemoBanner } from './DemoBanner';
import { BrandLogo } from '../../components/common/BrandLogo';
import { Lock, Eye, EyeOff, ArrowLeft, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';

interface RoleLoginPageProps {
  role: DemoRole;
  onSuccess: () => void;
  onNavigateHome: () => void;
}

export const RoleLoginPage: React.FC<RoleLoginPageProps> = ({
  role,
  onSuccess,
  onNavigateHome
}) => {
  const roleConfig: DemoRoleConfig = DEMO_ROLES[role];
  const { login: taxGuardLogin } = useApp();

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const normalizedLoginId = loginId.trim().toLowerCase();

  /*
   * Login environment presentation:
   *
   * - Blank login page remains neutral.
   * - artest2026 is explicitly DEMO.
   * - Client email addresses are LIVE.
   *
   * This affects presentation only.
   * Authentication authority remains AppContext/Firebase/server.
   */
  const isDemoLogin =
    normalizedLoginId === 'artest2026';

  const isLiveClientLogin =
    role === 'client' &&
    normalizedLoginId.length > 0 &&
    normalizedLoginId !== 'artest2026';


  // Check if already authenticated
  useEffect(() => {
    if (DemoAuthService.isAuthenticated(role)) {
      onSuccess();
    }
  }, [role, onSuccess]);

  // Periodic lockout timer countdown
  useEffect(() => {
    const checkLockout = () => {
      const normalizedLoginId = loginId.trim().toLowerCase();

      // Demo lockout applies only to the isolated demo credential.
      if (normalizedLoginId !== 'artest2026') {
        setLockoutRemaining(0);
        return;
      }

      const remaining = DemoAuthService.getRemainingLockoutSeconds(role);
      setLockoutRemaining(remaining);

      if (remaining > 0 && !errorMessage) {
        setErrorMessage(
          `Account temporarily locked due to repeated failed attempts. Retry in ${remaining}s.`
        );
      }
    };

    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, [role, errorMessage, loginId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const normalizedLoginId = loginId.trim().toLowerCase();

    if (!normalizedLoginId || !password) {
      setErrorMessage('Please enter both Login ID and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      /*
       * DEMO AUTHENTICATION
       *
       * Only the explicit artest2026 credential is allowed
       * through DemoAuthService.
       */
      if (normalizedLoginId === 'artest2026') {
        const result = await DemoAuthService.authenticate(
          role,
          normalizedLoginId,
          password
        );

        if (result.success) {
          setPassword('');
          setLockoutRemaining(0);
          onSuccess();
          return;
        }

        setPassword('');
        setErrorMessage(
          result.error || 'Invalid Login ID or password.'
        );

        const remaining =
          DemoAuthService.getRemainingLockoutSeconds(role);

        setLockoutRemaining(remaining);
        return;
      }

      /*
       * LIVE CLIENT AUTHENTICATION
       *
       * Normal client email accounts are authenticated through
       * AppContext -> Firebase -> TaxGuard firebase-session.
       *
       * DemoAuthService and its lockout counter are not used.
       */
      if (role !== 'client') {
        setPassword('');
        setErrorMessage(
          'This login identifier is not valid for this workspace.'
        );
        return;
      }

      const result = await taxGuardLogin(
        normalizedLoginId,
        password
      );

      setPassword('');
      setLockoutRemaining(0);

      if (result.success) {
        onSuccess();
        return;
      }

      setErrorMessage(
        result.error ||
        'Unable to authenticate the LIVE client account.'
      );
    } catch (error: any) {
      setPassword('');
      setLockoutRemaining(0);
      setErrorMessage(
        error?.message ||
        'Unexpected authentication failure. Please contact developer support.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#06172C] text-slate-100 flex flex-col font-sans antialiased selection:bg-[#C99A32] selection:text-[#06172C] relative">
      {/* Background Lighting & Texture */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0A2544]/80 via-[#06172C] to-[#030B16]" />
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#C99A32_1px,transparent_1px)] [background-size:24px_24px]" />

      {/* Persistent Demo Banner in Brand Navy */}
      {isDemoLogin && (
        <DemoBanner variant="navy" />
      )}

      {/* Top Navigation Header with Brand Logo & Role Badge */}
      <header className="relative z-10 border-b border-[#1E3A5F] bg-[#07182E]/90 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between">
        <button
          onClick={onNavigateHome}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-[#C99A32] group-hover:-translate-x-0.5 transition-transform" />
          <span>Return to Public Website</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline-block text-xs font-semibold text-slate-300 tracking-wider">
            A/R TAX SERVICES, LLC
          </span>
          <span className="px-2.5 py-1 rounded bg-[#0A2544] border border-[#C99A32]/40 text-[#E8C66A] font-semibold text-[10px] sm:text-xs tracking-wider uppercase">
            {roleConfig.department}
          </span>
        </div>
      </header>

      {/* Main Login Area */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        {/* Prominent Company Logo and Title Section */}
        <div className="flex flex-col items-center text-center mb-6">
          <BrandLogo 
            variant="full" 
            size="xl" 
            onClick={onNavigateHome} 
            className="cursor-pointer transition-transform hover:scale-[1.02]"
            showSubtitleOnMobile={true}
          />
          <div className="h-0.5 w-16 bg-gradient-to-r from-transparent via-[#C99A32] to-transparent my-2" />
        </div>

        {/* Executive Login Card */}
        <div className="w-full max-w-md bg-[#0D2340] border border-[#1E3A5F] shadow-[0_25px_60px_rgba(0,0,0,0.65),0_0_30px_rgba(201,154,50,0.08)] rounded-2xl p-6 sm:p-8 space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2 border-b border-[#1E3A5F] pb-5">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-b from-[#0A2544] to-[#07182E] border border-[#C99A32]/40 text-[#C99A32] shadow-[0_0_20px_rgba(201,154,50,0.15)] mb-1">
              <Lock className="w-5 h-5" />
            </div>
            <h2 className="text-base sm:text-lg font-bold font-serif tracking-wide text-white uppercase">
              {roleConfig.title} Sign In
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              {roleConfig.description}
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div 
              className="border border-rose-500/40 bg-rose-500/10 rounded-xl p-3.5 text-xs text-rose-200 space-y-2"
              role="alert"
            >
              <div className="flex items-start gap-2 font-medium">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
              
              <DeveloperContactNotice 
                reason="Authentication / Access Verification Assistance" 
                variant="navy" 
              />
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Login ID Input */}
            <div className="space-y-1.5">
              <label 
                htmlFor="demo-login-id" 
                className="block text-xs font-semibold uppercase tracking-wider text-slate-200"
              >
                Login ID / Email
              </label>
              <input
                id="demo-login-id"
                name="username"
                type="text"
                autoComplete="username"
                disabled={lockoutRemaining > 0 || isSubmitting}
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                placeholder="Enter login ID"
                className="w-full px-3.5 py-2.5 text-sm bg-[#07182E] border border-[#1E3A5F] text-white rounded-lg focus:outline-none focus:border-[#C99A32] focus:ring-1 focus:ring-[#C99A32] placeholder-slate-500 disabled:opacity-50 transition-colors"
              />
            </div>

            {/* Password Input with Show/Hide Toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label 
                  htmlFor="demo-password" 
                  className="block text-xs font-semibold uppercase tracking-wider text-slate-200"
                >
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  id="demo-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  disabled={lockoutRemaining > 0 || isSubmitting}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full px-3.5 py-2.5 pr-10 text-sm bg-[#07182E] border border-[#1E3A5F] text-white rounded-lg focus:outline-none focus:border-[#C99A32] focus:ring-1 focus:ring-[#C99A32] placeholder-slate-500 disabled:opacity-50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-[#C99A32] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
            {/* Client Registration */}
            {role === 'client' && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => {
                    window.history.pushState(
                      { page: 'client_register' },
                      '',
                      '/#/client/register'
                    );

                    window.dispatchEvent(new HashChangeEvent('hashchange'));
                  }}
                  className="w-full py-3 px-4 border border-[#C99A32] bg-[#07182E] hover:bg-[#0A2544] text-[#E8C66A] text-xs font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  Register
                </button>

                <p className="text-center text-[10px] text-slate-400">
                  New client? Create your secure TaxGuard account and begin onboarding.
                </p>
              </div>
            )}


        {/* Security Assurance Line */}
            <div className="flex items-center gap-2 text-[11px] text-slate-300 pt-0.5">
              <ShieldCheck className="w-4 h-4 text-[#C99A32] flex-shrink-0" />
              <span>'Secure client authentication through A/R Tax Services TaxGuard.'</span>
            </div>

                        <div className="text-center pt-1">
              <p className="text-[10px] text-slate-400">
                Already have an account? Sign in below.
              </p>
            </div>

            {/* Submit Button in Classic Gold */}
            <button
              type="submit"
              disabled={lockoutRemaining > 0 || isSubmitting}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#C99A32] via-[#D4AF37] to-[#E8C66A] hover:from-[#B88928] hover:via-[#C99A32] hover:to-[#D4AF37] text-[#06172C] text-xs font-bold uppercase tracking-wider rounded-lg shadow-[0_4px_16px_rgba(201,154,50,0.35)] hover:shadow-[0_6px_22px_rgba(201,154,50,0.45)] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>
                {isSubmitting ? 'Authenticating...' : lockoutRemaining > 0 ? `Locked (${lockoutRemaining}s)` : 'SIGN IN TO DASHBOARD'}
              </span>
            </button>
          </form>

          {/* Demonstration Architecture Footer */}
          <div className="pt-3 border-t border-[#1E3A5F] text-center text-[11px] text-slate-400 space-y-1">
            <div>
              Protected Endpoint: <span className="font-mono text-[#E8C66A]">{roleConfig.dashboardPath}</span>
            </div>
            <div className="text-[10px] text-slate-500">
              Rate limiting: 5 consecutive attempts permitted before 60s temporary lockout.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};





