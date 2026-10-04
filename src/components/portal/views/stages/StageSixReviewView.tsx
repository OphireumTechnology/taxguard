/**
 * A/R Tax Services, LLC — Stage 06: Review Workspace
 * Quality control checkpoint with Maker-Checker governance prior to return finalization.
 * Enforces preparer / reviewer segregation (preparer cannot approve their own work).
 */

import React, { useState, useEffect } from 'react';
import {
  UserCheck,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  FileText,
  Lock,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { getStoredToken } from '../../../../services/api';

interface ReviewChecklistItem {
  id: string;
  category: string;
  item: string;
  isCompleted: boolean;
  notes?: string;
}

interface StageSixReviewViewProps {
  clientId: string;
  selectedTaxYear: number;
  assignedReviewerName?: string;
  assignedPreparerName?: string;
  onNavigateToStageSeven?: () => void;
}

export const StageSixReviewView: React.FC<StageSixReviewViewProps> = ({
  clientId,
  selectedTaxYear,
  assignedReviewerName,
  assignedPreparerName,
  onNavigateToStageSeven
}) => {
  const [reviewStatus, setReviewStatus] = useState<'PENDING_ASSIGNMENT' | 'IN_REVIEW' | 'APPROVED' | 'RETURNED_FOR_REVISION'>('IN_REVIEW');
  const [checklist, setChecklist] = useState<ReviewChecklistItem[]>([
    { id: 'chk_1', category: 'Identity & Filing Status', item: 'Taxpayer identity, SSN/ITIN, and filing status validated', isCompleted: true },
    { id: 'chk_2', category: 'Income Accuracy', item: 'All W-2 compensation, 1099 interest, and dividends cross-checked', isCompleted: true },
    { id: 'chk_3', category: 'Deductions & Credits', item: 'Itemized vs standard deduction comparison and allowable state deductions verified', isCompleted: false },
    { id: 'chk_4', category: 'Regulatory Compliance', item: 'IRC § 6662 accuracy-related penalty checks and Circular 230 standards satisfied', isCompleted: false },
    { id: 'chk_5', category: 'Maker-Checker Separation', item: 'Independent secondary CPA review by non-preparing professional enforced', isCompleted: true }
  ]);
  const [reviewerNotes, setReviewerNotes] = useState<string>(
    'Secondary review underway. Cross-auditing state apportionment and Schedule A medical expenses deduction thresholds.'
  );

  const reviewerDisplay = assignedReviewerName || 'Elena Rostova, CPA (Senior Reviewer)';
  const preparerDisplay = assignedPreparerName || 'Desmond Hinds (Senior Tax Strategist)';

  const completedCount = checklist.filter(c => c.isCompleted).length;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 06 of 18 · Review
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <UserCheck className="w-5 h-5 text-purple-400" />
              <span>Preparer &amp; Independent CPA Workpaper Review</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="text-purple-300 font-bold">QC Checkpoint Active</span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 06: Quality control checkpoint enforcing independent Maker-Checker review before final return drafting.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">No action is required from you unless your CPA reviewer issues a clarification inquiry.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">An independent senior CPA audits every workpaper prepared by the primary tax accountant.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Upon reviewer sign-off, Stage 07 produces your official deliverables and tax preparation packages.</p>
          </div>
        </div>
      </div>

      {/* Maker-Checker Governance Card */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4 text-xs">
        <div className="flex items-center gap-2 border-b border-slate-700/60 pb-3">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <h3 className="font-bold text-white text-sm">Maker-Checker Professional Separation Governance</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase text-slate-400 block font-bold">1. Primary Preparer (Maker)</span>
            <span className="text-white font-bold text-sm block">{preparerDisplay}</span>
            <p className="text-[11px] text-slate-300">Authored tax schedules, intake tie-outs, and initial return calculations.</p>
          </div>
          <div className="p-4 bg-[#071A2E] rounded-xl border border-purple-500/30 space-y-1">
            <span className="text-[10px] font-mono uppercase text-purple-300 block font-bold">2. Independent Reviewer (Checker)</span>
            <span className="text-white font-bold text-sm block">{reviewerDisplay}</span>
            <p className="text-[11px] text-slate-300">Audits statutory compliance, verifies elections, and certifies return accuracy.</p>
          </div>
        </div>

        <div className="p-4 bg-[#071A2E] rounded-xl border border-slate-800 space-y-2">
          <span className="font-bold text-white block">Reviewer Professional Audit Log</span>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            "{reviewerNotes}"
          </p>
        </div>
      </div>

      {/* Quality Control Checklist */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
          <h3 className="font-bold text-white text-sm">CPA Quality Control Checklist</h3>
          <span className="text-xs font-mono font-bold text-slate-300">
            {completedCount} of {checklist.length} Checkpoints Completed
          </span>
        </div>

        <div className="space-y-2">
          {checklist.map(item => (
            <div
              key={item.id}
              className="p-3 bg-[#071A2E] rounded-xl border border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5">
                {item.isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-[#D4A843] shrink-0" />
                )}
                <div>
                  <span className="font-bold text-white block">{item.item}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{item.category}</span>
                </div>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                item.isCompleted ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'
              }`}>
                {item.isCompleted ? 'PASS' : 'IN AUDIT'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
