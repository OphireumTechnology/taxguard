import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';
import { requestPasswordReset } from '../../firebase/auth';
import { 
  Lock, 
  Mail, 
  Key, 
  Fingerprint, 
  UserCheck, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Building2, 
  User,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

export const ClientLoginPage: React.FC = () => {
  const { login, setCurrentPage } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot Password State
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      setCurrentPage(result.redirectPage || 'stage_one_onboard');
    } else {
      setError(result.error || 'Invalid client credentials. Please check your email and password.');
    }
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setError(null);
    setResetSuccess(null);
    const result = await requestPasswordReset(resetEmail.trim());
    setResetLoading(false);
    if (result.success) {
      setResetSuccess(`A secure password reset link has been dispatched to ${resetEmail}. Check your inbox and spam folders.`);
    } else {
      setError(result.error || 'Unable to send password reset email. Please verify the address.');
    }
  };

  const handleBiometricAuth = () => {
    setError('Biometric sign-in is unavailable until server-verified WebAuthn credentials are configured. Please sign in with your password.');
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
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
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
                  type="text"
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
                    type="text"
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

            {/* Biometric WebAuthn Simulator */}
            <div className="pt-4 border-t border-[#1E3A5F] space-y-3 text-center">
              <span className="text-[11px] text-slate-400 block">Or authenticate with device hardware:</span>
              <button
                type="button"
                onClick={handleBiometricAuth}
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[#07172B] hover:bg-[#132E52] border border-[#1E3A5F] text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Fingerprint className="w-4 h-4 text-[#C6A15B]" />
                Touch ID / Face ID Biometric Login
              </button>
            </div>

            <div className="text-center text-xs text-slate-400 pt-2">
              Don't have an account yet?{' '}
              <button
                onClick={() => setCurrentPage('client_register')}
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
  const { register, setCurrentPage } = useApp();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [category, setCategory] = useState('individual');
  const [contactMethod, setContactMethod] = useState('portal');
  const [timeZone, setTimeZone] = useState('America/New_York');
  const [referralSource, setReferralSource] = useState('Referral / Colleague');
  const [password, setPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service, Privacy Policy and IRC § 7216 disclosure to proceed.');
      return;
    }
    setError(null);
    setLoading(true);

    const fullName = [firstName, middleName, lastName].filter(Boolean).join(' ');

    const success = await register({
      name: fullName,
      email,
      password,
      phone,
      company: category !== 'individual' ? company : '',
      role: 'client',
      clientType: category === 'individual' ? 'individual' : 'business',
      taxFilingType: category === 'scorp' ? 'Form 1120-S (S-Corporation)' : category === 'llc' ? 'LLC (Schedule C / Partnership)' : 'Form 1040 (Individual)',
    });
    setLoading(false);

    if (success) {
      // Immediately route to Identity Verification Wizard (Stage One Onboard)
      setCurrentPage('stage_one_onboard');
    } else {
      setError('Unable to complete registration. Email may already be in use.');
    }
  };

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
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/40 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
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
                type="text"
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

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Secure Password *</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimum 8 characters with letters, numbers, symbols"
              className="w-full bg-[#07172B] border border-[#1E3A5F] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[#C6A15B]"
            />
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
              disabled={loading}
              className="w-full py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all shadow-lg disabled:opacity-50"
            >
              {loading ? 'Initializing Encrypted Account...' : 'Register & Begin Onboarding Dossier'}
            </button>
          </div>

          <div className="text-center text-xs text-slate-400 pt-2">
            Already registered?{' '}
            <button
              type="button"
              onClick={() => { window.location.hash = '#/client/login'; }}
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

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result: any = await login(email, password, targetRole);
    setLoading(false);
    if (result === true || (result && result.success)) {
      if (targetRole === 'admin') {
        setCurrentPage('admin_dashboard');
      } else {
        setCurrentPage('accountant_workspace');
      }
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
      // Launch staff onboarding wizard directly
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
            onClick={() => { setLoginMode('signin'); setError(null); }}
            className={`py-2 rounded-lg text-xs font-bold transition-all ${
              loginMode === 'signin' ? 'bg-[#C6A15B] text-[#07172B]' : 'text-slate-300 hover:text-white'
            }`}
          >
            Staff Sign In
          </button>
          <button
            type="button"
            onClick={() => { setLoginMode('accept_invitation'); setError(null); }}
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
          /* ACCEPT INVITATION FLOW */
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



