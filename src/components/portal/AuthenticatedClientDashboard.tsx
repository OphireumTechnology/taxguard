import React from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  FolderLock,
  FileText,
  Calendar,
  Building2,
  Lock,
  UserCheck,
  Check,
  AlertCircle
} from 'lucide-react';
import { StageOneOnboardingService } from '../../services/stageOneOnboardingService';
import { useApp } from '../../context/AppContext';
import { CANONICAL_STAGE_LABELS, StageNumber } from '../../server/taxguard/persistence.types';

interface AuthenticatedClientDashboardProps {
  clientId: string;
  selectedTaxYear: number;
  onTaxYearChange?: (year: number) => void;
  onEnterStageTwo: () => void;
  onReviewStageOne?: () => void;
}

export const AuthenticatedClientDashboard: React.FC<AuthenticatedClientDashboardProps> = ({
  clientId,
  selectedTaxYear,
  onTaxYearChange,
  onEnterStageTwo,
  onReviewStageOne
}) => {
  const { currentUser } = useApp();
  const dossier = StageOneOnboardingService.getDossier(clientId);

  const clientName = dossier?.legalName || currentUser?.name || 'Valued Taxpayer';
  const taxpayerType = dossier?.taxpayerType === 'entity' ? 'Entity / Business' : 'Individual / Family';
  const signerName = dossier?.engagementConsent?.signerFullName || dossier?.authorizedRep?.fullName || currentUser?.name || 'Authorized Signatory';

  const stages: Array<{ number: StageNumber; label: string; status: 'completed' | 'active' | 'pending' }> = [
    { number: 1, label: '01 Onboard', status: 'completed' },
    { number: 2, label: '02 Collect', status: 'active' },
    { number: 3, label: '03 Validate', status: 'pending' },
    { number: 4, label: '04 Record', status: 'pending' },
    { number: 5, label: '05 Reconcile', status: 'pending' },
    { number: 6, label: '06 Review', status: 'pending' },
    { number: 7, label: '07 Report', status: 'pending' },
    { number: 8, label: '08 Plan', status: 'pending' },
    { number: 9, label: '09 Prepare Taxes', status: 'pending' },
    { number: 10, label: '10 Approve', status: 'pending' },
    { number: 11, label: '11 Sign', status: 'pending' },
    { number: 12, label: '12 File', status: 'pending' },
    { number: 13, label: '13 Government Feedback', status: 'pending' },
    { number: 14, label: '14 Resolve', status: 'pending' },
    { number: 15, label: '15 Monitor', status: 'pending' },
    { number: 16, label: '16 Archive', status: 'pending' },
    { number: 17, label: '17 Renew', status: 'pending' },
    { number: 18, label: '18 Repeat', status: 'pending' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 text-slate-100" id="authenticated-client-dashboard">
      
      {/* 1. Client Header Card */}
      <div className="rounded-3xl bg-[#0D2340] border border-[#1E3A5F] p-6 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E3A5F] pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#C6A15B]/20 text-[#C6A15B] border border-[#C6A15B]/40">
                A/R TAX SERVICES &bull; TAXGUARD CLIENT DASHBOARD
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-900/40 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>STAGE 01 COMPLETED &bull; STAGE 02 ACTIVE</span>
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#C6A15B]" />
              <span>{clientName}</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Client ID: <strong className="font-mono text-slate-200">{clientId}</strong> &bull; Taxpayer Type: <strong className="text-slate-200">{taxpayerType}</strong> &bull; Primary Contact: <strong className="text-slate-200">{signerName}</strong>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#07172B] border border-[#1E3A5F] px-3.5 py-2 rounded-xl text-right">
              <div className="text-[10px] font-mono uppercase text-slate-400">Current Tax Year</div>
              <div className="text-sm font-bold text-[#E2BD67] flex items-center gap-1.5 justify-end mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-[#C6A15B]" />
                <select
                  value={selectedTaxYear}
                  onChange={(e) => onTaxYearChange?.(Number(e.target.value))}
                  className="bg-transparent font-mono text-xs font-bold text-[#E2BD67] cursor-pointer outline-none"
                >
                  <option value={2026} className="bg-[#0D2340] text-slate-100">Tax Year 2026 (Planning)</option>
                  <option value={2025} className="bg-[#0D2340] text-slate-100">Tax Year 2025 (Active Filing)</option>
                  <option value={2024} className="bg-[#0D2340] text-slate-100">Tax Year 2024 (Prior Year)</option>
                </select>
              </div>
            </div>

            <div className="bg-[#07172B] border border-[#1E3A5F] px-3.5 py-2 rounded-xl text-right hidden sm:block">
              <div className="text-[10px] font-mono uppercase text-slate-400">Compliance Protection</div>
              <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1 justify-end mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>IRC § 7216 Certified</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Unified 18-Stage Tax Operating Workflow Matrix */}
        <div>
          <div className="flex items-center justify-between text-xs font-semibold mb-2">
            <span className="text-[#C6A15B] uppercase tracking-wider font-mono text-[11px]">
              Unified 18-Stage Tax Operating Cycle
            </span>
            <span className="text-slate-400 font-mono text-[11px]">
              Stage 2 of 18 Active (Stage 01 Completed)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-1.5">
            {stages.map((stg) => {
              const canonicalTitle = CANONICAL_STAGE_LABELS[stg.number] || stg.label;
              return (
                <div
                  key={stg.number}
                  title={canonicalTitle}
                  className={`p-2 rounded-xl border text-center transition-all flex flex-col justify-between min-h-[58px] ${
                    stg.status === 'completed'
                      ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 font-semibold'
                      : stg.status === 'active'
                      ? 'bg-blue-950/60 border-blue-400 text-white font-bold ring-1 ring-blue-400 shadow-md'
                      : 'bg-[#07172B]/60 border-[#1E3A5F]/70 text-slate-500 font-medium'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span>{String(stg.number).padStart(2, '0')}</span>
                    {stg.status === 'completed' && <Check className="w-3 h-3 text-emerald-400 stroke-[3]" />}
                    {stg.status === 'active' && <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />}
                  </div>
                  <div className="text-[10px] leading-tight mt-1 truncate">
                    {stg.label.replace(/^\d+\s*/, '')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Primary Hero Card: Clear Entry into Stage 02 (Collect) */}
      <div className="rounded-3xl bg-gradient-to-r from-[#0B2545] via-[#0D2E57] to-[#0A223E] border-2 border-blue-500/50 p-6 sm:p-8 shadow-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-900/60 border border-blue-400/50 text-blue-200 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span>ACTIVE WORKFLOW STAGE &bull; STAGE 02 (COLLECT)</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Stage 02 (Collect) Workspace is Active &amp; Ready
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Your Stage 01 Onboarding requirements have been authoritatively validated and locked:
            TIN identity verification, principal entity address, authorized representative designation, supporting identification document provenance, 5-point duplicate clearance, and statutory IRC § 7216 consent execution are confirmed.
            Your secure intake checklist, digital tax vault, and document upload pipelines are now activated.
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1 font-mono">
            <div className="flex items-center gap-1.5 text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>7 of 7 Hard Exit Gate Items Cleared</span>
            </div>
            <div className="flex items-center gap-1.5 text-blue-300">
              <FolderLock className="w-4 h-4 text-blue-400" />
              <span>Encrypted Vault Enabled</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
          <button
            onClick={onEnterStageTwo}
            className="px-6 py-3.5 rounded-2xl text-sm font-bold text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all flex items-center justify-center gap-2 shadow-xl hover:shadow-2xl cursor-pointer"
          >
            <span>Enter Stage 02 (Collect) Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {onReviewStageOne && (
            <button
              onClick={onReviewStageOne}
              className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-[#07172B]/80 hover:bg-[#07172B] border border-[#1E3A5F] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Review Stage 01 Dossier</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. Four Core Status & Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Stage 01 Identity Dossier */}
        <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-[#C6A15B] font-bold">Identity &amp; Profile</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-300">Verified</span>
          </div>
          <div className="text-sm font-bold text-white">{dossier?.legalName || clientName}</div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>TIN: <span className="font-mono text-slate-300">{dossier?.maskedTIN || 'XX-XXX-Verified'}</span></div>
            <div>Signer: <span className="text-slate-300">{signerName}</span></div>
          </div>
          {onReviewStageOne && (
            <button
              onClick={onReviewStageOne}
              className="text-xs font-semibold text-[#C6A15B] hover:underline flex items-center gap-1 pt-1 cursor-pointer"
            >
              <span>View Onboarding Dossier &rarr;</span>
            </button>
          )}
        </div>

        {/* Card 2: IRC § 7216 Statutory Consent */}
        <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-[#C6A15B] font-bold">Statutory Privacy</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-900/60 text-emerald-300">Signed</span>
          </div>
          <div className="text-sm font-bold text-white">IRC § 7216 Consent</div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>Regulation: <span className="text-slate-300">Treas. Reg. § 301.7216-3</span></div>
            <div>Signer: <span className="text-slate-300">{dossier?.engagementConsent?.signerFullName || signerName}</span></div>
          </div>
          <div className="text-[11px] text-emerald-300 flex items-center gap-1 pt-1">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Confidential Taxpayer Protected</span>
          </div>
        </div>

        {/* Card 3: Secure Document Vault */}
        <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-[#C6A15B] font-bold">Intake &amp; Vault</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-900/60 text-blue-300">Active</span>
          </div>
          <div className="text-sm font-bold text-white">Document Collection</div>
          <div className="text-xs text-slate-400">
            Intake checklist and SHA-256 upload pipeline are open for W-2, 1099, K-1, and financial workpapers.
          </div>
          <button
            onClick={onEnterStageTwo}
            className="text-xs font-semibold text-blue-300 hover:text-blue-200 flex items-center gap-1 pt-1 cursor-pointer"
          >
            <span>Open Collection Workspace &rarr;</span>
          </button>
        </div>

        {/* Card 4: Practice Team Advisory */}
        <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-[#C6A15B] font-bold">Practice Team</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">Assigned</span>
          </div>
          <div className="text-sm font-bold text-white">Elena Rostova, CPA</div>
          <div className="text-xs text-slate-400 space-y-1">
            <div>Senior Preparer &amp; Reviewer</div>
            <div>Firm: <span className="text-slate-300">A/R Tax Services, LLC</span></div>
          </div>
          <div className="text-[11px] text-slate-300 pt-1">
            Desmond Hinds, Founder &amp; CEO
          </div>
        </div>

      </div>

    </div>
  );
};
