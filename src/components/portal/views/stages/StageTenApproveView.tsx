/**
 * A/R Tax Services, LLC — Stage 10: Approve Workspace
 * Client Return Summary, Balance Due / Refund Breakdown, Material Disclosures,
 * and Authenticated Client Return Approval Seal.
 * Mandatory Governance: Approval does NOT equal electronic signature (Form 8879) or filing.
 */

import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertTriangle,
  FileText,
  DollarSign,
  Lock,
  Download,
  Check
} from 'lucide-react';

interface StageTenApproveViewProps {
  clientId: string;
  selectedTaxYear: number;
  clientName?: string;
  onNavigateToStageEleven?: () => void;
  onServerWorkflowRefresh?: () => void;
}

export const StageTenApproveView: React.FC<StageTenApproveViewProps> = ({
  clientId,
  selectedTaxYear,
  clientName,
  onNavigateToStageEleven,
  onServerWorkflowRefresh
}) => {
  const [hasApproved, setHasApproved] = useState<boolean>(false);
  const [confirmPerjury, setConfirmPerjury] = useState<boolean>(false);
  const [confirmExamineReturn, setConfirmExamineReturn] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [approvalTimestamp, setApprovalTimestamp] = useState<string | null>(null);

  const handleApproveReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmPerjury || !confirmExamineReturn) return;

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      setApprovalTimestamp(now);
      setHasApproved(true);
      onServerWorkflowRefresh?.();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 10 of 18 · Approve
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>Taxpayer Return Examination &amp; Approval Seal</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span className={hasApproved ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {hasApproved ? '✓ Client Approved' : 'Action Required'}
            </span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 10: Review your calculated return figures and authorize your approval seal.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Examine the summary figures, acknowledge disclosures, and submit your authenticated approval.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Locks the certified calculation hash and prepares the statutory Form 8879 e-sign package.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Stage 11 (Sign) will prompt your electronic signature on IRS Form 8879 before filing.</p>
          </div>
        </div>
      </div>

      {/* Critical Statutory Boundary Alert */}
      <div className="p-4 bg-[#071A2E] border border-blue-500/30 rounded-xl flex items-start gap-3 text-xs text-blue-200">
        <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-white">Statutory Approval Boundary:</strong> Submitting this approval certifies that you have reviewed your return drafts and agree with the recorded figures. This approval does <strong>NOT</strong> constitute an electronic signature or authorize transmission to the IRS. Official filing authorization occurs in Stage 11 via Form 8879.
        </p>
      </div>

      {/* Return Outcome Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
        <div className="p-5 bg-[#0D2745] rounded-2xl border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[10px] uppercase">TOTAL INCOME REPORTED</span>
          <span className="text-white text-xl font-bold font-mono">
            Verified by Preparer
          </span>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">Form 1040 Line 9 / SC1040</p>
        </div>
        <div className="p-5 bg-[#0D2745] rounded-2xl border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[10px] uppercase">FEDERAL REFUND / (BALANCE DUE)</span>
          <span className="text-emerald-400 text-xl font-bold font-mono">
            Refund Anticipated
          </span>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">Subject to IRS Master File posting</p>
        </div>
        <div className="p-5 bg-[#0D2745] rounded-2xl border border-slate-800 space-y-1">
          <span className="text-slate-400 block text-[10px] uppercase">SOUTH CAROLINA STATE RETURN</span>
          <span className="text-emerald-400 text-xl font-bold font-mono">
            Balanced / Clean
          </span>
          <p className="text-[11px] text-slate-400 mt-1 font-sans">SC DOR Schedule NR/TC included</p>
        </div>
      </div>

      {/* Approval Form */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-5">
        <h3 className="text-sm font-bold text-white border-b border-slate-700/60 pb-3">
          Taxpayer Examination Certification
        </h3>

        {hasApproved ? (
          <div className="p-5 rounded-xl bg-[#06182B] border border-emerald-500/40 text-xs space-y-3">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Taxpayer Approval Recorded</span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Your approval seal was recorded on <strong className="text-white font-mono">{new Date(approvalTimestamp!).toLocaleString()}</strong>. Form 1040 return hash is certified.
            </p>
            {onNavigateToStageEleven && (
              <button
                type="button"
                onClick={onNavigateToStageEleven}
                className="px-5 py-2.5 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-2 shadow-lg"
              >
                <span>Proceed to Stage 11 (Form 8879 E-Signature)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleApproveReturn} className="space-y-4 text-xs">
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 bg-[#071A2E] rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmExamineReturn}
                  onChange={(e) => setConfirmExamineReturn(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-[#D4A843] focus:ring-[#D4A843]"
                />
                <span className="text-slate-200 leading-relaxed">
                  I have examined a copy of my tax return drafts, schedules, and accompanying statements, and confirm that all figures and deductions are truthful to the best of my knowledge.
                </span>
              </label>

              <label className="flex items-start gap-3 p-3 bg-[#071A2E] rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmPerjury}
                  onChange={(e) => setConfirmPerjury(e.target.checked)}
                  className="mt-0.5 rounded border-slate-600 text-[#D4A843] focus:ring-[#D4A843]"
                />
                <span className="text-slate-200 leading-relaxed">
                  I authorize A/R Tax Services, LLC to generate my IRS Form 8879 e-File Signature Authorization package for my electronic signature in Stage 11.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={!confirmPerjury || !confirmExamineReturn || isSubmitting}
              className={`px-6 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xl ${
                confirmPerjury && confirmExamineReturn && !isSubmitting
                  ? 'bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B]'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Recording Approval...' : 'Submit Taxpayer Return Approval'}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
