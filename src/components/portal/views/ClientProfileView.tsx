import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Lock,
  Eye,
  EyeOff,
  Edit2,
  Save,
  X,
  FileCheck,
  FolderLock,
  Download,
  Upload,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Send,
  HelpCircle,
  Calendar,
  Layers,
  Check
} from 'lucide-react';
import { User as UserType } from '../../../types';
import { useAuthoritativeClientProfile } from '../../../hooks/useAuthoritativeClientProfile';
import { ProfileEvidenceSections } from './ProfileEvidenceSections';
import { api } from '../../../services/api';

interface ClientProfileViewProps {
  currentUser: UserType | null;
  authLifecycleState: string;
  onNavigateToDocuments?: () => void;
  onNavigateToStageTwo?: () => void;
}

export type ProfileSectionKey =
  | 'personal'
  | 'contact'
  | 'representative'
  | 'identity'
  | 'engagement'
  | 'consents'
  | 'documents'
  | 'amendments';

export const ClientProfileView: React.FC<ClientProfileViewProps> = ({
  currentUser,
  authLifecycleState,
  onNavigateToDocuments,
  onNavigateToStageTwo
}) => {
  const [activeSection, setActiveSection] = useState<ProfileSectionKey>('personal');
  const [refresh, setRefresh] = useState(0);
  const profile = useAuthoritativeClientProfile(currentUser, authLifecycleState, refresh);
  const profileData = profile.data;
  const isLoading = profile.status === 'loading';
  const operationScope = useRef(profile.key);
  operationScope.current = profile.key;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Masking toggles
  const [showTIN, setShowTIN] = useState<boolean>(false);

  // Ordinary editing state (Contact info)
  const [isEditingContact, setIsEditingContact] = useState<boolean>(false);
  const [editPhone, setEditPhone] = useState<string>('');
  const [editMailingStreet, setEditMailingStreet] = useState<string>('');
  const [editMailingUnit, setEditMailingUnit] = useState<string>('');
  const [editMailingCity, setEditMailingCity] = useState<string>('');
  const [editMailingState, setEditMailingState] = useState<string>('');
  const [editMailingZip, setEditMailingZip] = useState<string>('');
  const [editEmailPref, setEditEmailPref] = useState<boolean>(true);
  const [editSmsPref, setEditSmsPref] = useState<boolean>(false);
  const [editPortalPref, setEditPortalPref] = useState<boolean>(true);
  const [isSavingOrdinary, setIsSavingOrdinary] = useState<boolean>(false);

  // Formal amendment modal state for sensitive fields
  const [amendmentModalOpen, setAmendmentModalOpen] = useState<boolean>(false);
  const [amendmentField, setAmendmentField] = useState<string>('legalName');
  const [amendmentFieldLabel, setAmendmentFieldLabel] = useState<string>('Legal Name');
  const [amendmentCurrentValue, setAmendmentCurrentValue] = useState<string>('');
  const [amendmentProposedValue, setAmendmentProposedValue] = useState<string>('');
  const [amendmentReason, setAmendmentReason] = useState<string>('');
  const [isSubmittingAmendment, setIsSubmittingAmendment] = useState<boolean>(false);
  const [amendmentSubmitError, setAmendmentSubmitError] = useState<string | null>(null);

  const fetchAuthoritativeProfile = async () => { setRefresh(value => value + 1); };

  const syncEditFields = (data: any) => {
    if (!data?.contact) return;
    setEditPhone(data.contact.phone || '');
    const mail = data.contact.mailingAddress || {};
    setEditMailingStreet(mail.street || '');
    setEditMailingUnit(mail.unit || '');
    setEditMailingCity(mail.city || '');
    setEditMailingState(mail.state || '');
    setEditMailingZip(mail.zip || '');
    const prefs = data.contact.communicationPreferences || {};
    setEditEmailPref(prefs.email !== false);
    setEditSmsPref(Boolean(prefs.sms));
    setEditPortalPref(prefs.portal !== false);
  };

  useEffect(() => {
    syncEditFields(profileData);
  }, [profileData]);
  useEffect(() => {
    setSuccessMessage(null); setErrorMessage(null); setShowTIN(false);
    setIsEditingContact(false); setAmendmentModalOpen(false); setAmendmentCurrentValue('');
    setAmendmentProposedValue(''); setAmendmentReason(''); setAmendmentSubmitError(null);
    setEditPhone(''); setEditMailingStreet(''); setEditMailingUnit(''); setEditMailingCity('');
    setEditMailingState(''); setEditMailingZip('');
    setIsSavingOrdinary(false); setIsSubmittingAmendment(false);
  }, [profile.key]);

  // Handle saving permitted ordinary profile fields
  const handleSaveOrdinaryContact = async () => {
    if (!profile.allowed || !profileData) return;
    const operationKey = profile.key;
    setIsSavingOrdinary(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const updates = {
      phone: editPhone,
      mailingAddress: {
        street: editMailingStreet,
        unit: editMailingUnit,
        city: editMailingCity,
        state: editMailingState,
        zip: editMailingZip,
        country: 'United States'
      },
      communicationPreferences: {
        email: editEmailPref,
        sms: editSmsPref,
        portal: editPortalPref
      }
    };

    try {
      await api.profile.updateOrdinary(updates);
      if (operationScope.current === operationKey) {
        setSuccessMessage('Contact information & communication preferences saved successfully.');
        setIsEditingContact(false);
        await fetchAuthoritativeProfile();
      }
    } catch {
      if (operationScope.current === operationKey) setErrorMessage('Contact updates could not be saved. Retry when the service is available.');
    } finally {
      if (operationScope.current === operationKey) setIsSavingOrdinary(false);
    }
  };

  // Open formal amendment modal for sensitive verified identity field
  const handleOpenAmendmentModal = (field: string, label: string, currentVal: string) => {
    setAmendmentField(field);
    setAmendmentFieldLabel(label);
    setAmendmentCurrentValue(currentVal);
    setAmendmentProposedValue('');
    setAmendmentReason('');
    setAmendmentSubmitError(null);
    setAmendmentModalOpen(true);
  };

  // Submit formal amendment request to Practice Console
  const handleSubmitAmendment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile.allowed || !profileData) return;
    const operationKey = profile.key;
    if (!amendmentProposedValue.trim()) {
      setAmendmentSubmitError('Proposed updated value is required.');
      return;
    }
    if (!amendmentReason.trim() || amendmentReason.trim().length < 5) {
      setAmendmentSubmitError('A detailed business or legal reason (at least 5 characters) is required.');
      return;
    }

    setIsSubmittingAmendment(true);
    setAmendmentSubmitError(null);

    try {
      await api.profile.requestAmendment({
          field: amendmentField,
          fieldLabel: amendmentFieldLabel,
          previousValue: amendmentCurrentValue,
          proposedValue: amendmentProposedValue.trim(),
          reason: amendmentReason.trim(),
          isSensitiveIdentityChange: true
      });
      if (operationScope.current === operationKey) {
        setSuccessMessage(
          `Formal amendment request for ${amendmentFieldLabel} recorded. It is currently pending review by A/R Tax Services CPAs.`
        );
        setAmendmentModalOpen(false);
        setActiveSection('amendments');
        await fetchAuthoritativeProfile();
      }
    } catch {
      if (operationScope.current === operationKey) setAmendmentSubmitError('Amendment could not be recorded. Please retry.');
    } finally {
      if (operationScope.current === operationKey) setIsSubmittingAmendment(false);
    }
  };

  if (!profile.allowed) return <p role="alert">An active authenticated client session is required to view your profile.</p>;
  if (profile.status === 'error') return <div role="alert" className="rounded-2xl bg-[#07172B] p-6 text-slate-300"><p>Your recorded profile could not be loaded. Retry to restore access.</p><button type="button" onClick={fetchAuthoritativeProfile}>Retry profile</button></div>;
  if (isLoading || !profileData) {
    return (
      <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-8 text-center space-y-4">
        <RefreshCw className="w-8 h-8 text-[#C6A15B] animate-spin mx-auto" />
        <div className="text-white font-bold text-sm">Retrieving Authoritative Client Profile...</div>
        <p className="text-xs text-slate-400">Loading your authorized recorded profile.</p>
      </div>
    );
  }

  const p = profileData?.personal || {};
  const c = profileData?.contact || {};
  const amendments = profileData?.amendments || [];

  return (
    <div className="space-y-6" id="taxguard-authoritative-client-profile">
      {/* Profile Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#07172B] via-[#0B2546] to-[#07172B] border border-[#1E3A5F] p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-wider text-[#C6A15B]">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Authoritative Client Profile &bull; Version {profileData?.version || 1}.0</span>
          </div>
          <h1 className="text-2xl font-serif font-bold text-white tracking-tight flex items-center gap-2">
            <span>{p.legalName || currentUser?.name || 'Client Taxpayer'}</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40">
              {profileData.identity?.status || 'NOT_VERIFIED'}
            </span>
          </h1>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Statutory taxpayer profile established during Stage 01 Onboarding. Sensitive identity attributes are locked
            under IRS Circular 230 and FTC Safeguards. Ordinary contact information can be updated anytime.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <button
            type="button"
            onClick={fetchAuthoritativeProfile}
            className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-200 bg-[#06172C] hover:bg-[#0D2340] border border-[#1E3A5F] transition flex items-center gap-1.5"
            title="Refresh recorded profile"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Authority</span>
          </button>

          {onNavigateToStageTwo && (
            <button
              type="button"
              onClick={onNavigateToStageTwo}
              className="px-4 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition flex items-center gap-1.5 shadow"
            >
              <span>Go to Stage 02 Collect</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button type="button" onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold ml-2">
            ✕
          </button>
        </div>
      )}

      {/* Section Navigation Tabs (Organized strictly into the 7 requested sections + Amendment History) */}
      <div className="flex items-center gap-1 bg-[#06172C] border border-[#1E3A5F] p-1.5 rounded-xl text-xs overflow-x-auto">
        {[
          { key: 'personal', label: '1. Personal / Entity', icon: User },
          { key: 'contact', label: '2. Contact Information', icon: Mail },
          { key: 'representative', label: '3. Authorized Representative', icon: Building2 },
          { key: 'identity', label: '4. Identity & Verification', icon: ShieldCheck },
          { key: 'engagement', label: '5. Engagement', icon: FileCheck },
          { key: 'consents', label: '6. Consent Center', icon: Lock },
          { key: 'documents', label: '7. My Documents', icon: FolderLock },
          { key: 'amendments', label: 'Amendments & Audit', icon: Clock }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSection === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSection(tab.key as ProfileSectionKey)}
              className={`px-3 py-2 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#C6A15B] text-[#07172B] shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-[#0D2340]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.key === 'amendments' && amendments.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#07172B] text-[#C6A15B] font-mono">
                  {amendments.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 1. PERSONAL / ENTITY INFORMATION */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'personal' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E3A5F] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-[#C6A15B]" />
                <span>Personal &amp; Entity Information</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Primary taxpayer identity, IRS filing classification, and verified taxpayer identification numbers.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 text-[11px] font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/40 rounded-lg">
                Locked &bull; Stage 01 Certified
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Legal Name */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col justify-between space-y-2">
              <div>
                <span className="text-slate-400 text-[11px] block font-mono">Legal Taxpayer Name</span>
                <span className="font-bold text-white text-base block mt-0.5">{p.legalName || 'N/A'}</span>
                <span className="text-[10px] text-slate-400">Must match Social Security card or official Articles of Organization</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAmendmentModal('legalName', 'Legal Taxpayer Name', p.legalName)}
                className="self-start text-[11px] text-[#C6A15B] hover:text-[#D9BF7A] font-semibold flex items-center gap-1 cursor-pointer pt-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Request Legal Name Amendment</span>
              </button>
            </div>

            {/* Taxpayer / Entity Type */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col justify-between space-y-2">
              <div>
                <span className="text-slate-400 text-[11px] block font-mono">Taxpayer &amp; Filing Classification</span>
                <span className="font-bold text-white text-base block mt-0.5 capitalize">
                  {p.taxpayerType === 'entity' ? `Entity (${p.entityClassification?.toUpperCase() || 'Classification not recorded'})` : p.taxpayerType === 'individual' ? 'Individual' : 'Not recorded'}
                </span>
                <span className="text-[10px] text-slate-400">Governs IRS filing forms, schedule attachments, and deduction rules</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAmendmentModal('taxpayerType', 'Taxpayer / Entity Type', p.taxpayerType)}
                className="self-start text-[11px] text-[#C6A15B] hover:text-[#D9BF7A] font-semibold flex items-center gap-1 cursor-pointer pt-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Request Classification Change</span>
              </button>
            </div>

            {/* Masked Taxpayer ID */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col justify-between space-y-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] font-mono">
                    Taxpayer Identification ({p.tinType?.toUpperCase() || 'SSN/EIN'})
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTIN(!showTIN)}
                    className="text-slate-400 hover:text-white p-1 text-xs flex items-center gap-1"
                  >
                    {showTIN ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showTIN ? 'Mask' : 'Show Last 4'}</span>
                  </button>
                </div>
                <div className="font-mono font-bold text-white text-base mt-1 tracking-wider">
                  {showTIN
                    ? p.maskedTIN || `***-**-${p.tinLast4 || '0000'}`
                    : p.tinType === 'ein'
                      ? 'XX-XXXXXXX'
                      : '***-**-****'}
                </div>
                <span className="text-[10px] text-slate-400">Strictly masked under IRC § 6103 &amp; NIST 800-88 standards</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAmendmentModal('tin', 'Taxpayer Identification Number', `***-**-${p.tinLast4}`)}
                className="self-start text-[11px] text-[#C6A15B] hover:text-[#D9BF7A] font-semibold flex items-center gap-1 cursor-pointer pt-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Request TIN / SSN Correction</span>
              </button>
            </div>

            {/* Date of Birth / Incorporation */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] flex flex-col justify-between space-y-2">
              <div>
                <span className="text-slate-400 text-[11px] block font-mono">
                  Recorded Date of Birth (DOB)
                </span>
                <span className="font-bold text-white text-base block mt-0.5">
                  {p.dateOfBirth || 'Not recorded'}
                </span>
                <span className="text-[10px] text-slate-400">Required for SSA matching and electronic return authorization</span>
              </div>
              <button
                type="button"
                onClick={() => handleOpenAmendmentModal('dateOfBirth', 'Date of Birth', p.dateOfBirth || '')}
                className="self-start text-[11px] text-[#C6A15B] hover:text-[#D9BF7A] font-semibold flex items-center gap-1 cursor-pointer pt-1"
              >
                <Edit2 className="w-3 h-3" />
                <span>Request DOB Correction</span>
              </button>
            </div>
          </div>

          {/* Business Entity Details (if entity or dba) */}
          {(p.taxpayerType === 'entity' || p.dbaName || p.businessDetails) && (
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#C6A15B]" />
                <span>Business &amp; Corporate Entity Governance</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F]">
                  <span className="text-slate-400 block text-[11px]">Trade / DBA Name:</span>
                  <span className="font-bold text-white mt-0.5 block">{p.dbaName || p.legalName}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F]">
                  <span className="text-slate-400 block text-[11px]">State of Organization:</span>
                  <span className="font-bold text-white mt-0.5 block">{p.stateOfIncorporation || 'Not recorded'}</span>
                </div>
                <div className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F]">
                  <span className="text-slate-400 block text-[11px]">Tax Return Type:</span>
                  <span className="font-bold text-[#C6A15B] mt-0.5 block">
                    {p.businessDetails?.taxClassification || 'Not recorded'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 2. CONTACT INFORMATION (Directly Editable) */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'contact' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E3A5F] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Mail className="w-4 h-4 text-[#C6A15B]" />
                <span>Contact Information &amp; Delivery Preferences</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage your phone number, official mailing address, and notification preferences.
              </p>
            </div>
            {!isEditingContact ? (
              <button
                type="button"
                onClick={() => setIsEditingContact(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edit Contact Info</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingContact(false);
                    syncEditFields(profileData);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-300 hover:text-white bg-[#06172C] border border-[#1E3A5F] transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveOrdinaryContact}
                  disabled={isSavingOrdinary}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-[#07172B] bg-emerald-400 hover:bg-emerald-300 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingOrdinary ? 'Saving...' : 'Save Updates'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Email Address */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-1">
              <span className="text-slate-400 text-[11px] font-mono flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" />
                <span>Primary Email Address (Account Identifier)</span>
              </span>
              <div className="font-bold text-white text-sm pt-1">{c.email || 'client@example.com'}</div>
              <span className="text-[10px] text-slate-400 block pt-1">
                Linked to authentication. Contact practice support to update primary login email.
              </span>
            </div>

            {/* Phone Number */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-1">
              <span className="text-slate-400 text-[11px] font-mono flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>Primary Telephone Number</span>
              </span>
              {isEditingContact ? (
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-[#07172B] border border-[#C6A15B] text-white text-sm focus:outline-none"
                  placeholder="(803) 555-0100"
                />
              ) : (
                <div className="font-bold text-white text-sm pt-1">{c.phone || 'No phone recorded'}</div>
              )}
              <span className="text-[10px] text-slate-400 block pt-1">
                Used for urgent verification notices and consultation callbacks.
              </span>
            </div>

            {/* Residential / Principal Physical Address */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-1">
              <span className="text-slate-400 text-[11px] font-mono flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-purple-400" />
                <span>Physical / Principal Residency Address</span>
              </span>
              <div className="font-semibold text-white text-xs pt-1 leading-relaxed">
                <div>{c.residentialAddress?.street || '1428 Palmetto Crest Way'}</div>
                {c.residentialAddress?.unit && <div>Unit / Suite: {c.residentialAddress.unit}</div>}
                <div>
                  {c.residentialAddress?.city || 'Columbia'}, {c.residentialAddress?.state || 'SC'}{' '}
                  {c.residentialAddress?.zip || '29201'}
                </div>
              </div>
              <span className="text-[10px] text-slate-400 block pt-1">
                Physical residency determines state tax jurisdiction.
              </span>
            </div>

            {/* Mailing Address (Editable) */}
            <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-1">
              <span className="text-slate-400 text-[11px] font-mono flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                <span>Official Tax Return Mailing Address</span>
              </span>
              {isEditingContact ? (
                <div className="space-y-2 pt-1">
                  <input
                    type="text"
                    value={editMailingStreet}
                    onChange={(e) => setEditMailingStreet(e.target.value)}
                    placeholder="Street Address"
                    className="w-full px-2.5 py-1.5 rounded bg-[#07172B] border border-[#C6A15B] text-white text-xs focus:outline-none"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      value={editMailingCity}
                      onChange={(e) => setEditMailingCity(e.target.value)}
                      placeholder="City"
                      className="px-2.5 py-1.5 rounded bg-[#07172B] border border-[#C6A15B] text-white text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editMailingState}
                      onChange={(e) => setEditMailingState(e.target.value)}
                      placeholder="State (e.g. SC)"
                      className="px-2.5 py-1.5 rounded bg-[#07172B] border border-[#C6A15B] text-white text-xs focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editMailingZip}
                      onChange={(e) => setEditMailingZip(e.target.value)}
                      placeholder="ZIP Code"
                      className="px-2.5 py-1.5 rounded bg-[#07172B] border border-[#C6A15B] text-white text-xs focus:outline-none"
                    />
                  </div>
                </div>
              ) : (
                <div className="font-semibold text-white text-xs pt-1 leading-relaxed">
                  <div>{c.mailingAddress?.street || c.residentialAddress?.street || '1428 Palmetto Crest Way'}</div>
                  {c.mailingAddress?.unit && <div>Unit: {c.mailingAddress.unit}</div>}
                  <div>
                    {c.mailingAddress?.city || c.residentialAddress?.city || 'Columbia'},{' '}
                    {c.mailingAddress?.state || c.residentialAddress?.state || 'SC'}{' '}
                    {c.mailingAddress?.zip || c.residentialAddress?.zip || '29201'}
                  </div>
                </div>
              )}
              <span className="text-[10px] text-slate-400 block pt-1">
                Where official IRS notices, refunds, and return copies will be dispatched.
              </span>
            </div>
          </div>

          {/* Communication Preferences */}
          <div className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-3">
            <h3 className="font-bold text-white text-xs uppercase tracking-wider font-mono text-[#C6A15B]">
              Communication Channels &amp; Delivery Preferences
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-white font-bold block">Email Notifications</span>
                  <span className="text-[11px] text-slate-400">Transcripts, stage approvals, reports</span>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditingContact}
                  checked={editEmailPref}
                  onChange={(e) => setEditEmailPref(e.target.checked)}
                  className="w-4 h-4 accent-[#C6A15B] rounded cursor-pointer"
                />
              </label>

              <label className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-white font-bold block">SMS / Text Alerts</span>
                  <span className="text-[11px] text-slate-400">Two-factor codes &amp; urgent alerts</span>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditingContact}
                  checked={editSmsPref}
                  onChange={(e) => setEditSmsPref(e.target.checked)}
                  className="w-4 h-4 accent-[#C6A15B] rounded cursor-pointer"
                />
              </label>

              <label className="p-3 rounded-lg bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-white font-bold block">Secure Portal Messaging</span>
                  <span className="text-[11px] text-slate-400">Direct encrypted CPA communications</span>
                </div>
                <input
                  type="checkbox"
                  disabled={!isEditingContact}
                  checked={editPortalPref}
                  onChange={(e) => setEditPortalPref(e.target.checked)}
                  className="w-4 h-4 accent-[#C6A15B] rounded cursor-pointer"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. AUTHORIZED REPRESENTATIVE */}
      {/* ------------------------------------------------------------------ */}
      <ProfileEvidenceSections section={activeSection} profile={profileData} onNavigateToDocuments={onNavigateToDocuments}/>

      {/* 8. AMENDMENTS & AUDIT TRAIL */}
      {/* ------------------------------------------------------------------ */}
      {activeSection === 'amendments' && (
        <div className="rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-6 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1E3A5F] pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#C6A15B]" />
                <span>Profile Amendment History &amp; Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                All requested amendments for sensitive verified fields are recorded with full provenance.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenAmendmentModal('legalName', 'Legal Name', p.legalName)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Submit Amendment Request</span>
            </button>
          </div>

          {amendments.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-bold text-white text-sm">Authoritative Profile Unaltered</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No sensitive identity amendments have been submitted. Your profile is running against Certified Baseline
                Version 1.0.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {amendments.map((am: any) => {
                const isPending = am.disposition === 'PENDING' || !am.disposition;
                const isApproved = am.disposition === 'APPROVED';
                return (
                  <div
                    key={am.id}
                    className="p-4 rounded-xl bg-[#06172C] border border-[#1E3A5F] space-y-2 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">{am.fieldLabel || am.field}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isPending
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : isApproved
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {isPending ? '⏳ Pending CPA Review' : isApproved ? '✓ Approved' : '✕ Rejected'}
                        </span>
                      </div>
                      <span className="text-slate-400 font-mono text-[10px]">
                        Requested: {new Date(am.requestTimestamp).toLocaleString()}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-2.5 rounded bg-[#07172B] border border-[#1E3A5F] text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Previous Certified Value:</span>
                        <span className="font-mono text-slate-300">{String(am.previousValue || '(None)')}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Proposed Value:</span>
                        <span className="font-mono font-bold text-[#C6A15B]">{String(am.proposedValue)}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-300">
                      <strong>Reason:</strong> {am.reason}
                    </div>

                    {am.dispositionNotes && (
                      <div className="text-[11px] text-slate-400 border-t border-[#1E3A5F] pt-2">
                        <strong>Reviewer Notes:</strong> {am.dispositionNotes} (by {am.reviewingUserEmail || 'CPA Staff'})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FORMAL AMENDMENT REQUEST MODAL */}
      {/* ------------------------------------------------------------------ */}
      {amendmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-[#07172B] border border-[#1E3A5F] p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <div>
                <h3 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#C6A15B]" />
                  <span>Request Sensitive Profile Amendment</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Formal verification request to amend verified identity information under Circular 230 rules.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAmendmentModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {amendmentSubmitError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{amendmentSubmitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitAmendment} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block font-mono text-[11px] mb-1">Target Field to Amend</label>
                <div className="p-2.5 rounded-lg bg-[#06172C] border border-[#1E3A5F] text-white font-bold">
                  {amendmentFieldLabel}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block font-mono text-[11px] mb-1">Current Certified Value</label>
                <div className="p-2.5 rounded-lg bg-[#06172C] border border-[#1E3A5F] text-slate-300 font-mono">
                  {amendmentCurrentValue || '(Current Certified Value)'}
                </div>
              </div>

              <div>
                <label className="text-slate-300 block font-bold mb-1">
                  Proposed New Value <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={amendmentProposedValue}
                  onChange={(e) => setAmendmentProposedValue(e.target.value)}
                  placeholder={`Enter proposed ${amendmentFieldLabel}`}
                  className="w-full px-3 py-2 rounded-lg bg-[#06172C] border border-[#C6A15B] text-white text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-300 block font-bold mb-1">
                  Legal / Factual Reason for Amendment <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={amendmentReason}
                  onChange={(e) => setAmendmentReason(e.target.value)}
                  placeholder="State the reason (e.g. Legal name change following marriage; SSN typo correction; LLC entity classification change approved by IRS)"
                  className="w-full px-3 py-2 rounded-lg bg-[#06172C] border border-[#1E3A5F] text-white text-xs focus:outline-none focus:border-[#C6A15B]"
                />
                <span className="text-[10px] text-slate-400">
                  Minimum 5 characters. This reason is logged to the permanent audit trail.
                </span>
              </div>

              <div className="p-3 rounded-lg bg-[#06172C] border border-amber-500/30 text-amber-200 text-[11px] flex items-start gap-2">
                <HelpCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  Sensitive identity modifications do not immediately overwrite your verified profile. A licensed CPA or
                  senior reviewer will review supporting proofs before applying version increments.
                </span>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAmendmentModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-[#06172C] border border-[#1E3A5F] transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAmendment}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingAmendment ? 'Submitting...' : 'Submit Amendment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
