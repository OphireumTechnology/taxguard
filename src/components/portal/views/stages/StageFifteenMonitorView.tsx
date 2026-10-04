/**
 * A/R Tax Services, LLC — Stage 15: Monitor Workspace
 * Post-filing monitoring: estimated tax vouchers (Form 1040-ES), quarterly deadlines,
 * payment schedules, and compliance reminders.
 */

import React from 'react';
import {
  Activity,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  DollarSign,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

interface StageFifteenMonitorViewProps {
  clientId: string;
  selectedTaxYear: number;
}

export const StageFifteenMonitorView: React.FC<StageFifteenMonitorViewProps> = ({
  clientId,
  selectedTaxYear
}) => {
  const nextYear = selectedTaxYear + 1;
  const estimatedTaxSchedules = [
    { quarter: 'Q1 Estimated Voucher', dueDate: `April 15, ${nextYear}`, form: 'Form 1040-ES (Q1)', status: 'Upcoming' },
    { quarter: 'Q2 Estimated Voucher', dueDate: `June 15, ${nextYear}`, form: 'Form 1040-ES (Q2)', status: 'Upcoming' },
    { quarter: 'Q3 Estimated Voucher', dueDate: `September 15, ${nextYear}`, form: 'Form 1040-ES (Q3)', status: 'Upcoming' },
    { quarter: 'Q4 Estimated Voucher', dueDate: `January 15, ${nextYear + 1}`, form: 'Form 1040-ES (Q4)', status: 'Upcoming' }
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 15 of 18 · Monitor
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <Activity className="w-5 h-5 text-[#D4A843]" />
              <span>Post-Filing Monitoring &amp; Estimated Tax Calendar</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Tracking: <strong className="text-white">TY {nextYear} Compliance</strong></span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 15: Post-filing monitoring tracking safe-harbor estimated vouchers and compliance milestones.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Mark your quarterly estimated tax deadlines to avoid statutory underpayment penalties under IRC § 6654.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Calculates quarterly safe-harbor payment vouchers and sends proactive reminder notices.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Your return documents are preserved in Stage 16 (Archive Vault) for the statutory 7-year retention period.</p>
          </div>
        </div>
      </div>

      {/* Estimated Tax Schedules */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#D4A843]" />
            <span>TY {nextYear} Safe-Harbor Estimated Tax Calendar (Form 1040-ES)</span>
          </h3>
          <span className="text-xs font-mono text-slate-400">IRC § 6654 Safe Harbor</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          {estimatedTaxSchedules.map(sc => (
            <div
              key={sc.quarter}
              className="p-4 bg-[#071A2E] rounded-xl border border-slate-800 flex items-center justify-between"
            >
              <div>
                <span className="font-bold text-white block">{sc.quarter}</span>
                <span className="text-[11px] text-slate-400 font-mono">Due Date: {sc.dueDate}</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-500/40 font-bold">
                {sc.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
