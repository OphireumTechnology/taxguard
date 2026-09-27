/**
 * A/R TAX SERVICES, LLC - Accountant & Consultant Onboarding Wizard
 * Implements Part 3 of specification:
 * Mandatory 8-section staff onboarding workflow for invited tax professionals:
 * Section A: Personal and Contact Details
 * Section B: Employment Information
 * Section C: Professional Qualifications (CPA, EA, PTIN, EFIN)
 * Section D: Services and Specializations
 * Section E: Jurisdictions and Client Eligibility
 * Section F: Security Setup (MFA, Compliance Trainings)
 * Section G: Calendar Setup (Working hours, Buffers, Sync)
 * Section H: Administrative Review & Account Activation
 */

import React, { useState, useEffect } from 'react';
import { 
  UserCheck, 
  Briefcase, 
  Award, 
  Layers, 
  Globe, 
  ShieldCheck, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  FileCheck,
  Clock,
  Check,
  Lock,
  Plus,
  Trash2
} from 'lucide-react';
import { StaffOnboardingDossier } from '../../types/onboarding';
import { getStoredToken } from '../../services/api';

const STAFF_SECTIONS = [
  { id: 'A', title: 'Personal & Contact', icon: UserCheck },
  { id: 'B', title: 'Employment Info', icon: Briefcase },
  { id: 'C', title: 'Qualifications & PTIN', icon: Award },
  { id: 'D', title: 'Specializations', icon: Layers },
  { id: 'E', title: 'Jurisdictions & Capacity', icon: Globe },
  { id: 'F', title: 'Security & MFA', icon: ShieldCheck },
  { id: 'G', title: 'Calendar & Sync', icon: Calendar },
  { id: 'H', title: 'Admin Verification', icon: CheckCircle2 }
];

export const StaffOnboardingWizard: React.FC = () => {
  const [dossier, setDossier] = useState<StaffOnboardingDossier | null>(null);
  const [activeSection, setActiveSection] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'>('A');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStaffDossier();
  }, []);

  const fetchStaffDossier = async () => {
    try {
      setIsLoading(true);
      const token = getStoredToken();
      const res = await fetch('/api/onboarding/staff/dossier', {
        headers: {
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (!res.ok) throw new Error('Could not load staff onboarding dossier');
      const data = await res.json();
      setDossier(data.dossier);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSectionData = async (section: string, data: any) => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      const token = getStoredToken();
      const res = await fetch('/api/onboarding/staff/save-section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        },
        body: JSON.stringify({ section, data })
      });
      if (!res.ok) throw new Error('Save failed');
      const resData = await res.json();
      setDossier(resData.dossier);
      setSaveMessage('Section saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitStaffOnboarding = async () => {
    try {
      setIsSaving(true);
      const token = getStoredToken();
      const res = await fetch('/api/onboarding/staff/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'x-session-token': token || ''
        }
      });
      if (!res.ok) throw new Error('Submission failed');
      const resData = await res.json();
      setDossier(resData.dossier);
      setActiveSection('H');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4">
        <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-600 font-medium">Loading staff professional onboarding dossier...</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="p-8 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 max-w-2xl mx-auto text-center space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto text-amber-600" />
        <h3 className="font-bold text-lg">Staff Invitation Required</h3>
        <p className="text-sm text-slate-600">
          Accountant, Consultant, and Reviewer accounts require a single-use administrative invitation token. Public signup for staff is strictly prohibited to enforce firm security and credential verification.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 md:p-8 shadow-xl border border-amber-500/20 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>A/R Tax Services, LLC • Staff Credentialing</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold font-serif text-white">
              Professional Staff Onboarding & Verification
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Complete your tax practitioner credentials, IRS PTIN/EFIN details, calendar availability, and security compliance training.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
            <div>
              <div className="text-xs text-slate-400 font-medium uppercase tracking-wider">Status</div>
              <div className="text-sm font-bold text-amber-400 capitalize">
                {dossier.status.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 overflow-x-auto">
        <div className="flex space-x-1 min-w-max">
          {STAFF_SECTIONS.map(tab => {
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

      {/* Main Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
        {saveMessage && (
          <div className="mb-6 flex items-center space-x-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{saveMessage}</span>
          </div>
        )}

        {/* SECTION A: PERSONAL & CONTACT */}
        {activeSection === 'A' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section A: Personal & Contact Information</h2>
              <p className="text-sm text-slate-500">Legal identification and public practitioner profile.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Legal First Name</label>
                <input
                  type="text"
                  value={dossier.personalContact.legalFirstName}
                  onChange={e => setDossier({ ...dossier, personalContact: { ...dossier.personalContact, legalFirstName: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Legal Last Name</label>
                <input
                  type="text"
                  value={dossier.personalContact.legalLastName}
                  onChange={e => setDossier({ ...dossier, personalContact: { ...dossier.personalContact, legalLastName: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Professional Display Name</label>
                <input
                  type="text"
                  placeholder="e.g., Marcus Vance, MS Tax"
                  value={dossier.personalContact.professionalDisplayName}
                  onChange={e => setDossier({ ...dossier, personalContact: { ...dossier.personalContact, professionalDisplayName: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  disabled
                  value={dossier.personalContact.workEmail}
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 text-slate-500 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Mobile Telephone</label>
                <input
                  type="tel"
                  value={dossier.personalContact.mobileNumber}
                  onChange={e => setDossier({ ...dossier, personalContact: { ...dossier.personalContact, mobileNumber: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Time Zone</label>
                <select
                  value={dossier.personalContact.timeZone}
                  onChange={e => setDossier({ ...dossier, personalContact: { ...dossier.personalContact, timeZone: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="America/New_York">Eastern Time (US & Canada)</option>
                  <option value="America/Chicago">Central Time (US & Canada)</option>
                  <option value="America/Denver">Mountain Time (US & Canada)</option>
                  <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Professional Biography</label>
              <textarea
                rows={3}
                placeholder="Brief summary of your accounting expertise, experience, and background..."
                value={dossier.personalContact.professionalBio}
                onChange={e => setDossier({ ...dossier, personalContact: { ...dossier.personalContact, professionalBio: e.target.value } })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
          </div>
        )}

        {/* SECTION B: EMPLOYMENT INFO */}
        {activeSection === 'B' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section B: Employment & Agreements</h2>
              <p className="text-sm text-slate-500">Firm role, working arrangement, and confidentiality agreements.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Job Title</label>
                <input
                  type="text"
                  value={dossier.employmentInfo.jobTitle}
                  onChange={e => setDossier({ ...dossier, employmentInfo: { ...dossier.employmentInfo, jobTitle: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Department</label>
                <select
                  value={dossier.employmentInfo.department}
                  onChange={e => setDossier({ ...dossier, employmentInfo: { ...dossier.employmentInfo, department: e.target.value as any } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Tax">Tax Compliance & Strategy</option>
                  <option value="Accounting">Accounting & Bookkeeping</option>
                  <option value="Review">Quality & Regulatory Review</option>
                  <option value="Advisory">Advisory & Consulting</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Office Location</label>
                <select
                  value={dossier.employmentInfo.officeLocation}
                  onChange={e => setDossier({ ...dossier, employmentInfo: { ...dossier.employmentInfo, officeLocation: e.target.value as any } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                >
                  <option value="Columbia HQ">Columbia HQ (In-Office)</option>
                  <option value="Remote">Remote</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Signed Staff Compliance Agreements</h3>
              <div className="space-y-2">
                {[
                  { key: 'employmentAgreement', label: 'Employment / Independent Contractor Professional Agreement' },
                  { key: 'confidentialityAgreement', label: 'IRC § 7216 Client Tax Data Non-Disclosure Agreement' },
                  { key: 'acceptableUsePolicy', label: 'Firm Technology & Cloud Access Acceptable Use Policy' },
                  { key: 'securityAgreement', label: 'SOC-2 Data Security & Incident Reporting Acknowledgment' }
                ].map(agr => (
                  <label key={agr.key} className="flex items-center space-x-3 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={(dossier.employmentInfo.signedAgreements as any)[agr.key]}
                      onChange={e => setDossier({
                        ...dossier,
                        employmentInfo: {
                          ...dossier.employmentInfo,
                          signedAgreements: { ...dossier.employmentInfo.signedAgreements, [agr.key]: e.target.checked }
                        }
                      })}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>{agr.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SECTION C: QUALIFICATIONS & PTIN */}
        {activeSection === 'C' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section C: Professional Licenses, PTIN & EFIN</h2>
              <p className="text-sm text-slate-500">Document active CPA, Enrolled Agent, and IRS preparer credentials.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">IRS PTIN Number</label>
                <input
                  type="text"
                  placeholder="P00000000"
                  value={dossier.qualifications.ptinStatus || ''}
                  onChange={e => setDossier({ ...dossier, qualifications: { ...dossier.qualifications, ptinStatus: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">IRS EFIN Association</label>
                <input
                  type="text"
                  placeholder="Firm Master EFIN"
                  value={dossier.qualifications.efinAssociation || ''}
                  onChange={e => setDossier({ ...dossier, qualifications: { ...dossier.qualifications, efinAssociation: e.target.value } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Years of Tax Experience</label>
                <input
                  type="number"
                  value={dossier.qualifications.yearsOfExperience}
                  onChange={e => setDossier({ ...dossier, qualifications: { ...dossier.qualifications, yearsOfExperience: parseInt(e.target.value, 10) } })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Professional Licenses & Certifications</h3>
                <button
                  onClick={() => {
                    const newLicense = {
                      type: 'CPA' as const,
                      licenseNumber: '',
                      issuingAuthority: 'South Carolina Board of Accountancy',
                      jurisdiction: 'SC',
                      issueDate: '',
                      expirationDate: '',
                      verifiedByAdmin: false
                    };
                    setDossier({
                      ...dossier,
                      qualifications: {
                        ...dossier.qualifications,
                        licenses: [...dossier.qualifications.licenses, newLicense]
                      }
                    });
                  }}
                  className="inline-flex items-center space-x-1 px-3 py-1 bg-amber-600 text-white rounded text-xs font-bold hover:bg-amber-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add License</span>
                </button>
              </div>

              {dossier.qualifications.licenses.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">No licenses recorded. Click &ldquo;Add License&rdquo; to add CPA, EA, or QuickBooks credentials.</p>
              ) : (
                dossier.qualifications.licenses.map((lic, idx) => (
                  <div key={idx} className="p-3 bg-white rounded-lg border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-700 block mb-1">Credential Type</span>
                      <select
                        value={lic.type}
                        onChange={e => {
                          const updated = [...dossier.qualifications.licenses];
                          updated[idx].type = e.target.value as any;
                          setDossier({ ...dossier, qualifications: { ...dossier.qualifications, licenses: updated } });
                        }}
                        className="w-full p-1.5 border rounded bg-white"
                      >
                        <option value="CPA">Certified Public Accountant (CPA)</option>
                        <option value="EA">IRS Enrolled Agent (EA)</option>
                        <option value="JD">Attorney (JD / Tax LLM)</option>
                        <option value="QuickBooks ProAdvisor">QuickBooks ProAdvisor</option>
                        <option value="Xero Advisor">Xero Advisor</option>
                      </select>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 block mb-1">License #</span>
                      <input
                        type="text"
                        placeholder="e.g. SC-12491"
                        value={lic.licenseNumber}
                        onChange={e => {
                          const updated = [...dossier.qualifications.licenses];
                          updated[idx].licenseNumber = e.target.value;
                          setDossier({ ...dossier, qualifications: { ...dossier.qualifications, licenses: updated } });
                        }}
                        className="w-full p-1.5 border rounded font-mono"
                      />
                    </div>
                    <div>
                      <span className="font-bold text-slate-700 block mb-1">Expiration Date</span>
                      <input
                        type="date"
                        value={lic.expirationDate}
                        onChange={e => {
                          const updated = [...dossier.qualifications.licenses];
                          updated[idx].expirationDate = e.target.value;
                          setDossier({ ...dossier, qualifications: { ...dossier.qualifications, licenses: updated } });
                        }}
                        className="w-full p-1.5 border rounded"
                      />
                    </div>
                    <div className="flex items-end justify-between">
                      <span className="text-[10px] text-amber-800 bg-amber-100 px-2 py-1 rounded font-bold">
                        Pending Admin Verification
                      </span>
                      <button
                        onClick={() => {
                          const updated = dossier.qualifications.licenses.filter((_, i) => i !== idx);
                          setDossier({ ...dossier, qualifications: { ...dossier.qualifications, licenses: updated } });
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* SECTION F: SECURITY SETUP */}
        {activeSection === 'F' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section F: Security & Compliance Verification</h2>
              <p className="text-sm text-slate-500">MFA enrollment and mandatory security compliance modules.</p>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-emerald-900 text-xs">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Mandatory Multi-Factor Authentication (MFA) Active:</strong> Your staff account enforces cryptographic one-time passwords on every login.
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Required Firm Training Acknowledgments</h3>
              {[
                { key: 'confidentialityTraining', title: 'IRC Section 7216 Taxpayer Data Privacy Standards' },
                { key: 'phishingTraining', title: 'Anti-Phishing & Social Engineering Defense Protocol' },
                { key: 'dataProtectionTraining', title: 'Encrypted Workpaper Storage & Transmission Standards' },
                { key: 'documentHandlingTraining', title: 'Tax Document Redaction & Destruction Policy' },
                { key: 'incidentReportingAcknowledged', title: '24-Hour Security Incident Reporting Duty' }
              ].map(item => (
                <label key={item.key} className="flex items-center space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(dossier.securitySetup.completedTrainings as any)[item.key]}
                    onChange={e => setDossier({
                      ...dossier,
                      securitySetup: {
                        ...dossier.securitySetup,
                        completedTrainings: { ...dossier.securitySetup.completedTrainings, [item.key]: e.target.checked }
                      }
                    })}
                    className="rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="font-medium">{item.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* SECTION G: CALENDAR SETUP */}
        {activeSection === 'G' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section G: Calendar Availability & Working Hours</h2>
              <p className="text-sm text-slate-500">Configure your recurring appointment windows and meeting buffers.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Workday Starts</label>
                <input
                  type="time"
                  value={dossier.calendarSetup.workingHours.start}
                  onChange={e => setDossier({
                    ...dossier,
                    calendarSetup: {
                      ...dossier.calendarSetup,
                      workingHours: { ...dossier.calendarSetup.workingHours, start: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Workday Ends</label>
                <input
                  type="time"
                  value={dossier.calendarSetup.workingHours.end}
                  onChange={e => setDossier({
                    ...dossier,
                    calendarSetup: {
                      ...dossier.calendarSetup,
                      workingHours: { ...dossier.calendarSetup.workingHours, end: e.target.value }
                    }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Buffer Before (Min)</label>
                <input
                  type="number"
                  value={dossier.calendarSetup.bufferMinutesBefore}
                  onChange={e => setDossier({
                    ...dossier,
                    calendarSetup: { ...dossier.calendarSetup, bufferMinutesBefore: parseInt(e.target.value, 10) }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">Buffer After (Min)</label>
                <input
                  type="number"
                  value={dossier.calendarSetup.bufferMinutesAfter}
                  onChange={e => setDossier({
                    ...dossier,
                    calendarSetup: { ...dossier.calendarSetup, bufferMinutesAfter: parseInt(e.target.value, 10) }
                  })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION H: ADMIN REVIEW & ACTIVATION */}
        {activeSection === 'H' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-slate-900 font-serif">Section H: Administrative Review & Account Activation</h2>
              <p className="text-sm text-slate-500">Executive review by Managing Partner Desmond Hinds and firm administrators.</p>
            </div>

            <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${
                  dossier.status === 'approved' ? 'bg-emerald-600' : 'bg-amber-600'
                }`}>
                  {dossier.status === 'approved' ? <Check className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">
                    {dossier.status === 'approved' ? 'Account Verified & Active' : 'Submitted for Executive Review'}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {dossier.status === 'approved'
                      ? `Activated on ${new Date(dossier.adminReview.activatedAt || '').toLocaleDateString()}`
                      : 'Pending CPA license verification and firm partner sign-off.'}
                  </p>
                </div>
              </div>

              {dossier.status !== 'approved' && (
                <div className="pt-4 border-t border-slate-200 flex justify-end">
                  <button
                    onClick={handleSubmitStaffOnboarding}
                    className="px-6 py-2.5 bg-amber-500 text-slate-950 font-bold rounded-lg text-xs hover:bg-amber-600 flex items-center space-x-2"
                  >
                    <FileCheck className="w-4 h-4" />
                    <span>Submit Onboarding Dossier to Admin</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Navigation Buttons */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => {
              const curIdx = STAFF_SECTIONS.findIndex(t => t.id === activeSection);
              if (curIdx > 0) setActiveSection(STAFF_SECTIONS[curIdx - 1].id as any);
            }}
            disabled={activeSection === 'A'}
            className="inline-flex items-center space-x-2 px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const sectionDataMap: Record<string, any> = {
                  'A': dossier.personalContact,
                  'B': dossier.employmentInfo,
                  'C': dossier.qualifications,
                  'D': dossier.servicesSpecializations,
                  'E': dossier.jurisdictionsEligibility,
                  'F': dossier.securitySetup,
                  'G': dossier.calendarSetup
                };
                saveSectionData(activeSection, sectionDataMap[activeSection]);
              }}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-4 py-2 border border-amber-500/40 text-amber-700 bg-amber-50 rounded-lg text-xs font-bold hover:bg-amber-100"
            >
              <Save className="w-4 h-4" />
              <span>Save Section</span>
            </button>

            <button
              onClick={() => {
                const curIdx = STAFF_SECTIONS.findIndex(t => t.id === activeSection);
                if (curIdx < STAFF_SECTIONS.length - 1) {
                  setActiveSection(STAFF_SECTIONS[curIdx + 1].id as any);
                }
              }}
              disabled={activeSection === 'H'}
              className="inline-flex items-center space-x-2 px-5 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 disabled:opacity-30"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
