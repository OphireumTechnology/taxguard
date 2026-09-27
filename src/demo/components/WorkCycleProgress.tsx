import React from 'react';
import { WorkCycleStage, WORK_CYCLE_STAGES } from '../types';
import { Check } from 'lucide-react';

interface WorkCycleProgressProps {
  currentStage: WorkCycleStage;
  className?: string;
  compact?: boolean;
}

export const WorkCycleProgress: React.FC<WorkCycleProgressProps> = ({ 
  currentStage, 
  className = '',
  compact = false 
}) => {
  const currentIndex = Math.max(0, WORK_CYCLE_STAGES.indexOf(currentStage));
  const totalStages = WORK_CYCLE_STAGES.length;

  if (compact) {
    return (
      <div className={`border border-neutral-300 bg-white p-3 ${className}`}>
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          <span className="font-bold text-black uppercase tracking-wider">
            Operating Cycle: Stage {currentIndex + 1} of {totalStages}
          </span>
          <span className="font-bold bg-black text-white px-2 py-0.5">
            {currentStage}
          </span>
        </div>
        <div className="w-full bg-neutral-200 h-2 border border-neutral-300">
          <div 
            className="bg-black h-full transition-all duration-300"
            style={{ width: `${Math.round(((currentIndex + 1) / totalStages) * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`border border-neutral-300 bg-white p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 border-b border-neutral-200 pb-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-widest text-black">
            Unified 18-Stage Operating Cycle
          </h3>
          <p className="text-[11px] text-neutral-600">
            Onboard → Collect → Validate → Record → Reconcile → Review → Report → Plan → Prepare Taxes → Approve → Sign → File → Government Feedback → Resolve → Monitor → Archive → Renew → Repeat
          </p>
        </div>
        <div className="text-xs font-mono font-bold bg-black text-white px-2.5 py-1">
          Active: {currentStage} ({currentIndex + 1}/{totalStages})
        </div>
      </div>

      {/* 18-step visual grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-9 xl:grid-cols-18 gap-1.5">
        {WORK_CYCLE_STAGES.map((stage, idx) => {
          const isPassed = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div
              key={stage}
              className={`p-1.5 text-center border text-xs transition-colors flex flex-col justify-between min-h-[58px] ${
                isCurrent 
                  ? 'bg-black text-white border-black font-bold shadow-sm' 
                  : isPassed
                  ? 'bg-white text-black border-neutral-400 font-medium'
                  : 'bg-neutral-50 text-neutral-400 border-neutral-200'
              }`}
            >
              <div className="flex items-center justify-between mb-0.5">
                <span className={`text-[9px] font-mono ${isCurrent ? 'text-white' : 'text-neutral-500'}`}>
                  {String(idx + 1).padStart(2, '0')}
                </span>
                {isPassed && <Check className="w-2.5 h-2.5 text-black stroke-[3]" />}
                {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              </div>
              <div className="text-[10px] leading-tight break-words font-medium">
                {stage}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
