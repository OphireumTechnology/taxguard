import React from 'react';
import { 
  Workflow, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  UserCheck, 
  ShieldCheck, 
  FileCheck, 
  ChevronRight 
} from 'lucide-react';
import { Engagement } from '../../../types';

interface TaxReturnViewProps {
  engagement?: Engagement;
  onNavigateToDeliverables: () => void;
}

export const TaxReturnView: React.FC<TaxReturnViewProps> = ({
  engagement,
  onNavigateToDeliverables
}) => {
  const milestones = [
    {
      id: 'm1',
      title: 'Tax Intake & Questionnaire Submission',
      status: 'completed',
      date: 'Completed Feb 24, 2026',
      assignedTo: 'Michael Perotti (Client)',
      notes: 'Initial questionnaire verified with supporting personal exemptions and Schedule C profile.'
    },
    {
      id: 'm2',
      title: 'Document Acquisition & Security Scans',
      status: 'completed',
      date: 'Completed Mar 02, 2026',
      assignedTo: 'Desmond Hinds (Accountant)',
      notes: 'Wage statements (W-2) and 1099-NEC reconciled against IRS master transcripts.'
    },
    {
      id: 'm3',
      title: 'Workpaper Preparation & Deduction Schedules',
      status: 'completed',
      date: 'Completed Mar 10, 2026',
      assignedTo: 'Desmond Hinds (Senior Accountant)',
      notes: 'Schedule C business expenses and vehicle deductions calculated in compliance with IRC Section 179.'
    },
    {
      id: 'm4',
      title: 'Quality & Regulatory Review',
      status: 'active',
      date: 'In Progress • Target Mar 22, 2026',
      assignedTo: 'Elena Rostova, CPA (Senior Reviewer)',
      notes: 'Undergoing secondary CPA cross-check and state nexus validation prior to final certification.'
    },
    {
      id: 'm5',
      title: 'Electronic Filing Transmission (IRS & SCDOR)',
      status: 'upcoming',
      date: 'Pending Form 8879 Signature',
      assignedTo: 'IRS Authorized e-File Transmitter',
      notes: 'Direct XML submission via MeF (Modernized e-File) gateway upon receipt of client signature.'
    }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="p-6 sm:p-7 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#183458] pb-4">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
              Filing Pipeline &bull; Tax Year 2025
            </span>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-white">
              Comprehensive Individual Federal &amp; SC State Tax Return
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              Stage 4: Quality Review
            </span>
          </div>
        </div>

        {/* Team & Deadline Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#183458] space-y-1">
            <span className="text-slate-400 block text-[11px]">Primary Preparer</span>
            <span className="font-semibold text-white">Desmond Hinds</span>
            <span className="text-[10px] text-[#C6A15B] block">Founder &amp; Senior Managing Accountant</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#183458] space-y-1">
            <span className="text-slate-400 block text-[11px]">Quality Reviewer</span>
            <span className="font-semibold text-white">Elena Rostova, CPA</span>
            <span className="text-[10px] text-emerald-400 block">Senior Tax &amp; Quality Control Lead</span>
          </div>

          <div className="p-3.5 rounded-xl bg-[#06172C] border border-[#183458] space-y-1">
            <span className="text-slate-400 block text-[11px]">Statutory Filing Deadline</span>
            <span className="font-semibold text-white font-mono">April 15, 2026</span>
            <span className="text-[10px] text-slate-400 block">On schedule for timely transmission</span>
          </div>
        </div>
      </div>

      {/* Milestones Card */}
      <div className="p-6 rounded-2xl bg-[#0A1F38] border border-[#183458] space-y-5">
        <div className="flex items-center justify-between border-b border-[#183458] pb-3">
          <div>
            <h3 className="font-serif text-lg font-bold text-white">
              Engagement Stages &amp; Regulatory Checkpoints
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Strict multi-tier review cycle adhering to AICPA standards and IRS Circular 230.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {milestones.map((m, idx) => {
            const isDone = m.status === 'completed';
            const isActive = m.status === 'active';

            return (
              <div
                key={m.id}
                className={`p-4 rounded-xl border transition-colors ${
                  isActive 
                    ? 'bg-[#0D2340] border-[#C6A15B]/40' 
                    : isDone
                    ? 'bg-[#06172C] border-[#183458]'
                    : 'bg-[#06172C]/50 border-[#183458]/60 opacity-70'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      isDone 
                        ? 'bg-emerald-500 text-[#06172C]' 
                        : isActive 
                        ? 'bg-[#C6A15B] text-[#06172C]' 
                        : 'bg-[#183458] text-slate-400'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                    </div>

                    <div>
                      <h4 className="font-semibold text-white text-xs sm:text-sm">{m.title}</h4>
                      <span className="text-[11px] text-slate-400">
                        {m.assignedTo} &bull; <strong className={isActive ? 'text-[#C6A15B]' : 'text-slate-300'}>{m.date}</strong>
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase self-start sm:self-auto ${
                    isDone 
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' 
                      : isActive 
                      ? 'bg-blue-500/15 text-blue-300 border border-blue-500/30' 
                      : 'bg-[#06172C] text-slate-500 border border-[#183458]'
                  }`}>
                    {m.status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 mt-2 pl-10 leading-relaxed">
                  {m.notes}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deliverable Callout */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#0D2340] to-[#0A1F38] border border-[#183458] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-serif text-sm font-bold text-white">
              Certified Returns &amp; E-File Signature Forms Ready
            </h4>
            <p className="text-xs text-slate-300">
              Form 1040 Certified Package and Form 8879 are generated and awaiting your electronic authorization.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onNavigateToDeliverables}
          className="px-4 py-2.5 rounded-xl bg-[#C6A15B] hover:bg-[#D9BF7A] text-[#06172C] font-bold text-xs flex items-center gap-1.5 shadow-sm flex-shrink-0"
        >
          <span>View Deliverables &amp; Sign</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

    </div>
  );
};
