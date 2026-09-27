import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  UserCheck,
  Building2,
  Smartphone,
  FileText,
  Key,
  HardDrive,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  RefreshCw,
  ExternalLink,
  Users,
  Layers,
  Laptop
} from 'lucide-react';
import { User } from '../../../types';
import { ProfileSecurityTab } from '../../../types/clientPortal';
import { AuditActivityView } from './AuditActivityView';

interface ProfileSecurityViewProps {
  currentUser: User | null;
  initialTab?: ProfileSecurityTab;
}

export const ProfileSecurityView: React.FC<ProfileSecurityViewProps> = ({
  currentUser,
  initialTab = 'taxpayer_profile'
}) => {
  const [activeTab, setActiveTab] = useState<ProfileSecurityTab>(initialTab);
  const [showSSN, setShowSSN] = useState(false);
  const [showEIN, setShowEIN] = useState(false);

  // Storage selection state
  const [selectedStorageProvider, setSelectedStorageProvider] = useState<'platform_vault' | 'google_drive' | 'one_drive' | 'aws_s3'>('platform_vault');
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Active sessions
  const [sessions, setSessions] = useState([
    {
      id: 'sess_01',
      device: 'MacBook Pro 16" (macOS Sonoma 14.3)',
      browser: 'Chrome 122.0.6261.128',
      ipMasked: '73.189.•••.•••',
      location: 'Columbia, SC, United States',
      current: true,
      lastActive: 'Active Now'
    },
    {
      id: 'sess_02',
      device: 'iPhone 15 Pro (iOS 17.4)',
      browser: 'Safari Mobile 17.4',
      ipMasked: '174.202.•••.•••',
      location: 'Charleston, SC, United States',
      current: false,
      lastActive: '3 hours ago'
    }
  ]);

  const handleRevokeSession = (sessionId: string) => {
    setSessions(prev => prev.filter(s => s.id !== sessionId));
  };

  const handleSelectStorage = (provider: typeof selectedStorageProvider) => {
    setSelectedStorageProvider(provider);
    if (provider === 'platform_vault') {
      setStorageNotice('Platform-Managed Secure Vault selected: Protected with envelope encryption (AES-256) and dedicated tenant keys.');
    } else {
      setStorageNotice(`External Storage (${provider.replace('_', ' ').toUpperCase()}) selected: Note that external storage is governed by your cloud provider’s access model and retention policies.`);
    }
  };

  return (
    <div className="space-y-6" id="client-profile-security-container">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#0B2748]">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#C99A3D]">
            Identity Safeguards &bull; FTC / GLBA / IRS PUB 4557
          </div>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight mt-0.5">
            Profile, Security &amp; Data Controls
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Identity credentials, entity governance, storage provider selection, active sessions, and privacy consents.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4" />
          <span>Security Level: Enterprise Tier</span>
        </div>
      </div>

      {/* Profile & Security Sub-Navigation */}
      <div className="flex items-center gap-1 bg-[#07172B] border border-[#1E3A5F] p-1 rounded-xl text-xs overflow-x-auto">
        {[
          { key: 'taxpayer_profile', label: 'Taxpayer Profile', icon: UserCheck },
          { key: 'business_entity', label: 'Business Entities', icon: Building2 },
          { key: 'dependents_reps', label: 'Dependents & Reps', icon: Users },
          { key: 'storage_selection', label: 'Storage Selection', icon: HardDrive },
          { key: 'devices_sessions', label: 'Devices & Sessions', icon: Laptop },
          { key: 'mfa_security', label: 'MFA & Credentials', icon: Key },
          { key: 'privacy_consent', label: 'Privacy (IRC 7216)', icon: Lock },
          { key: 'data_export_closure', label: 'Export & Closure', icon: Download },
          { key: 'audit_activity', label: 'Compliance Audit Trail', icon: ShieldCheck }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as ProfileSecurityTab)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'bg-[#C99A3D] text-[#06172C] shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-[#0A1F38]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {storageNotice && (
        <div className="p-4 rounded-xl bg-[#0B2748] border border-[#C99A3D]/50 text-slate-200 text-xs flex items-center justify-between">
          <span>{storageNotice}</span>
          <button type="button" onClick={() => setStorageNotice(null)} className="text-[#C99A3D] hover:underline font-bold">Dismiss</button>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 1. TAXPAYER PROFILE */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'taxpayer_profile' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Primary Taxpayer Identification
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Verified identity data used for IRS e-file authentication and SSA record matching.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
              <span className="text-slate-400 block">Primary Taxpayer Legal Name</span>
              <div className="font-bold text-white text-sm mt-0.5">{currentUser?.name || 'Robert Perotti'}</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
              <span className="text-slate-400 block">Social Security Number (SSN)</span>
              <div className="flex items-center justify-between mt-0.5">
                <span className="font-mono font-bold text-white text-sm">
                  {showSSN ? '•••-••-8192' : '•••-••-••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowSSN(!showSSN)}
                  className="text-slate-400 hover:text-white p-1"
                >
                  {showSSN ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
              <span className="text-slate-400 block">Filing Address (Form 1040)</span>
              <div className="font-semibold text-white mt-0.5">1428 Palmetto Crest Way, Columbia, SC 29201</div>
            </div>

            <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#1E3A5F]">
              <span className="text-slate-400 block">Filing Status</span>
              <div className="font-semibold text-white mt-0.5">Married Filing Jointly (Sarah Perotti, Spouse)</div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 2. BUSINESS ENTITIES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'business_entity' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Associated Business Entities &amp; Beneficial Ownership (CTA)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Federal Employer Identification Numbers (EINs) and FinCEN beneficial ownership registry status.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold text-white text-sm">Perotti Advisory Group, LLC</div>
                <div className="text-slate-400 text-[11px]">S-Corporation (Form 1120-S) &bull; South Carolina</div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 self-start sm:self-auto">
                ✓ Active Standing
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] text-[11px] text-slate-300">
              <div>
                <span>Employer Identification Number (EIN):</span>
                <div className="font-mono font-bold text-white mt-0.5">••-•••4912</div>
              </div>
              <div>
                <span>State of Organization:</span>
                <div className="font-bold text-white mt-0.5">South Carolina</div>
              </div>
              <div>
                <span>FinCEN BOI Status:</span>
                <div className="text-emerald-400 font-bold mt-0.5">✓ Initial Report Filed</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 3. DEPENDENTS & AUTHORIZED REPRESENTATIVES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'dependents_reps' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Dependents &amp; Authorized Representatives (Form 2848 / 8821)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Individuals claimed on Form 1040 and professionals authorized to represent you before the IRS.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2">
              <div className="font-bold text-[#E2BD67] uppercase tracking-wider">Authorized Practice Representative:</div>
              <div className="text-white font-bold text-sm">Desmond Hinds, Founder &amp; CEO (A/R Tax Services, LLC)</div>
              <div className="text-slate-300">IRS Centralized Authorization File (CAF) / PTIN Authorized</div>
              <div className="text-emerald-400 text-[11px] font-semibold">✓ Form 8821 Tax Information Authorization Active</div>
            </div>

            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2">
              <div className="font-bold text-[#E2BD67] uppercase tracking-wider">Qualifying Dependents (Child Tax Credit):</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300">
                <div className="p-2.5 rounded-lg bg-[#07172B] border border-[#1E3A5F]">
                  <div className="text-white font-bold">Liam Perotti (Son, Age 11)</div>
                  <div className="text-[11px] text-slate-400">SSN Verified &bull; Full CTC Eligible ($2,000)</div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#07172B] border border-[#1E3A5F]">
                  <div className="text-white font-bold">Maya Perotti (Daughter, Age 8)</div>
                  <div className="text-[11px] text-slate-400">SSN Verified &bull; Full CTC Eligible ($2,000)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 4. STORAGE SELECTION (SECTION 6) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'storage_selection' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Document Vault &amp; External Storage Selection
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Select where your permanent tax records and workpapers are securely archived.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Platform-Managed Vault */}
            <div
              onClick={() => handleSelectStorage('platform_vault')}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                selectedStorageProvider === 'platform_vault'
                  ? 'bg-[#0E2849] border-[#C99A3D] ring-1 ring-[#C99A3D]'
                  : 'bg-[#06172C] border-[#1E3A5F] hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-[#C99A3D]" />
                  <span className="font-bold text-white text-sm">Platform-Managed Vault</span>
                </div>
                {selectedStorageProvider === 'platform_vault' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C99A3D] text-[#06172C]">Active</span>
                )}
              </div>
              <p className="text-slate-300 leading-relaxed">
                Firm-hosted private cloud. Envelope encryption at rest using AES-256 and unique tenant encryption keys.
              </p>
              <div className="text-[11px] text-slate-400 border-t border-[#1E3A5F] pt-2">
                Storage Quota: <strong className="text-white">1.2 GB of 25.0 GB used (5%)</strong>
              </div>
            </div>

            {/* Google Drive */}
            <div
              onClick={() => handleSelectStorage('google_drive')}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                selectedStorageProvider === 'google_drive'
                  ? 'bg-[#0E2849] border-[#C99A3D] ring-1 ring-[#C99A3D]'
                  : 'bg-[#06172C] border-[#1E3A5F] hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-blue-400" />
                  <span className="font-bold text-white text-sm">Google Drive</span>
                </div>
                {selectedStorageProvider === 'google_drive' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C99A3D] text-[#06172C]">Active</span>
                )}
              </div>
              <p className="text-slate-300 leading-relaxed">
                Archives sync directly to your dedicated Google Workspace drive. Governed by Google’s security policies.
              </p>
              <div className="text-[11px] text-slate-400 border-t border-[#1E3A5F] pt-2">
                Folder: <strong className="text-white">A/R Tax Services Vault</strong>
              </div>
            </div>

            {/* Microsoft OneDrive */}
            <div
              onClick={() => handleSelectStorage('one_drive')}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                selectedStorageProvider === 'one_drive'
                  ? 'bg-[#0E2849] border-[#C99A3D] ring-1 ring-[#C99A3D]'
                  : 'bg-[#06172C] border-[#1E3A5F] hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-sky-400" />
                  <span className="font-bold text-white text-sm">Microsoft OneDrive</span>
                </div>
                {selectedStorageProvider === 'one_drive' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C99A3D] text-[#06172C]">Active</span>
                )}
              </div>
              <p className="text-slate-300 leading-relaxed">
                Connect your Microsoft 365 tenant for direct SharePoint/OneDrive sync.
              </p>
              <div className="text-[11px] text-slate-400 border-t border-[#1E3A5F] pt-2">
                Status: Available for OAuth Link
              </div>
            </div>

            {/* AWS S3 Client Vault */}
            <div
              onClick={() => handleSelectStorage('aws_s3')}
              className={`p-4 rounded-xl border cursor-pointer transition-all space-y-3 ${
                selectedStorageProvider === 'aws_s3'
                  ? 'bg-[#0E2849] border-[#C99A3D] ring-1 ring-[#C99A3D]'
                  : 'bg-[#06172C] border-[#1E3A5F] hover:border-slate-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-amber-400" />
                  <span className="font-bold text-white text-sm">AWS S3 Client Bucket</span>
                </div>
                {selectedStorageProvider === 'aws_s3' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C99A3D] text-[#06172C]">Active</span>
                )}
              </div>
              <p className="text-slate-300 leading-relaxed">
                Direct client-controlled S3 bucket with Object Lock for immutable legal hold compliance.
              </p>
              <div className="text-[11px] text-slate-400 border-t border-[#1E3A5F] pt-2">
                Encryption: Client KMS Key
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 5. DEVICES & ACTIVE SESSIONS */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'devices_sessions' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Authenticated Devices &amp; Active Portal Sessions
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Review browsers and hardware authorized to access confidential return transcripts.
            </p>
          </div>

          <div className="space-y-3 text-xs">
            {sessions.map((sess) => (
              <div
                key={sess.id}
                className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Laptop className="w-4 h-4 text-[#C99A3D]" />
                    <span className="font-bold text-white text-sm">{sess.device}</span>
                    {sess.current && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">Current Device</span>
                    )}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {sess.browser} &bull; IP: <span className="font-mono text-slate-300">{sess.ipMasked}</span> &bull; {sess.location}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400">{sess.lastActive}</span>
                  {!sess.current && (
                    <button
                      type="button"
                      onClick={() => handleRevokeSession(sess.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-500/40 text-[11px] font-bold transition-colors"
                    >
                      Revoke Access
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 6. MULTI-FACTOR AUTHENTICATION */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'mfa_security' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Multi-Factor Authentication &amp; Credentials
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Required for all Form 8879 authorizations under IRS Publication 4557 security standards.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Key className="w-5 h-5 text-emerald-400" />
                <div>
                  <span className="font-bold text-white text-sm">TOTP Authenticator App (Google / 1Password)</span>
                  <div className="text-slate-400 text-[11px]">Time-based one-time passcode algorithm</div>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                ✓ Enabled &amp; Verified
              </span>
            </div>

            <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] text-slate-300">
              Your authenticator is required every time you authorize IRS Form 8879 or export unmasked Social Security numbers.
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 7. PRIVACY & CONSENT CONTROLS (IRC § 7216) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'privacy_consent' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Privacy &amp; Statutory Consent Controls (IRC § 7216)
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Internal Revenue Code Section 7216 limits the disclosure or use of tax return information without explicit consent.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] text-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-sm">Tax Advisory &amp; Proactive Scenario Planning Consent</span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                ✓ Granted Jan 11, 2026
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Allows A/R Tax Services, LLC advisors to analyze your Form 1040 and K-1 records to model Section 179 depreciation and pass-through optimization strategies.
            </p>
            <div className="text-[11px] text-slate-400 border-t border-[#1E3A5F] pt-2">
              Consent Valid Through: <strong className="text-white">December 31, 2026</strong> &bull; You may revoke this consent in writing at any time.
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 8. DATA EXPORT & ACCOUNT CLOSURE */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'data_export_closure' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 shadow-lg space-y-5">
          <div className="border-b border-[#0B2748] pb-3">
            <h2 className="font-serif text-lg font-bold text-white">
              Complete Data Export &amp; Account Closure
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Download your complete client archive or initiate formal account closure and document retention transition.
            </p>
          </div>

          {actionNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{actionNotice}</span>
              </div>
              <button 
                type="button" 
                onClick={() => setActionNotice(null)} 
                className="text-emerald-400 hover:text-white font-bold text-xs ml-2"
              >
                ✕
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="font-bold text-white text-sm">Export Complete Client Archive</div>
              <p className="text-slate-300">
                Download an encrypted ZIP package containing all uploaded source documents, Form 1040 PDF copies, Form 8879 signatures, and audit trails.
              </p>
              <button
                type="button"
                onClick={() => setActionNotice('Preparing encrypted client archive package (ZIP). A secure download token will be emailed to your authorized address.')}
                className="px-4 py-2 rounded-xl bg-[#0B2748] hover:bg-[#11355F] text-white border border-[#C99A3D]/40 font-bold transition-colors flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#C99A3D]" />
                <span>Export Client Archive (ZIP)</span>
              </button>
            </div>

            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <div className="font-bold text-rose-400 text-sm">Account Closure &amp; Legal Hold</div>
              <p className="text-slate-300">
                Formal account closure initiates our 7-year IRS compliance archive before final record purging under Circular 230 rules.
              </p>
              <button
                type="button"
                onClick={() => setActionNotice('Formal account closure ticket dispatched. Desmond Hinds, Founder & CEO, will review statutory filing requirements.')}
                className="px-4 py-2 rounded-xl bg-rose-900/30 hover:bg-rose-900/50 text-rose-300 border border-rose-500/40 font-bold transition-colors"
              >
                Request Account Closure
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* 9. COMPLIANCE AUDIT TRAIL (Section 24) */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'audit_activity' && (
        <AuditActivityView />
      )}
    </div>
  );
};
