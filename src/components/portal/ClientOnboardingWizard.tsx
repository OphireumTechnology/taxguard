/**
 * A/R TAX SERVICES, LLC - Dedicated Client Onboarding Wizard
 * Implements Sections A through I per Part 2 of specification:
 * Section A: Identity and Contact Information
 * Section B: Client and Entity Classification
 * Section C: Tax Profile
 * Section D: Accounting Requirements
 * Section E: Service Selection
 * Section F: Dynamic Document Checklist
 * Section G: Consultation Preferences (Live Calendar Booking)
 * Section H: Engagement and Consent (IRS Form 8879, Scope, Pricing, Electronic Signature)
 * Section I: Final Review, Validation & Submission (Locked for Staff Review)
 */

import React, { useState, useEffect } from 'react';
import { 
  User, 
  Building2, 
  FileText, 
  BookOpen, 
  Briefcase, 
  UploadCloud, 
  Calendar, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Lock, 
  Clock, 
  Check, 
  Save,
  Video,
  Phone,
  MapPin,
  HelpCircle,
  FileCheck
} from 'lucide-react';
import { ClientOnboardingDossier, ClientCategory } from '../../types/onboarding';
import { AvailableTimeSlot } from '../../types/calendar';
import { getStoredToken } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { BrandedButton } from '../ui/BrandedButton';

interface Props {
  onComplete?: () => void;
}

const SECTION_TABS = [
  { id: 'A', title: 'Identity & Contact', icon: User },
  { id: 'B', title: 'Entity Classification', icon: Building2 },
  { id: 'C', title: 'Tax Profile', icon: FileText },
  { id: 'D', title: 'Accounting Needs', icon: BookOpen },
  { id: 'E', title: 'Service Selection', icon: Briefcase },
  { id: 'F', title: 'Document Checklist', icon: UploadCloud },
  { id: 'G', title: 'Consultation', icon: Calendar },
  { id: 'H', title: 'Engagement & Consent', icon: ShieldCheck },
  { id: 'I', title: 'Review & Submit', icon: CheckCircle2 }
];

export const ClientOnboardingWizard: React.FC<Props> = ({ onComplete }) => {
  const [dossier, setDossier] = useState<ClientOnboardingDossier | null>(null);
  const [activeSection, setActiveSection] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'>('A');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Consultation slot selection state
  const [consultationDate, setConsultationDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [availableSlots, setAvailableSlots] = useState<AvailableTimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailableTimeSlot | null>(null);
  const [heldSlotKey, setHeldSlotKey] = useState<string | null>(null);
  const [holdCountdown, setHoldCountdown] = useState<number | null>(null);
  const [isHolding, setIsHolding] = useState(false);

  const { currentUser } = useApp();

  // Load client onboarding dossier
  useEffect(() => {
    fetchDossier();
  }, [currentUser?.id]);

  const fetchDossier = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = getStoredToken();
      const res = await fetch('/api/onboarding/client', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to load onboarding dossier');
      }
      const data = await res.json();
      setDossier(data.dossier);
      if (data.dossier.reviewSubmission?.lockedForClient) {
        setActiveSection('I');
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to onboarding service');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch live calendar slots when on section G
  useEffect(() => {
    if (activeSection === 'G' && consultationDate) {
      fetchSlots();
    }
  }, [activeSection, consultationDate]);

  const fetchSlots = async () => {
    try {
      const res = await fetch(`/api/calendar/available-slots?date=${consultationDate}&serviceTypeCode=${dossier?.consultationPreferences?.serviceRequired || 'new_client_consultation'}`);
      if (res.ok) {
        const data = await res.json();
        setAvailableSlots(data.availableSlots || []);
      }
    } catch (err) {
      console.error('Failed to load slots', err);
    }
  };

  // 10-minute hold countdown timer
  useEffect(() => {
    if (!holdCountdown) return;
    const interval = setInterval(() => {
      setHoldCountdown(prev => {
        if (!prev || prev <= 1) {
          clearInterval(interval);
          setHeldSlotKey(null);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [holdCountdown]);

  const handleHoldSlot = async (slot: AvailableTimeSlot) => {
    try {
      setIsHolding(true);
      const token = getStoredToken();
      const idempotencyKey = `hold_${slot.slotKey}_${Date.now()}`;

      const res = await fetch('/api/calendar/hold-slot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({
          staffId: slot.staffId,
          startUtc: slot.startUtc,
          endUtc: slot.endUtc,
          serviceType: dossier?.consultationPreferences?.serviceRequired || 'Client Intake Consultation',
          idempotencyKey
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Slot reservation failed');
      }

      setSelectedSlot(slot);
      setHeldSlotKey(slot.slotKey);
      setHoldCountdown(600); // 10 minutes in seconds

      // Save to dossier preferences
      if (dossier) {
        const updatedPrefs = {
          ...dossier.consultationPreferences,
          selectedDate: consultationDate,
          selectedSlot: slot.clientLocalDisplay,
          specificStaffId: slot.staffId
        };
        saveSectionData('G', updatedPrefs);
      }
    } catch (err: any) {
      alert(err.message || 'Could not reserve slot.');
    } finally {
      setIsHolding(false);
    }
  };

  const saveSectionData = async (section: string, data: any) => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      const token = getStoredToken();
      const res = await fetch('/api/onboarding/client/save-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({ section, data })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Save failed');
      }

      const resData = await res.json();
      setDossier(resData.dossier);
      setSaveMessage('Draft auto-saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitDossier = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const token = getStoredToken();
      const res = await fetch('/api/onboarding/client/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Submission failed');
      }

      const resData = await res.json();
      setDossier(resData.dossier);
      setActiveSection('I');
      if (onComplete) onComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-[#FBF8F1] border border-[#D8C9A5] rounded-2xl">
        <div className="w-12 h-12 border-4 border-[#C99A3D] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#10233D] font-semibold text-sm">Initializing secure client onboarding dossier...</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="p-8 bg-[#FBF8F1] border border-[#D8C9A5] rounded-2xl text-[#10233D] shadow-sm max-w-xl mx-auto my-8">
        <div className="w-12 h-12 rounded-xl bg-[#F4E7C3] border border-[#B98B32] flex items-center justify-center mb-4 text-[#10233D]">
          <FileText className="w-6 h-6" />
        </div>
        <h3 className="font-serif text-lg font-bold text-[#10233D]">Secure Onboarding Dossier</h3>
        <p className="text-xs text-[#52657B] mt-1.5 leading-relaxed">
          {error
            ? `Dossier connection note: ${error}`
            : 'Your client intake file is securely indexed under your account credentials. Please click below to load or initialize your intake file.'}
        </p>
        <div className="mt-5 flex items-center gap-3">
          <BrandedButton
            size="sm"
            variant="primary"
            onClick={() => fetchDossier()}
          >
            Load Intake Dossier
          </BrandedButton>
        </div>
      </div>
    );
  }

  const isLocked = !!dossier.reviewSubmission?.lockedForClient;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Onboarding Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl border border-amber-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>A/R Tax Services, LLC • Confidential Client Intake</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-serif tracking-tight text-white">
              Client Onboarding & Engagement Dossier
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Complete your tax and entity profile so our CPAs and tax advisors can prepare your engagement scope, customize your checklist, and authorize your filing.
            </p>
          </div>

          {/* Progress Circle & Status Badge */}
          <div className="flex items-center space-x-4 bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
            <div className="relative w-14 h-14 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-700"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-amber-500 transition-all duration-700 ease-out"
                  strokeDasharray={`${dossier.percentComplete}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-xs font-bold text-white">{dossier.percentComplete}%</span>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Status</div>
              <div className="text-sm font-bold text-amber-400 capitalize">
                {dossier.status.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>

        {/* Lock Banner if Submitted */}
        {isLocked && (
          <div className="mt-6 flex items-center space-x-3 bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-3 rounded-lg text-sm">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              <strong>Dossier Submitted & Under Review:</strong> Your intake answers and executed engagement agreement are locked for senior accounting review. Contact your assigned CPA for corrections.
            </span>
          </div>
        )}
      </div>

      {/* Navigation Tabs (Sections A through I) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 overflow-x-auto">
        <div className="flex space-x-1 min-w-max">
          {SECTION_TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-slate-900 text-amber-400 shadow'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-700'
                }`}>
                  {tab.id}
                </span>
                <Icon className="w-4 h-4" />
                <span>{tab.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Section Content Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        {saveMessage && (
          <div className="mb-6 flex items-center space-x-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200 animate-fade-in">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* SECTION A: IDENTITY AND CONTACT INFORMATION */}
        {activeSection === 'A' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section A: Identity & Contact Information</h2>
              <p className="text-sm text-slate-500">Provide legal identification and primary communication preferences.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Legal First Name *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={dossier.identityContact.legalFirstName}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, legalFirstName: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={dossier.identityContact.legalMiddleName || ''}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, legalMiddleName: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Legal Last Name *</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={dossier.identityContact.legalLastName}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, legalLastName: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Preferred First Name / Display</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={dossier.identityContact.preferredName || ''}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, preferredName: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Email Address *</label>
                <input
                  type="email"
                  disabled={isLocked}
                  value={dossier.identityContact.email}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, email: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Mobile Telephone *</label>
                <input
                  type="tel"
                  disabled={isLocked}
                  value={dossier.identityContact.mobilePhone}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, mobilePhone: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-slate-900">Residential Street Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="Street address (e.g., 1201 Main St)"
                    value={dossier.identityContact.residentialAddress.street}
                    onChange={e => setDossier({
                      ...dossier,
                      identityContact: {
                        ...dossier.identityContact,
                        residentialAddress: { ...dossier.identityContact.residentialAddress, street: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="City"
                    value={dossier.identityContact.residentialAddress.city}
                    onChange={e => setDossier({
                      ...dossier,
                      identityContact: {
                        ...dossier.identityContact,
                        residentialAddress: { ...dossier.identityContact.residentialAddress, city: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="State"
                    value={dossier.identityContact.residentialAddress.state}
                    onChange={e => setDossier({
                      ...dossier,
                      identityContact: {
                        ...dossier.identityContact,
                        residentialAddress: { ...dossier.identityContact.residentialAddress, state: e.target.value }
                      }
                    })}
                    className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm text-center font-mono"
                  />
                  <input
                    type="text"
                    disabled={isLocked}
                    placeholder="ZIP"
                    value={dossier.identityContact.residentialAddress.zip}
                    onChange={e => setDossier({
                      ...dossier,
                      identityContact: {
                        ...dossier.identityContact,
                        residentialAddress: { ...dossier.identityContact.residentialAddress, zip: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Preferred Channel</label>
                <select
                  disabled={isLocked}
                  value={dossier.identityContact.preferredChannel}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, preferredChannel: e.target.value as any } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="portal">Secure Portal Messages (Recommended)</option>
                  <option value="email">Direct Email</option>
                  <option value="phone">Telephone Call</option>
                  <option value="sms">SMS Notifications</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Time Zone</label>
                <select
                  disabled={isLocked}
                  value={dossier.identityContact.timeZone}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, timeZone: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Preferred Language</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={dossier.identityContact.preferredLanguage}
                  onChange={e => setDossier({ ...dossier, identityContact: { ...dossier.identityContact, preferredLanguage: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION B: CLIENT AND ENTITY CLASSIFICATION */}
        {activeSection === 'B' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section B: Client & Entity Classification</h2>
              <p className="text-sm text-slate-500">Specify your organizational structure and business operating parameters.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Entity Structure *</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'individual', title: 'Individual Taxpayer', desc: 'Form 1040, W-2, family & investments' },
                  { id: 'sole_proprietorship', title: 'Sole Proprietor / 1099', desc: 'Schedule C independent contractor' },
                  { id: 'llc', title: 'Limited Liability Co. (LLC)', desc: 'Single-member or partnership pass-through' },
                  { id: 'scorp', title: 'S-Corporation (1120-S)', desc: 'Shareholder salary and distributions' },
                  { id: 'ccorp', title: 'C-Corporation (1120)', desc: 'Standard entity-level corporate taxation' },
                  { id: 'partnership', title: 'Partnership (1065)', desc: 'Multi-member commercial partnership' }
                ].map(opt => (
                  <label
                    key={opt.id}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      dossier.entityClassification.entityType === opt.id
                        ? 'border-amber-500 bg-amber-50/50 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      disabled={isLocked}
                      name="entityType"
                      value={opt.id}
                      checked={dossier.entityClassification.entityType === opt.id}
                      onChange={() => setDossier({
                        ...dossier,
                        entityClassification: {
                          ...dossier.entityClassification,
                          entityType: opt.id as any,
                          isBusiness: opt.id !== 'individual'
                        }
                      })}
                      className="hidden"
                    />
                    <div className="font-bold text-sm text-slate-900">{opt.title}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                  </label>
                ))}
              </div>
            </div>

            {dossier.entityClassification.isBusiness && (
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Commercial Entity Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Legal Company Name *</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder="e.g., Palmetto Premier Enterprises LLC"
                      value={dossier.entityClassification.legalEntityName || ''}
                      onChange={e => setDossier({
                        ...dossier,
                        entityClassification: { ...dossier.entityClassification, legalEntityName: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">DBA / Trade Name (Optional)</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder="Trade or brand name if different"
                      value={dossier.entityClassification.dbaName || ''}
                      onChange={e => setDossier({
                        ...dossier,
                        entityClassification: { ...dossier.entityClassification, dbaName: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">State of Formation</label>
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder="e.g. South Carolina"
                      value={dossier.entityClassification.formationState || ''}
                      onChange={e => setDossier({
                        ...dossier,
                        entityClassification: { ...dossier.entityClassification, formationState: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Formation Date</label>
                    <input
                      type="date"
                      disabled={isLocked}
                      value={dossier.entityClassification.dateEstablished || ''}
                      onChange={e => setDossier({
                        ...dossier,
                        entityClassification: { ...dossier.entityClassification, dateEstablished: e.target.value }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Number of Employees</label>
                    <input
                      type="number"
                      disabled={isLocked}
                      value={dossier.entityClassification.numberOfEmployees || 0}
                      onChange={e => setDossier({
                        ...dossier,
                        entityClassification: { ...dossier.entityClassification, numberOfEmployees: parseInt(e.target.value, 10) }
                      })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SECTION C: TAX PROFILE */}
        {activeSection === 'C' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section C: Tax Profile & Income Streams</h2>
              <p className="text-sm text-slate-500">Provide filing details to customize your calculations and deduction strategies.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Target Tax Year *</label>
                <select
                  disabled={isLocked}
                  value={dossier.taxProfile.requestedTaxYear}
                  onChange={e => setDossier({
                    ...dossier,
                    taxProfile: { ...dossier.taxProfile, requestedTaxYear: parseInt(e.target.value, 10) }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value={2025}>2025 Tax Year (Current Filing Season)</option>
                  <option value={2024}>2024 Tax Year (Prior Year / Late)</option>
                  <option value={2026}>2026 Forward Strategy & Planning</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Marital / Filing Status *</label>
                <select
                  disabled={isLocked}
                  value={dossier.taxProfile.filingStatus}
                  onChange={e => setDossier({
                    ...dossier,
                    taxProfile: { ...dossier.taxProfile, filingStatus: e.target.value as any }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="single">Single</option>
                  <option value="married_filing_jointly">Married Filing Jointly</option>
                  <option value="married_filing_separately">Married Filing Separately</option>
                  <option value="head_of_household">Head of Household</option>
                  <option value="qualifying_surviving_spouse">Qualifying Surviving Spouse</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">Select All Applicable Income Types</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { id: 'w2', label: 'W-2 Wages & Salaries' },
                  { id: '1099_nec', label: '1099-NEC Freelance / Independent' },
                  { id: 'k1', label: 'Schedule K-1 (Partnership/S-Corp)' },
                  { id: 'dividends', label: 'Interest & Dividends (1099-INT/DIV)' },
                  { id: 'capital_gains', label: 'Stocks & Capital Assets (1099-B)' },
                  { id: 'rental', label: 'Rental Real Estate (Schedule E)' }
                ].map(inc => {
                  const has = dossier.taxProfile.incomeCategories.includes(inc.id);
                  return (
                    <label key={inc.id} className="flex items-center space-x-2 text-sm text-slate-700 cursor-pointer p-2 rounded hover:bg-slate-50">
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        checked={has}
                        onChange={() => {
                          const cats = has
                            ? dossier.taxProfile.incomeCategories.filter(c => c !== inc.id)
                            : [...dossier.taxProfile.incomeCategories, inc.id];
                          setDossier({
                            ...dossier,
                            taxProfile: { ...dossier.taxProfile, incomeCategories: cats }
                          });
                        }}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>{inc.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <label className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={dossier.taxProfile.hasIrsOrStateNotices}
                  onChange={e => setDossier({
                    ...dossier,
                    taxProfile: { ...dossier.taxProfile, hasIrsOrStateNotices: e.target.checked }
                  })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Received IRS or State Tax Notices?</div>
                  <div className="text-xs text-slate-500">Audit inquiries, balance letters, CP2000</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={dossier.taxProfile.foreignIncomeOrAccounts}
                  onChange={e => setDossier({
                    ...dossier,
                    taxProfile: { ...dossier.taxProfile, foreignIncomeOrAccounts: e.target.checked }
                  })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Foreign Accounts or Income?</div>
                  <div className="text-xs text-slate-500">FBAR (FinCEN 114) or Form 8938 reporting</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* SECTION D: ACCOUNTING REQUIREMENTS */}
        {activeSection === 'D' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section D: Accounting & Bookkeeping Needs</h2>
              <p className="text-sm text-slate-500">Define your general ledger, payroll, and financial statement requirements.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Primary Accounting Software</label>
                <select
                  disabled={isLocked}
                  value={dossier.accountingRequirements.accountingSoftware}
                  onChange={e => setDossier({
                    ...dossier,
                    accountingRequirements: { ...dossier.accountingRequirements, accountingSoftware: e.target.value as any }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="quickbooks_online">QuickBooks Online (Certified ProAdvisor)</option>
                  <option value="xero">Xero Cloud Accounting (Certified Advisor)</option>
                  <option value="freshbooks">FreshBooks</option>
                  <option value="wave">Wave Financial</option>
                  <option value="other">Other Commercial Software</option>
                  <option value="none">No Software (Spreadsheets or Need Setup)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Bookkeeping Support Frequency</label>
                <select
                  disabled={isLocked}
                  value={dossier.accountingRequirements.frequency || 'monthly'}
                  onChange={e => setDossier({
                    ...dossier,
                    accountingRequirements: { ...dossier.accountingRequirements, frequency: e.target.value as any }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="monthly">Monthly Active Ledger Reconciliation</option>
                  <option value="quarterly">Quarterly Review & Closing</option>
                  <option value="annual">Year-End Clean-Up Only</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <label className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={dossier.accountingRequirements.payrollSupportRequired}
                  onChange={e => setDossier({
                    ...dossier,
                    accountingRequirements: { ...dossier.accountingRequirements, payrollSupportRequired: e.target.checked }
                  })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Payroll Support & Compliance</div>
                  <div className="text-xs text-slate-500">W-2/W-3 processing, direct deposits, payroll taxes</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200">
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={dossier.accountingRequirements.bankReconciliationRequired}
                  onChange={e => setDossier({
                    ...dossier,
                    accountingRequirements: { ...dossier.accountingRequirements, bankReconciliationRequired: e.target.checked }
                  })}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <div className="text-sm font-semibold text-slate-900">Multi-Account Bank Reconciliations</div>
                  <div className="text-xs text-slate-500">Tie operating, credit card, and Stripe ledgers</div>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* SECTION E: SERVICE SELECTION */}
        {activeSection === 'E' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section E: Service Engagement Selection</h2>
              <p className="text-sm text-slate-500">Select the specific services to include in your legal engagement letter.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { id: 'individual_tax_1040', title: 'Individual Tax Preparation (Form 1040)', desc: 'Complete federal and state return preparation with electronic filing' },
                { id: 'business_tax_scorp_llc', title: 'Corporate Tax Preparation (1120-S / 1065)', desc: 'Pass-through entity tax filings, K-1 generation, and officer compensation' },
                { id: 'tax_planning_executive', title: 'Strategic Tax Advisory & Wealth Planning', desc: 'Quarterly projections, depreciation acceleration, entity restructuring' },
                { id: 'bookkeeping_monthly', title: 'Monthly Cloud Bookkeeping & Ledger Maintenance', desc: 'Transaction categorization, journal entries, balance sheet tie-outs' },
                { id: 'payroll_compliance', title: 'Payroll Processing & Form 941/940 Filing', desc: 'Automated tax impounds, state unemployment, and year-end W-2s' },
                { id: 'irs_notice_resolution', title: 'IRS / State Audit Representation', desc: 'Professional response letters, penalty abatements, and resolution' }
              ].map(srv => {
                const isSelected = dossier.serviceSelection.selectedServices.includes(srv.id);
                return (
                  <label
                    key={srv.id}
                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-start space-x-3 ${
                      isSelected ? 'border-amber-500 bg-amber-50/40 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      disabled={isLocked}
                      checked={isSelected}
                      onChange={() => {
                        const nextServices = isSelected
                          ? dossier.serviceSelection.selectedServices.filter(s => s !== srv.id)
                          : [...dossier.serviceSelection.selectedServices, srv.id];
                        setDossier({
                          ...dossier,
                          serviceSelection: { ...dossier.serviceSelection, selectedServices: nextServices }
                        });
                      }}
                      className="mt-1 rounded text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <div className="font-bold text-sm text-slate-900">{srv.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{srv.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION F: DOCUMENT CHECKLIST (DYNAMIC) */}
        {activeSection === 'F' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section F: Dynamic Document Checklist</h2>
              <p className="text-sm text-slate-500">
                Generated automatically from your entity and tax profile answers. Upload unexpired, legible copies.
              </p>
            </div>

            <div className="space-y-3">
              {dossier.documentChecklist.map((item, idx) => (
                <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-sm text-slate-900">{item.name}</h4>
                        {item.required && (
                          <span className="text-[10px] uppercase tracking-wider font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${
                      item.status === 'verified'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'uploaded'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {item.status}
                    </span>

                    {!isLocked && (
                      <button
                        onClick={() => {
                          const updated = dossier.documentChecklist.map(c => 
                            c.id === item.id ? { ...c, status: 'uploaded' as const, uploadedDocumentId: `doc_${Date.now()}` } : c
                          );
                          setDossier({ ...dossier, documentChecklist: updated });
                          saveSectionData('F', updated);
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-amber-600" />
                        <span>Upload File</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION G: CONSULTATION PREFERENCES & LIVE BOOKING */}
        {activeSection === 'G' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section G: Consultation Preferences & Live Booking</h2>
              <p className="text-sm text-slate-500">
                Reserve your onboarding meeting. The selected slot is held for 10 minutes with live calendar synchronization.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Meeting Format *</label>
                <div className="space-y-2">
                  {[
                    { id: 'virtual', title: 'Virtual Video (Google Meet)', icon: Video },
                    { id: 'telephone', title: 'Direct Phone Consultation', icon: Phone },
                    { id: 'in_office', title: 'Columbia, SC Executive Office', icon: MapPin }
                  ].map(m => {
                    const Icon = m.icon;
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer text-sm font-medium ${
                          dossier.consultationPreferences.meetingType === m.id
                            ? 'border-amber-500 bg-amber-50 text-slate-900'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          disabled={isLocked}
                          name="meetingType"
                          checked={dossier.consultationPreferences.meetingType === m.id}
                          onChange={() => setDossier({
                            ...dossier,
                            consultationPreferences: { ...dossier.consultationPreferences, meetingType: m.id as any }
                          })}
                          className="hidden"
                        />
                        <Icon className="w-4 h-4 text-amber-600" />
                        <span>{m.title}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">Select Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={consultationDate}
                    onChange={e => setConsultationDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm bg-white font-mono"
                  />
                </div>

                {/* 10-minute hold notification banner */}
                {heldSlotKey && holdCountdown && (
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-300 text-amber-900 px-4 py-2.5 rounded-lg text-xs font-semibold">
                    <span className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Slot Reserved for you: <strong>{selectedSlot?.clientLocalDisplay}</strong></span>
                    </span>
                    <span className="font-mono bg-amber-200/80 px-2 py-0.5 rounded text-amber-950">
                      Hold expires in: {Math.floor(holdCountdown / 60)}:{(holdCountdown % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                )}

                {/* Available Slots Grid */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Available Timeslots</div>
                  {availableSlots.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">No open slots on this date. Select another date above.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {availableSlots.map(slot => {
                        const isSelected = selectedSlot?.slotKey === slot.slotKey || heldSlotKey === slot.slotKey;
                        return (
                          <button
                            key={slot.slotKey}
                            disabled={isLocked || isHolding}
                            onClick={() => handleHoldSlot(slot)}
                            className={`px-3 py-2 rounded-lg text-xs font-bold border transition-all ${
                              isSelected
                                ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                : 'bg-white text-slate-800 border-slate-200 hover:border-amber-400 hover:bg-amber-50/50'
                            }`}
                          >
                            <div>{slot.clientLocalDisplay}</div>
                            <div className="text-[10px] font-normal opacity-80">{slot.staffName.split(' ')[0]}</div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION H: ENGAGEMENT AND CONSENT */}
        {activeSection === 'H' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section H: Engagement Letter & Legal Consent</h2>
              <p className="text-sm text-slate-500">Execute IRS Form 8879 acknowledgment, pricing agreement, and electronic consent.</p>
            </div>

            {/* Engagement Letter Preview Box */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-3 font-sans max-h-60 overflow-y-auto leading-relaxed">
              <p className="font-bold text-slate-900 text-sm">A/R TAX SERVICES, LLC — PROFESSIONAL ENGAGEMENT AGREEMENT (v2026.1)</p>
              <p>
                This agreement establishes the professional relationship between A/R Tax Services, LLC (&ldquo;Firm&rdquo;) and the Client named herein for tax preparation, review, and advisory services. The Firm will prepare federal and state tax returns based on representations and documentation furnished by the Client.
              </p>
              <p>
                <strong>Client Responsibility:</strong> You certify that you have provided complete and accurate records, including all gross receipts, 1099 statements, W-2s, and digital asset transactions. You maintain final legal responsibility for the accuracy of your returns under penalties of perjury.
              </p>
              <p>
                <strong>Retention & Confidentiality:</strong> All records are stored under enterprise-grade encryption per IRC § 7216 standards and maintained for the mandatory statutory period.
              </p>
            </div>

            {/* Required Consent Checkboxes */}
            <div className="space-y-2.5">
              {[
                { id: 'engagementLetterAcknowledged', label: 'I acknowledge and agree to the A/R Tax Services, LLC Engagement Terms and Scope of Work.' },
                { id: 'scopeAcknowledged', label: 'I understand that tax return preparation relies strictly on complete and truthful records supplied by me.' },
                { id: 'pricingAcknowledged', label: 'I accept the firm pricing schedule, consultation retainers, and transparent billing policy.' },
                { id: 'privacyNoticeAcknowledged', label: 'I acknowledge receipt of the Gramm-Leach-Bliley Act (GLBA) & IRC § 7216 Privacy Disclosure.' },
                { id: 'electronicConsentAcknowledged', label: 'I consent to use electronic signatures and receive IRS electronic filing Form 8879 notices.' }
              ].map(item => (
                <label key={item.id} className="flex items-start space-x-3 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={isLocked}
                    checked={(dossier.engagementConsent as any)[item.id]}
                    onChange={e => setDossier({
                      ...dossier,
                      engagementConsent: { ...dossier.engagementConsent, [item.id]: e.target.checked }
                    })}
                    className="mt-0.5 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            {/* Electronic Signature */}
            <div className="pt-4 border-t border-slate-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Legal Electronic Signature (Type Full Legal Name) *
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <input
                  type="text"
                  disabled={isLocked}
                  placeholder="e.g., Michael J. Perotti"
                  value={dossier.engagementConsent.electronicSignatureName}
                  onChange={e => setDossier({
                    ...dossier,
                    engagementConsent: { ...dossier.engagementConsent, electronicSignatureName: e.target.value }
                  })}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-base font-serif italic text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                />
                <div className="text-xs text-slate-500">
                  By typing your name, you acknowledge legal intent to execute this binding agreement under the US Electronic Signatures in Global and National Commerce Act (E-SIGN).
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION I: FINAL REVIEW, VALIDATION & SUBMISSION */}
        {activeSection === 'I' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section I: Final Dossier Review & Submission</h2>
              <p className="text-sm text-slate-500">Verify your completed sections before final transmission to our senior CPAs.</p>
            </div>

            {/* Review Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <User className="w-4 h-4 text-amber-600" />
                  <span>Client Identification</span>
                </div>
                <div><strong>Name:</strong> {dossier.identityContact.legalFirstName} {dossier.identityContact.legalLastName}</div>
                <div><strong>Email:</strong> {dossier.identityContact.email}</div>
                <div><strong>Phone:</strong> {dossier.identityContact.mobilePhone}</div>
                <div><strong>Address:</strong> {dossier.identityContact.residentialAddress.street}, {dossier.identityContact.residentialAddress.city}, {dossier.identityContact.residentialAddress.state} {dossier.identityContact.residentialAddress.zip}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span>Entity Classification</span>
                </div>
                <div><strong>Entity Type:</strong> {(dossier.entityClassification?.entityType || 'individual').toUpperCase()}</div>
                {dossier.entityClassification.isBusiness && (
                  <div><strong>Legal Entity:</strong> {dossier.entityClassification.legalEntityName}</div>
                )}
                <div><strong>State:</strong> {dossier.entityClassification.formationState || 'SC'}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>Tax & Income Summary</span>
                </div>
                <div><strong>Tax Year:</strong> {dossier.taxProfile.requestedTaxYear}</div>
                <div><strong>Filing Status:</strong> {dossier.taxProfile.filingStatus.replace(/_/g, ' ')}</div>
                <div><strong>Income Types:</strong> {dossier.taxProfile.incomeCategories.join(', ') || 'None selected'}</div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  <span>Execution & Consent</span>
                </div>
                <div><strong>E-Signature:</strong> {dossier.engagementConsent.electronicSignatureName || 'Pending signature'}</div>
                <div><strong>Policy Version:</strong> {dossier.engagementConsent.policyVersion}</div>
                <div><strong>Timestamp:</strong> {dossier.engagementConsent.signatureTimestamp ? new Date(dossier.engagementConsent.signatureTimestamp).toLocaleString() : 'Not recorded'}</div>
              </div>
            </div>

            {/* Submission Action Box */}
            <div className="p-6 bg-slate-900 text-white rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white font-serif">Ready to submit for CPA authorization?</h3>
                <p className="text-slate-300 text-xs mt-0.5">
                  Once submitted, your responses will be securely locked and assigned to our principal review team.
                </p>
              </div>

              {isLocked ? (
                <div className="flex items-center space-x-2 bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-lg text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Submitted & Locked</span>
                </div>
              ) : (
                <button
                  onClick={handleSubmitDossier}
                  disabled={isSaving || !dossier.engagementConsent.electronicSignatureName}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-sm transition-all shadow-md disabled:opacity-50 flex items-center space-x-2 shrink-0"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Submit Dossier to Firm</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => {
              const curIdx = SECTION_TABS.findIndex(t => t.id === activeSection);
              if (curIdx > 0) setActiveSection(SECTION_TABS[curIdx - 1].id as any);
            }}
            disabled={activeSection === 'A'}
            className="inline-flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous Section</span>
          </button>

          <div className="flex items-center space-x-3">
            {!isLocked && (
              <button
                onClick={() => {
                  // Save current active section
                  const sectionDataMap: Record<string, any> = {
                    'A': dossier.identityContact,
                    'B': dossier.entityClassification,
                    'C': dossier.taxProfile,
                    'D': dossier.accountingRequirements,
                    'E': dossier.serviceSelection,
                    'F': dossier.documentChecklist,
                    'G': dossier.consultationPreferences,
                    'H': dossier.engagementConsent
                  };
                  saveSectionData(activeSection, sectionDataMap[activeSection]);
                }}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-4 py-2 border border-amber-500/40 text-amber-700 bg-amber-50 rounded-lg text-xs font-bold hover:bg-amber-100"
              >
                <Save className="w-4 h-4" />
                <span>Save Draft</span>
              </button>
            )}

            <button
              onClick={() => {
                const curIdx = SECTION_TABS.findIndex(t => t.id === activeSection);
                if (curIdx < SECTION_TABS.length - 1) {
                  // Auto save before moving next
                  const sectionDataMap: Record<string, any> = {
                    'A': dossier.identityContact,
                    'B': dossier.entityClassification,
                    'C': dossier.taxProfile,
                    'D': dossier.accountingRequirements,
                    'E': dossier.serviceSelection,
                    'F': dossier.documentChecklist,
                    'G': dossier.consultationPreferences,
                    'H': dossier.engagementConsent
                  };
                  if (!isLocked && sectionDataMap[activeSection]) {
                    saveSectionData(activeSection, sectionDataMap[activeSection]);
                  }
                  setActiveSection(SECTION_TABS[curIdx + 1].id as any);
                }
              }}
              disabled={activeSection === 'I'}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-30"
            >
              <span>Next Section</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
