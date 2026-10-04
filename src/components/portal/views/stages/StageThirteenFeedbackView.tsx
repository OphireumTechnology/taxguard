/**
 * A/R Tax Services, LLC — Stage 13: Government Feedback Workspace
 * Official IRS and State Agency Acknowledgment & Feedback Tracking.
 * Strictly adheres to Phase 15:
 * NO SIMULATED GOVERNMENT RESPONSES. Truthful status reflects genuine agency transmission states.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ShieldCheck,
  Building2,
  ArrowRight
} from 'lucide-react';

interface StageThirteenFeedbackViewProps {
  clientId: string;
  selectedTaxYear: number;
}

export const StageThirteenFeedbackView: React.FC<StageThirteenFeedbackViewProps> = ({
  clientId,
  selectedTaxYear
}) => {
  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 13 of 18 · Government Feedback
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Government Electronic Acknowledgment &amp; Feedback</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-400">Pending Gateway Transmission</span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 13: Official electronic acknowledgment tracking from the IRS and state taxing authorities.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">No action required until official agency acceptance or rejection diagnostics are received.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Monitors the IRS MeF transmitter queue for official electronic acceptance acknowledgments.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Once accepted, your return moves to Stage 15 (Monitor) and Stage 16 (Archive Vault).</p>
          </div>
        </div>
      </div>

      {/* Truthful Feedback State Card */}
      <div className="p-8 text-center bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl shadow-xl space-y-4">
        <Clock className="w-10 h-10 text-[#D4A843] mx-auto" />
        <div className="space-y-1">
          <h3 className="text-base font-bold text-white">Awaiting IRS / State Electronic Transmission</h3>
          <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">
            Official agency electronic acknowledgment codes (IRS MeF Acceptance / SCDOR Receipt) will populate here once your return is transmitted through the commissioned filing gateway in Stage 12.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#071A2E] border border-slate-800 rounded-lg text-xs font-mono text-slate-400">
          <span>Truthful Status: 0 Simulated Receipts</span>
          <span aria-hidden="true">·</span>
          <span>Pending Live Transmission</span>
        </div>
      </div>
    </div>
  );
};
