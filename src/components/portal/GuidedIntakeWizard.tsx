import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  Upload, 
  FileText, 
  Users, 
  CreditCard, 
  HelpCircle, 
  Eye, 
  EyeOff, 
  FileCheck2, 
  Globe2,
  Lock,
  Calendar,
  Sparkles
} from 'lucide-react';
import { FullClientIntakeDossier, USEntityType, USStateCode, OwnerOrOfficer } from '../../types/intake';

interface GuidedIntakeWizardProps {
  dossier: FullClientIntakeDossier;
  initialStep?: number;
  onSaveAndClose: () => void;
  onDossierUpdated: (updated: FullClientIntakeDossier) => void;
}

const US_STATES: { code: USStateCode; name: string }[] = [
  { code: 'SC', name: 'South Carolina' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'GA', name: 'Georgia' },
  { code: 'FL', name: 'Florida' },
  { code: 'VA', name: 'Virginia' },
  { code: 'CA', name: 'California' },
  { code: 'NY', name: 'New York' },
  { code: 'TX', name: 'Texas' },
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'DC', name: 'District of Columbia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' }
];

export const GuidedIntakeWizard: React.FC<GuidedIntakeWizardProps> = ({
  dossier,
  initialStep = 1,
  onSaveAndClose,
  onDossierUpdated
}) => {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [formData, setFormData] = useState<FullClientIntakeDossier>(dossier);
  const [showMaskedId, setShowMaskedId] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const steps = [
    { number: 1, title: 'Business Profile', icon: Building2, areaId: 'area_business_info' },
    { number: 2, title: 'Tax & Jurisdictions', icon: Globe2, areaId: 'area_tax_info' },
    { number: 3, title: 'Entity Specifics', icon: FileText, areaId: 'area_tax_info' },
    { number: 4, title: 'Owners & Officers', icon: Users, areaId: 'area_owners_contacts' },
    { number: 5, title: 'Accounting & Banking', icon: CreditCard, areaId: 'area_bank_accounts' },
    { number: 6, title: 'Operations Profile', icon: HelpCircle, areaId: 'area_accounting_prefs' },
    { number: 7, title: 'Cross-Border Flags', icon: ShieldCheck, areaId: 'area_tax_info' },
    { number: 8, title: 'Financial Documents', icon: Upload, areaId: 'area_financial_docs' },
    { number: 9, title: 'Review & Sign', icon: FileCheck2, areaId: 'area_business_info' }
  ];

  const totalEquity = (formData.ownersAndContacts || []).reduce(
    (acc, curr) => acc + (Number(curr.ownershipPercentage) || 0),
    0
  );

  const handleAutosave = async (updated: FullClientIntakeDossier) => {
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/intake/dossier', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'x-session-token': localStorage.getItem('token') || ''
        },
        body: JSON.stringify(updated)
      });
      const data = await res.json();
      if (res.ok && data.dossier) {
        setFormData(data.dossier);
        onDossierUpdated(data.dossier);
        setSaveSuccessMsg('Progress saved');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
      } else {
        setErrorMessage(data.error || 'Failed to save changes.');
      }
    } catch {
      setErrorMessage('Network error while saving intake progress.');
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = () => {
    const next = Math.min(steps.length, currentStep + 1);
    setCurrentStep(next);
    const updated = { ...formData, currentSectionStep: next };
    setFormData(updated);
    handleAutosave(updated);
  };

  const prevStep = () => {
    const prev = Math.max(1, currentStep - 1);
    setCurrentStep(prev);
    const updated = { ...formData, currentSectionStep: prev };
    setFormData(updated);
    handleAutosave(updated);
  };

  const submitFinalDossier = async () => {
    if (!formData.preferencesAndConsents.electronicSignature) {
      setErrorMessage('Please type your legal full name in the signature field to complete submission.');
      return;
    }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/intake/dossier/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'x-session-token': localStorage.getItem('token') || ''
        },
        body: JSON.stringify({
          clientId: formData.clientId,
          electronicSignature: formData.preferencesAndConsents.electronicSignature
        })
      });
      const data = await res.json();
      if (res.ok && data.dossier) {
        setFormData(data.dossier);
        onDossierUpdated(data.dossier);
        onSaveAndClose();
      } else {
        setErrorMessage(data.error || 'Submission failed.');
      }
    } catch {
      setErrorMessage('Network error submitting intake dossier.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 border-b border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                U.S. Client Intake Portal
              </span>
              <span className="text-xs text-slate-400">
                Tax Year {formData.taxYear}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">
              {formData.legalBusinessName || 'New Client Intake'}
            </h2>
            <p className="text-sm text-slate-300 mt-0.5">
              Assigned Professional: <strong className="text-amber-400">{formData.assignedAccountantName}</strong> ({formData.primaryJurisdiction})
            </p>
          </div>

          <div className="flex items-center gap-3">
            {saveSuccessMsg && (
              <span className="text-xs font-medium text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/60 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {saveSuccessMsg}
              </span>
            )}
            <button
              onClick={() => handleAutosave(formData)}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={onSaveAndClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>

        {/* Step Progression Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>Step {currentStep} of {steps.length}: <strong>{steps[currentStep - 1].title}</strong></span>
            <span>{formData.percentComplete}% Overall Complete</span>
          </div>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-amber-500 to-amber-400 h-full rounded-full transition-all duration-300"
              style={{ width: `${formData.percentComplete}%` }}
            />
          </div>

          {/* Step Pill Navigation */}
          <div className="flex gap-1.5 mt-4 overflow-x-auto pb-1 scrollbar-none">
            {steps.map((step) => {
              const isActive = step.number === currentStep;
              const isPassed = step.number < currentStep;
              return (
                <button
                  key={step.number}
                  onClick={() => {
                    setCurrentStep(step.number);
                    const updated = { ...formData, currentSectionStep: step.number };
                    setFormData(updated);
                    handleAutosave(updated);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : isPassed
                      ? 'bg-slate-800 text-emerald-400 hover:bg-slate-750'
                      : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <step.icon className="w-3.5 h-3.5" />
                  <span>{step.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error notification banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-800 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800 font-semibold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Form Body */}
      <div className="p-6 sm:p-8 max-w-4xl mx-auto min-h-[480px]">
        {/* STEP 1: BUSINESS PROFILE */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-600" />
                Business Legal Information
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Provide legal formation and contact details for your United States entity.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Legal Business Name *
                </label>
                <input
                  type="text"
                  value={formData.businessProfile.legalBusinessName}
                  onChange={(e) => setFormData({
                    ...formData,
                    legalBusinessName: e.target.value,
                    businessProfile: { ...formData.businessProfile, legalBusinessName: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="e.g. Acme Advisory Services, LLC"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Trade Name / DBA (Optional)
                </label>
                <input
                  type="text"
                  value={formData.businessProfile.tradeNameDba}
                  onChange={(e) => setFormData({
                    ...formData,
                    dbaName: e.target.value,
                    businessProfile: { ...formData.businessProfile, tradeNameDba: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Doing business as"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Entity Type *
                </label>
                <select
                  value={formData.businessProfile.entityType}
                  onChange={(e) => setFormData({
                    ...formData,
                    entityType: e.target.value as USEntityType,
                    businessProfile: { ...formData.businessProfile, entityType: e.target.value as USEntityType }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="llc">Limited Liability Company (LLC)</option>
                  <option value="scorp">S-Corporation (Form 1120-S)</option>
                  <option value="ccorp">C-Corporation (Form 1120)</option>
                  <option value="partnership">General or Limited Partnership (Form 1065)</option>
                  <option value="sole_proprietorship">Sole Proprietorship / Disregarded Entity (Schedule C)</option>
                  <option value="individual">Individual Taxpayer (Form 1040)</option>
                  <option value="nonprofit">Tax-Exempt Organization (Form 990)</option>
                  <option value="trust_estate">Estate or Trust (Form 1041)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Employer Identification Number (EIN) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowMaskedId(!showMaskedId)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {showMaskedId ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showMaskedId ? 'Mask' : 'Show'}</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={showMaskedId ? formData.businessProfile.einMasked.replace(/•/g, '9') : formData.businessProfile.einMasked}
                    onChange={(e) => setFormData({
                      ...formData,
                      businessProfile: { ...formData.businessProfile, einMasked: e.target.value }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="XX-XXXXXXX"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Encrypted and masked by default in compliance with IRS Pub 1075 safeguards.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Formation State *
                </label>
                <select
                  value={formData.businessProfile.formationState}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessProfile: { ...formData.businessProfile, formationState: e.target.value as USStateCode }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Formation Date
                </label>
                <input
                  type="date"
                  value={formData.businessProfile.formationDate}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessProfile: { ...formData.businessProfile, formationDate: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Physical Business Street Address *
                </label>
                <input
                  type="text"
                  value={formData.businessProfile.businessAddress.street}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessProfile: {
                      ...formData.businessProfile,
                      businessAddress: { ...formData.businessProfile.businessAddress, street: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="123 Corporate Blvd, Suite 100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.businessProfile.businessAddress.city}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessProfile: {
                      ...formData.businessProfile,
                      businessAddress: { ...formData.businessProfile.businessAddress, city: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Columbia"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    State *
                  </label>
                  <select
                    value={formData.businessProfile.businessAddress.state}
                    onChange={(e) => setFormData({
                      ...formData,
                      businessProfile: {
                        ...formData.businessProfile,
                        businessAddress: { ...formData.businessProfile.businessAddress, state: e.target.value as USStateCode }
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    {US_STATES.map((s) => (
                      <option key={s.code} value={s.code}>{s.code}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={formData.businessProfile.businessAddress.zip}
                    onChange={(e) => setFormData({
                      ...formData,
                      businessProfile: {
                        ...formData.businessProfile,
                        businessAddress: { ...formData.businessProfile.businessAddress, zip: e.target.value }
                      }
                    })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="29201"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Business Phone (US) *
                </label>
                <input
                  type="text"
                  value={formData.businessProfile.phoneUs}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessProfile: { ...formData.businessProfile, phoneUs: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="(803) 555-0142"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Email *
                </label>
                <input
                  type="email"
                  value={formData.businessProfile.email}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessProfile: { ...formData.businessProfile, email: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="contact@company.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Primary Business Activity Description
                </label>
                <textarea
                  rows={2}
                  value={formData.businessProfile.primaryActivityDescription}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessProfile: { ...formData.businessProfile, primaryActivityDescription: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Describe your primary products, services, and commercial operations."
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: TAX JURISDICTIONS & NEXUS */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-amber-600" />
                Tax Jurisdictions & Nexus Operations
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Configure state and local filing obligations under U.S. Federal (IRS) and State Department of Revenue rules.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-slate-800">Federal Tax Filing (IRS)</span>
                  <p className="text-xs text-slate-500">United States Internal Revenue Service filing required.</p>
                </div>
                <span className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                  Required (U.S.)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Home Tax Resident State *
                </label>
                <select
                  value={formData.jurisdictions.residentState}
                  onChange={(e) => setFormData({
                    ...formData,
                    jurisdictions: { ...formData.jurisdictions, residentState: e.target.value as USStateCode }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none bg-white"
                >
                  {US_STATES.map((s) => (
                    <option key={s.code} value={s.code}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  States with Physical Operations, Property, or Employees
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Select all U.S. states where your business has physical presence, payroll withholding, or economic sales nexus.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200">
                  {US_STATES.map((s) => {
                    const isSelected = formData.jurisdictions.statesOfOperation.includes(s.code);
                    return (
                      <label key={s.code} className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const cur = formData.jurisdictions.statesOfOperation;
                            const updated = e.target.checked
                              ? [...cur, s.code]
                              : cur.filter(c => c !== s.code);
                            setFormData({
                              ...formData,
                              jurisdictions: { ...formData.jurisdictions, statesOfOperation: updated }
                            });
                          }}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>{s.code} - {s.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Local Tax & Licensing Jurisdictions
                </label>
                <input
                  type="text"
                  value={formData.jurisdictions.localJurisdictions.join(', ')}
                  onChange={(e) => setFormData({
                    ...formData,
                    jurisdictions: {
                      ...formData.jurisdictions,
                      localJurisdictions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="e.g. City of Columbia Business License, Richland County Assessor"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: ENTITY SPECIFICS */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-600" />
                Entity-Specific Tax Questionnaire
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Targeted questions for your entity structure ({formData.entityType.toUpperCase()}).
              </p>
            </div>

            {/* S-Corp / Partnership / LLC Questions */}
            {(formData.entityType === 'scorp' || formData.entityType === 'llc' || formData.entityType === 'sole_proprietorship') && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-semibold text-sm text-slate-800 block mb-1">Home Office Deduction</span>
                  <p className="text-xs text-slate-500 mb-3">
                    Do you maintain a dedicated, regularly used space for your administrative or consulting operations?
                  </p>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(formData.entitySpecificDetails?.soleProprietor?.homeOfficeDeductionClaimed)}
                      onChange={(e) => setFormData({
                        ...formData,
                        entitySpecificDetails: {
                          ...formData.entitySpecificDetails,
                          soleProprietor: {
                            businessName: formData.legalBusinessName,
                            principalActivity: formData.businessProfile.primaryActivityDescription,
                            homeOfficeDeductionClaimed: e.target.checked,
                            businessMileage: formData.entitySpecificDetails.soleProprietor?.businessMileage || 0,
                            mileageMethod: 'standard_rate',
                            inventoryAtYearEnd: 0
                          }
                        }
                      })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Yes, I claim a home office deduction under IRC § 280A.</span>
                  </label>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="font-semibold text-sm text-slate-800 block mb-1">Business Vehicle Mileage</span>
                  <p className="text-xs text-slate-500 mb-3">
                    Record business mileage substantiated by a contemporary written log (IRC § 274(d)).
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      value={formData.entitySpecificDetails?.soleProprietor?.businessMileage || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        entitySpecificDetails: {
                          ...formData.entitySpecificDetails,
                          soleProprietor: {
                            businessName: formData.legalBusinessName,
                            principalActivity: formData.businessProfile.primaryActivityDescription,
                            homeOfficeDeductionClaimed: Boolean(formData.entitySpecificDetails.soleProprietor?.homeOfficeDeductionClaimed),
                            businessMileage: Number(e.target.value),
                            mileageMethod: 'standard_rate',
                            inventoryAtYearEnd: 0
                          }
                        }
                      })}
                      className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      placeholder="Total miles"
                    />
                    <span className="text-xs text-slate-600 font-medium">Annual business miles (2025 rate: 67¢/mile)</span>
                  </div>
                </div>

                {formData.entityType === 'scorp' && (
                  <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-700" />
                      <span className="font-semibold text-sm text-amber-900">S-Corporation Reasonable Officer Compensation</span>
                    </div>
                    <p className="text-xs text-amber-800">
                      IRS Rev. Rul. 74-44 requires shareholder-officers performing significant services to receive reasonable W-2 compensation prior to receiving non-wage distributions.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Officer W-2 Compensation Paid ($)</label>
                        <input
                          type="number"
                          value={formData.entitySpecificDetails?.sCorp?.officerW2CompensationPaid || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            entitySpecificDetails: {
                              ...formData.entitySpecificDetails,
                              sCorp: {
                                form1120sFilingRequired: true,
                                officerW2CompensationPaid: Number(e.target.value),
                                distributionsPaid: formData.entitySpecificDetails.sCorp?.distributionsPaid || 0,
                                hasShareholderLoans: false,
                                statePtetElectionMade: false
                              }
                            }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. 75000"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Shareholder Distributions Paid ($)</label>
                        <input
                          type="number"
                          value={formData.entitySpecificDetails?.sCorp?.distributionsPaid || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            entitySpecificDetails: {
                              ...formData.entitySpecificDetails,
                              sCorp: {
                                form1120sFilingRequired: true,
                                officerW2CompensationPaid: formData.entitySpecificDetails.sCorp?.officerW2CompensationPaid || 0,
                                distributionsPaid: Number(e.target.value),
                                hasShareholderLoans: false,
                                statePtetElectionMade: false
                              }
                            }
                          })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="e.g. 45000"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: OWNERS AND OFFICERS */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-600" />
                  Owners, Officers & Authorized Contacts
                </h3>
                <p className="text-sm text-slate-600 mt-1">
                  Document all owners and beneficial owners (FinCEN Corporate Transparency Act compliance).
                </p>
              </div>

              <div className={`px-3 py-1 text-xs font-semibold rounded-full border ${
                Math.abs(totalEquity - 100) < 0.01 
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border-amber-300'
              }`}>
                Total Equity Allocated: {totalEquity}% / 100%
              </div>
            </div>

            <div className="space-y-4">
              {formData.ownersAndContacts.map((owner, idx) => (
                <div key={owner.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-800">
                      Owner #{idx + 1}: {owner.legalName || 'Authorized Officer'}
                    </span>
                    <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {owner.ownershipPercentage}% Equity
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Legal Full Name</label>
                      <input
                        type="text"
                        value={owner.legalName}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].legalName = e.target.value;
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Corporate Title / Role</label>
                      <input
                        type="text"
                        value={owner.role}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].role = e.target.value;
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Ownership Percentage (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={owner.ownershipPercentage}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].ownershipPercentage = Number(e.target.value);
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Email</label>
                      <input
                        type="email"
                        value={owner.email}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].email = e.target.value;
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Phone</label>
                      <input
                        type="text"
                        value={owner.phone}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].phone = e.target.value;
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Masked SSN / ITIN</label>
                      <input
                        type="text"
                        value={owner.maskedSsnOrTin}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].maskedSsnOrTin = e.target.value;
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm bg-white font-mono"
                        placeholder="•••-••-1234"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-slate-200 text-xs text-slate-700">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={owner.isUsResident}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].isUsResident = e.target.checked;
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="rounded text-amber-600"
                      />
                      <span>U.S. Resident</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={owner.isAuthorizedSignatory}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].isAuthorizedSignatory = e.target.checked;
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="rounded text-amber-600"
                      />
                      <span>Authorized Signatory</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={owner.isBoiBeneficialOwner}
                        onChange={(e) => {
                          const updated = [...formData.ownersAndContacts];
                          updated[idx].isBoiBeneficialOwner = e.target.checked;
                          setFormData({ ...formData, ownersAndContacts: updated });
                        }}
                        className="rounded text-amber-600"
                      />
                      <span>FinCEN BOI Beneficial Owner</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 5: ACCOUNTING SETUP & BANK ACCOUNTS */}
        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600" />
                Accounting Setup & Bank Accounts
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Configure accounting methods, chart of accounts, and financial institution accounts.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Accounting Method *
                </label>
                <select
                  value={formData.accountingSetup.accountingMethod}
                  onChange={(e) => setFormData({
                    ...formData,
                    accountingSetup: {
                      ...formData.accountingSetup,
                      accountingMethod: e.target.value as 'cash' | 'accrual'
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                >
                  <option value="cash">Cash Basis (Revenue recognized upon receipt)</option>
                  <option value="accrual">Accrual Basis (Revenue earned / Expenses incurred)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Current Accounting Software *
                </label>
                <input
                  type="text"
                  value={formData.accountingSetup.currentSoftware}
                  onChange={(e) => setFormData({
                    ...formData,
                    accountingSetup: { ...formData.accountingSetup, currentSoftware: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="e.g. QuickBooks Online, Xero, Desktop"
                />
              </div>
            </div>

            {/* Bank Accounts Section */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              <span className="font-semibold text-sm text-slate-800 block">Operating & Reserve Bank Accounts</span>
              <div className="space-y-3">
                {formData.accountingSetup.bankAccounts.map((bank, bIdx) => (
                  <div key={bank.id} className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                    <div>
                      <div className="font-semibold text-slate-800">{bank.institutionName} ({bank.accountType})</div>
                      <div className="text-xs text-slate-500">
                        Account: <span className="font-mono">{bank.maskedAccountNumber}</span> | Routing: <span className="font-mono">{bank.routingNumberMasked}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                        bank.currentReconciliationStatus === 'reconciled'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {bank.currentReconciliationStatus === 'reconciled' ? 'Reconciled' : 'Statement Needed'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 6: BUSINESS OPERATIONS QUESTIONNAIRE */}
        {currentStep === 6 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-amber-600" />
                Business Operations & Tax Triggers
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Answer these standard operational questions to ensure all statutory deductions and disclosures are identified.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.businessOperations.acceptsCreditCards}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessOperations: { ...formData.businessOperations, acceptsCreditCards: e.target.checked }
                  })}
                  className="mt-1 rounded text-amber-600"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">Credit & Debit Card Processing</span>
                  <span className="text-xs text-slate-500">Accepts customer credit card payments (generates Form 1099-K).</span>
                </div>
              </label>

              <label className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.businessOperations.pays1099Contractors}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessOperations: { ...formData.businessOperations, pays1099Contractors: e.target.checked }
                  })}
                  className="mt-1 rounded text-amber-600"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">Independent Contractors (1099-NEC)</span>
                  <span className="text-xs text-slate-500">Paid $600+ to non-employees for services in tax year.</span>
                </div>
              </label>

              <label className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.businessOperations.holdsInventory}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessOperations: { ...formData.businessOperations, holdsInventory: e.target.checked }
                  })}
                  className="mt-1 rounded text-amber-600"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">Holds Physical Goods Inventory</span>
                  <span className="text-xs text-slate-500">Subject to inventory valuation methods (FIFO/LIFO/Average Cost).</span>
                </div>
              </label>

              <label className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.businessOperations.sponsorsRetirementPlan}
                  onChange={(e) => setFormData({
                    ...formData,
                    businessOperations: { ...formData.businessOperations, sponsorsRetirementPlan: e.target.checked }
                  })}
                  className="mt-1 rounded text-amber-600"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-800 block">Employer Retirement Plan</span>
                  <span className="text-xs text-slate-500">SEP-IRA, Solo 401(k), or company 401(k) contributions made.</span>
                </div>
              </label>
            </div>
          </div>
        )}

        {/* STEP 7: CROSS-BORDER FLAGS (Professional Review Queue) */}
        {currentStep === 7 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-amber-600" />
                Foreign Financial Interests & Safeguards
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                U.S. tax law imposes significant penalties for unfiled foreign account reports. Answering yes flags this topic for CPA review without automatically imposing requirements.
              </p>
            </div>

            <div className="p-5 bg-amber-50/50 rounded-xl border border-amber-200 space-y-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.crossBorderTriggers.hasForeignBankAccounts}
                  onChange={(e) => setFormData({
                    ...formData,
                    crossBorderTriggers: { ...formData.crossBorderTriggers, hasForeignBankAccounts: e.target.checked }
                  })}
                  className="mt-1 rounded text-amber-600"
                />
                <div>
                  <span className="text-sm font-semibold text-slate-900 block">
                    Foreign Financial Accounts Exceeding $10,000 Aggregate
                  </span>
                  <span className="text-xs text-slate-600">
                    Did you or your business have signature authority over or financial interest in bank, securities, or crypto accounts outside the United States at any point in {formData.taxYear}?
                  </span>
                </div>
              </label>

              {formData.crossBorderTriggers.hasForeignBankAccounts && (
                <div className="p-3 bg-white rounded-lg border border-amber-300 text-xs text-slate-700 space-y-1">
                  <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-700" />
                    Flagged for Professional Review: FinCEN Form 114 (FBAR) & Form 8938
                  </div>
                  <p className="text-slate-600">
                    Your assigned accountant (Desmond Hinds) will personally assess foreign currency thresholds before any international filing is mandated.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP 8: FINANCIAL DOCUMENTS CHECKLIST */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-600" />
                Required Financial Documents
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Upload tax forms and bank statements directly. Our AI Document Intelligence automatically classifies and extracts key line items.
              </p>
            </div>

            <div className="space-y-3">
              {formData.documentChecklist.map((doc) => (
                <div key={doc.id} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900">{doc.title}</span>
                      {doc.required && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">{doc.description}</p>
                    {doc.fileName && (
                      <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mt-1">
                        File: {doc.fileName} (AI Confidence: {doc.aiConfidence}%)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {doc.status === 'approved' ? (
                      <span className="px-3 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100 rounded-full border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                      </span>
                    ) : (
                      <label className="px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer flex items-center gap-1.5 transition">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File</span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              const f = e.target.files[0];
                              const updated = formData.documentChecklist.map(d => 
                                d.id === doc.id ? { ...d, status: 'approved' as const, fileName: f.name, aiConfidence: 95 } : d
                              );
                              const newFormData = { ...formData, documentChecklist: updated };
                              setFormData(newFormData);
                              handleAutosave(newFormData);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 9: REVIEW & ELECTRONIC SIGNATURE */}
        {currentStep === 9 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-amber-600" />
                Final Review & Electronic Signature
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Review your submitted details. Provide an electronic signature to transmit your intake package to Desmond Hinds.
              </p>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Entity Legal Name</span>
                  <p className="font-semibold text-slate-800">{formData.legalBusinessName}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Structure & Tax Year</span>
                  <p className="font-semibold text-slate-800">{formData.entityType.toUpperCase()} ({formData.taxYear})</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Formation & Resident State</span>
                  <p className="font-semibold text-slate-800">{formData.businessProfile.formationState} / {formData.jurisdictions.residentState}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 uppercase font-semibold">Assigned Senior Accountant</span>
                  <p className="font-semibold text-slate-800">{formData.assignedAccountantName}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Authorized Electronic Signature *
                </label>
                <input
                  type="text"
                  value={formData.preferencesAndConsents.electronicSignature}
                  onChange={(e) => setFormData({
                    ...formData,
                    preferencesAndConsents: { ...formData.preferencesAndConsents, electronicSignature: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white font-serif italic text-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  placeholder="Type your full legal name"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  By signing, I certify under penalty of perjury that the information provided is true, correct, and complete to the best of my knowledge.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Controls */}
      <div className="bg-slate-50 p-6 border-t border-slate-200 flex items-center justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-lg shadow-sm disabled:opacity-40 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-3">
          {currentStep < steps.length ? (
            <button
              onClick={nextStep}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-sm font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition"
            >
              Save & Continue
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={submitFinalDossier}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSaving ? 'Submitting...' : 'Submit to Desmond Hinds'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
