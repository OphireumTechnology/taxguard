import React from 'react';
import { Check, ChevronRight, Clock, ShieldCheck, UserCheck } from 'lucide-react';
import { Engagement } from '../../../types';

interface TaxReturnStatusProps {
  engagement?: Engagement;
  onViewDetails: () => void;
}

export const TaxReturnStatus: React.FC<TaxReturnStatusProps> = ({
  engagement,
  onViewDetails
}) => {
  const steps = [
    { id: 'intake', label: 'Intake', status: 'completed' },
    { id: 'documents', label: 'Documents', status: 'completed' },
    { id: 'preparation', label: 'Preparation', status: 'completed' },
    { id: 'review', label: 'Quality Review', status: 'active' },
    { id: 'filing', label: 'IRS Transmission', status: 'upcoming' },
  ];

  const progressPercent = engagement?.progressPercentage ?? engagement?.progressPercent ?? 75;
  const estCompletion = engagement?.dueDate ? 'April 15, 2026' : 'April 15, 2026';

  return (
    <div className="p-6 sm:p-7 rounded-2xl bg-[#0A1F38] border border-[#183458] shadow-xl text-slate-100 space-y-6">
      
      {/* Top Title & Status Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#183458] pb-4">
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold tracking-wider text-[#C6A15B]">
            Primary Tax Engagement
          </div>
          <h2 className="font-serif text-lg sm:text-xl font-bold text-white">
            2025 Comprehensive Individual Federal &amp; SC State Tax Return
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="uppercase tracking-wider text-[11px] font-bold">Under Review</span>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs text-slate-400 block text-[11px]">Completion Target</span>
            <span className="text-xs font-semibold text-white font-mono">{estCompletion}</span>
          </div>
        </div>
      </div>

      {/* Redesigned Clean Horizontal Timeline */}
      <div className="space-y-4 pt-1">
        <div className="relative">
          {/* Background Track Line */}
          <div className="absolute top-4 left-4 right-4 h-0.5 bg-[#183458] -z-0" />
          {/* Active Fill Track Line */}
          <div 
            className="absolute top-4 left-4 h-0.5 bg-gradient-to-r from-emerald-400 to-[#C6A15B] -z-0 transition-all duration-500"
            style={{ width: `calc(${progressPercent}% - 32px)` }}
          />

          {/* Timeline Nodes */}
          <div className="grid grid-cols-5 gap-1 relative z-10">
            {steps.map((step, idx) => {
              const isCompleted = step.status === 'completed';
              const isActive = step.status === 'active';
              const isUpcoming = step.status === 'upcoming';

              return (
                <div key={step.id} className="flex flex-col items-center text-center">
                  {/* Circle Indicator */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                      isCompleted
                        ? 'bg-emerald-500 text-[#06172C] font-bold ring-4 ring-[#0A1F38]'
                        : isActive
                        ? 'bg-[#C6A15B] text-[#06172C] font-bold ring-4 ring-[#C6A15B]/20 shadow-md'
                        : 'bg-[#06172C] border-2 border-[#183458] text-slate-500 ring-4 ring-[#0A1F38]'
                    }`}
                  >
                    {isCompleted ? (
                      <Check className="w-4 h-4 stroke-[3]" />
                    ) : isActive ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-[#06172C]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#183458]" />
                    )}
                  </div>

                  {/* Label */}
                  <div className="mt-2 space-y-0.5">
                    <span
                      className={`text-[11px] block leading-tight font-medium ${
                        isCompleted
                          ? 'text-slate-200'
                          : isActive
                          ? 'text-[#C6A15B] font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider block text-slate-400">
                      {isCompleted ? 'Done' : isActive ? 'In Progress' : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Annotation & Advisor Notes */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-emerald-400">{progressPercent}% Complete</span>
            <span className="text-slate-500">&bull;</span>
            <span className="text-slate-300">
              Prepared by Desmond Hinds &bull; Currently with Senior CPA Elena Rostova for final sign-off
            </span>
          </div>

          <button
            type="button"
            onClick={onViewDetails}
            className="text-xs text-[#C6A15B] hover:text-[#D9BF7A] font-semibold flex items-center gap-1 hover:underline self-end sm:self-auto"
          >
            <span>View Return Milestones</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
};
