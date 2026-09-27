import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ArrowRight, 
  FileText, 
  Video, 
  Phone, 
  Calendar, 
  MessageSquare, 
  Shield, 
  Building2, 
  CreditCard, 
  Eye, 
  EyeOff, 
  Upload, 
  Lock, 
  UserCheck, 
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FullClientIntakeDossier, SetupAreaItem } from '../../types/intake';
import { GuidedIntakeWizard } from './GuidedIntakeWizard';

export const ClientIntakeDashboard: React.FC = () => {
  const { currentUser, appointments, setCurrentPage } = useApp();

  const [loading, setLoading] = useState(true);
  const [dossier, setDossier] = useState<FullClientIntakeDossier | null>(null);
  const [activeWizardStep, setActiveWizardStep] = useState<number | null>(null);
  const [showSensitiveData, setShowSensitiveData] = useState(false);
  const [consultationModalOpen, setConsultationModalOpen] = useState(false);
  const [consultationType, setConsultationType] = useState<'video' | 'audio'>('video');
  const [consultationNotes, setConsultationNotes] = useState('');
  const [consultationSuccess, setConsultationSuccess] = useState(false);

  // Fetch intake dashboard data
  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/intake/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'x-session-token': localStorage.getItem('token') || ''
        }
      });
      const data = await res.json();
      if (res.ok && data.dossier) {
        setDossier(data.dossier);
      }
    } catch (err) {
      console.error('Error fetching intake dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleConsultationRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/appointments/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'x-session-token': localStorage.getItem('token') || ''
        },
        body: JSON.stringify({
          clientName: currentUser?.name || dossier?.clientName || 'Valued Client',
          clientEmail: currentUser?.email || 'client@example.com',
          serviceType: consultationType === 'video' ? 'Virtual Video Tax Review' : 'Direct Audio Consultation',
          date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          time: '10:00 AM',
          notes: consultationNotes || `Requested ${consultationType} consultation regarding intake onboarding.`
        })
      });
      if (res.ok) {
        setConsultationSuccess(true);
        setTimeout(() => {
          setConsultationSuccess(false);
          setConsultationModalOpen(false);
          setConsultationNotes('');
        }, 2500);
      }
    } catch (err) {
      console.error('Failed to request consultation:', err);
    }
  };

  // Find next upcoming appointment
  const upcomingAppointment = (appointments || []).find(
    a => (a.clientEmail === currentUser?.email || currentUser?.role !== 'client') && a.status === 'confirmed'
  );

  if (loading && !dossier) {
    return (
      <div className="flex items-center justify-center p-12 bg-white rounded-xl border border-slate-200">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-3 text-sm font-medium text-slate-600">Loading Client Intake Dashboard...</span>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="p-8 bg-white rounded-xl border border-slate-200 text-center">
        <AlertCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
        <h3 className="text-base font-bold text-slate-900">Intake Dossier Pending</h3>
        <p className="text-sm text-slate-600 mt-1 mb-4">
          Click below to initialize your U.S. Client Intake Package.
        </p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-lg"
        >
          Initialize Setup
        </button>
      </div>
    );
  }

  // If user clicked View/Edit step, render the wizard modal or full view
  if (activeWizardStep !== null) {
    return (
      <GuidedIntakeWizard
        dossier={dossier}
        initialStep={activeWizardStep}
        onSaveAndClose={() => {
          setActiveWizardStep(null);
          fetchDashboard();
        }}
        onDossierUpdated={(updated) => {
          setDossier(updated);
        }}
      />
    );
  }

  // Step mapping for setup areas
  const stepByAreaId: Record<string, number> = {
    area_business_info: 1,
    area_tax_info: 2,
    area_owners_contacts: 4,
    area_coa: 5,
    area_bank_accounts: 5,
    area_opening_balances: 5,
    area_financial_docs: 8,
    area_accounting_prefs: 6
  };

  return (
    <div className="space-y-6">
      {/* 1. WELCOME & ENGAGEMENT OVERVIEW BANNER */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        {/* Subtle decorative background glow */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">
                U.S. Client Intake System
              </span>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-800 text-slate-300 rounded border border-slate-700">
                Tax Year {dossier.taxYear}
              </span>
              <span className="px-2.5 py-0.5 text-xs font-medium bg-slate-800 text-slate-300 rounded border border-slate-700">
                {dossier.primaryJurisdiction}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome, {dossier.clientName}
            </h1>

            <p className="text-sm text-slate-300 max-w-2xl">
              Current Engagement: <strong className="text-white">{dossier.currentEngagementTitle}</strong>. 
              Your assigned Senior Accountant is <strong className="text-amber-400">{dossier.assignedAccountantName}</strong> (A/R Tax Services, LLC).
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Legal Entity: <strong className="text-slate-200">{dossier.legalBusinessName}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-400" />
                <span>
                  EIN: <strong className="font-mono text-slate-200">
                    {showSensitiveData ? dossier.businessProfile.einMasked.replace(/•/g, '9') : dossier.businessProfile.einMasked}
                  </strong>
                </span>
                <button
                  onClick={() => setShowSensitiveData(!showSensitiveData)}
                  className="text-slate-400 hover:text-white transition ml-0.5"
                  title="Toggle Tax ID Masking"
                >
                  {showSensitiveData ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Progress Circular Widget & Primary Action */}
          <div className="flex flex-col sm:flex-row items-center gap-5 bg-slate-800/80 p-5 rounded-xl border border-slate-700 shrink-0">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-slate-700"
                  strokeWidth="7"
                  fill="transparent"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  className="stroke-amber-400 transition-all duration-500"
                  strokeWidth="7"
                  strokeDasharray={213}
                  strokeDashoffset={213 - (213 * dossier.percentComplete) / 100}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-white leading-none">{dossier.percentComplete}%</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-tight mt-0.5">Setup</span>
              </div>
            </div>

            <div className="text-center sm:text-left space-y-2">
              <div className="text-xs font-medium text-slate-300">
                Status: <span className="font-semibold text-amber-400 capitalize">{dossier.status.replace(/_/g, ' ')}</span>
              </div>
              <button
                onClick={() => setActiveWizardStep(dossier.currentSectionStep || 1)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 rounded-lg shadow-lg shadow-amber-500/10 transition transform active:scale-98"
              >
                <span>Complete Setup</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. CRITICAL HIGHLIGHTS & ACTION HUBS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Missing Critical Items & Next Action */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                Action Required
              </span>
              <AlertCircle className="w-4 h-4 text-rose-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Missing Critical Requirements</h3>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              <li className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>1 bank statement missing (Wells Fargo Dec 2025)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                <span>3 financial documents missing (Form 1098, Mileage Log)</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span>Opening ledger balances require client verification</span>
              </li>
            </ul>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              onClick={() => setActiveWizardStep(8)}
              className="w-full text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 p-2 rounded-lg flex items-center justify-center gap-1.5 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Missing Documents</span>
            </button>
          </div>
        </div>

        {/* Card 2: Upcoming Statutory Deadlines */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                U.S. Tax Calendar
              </span>
              <Calendar className="w-4 h-4 text-slate-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Upcoming Filing Deadlines</h3>
            <div className="mt-2 space-y-2 text-xs">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <div className="font-semibold text-slate-800">March 15, 2026</div>
                <div className="text-slate-500">S-Corp (Form 1120-S) & Partnership (Form 1065)</div>
              </div>
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                <div className="font-semibold text-slate-800">April 15, 2026</div>
                <div className="text-slate-500">Individual (Form 1040) & C-Corp (Form 1120)</div>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
            Assigned accountant handles automatic extension filings if needed.
          </div>
        </div>

        {/* Card 3: Staff Review & Consultation Hub */}
        <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                CPA Direct Connect
              </span>
              <UserCheck className="w-4 h-4 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">Desmond Hinds, Senior Accountant</h3>
            <p className="text-xs text-slate-600 mt-1">
              "We have reviewed your W-2 and 1099-NEC. Please provide the final December bank statement to finalize Schedule C business expenses."
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2">
            <button
              onClick={() => {
                setConsultationType('video');
                setConsultationModalOpen(true);
              }}
              className="flex-1 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg flex items-center justify-center gap-1 transition"
            >
              <Video className="w-3.5 h-3.5 text-amber-600" />
              <span>Video Call</span>
            </button>
            <button
              onClick={() => {
                setConsultationType('audio');
                setConsultationModalOpen(true);
              }}
              className="flex-1 text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200 p-2 rounded-lg flex items-center justify-center gap-1 transition"
            >
              <Phone className="w-3.5 h-3.5 text-slate-600" />
              <span>Audio Call</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. ACTIVE CONSULTATION / UPCOMING SESSION (If Exists) */}
      {upcomingAppointment && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="p-3 bg-amber-500 text-slate-950 rounded-xl font-bold">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Scheduled Professional Consultation
              </div>
              <h4 className="text-base font-bold text-slate-900">
                {upcomingAppointment.serviceType}
              </h4>
              <p className="text-xs text-slate-600">
                {upcomingAppointment.date} at {upcomingAppointment.timeSlot || (upcomingAppointment as any).time || '10:00 AM'} with Desmond Hinds. Short-lived encrypted token ready.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                // Navigate to virtual consultation room
                window.location.href = `/consultation/${upcomingAppointment.id || 'room_default'}`;
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-amber-400 text-xs font-bold rounded-lg shadow-sm transition"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Join Secure Consultation</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 4. SETUP AREAS TABLE WITH ACCESSIBLE STATUSES */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              U.S. Client Intake & Setup Areas
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and complete the eight structured compliance areas required for federal and state filing.
            </p>
          </div>

          <button
            onClick={() => setActiveWizardStep(1)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition"
          >
            <span>Open Full Wizard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Setup Area</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Completion Details</th>
                <th className="py-3 px-4 text-center">Progress</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {dossier.setupAreas.map((area) => {
                const step = stepByAreaId[area.id] || 1;
                return (
                  <tr key={area.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-900 block">{area.name}</span>
                      {area.requiredForSubmission && (
                        <span className="text-[10px] text-slate-400 uppercase font-medium">Required for filing</span>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold rounded-full ${
                        area.badgeVariant === 'success'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : area.badgeVariant === 'warning'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : area.badgeVariant === 'danger'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {area.badgeVariant === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {area.badgeVariant === 'warning' && <AlertCircle className="w-3 h-3 text-amber-600" />}
                        {area.badgeVariant === 'danger' && <AlertCircle className="w-3 h-3 text-rose-600" />}
                        <span>{area.statusLabel}</span>
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                      {area.description}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <div className="w-16 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              area.completionPercentage === 100 ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${area.completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-500">{area.completionPercentage}%</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setActiveWizardStep(step)}
                        className="text-xs font-semibold text-slate-800 hover:text-amber-800 bg-slate-100 hover:bg-amber-50 px-3 py-1.5 rounded-lg border border-slate-200 transition"
                      >
                        {area.completionPercentage === 100 ? 'Review' : 'Complete →'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. CONSULTATION REQUEST MODAL */}
      {consultationModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {consultationType === 'video' ? <Video className="w-5 h-5 text-amber-600" /> : <Phone className="w-5 h-5 text-amber-600" />}
                Request {consultationType === 'video' ? 'Video Consultation' : 'Audio Call'}
              </h3>
              <button
                onClick={() => setConsultationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {consultationSuccess ? (
              <div className="py-8 text-center space-y-2">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h4 className="text-base font-bold text-slate-900">Request Confirmed</h4>
                <p className="text-xs text-slate-600">
                  Desmond Hinds has been notified. You will receive a secure meeting room link via email and portal.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConsultationRequest} className="space-y-4 pt-4">
                <p className="text-xs text-slate-600">
                  Connect with your assigned senior accountant to review missing intake items, tax strategies, or financial statements.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    Meeting Reason / Key Discussion Items
                  </label>
                  <textarea
                    rows={3}
                    value={consultationNotes}
                    onChange={(e) => setConsultationNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="e.g. Discuss Schedule C deductions and Wells Fargo statement reconciliation."
                  />
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Consultations are conducted over encrypted WebRTC with live dynamic watermarking for document review.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setConsultationModalOpen(false)}
                    className="px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition"
                  >
                    Submit Request
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
