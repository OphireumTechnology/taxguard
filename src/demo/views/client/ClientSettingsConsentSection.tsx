import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Smartphone,
  Key,
  FileCheck,
  Bell,
  Clock,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Download,
  Info,
  ChevronRight
} from 'lucide-react';
import { demoDataStore } from '../../services/DemoDataService';

interface ClientSettingsConsentSectionProps {
  clientId?: string;
  onOpenAssistant?: () => void;
  defaultTab?: 'security' | 'consents' | 'notifications' | 'sessions';
}

export const ClientSettingsConsentSection: React.FC<ClientSettingsConsentSectionProps> = ({
  clientId = 'cli_perotti',
  onOpenAssistant,
  defaultTab = 'security'
}) => {
  const [activeTab, setActiveTab] = useState<'security' | 'consents' | 'notifications' | 'sessions'>(defaultTab);
  const [mfaEnabled, setMfaEnabled] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const handleExportAuditTrail = () => {
    const auditData = {
      client: clientId,
      exportTimestamp: new Date().toISOString(),
      mfaStatus: mfaEnabled ? 'Enforced' : 'Disabled',
      registeredSessions: sessions,
      activeConsents: consents
    };
    const blob = new Blob([JSON.stringify(auditData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Security_Audit_Trail_${clientId}_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setActionNotice('Security and audit trail exported successfully.');
    setTimeout(() => setActionNotice(null), 4000);
  };

  // Active Consents
  const consents = [
    {
      title: 'IRS Form 2848 Power of Attorney & Declaration of Representative',
      scope: 'Federal Form 1120-S & Form 1040 (Tax Years 2022–2026)',
      representative: 'Elena Rostova, CPA (CAF # 0309-88192R)',
      status: 'Active on IRS Centralized Authorization File (CAF)',
      dateExecuted: 'January 10, 2025',
      expires: 'Perpetual until revoked'
    },
    {
      title: 'Internal Revenue Code § 7216 Tax Disclosure Consent',
      scope: 'Authorization to disclose tax information to commercial lending institutions upon written instruction',
      representative: 'A/R Tax Services, LLC Compliance',
      status: 'Active (Treas. Reg. § 301.7216-3 compliant)',
      dateExecuted: 'January 15, 2025',
      expires: 'January 15, 2027'
    },
    {
      title: 'Electronic Record & E-Signature Consent (ESIGN Act)',
      scope: 'Agreement to receive official tax documents, K-1s, and IRS notices via encrypted client portal',
      representative: 'A/R Tax Services, LLC',
      status: 'Active',
      dateExecuted: 'January 05, 2025',
      expires: 'Ongoing'
    },
    {
      title: '2025 Annual Master Engagement Agreement',
      scope: 'Comprehensive tax compliance, quarterly bookkeeping, and audit representation retainer',
      representative: 'Desmond Hinds, CEO & Managing Partner',
      status: 'Countersigned & Fully In Effect',
      dateExecuted: 'January 08, 2025',
      expires: 'December 31, 2025'
    }
  ];

  // Active Login Sessions
  const [sessions, setSessions] = useState([
    {
      id: 'sess_01',
      device: 'MacBook Pro (macOS 15.3 &bull; Chrome 133)',
      location: 'Columbia, South Carolina (IP: 75.140.82.11)',
      isCurrent: true,
      lastActive: 'Active Now',
      mfaVerified: 'TOTP Authenticator App'
    },
    {
      id: 'sess_02',
      device: 'iPhone 16 Pro (iOS 18.2 &bull; Safari Mobile)',
      location: 'Charlotte, North Carolina (IP: 174.98.112.4)',
      isCurrent: false,
      lastActive: 'Yesterday at 04:18 PM EST',
      mfaVerified: 'FaceID + SMS Passcode'
    }
  ]);

  const handleRevokeSession = (id: string, device: string) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    demoDataStore.logAudit({
      user: 'Michael Perotti',
      role: 'client',
      action: 'Revoked Active Login Session',
      record: device,
      result: 'Success (Simulated)',
      reason: 'Client security revocation'
    });
    setActionNotice(`Session for ${device} terminated.`);
    setTimeout(() => setActionNotice(null), 4000);
  };

  return (
    <div className="space-y-6" id="client-settings-consent-section">
      {/* Header Banner */}
      <div className="bg-white rounded-lg border border-[#D8DCE2] p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D8DCE2]">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-[#061A2F] text-[#E8C66A] text-[10px] font-mono font-bold uppercase rounded">
                Account Security &amp; Compliance
              </span>
              <span className="text-xs text-[#667085]">Form 2848 &bull; IRC § 7216 &bull; MFA</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#061A2F] mt-1">
              Security, Consents &amp; Authorized Representatives
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Manage multi-factor authentication, IRS Form 2848 authorizations, and privacy preferences.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAuditTrail}
              className="px-3.5 py-2 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-bold text-[#061A2F] flex items-center gap-1.5 cursor-pointer hover:bg-neutral-50 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit Trail</span>
            </button>
          </div>
        </div>

        {/* Action Notice */}
        {actionNotice && (
          <div className="mt-4 p-3 bg-[#FAF9F5] border border-[#C99A32] rounded text-xs text-[#061A2F] flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#C99A32]" />
              <span>{actionNotice}</span>
            </div>
            <span className="text-[10px] text-[#667085] font-mono">Logged to audit trail</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#D8DCE2] pt-4 overflow-x-auto">
          {[
            { id: 'security', label: 'MFA & Authentication', icon: Lock },
            { id: 'consents', label: 'Form 2848 & IRC § 7216 Consents', icon: ShieldCheck },
            { id: 'sessions', label: 'Active Sessions & Devices', icon: Smartphone },
            { id: 'notifications', label: 'Notification Preferences', icon: Bell }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-2 px-4 text-xs font-bold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'border-[#061A2F] text-[#061A2F]'
                    : 'border-transparent text-[#667085] hover:text-[#061A2F]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#C99A32]' : 'text-[#667085]'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: SECURITY */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-6 shadow-xs">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Multi-Factor Authentication &amp; Credentials</h3>
            <p className="text-xs text-[#667085]">IRS Security Summit Publication 4557 mandate for protecting taxpayer portals.</p>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#1B5E20]" />
                  <span className="font-bold text-sm text-[#061A2F]">Hardware / Authenticator App MFA (TOTP)</span>
                  <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-bold">
                    Enforced &bull; Active
                  </span>
                </div>
                <div className="text-xs text-[#667085] mt-0.5">
                  Time-based One-Time Password paired with 1Password / Google Authenticator.
                </div>
              </div>
              <button
                onClick={() => {
                  setActionNotice('MFA rotation initiated: Scan refreshed QR code with your authenticator app.');
                  setTimeout(() => setActionNotice(null), 4000);
                }}
                className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F] cursor-pointer hover:bg-white transition-colors"
              >
                Reconfigure Key
              </button>
            </div>

            <div className="p-4 bg-[#FBFAF7] border border-[#E5E7EB] rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#061A2F]" />
                  <span className="font-bold text-sm text-[#061A2F]">Encrypted SMS Backup Verification</span>
                  <span className="px-2 py-0.5 text-[10px] bg-white border border-[#D8DCE2] text-[#667085] rounded">
                    +1 (803) •••-4890
                  </span>
                </div>
                <div className="text-xs text-[#667085] mt-0.5">
                  Fallback secondary verification in the event of hardware device loss.
                </div>
              </div>
              <button
                onClick={() => {
                  setActionNotice('Backup phone verification updated and SMS verification code dispatched.');
                  setTimeout(() => setActionNotice(null), 4000);
                }}
                className="px-3 py-1.5 border border-[#D8DCE2] hover:border-[#061A2F] rounded text-xs font-medium text-[#061A2F] cursor-pointer hover:bg-white transition-colors"
              >
                Update Phone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CONSENTS */}
      {activeTab === 'consents' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Statutory Consents, Power of Attorney &amp; CAF Registry</h3>
            <p className="text-xs text-[#667085]">Legal authorizations empowering A/R Tax Services, LLC to represent your entity before the IRS.</p>
          </div>

          <div className="space-y-3">
            {consents.map((c, idx) => (
              <div key={idx} className="border border-[#D8DCE2] rounded-lg p-4 bg-[#FBFAF7] space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="font-bold text-sm text-[#061A2F]">{c.title}</div>
                  <span className="px-2 py-0.5 text-[10px] bg-[#E8F5E9] text-[#1B5E20] border border-[#C8E6C9] rounded font-bold whitespace-nowrap">
                    {c.status}
                  </span>
                </div>
                <div className="text-xs text-[#4B5563]">
                  <strong>Authorized Scope:</strong> {c.scope}
                </div>
                <div className="text-[11px] text-[#667085] flex flex-wrap items-center gap-3 pt-1 border-t border-[#E5E7EB]">
                  <span>Representative: <strong>{c.representative}</strong></span>
                  <span>&bull;</span>
                  <span>Executed: <strong>{c.dateExecuted}</strong></span>
                  <span>&bull;</span>
                  <span>Term: <strong>{c.expires}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Active Login Sessions &amp; Authorized Devices</h3>
            <p className="text-xs text-[#667085]">Monitored IP addresses and client devices currently authenticated to this vault.</p>
          </div>

          <div className="space-y-3">
            {sessions.map(s => (
              <div
                key={s.id}
                className="border border-[#D8DCE2] rounded-lg p-4 bg-[#FBFAF7] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#061A2F]" dangerouslySetInnerHTML={{ __html: s.device }} />
                    {s.isCurrent && (
                      <span className="px-2 py-0.5 text-[10px] bg-[#061A2F] text-[#E8C66A] rounded font-bold">
                        Current Session
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#667085]" dangerouslySetInnerHTML={{ __html: s.location }} />
                  <div className="text-[11px] text-[#667085]">
                    Status: <strong className="text-[#1B5E20]">{s.lastActive}</strong> &bull; Auth: {s.mfaVerified}
                  </div>
                </div>

                {!s.isCurrent && (
                  <button
                    onClick={() => handleRevokeSession(s.id, s.device)}
                    className="px-3 py-1.5 border border-red-200 text-red-700 hover:bg-red-50 text-xs font-medium rounded flex items-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Terminate Session</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: NOTIFICATIONS */}
      {activeTab === 'notifications' && (
        <div className="bg-white rounded-lg border border-[#D8DCE2] p-6 space-y-4 shadow-xs">
          <div className="border-b border-[#D8DCE2] pb-3">
            <h3 className="text-sm font-bold text-[#061A2F]">Filing Alerts &amp; Notification Channels</h3>
            <p className="text-xs text-[#667085]">Choose how you receive statutory deadline alerts and IRS e-file notifications.</p>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center justify-between p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded cursor-pointer">
              <div>
                <div className="font-bold text-[#061A2F]">IRS E-File Acceptance Alerts</div>
                <div className="text-[#667085]">Immediate alert when the IRS acknowledges and accepts your corporate return.</div>
              </div>
              <input type="checkbox" defaultChecked className="rounded text-[#061A2F]" />
            </label>

            <label className="flex items-center justify-between p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded cursor-pointer">
              <div>
                <div className="font-bold text-[#061A2F]">Quarterly Estimated Tax Safe Harbor Reminders</div>
                <div className="text-[#667085]">Notifications 14 days prior to quarterly voucher payment dates.</div>
              </div>
              <input type="checkbox" defaultChecked className="rounded text-[#061A2F]" />
            </label>

            <label className="flex items-center justify-between p-3 bg-[#FBFAF7] border border-[#E5E7EB] rounded cursor-pointer">
              <div>
                <div className="font-bold text-[#061A2F]">Monthly Bookkeeping Review Prompts</div>
                <div className="text-[#667085]">Alerts when new bank feeds require client payee or business purpose clarification.</div>
              </div>
              <input type="checkbox" defaultChecked className="rounded text-[#061A2F]" />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
