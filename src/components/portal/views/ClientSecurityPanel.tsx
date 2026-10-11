import React from 'react';
import type { User } from '../../../types';
import type { ProfileSecurityTab } from '../../../types/clientPortal';
import { ProfileEvidenceSections } from './ProfileEvidenceSections';

export function recordedMfaSetting(user: Pick<User, 'mfaEnabled'> | null) {
  return user?.mfaEnabled === true ? 'Recorded as enabled' : user?.mfaEnabled === false ? 'Recorded as disabled' : 'Not recorded';
}

export function ClientAuditUnavailable() {
  return <section className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-3 text-slate-300" aria-label="Client audit availability">
    <h2 className="font-bold text-white">Recorded Client Audit Activity</h2>
    <p role="status">An authorized durable client audit feed is unavailable in this workspace. No example consent, signature, security or workflow events are substituted.</p>
    <button type="button" disabled className="p-2 border border-slate-500 rounded-lg">Audit export unavailable</button>
  </section>;
}

export function ClientSecurityPanel({ tab, user, profile, status, onRetry }: { tab: ProfileSecurityTab; user: User | null; profile: any; status: 'loading' | 'ready' | 'error'; onRetry: () => void }) {
  if (tab === 'audit_activity') return <ClientAuditUnavailable/>;
  if (['taxpayer_profile', 'business_entity', 'dependents_reps', 'privacy_consent'].includes(tab)) {
    if (status === 'loading') return <p role="status">Loading your authorized profile records...</p>;
    if (status === 'error' || !profile) return <div role="alert"><p>Recorded profile unavailable. Retry to restore access.</p><button type="button" onClick={onRetry}>Retry profile records</button></div>;
    if (tab === 'privacy_consent') return <ProfileEvidenceSections section="consents" profile={profile}/>;
    if (tab === 'dependents_reps') return <><ProfileEvidenceSections section="representative" profile={profile}/><p>Dependent records are unavailable in this account-wide profile contract. Use your selected-year questionnaire for recorded tax-year information.</p></>;
    const personal = profile.personal || {};
    return <section className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-3 text-slate-300">
      <h2 className="font-bold text-white">{tab === 'business_entity' ? 'Recorded Entity Profile' : 'Recorded Taxpayer Profile'}</h2>
      <dl className="space-y-2"><dt>Recorded name</dt><dd>{personal.legalName || 'Not recorded'}</dd>
        <dt>Taxpayer type</dt><dd>{personal.taxpayerType || 'Not recorded'}</dd>
        <dt>Entity classification</dt><dd>{personal.entityClassification || 'Not recorded'}</dd>
        <dt>Masked taxpayer identifier</dt><dd>{personal.maskedTIN || 'Not recorded'}</dd>
      </dl><p>Recorded profile fields do not establish verified identity, entity standing or filing authority.</p>
    </section>;
  }
  const messages: Partial<Record<ProfileSecurityTab, [string, string]>> = {
    storage_selection: ['Storage Selection', 'Verified storage configuration and external-storage authorization are unavailable in this workspace. Use the existing private document workspace for authorized uploads.'],
    devices_sessions: ['Devices & Sessions', 'Verified device and session history is unavailable in this workspace. Session revocation requires an authorized backend operation.'],
    data_export_closure: ['Export & Closure', 'Archive export and account closure are unavailable. No export package, email, closure ticket or retention decision is created by this screen.'],
  };
  if (tab === 'mfa_security') return <section className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-3 text-slate-300"><h2 className="font-bold text-white">MFA & Credentials</h2><p>Recorded MFA setting: {recordedMfaSetting(user)}</p><p>This setting does not verify the current authentication factor, an enrolled device or signing authority. Credential management is unavailable in this workspace.</p></section>;
  const [title, description] = messages[tab] || ['Security', 'This integration is unavailable.'];
  return <section className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-3 text-slate-300"><h2 className="font-bold text-white">{title}</h2><p role="status">{description}</p>
    {tab === 'data_export_closure' && <><button type="button" disabled>Export client archive unavailable</button><button type="button" disabled>Account closure unavailable</button></>}
  </section>;
}
