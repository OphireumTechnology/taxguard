import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  UserCheck,
  Building2,
  Key,
  HardDrive,
  Download,
  Users,
  Laptop
} from 'lucide-react';
import { User } from '../../../types';
import { ProfileSecurityTab } from '../../../types/clientPortal';
import { ClientSecurityPanel } from './ClientSecurityPanel';
import { useAuthoritativeClientProfile } from '../../../hooks/useAuthoritativeClientProfile';

interface ProfileSecurityViewProps {
  currentUser: User | null;
  authLifecycleState: string;
  initialTab?: ProfileSecurityTab;
}

export const ProfileSecurityView: React.FC<ProfileSecurityViewProps> = ({
  currentUser,
  authLifecycleState,
  initialTab = 'taxpayer_profile'
}) => {
  const [activeTab, setActiveTab] = useState<ProfileSecurityTab>(initialTab);
  const [refresh, setRefresh] = useState(0);
  const profile = useAuthoritativeClientProfile(currentUser, authLifecycleState, refresh);
  if (!profile.allowed) return <p role="alert">An active authenticated client session is required.</p>;

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
            Recorded profile and consent information, with availability of security integrations.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4" />
          <span>Recorded profile and security information</span>
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
              aria-current={isActive ? 'page' : undefined}
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

      <ClientSecurityPanel tab={activeTab} user={currentUser} profile={profile.data} status={profile.status} onRetry={() => setRefresh(value => value + 1)}/>
    </div>
  );
};
