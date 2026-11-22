import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface IndustryChallengesPanelProps {
  keyChallenges: string[];
  strategicSolutions: string[];
}

/**
 * Structured two-column financial intelligence panels preserving verbatim
 * Critical Industry Challenges We Solve and Our Bespoke Practice Architecture.
 */
export const IndustryChallengesPanel: React.FC<IndustryChallengesPanelProps> = ({
  keyChallenges,
  strategicSolutions,
}) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Critical Industry Challenges We Solve */}
      <div className="rounded-2xl bg-[#07182C] border border-slate-700/55 p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-700/45">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-400/35 flex items-center justify-center text-amber-300 shrink-0">
              <AlertCircle className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-amber-300/90">
                Risk &amp; Complexity Profile
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-white leading-snug">
                Critical Industry Challenges We Solve
              </h3>
            </div>
          </div>
        </div>

        <ol className="space-y-3.5">
          {keyChallenges.map((challenge, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3.5 rounded-xl bg-[#0A1F38]/80 border border-slate-700/40 p-3.5 sm:p-4"
            >
              <span className="text-xs font-mono font-bold text-amber-300/90 tabular-nums pt-0.5 shrink-0">
                0{idx + 1}
              </span>
              <span className="text-sm text-slate-200/95 leading-relaxed">{challenge}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Our Bespoke Practice Architecture */}
      <div className="rounded-2xl bg-[#07182C] border border-[#D4A843]/35 p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between gap-3 pb-4 border-b border-slate-700/45">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#D4A843]/12 border border-[#D4A843]/45 flex items-center justify-center text-[#E5B552] shrink-0">
              <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <div className="text-[11px] font-semibold tracking-[0.14em] uppercase text-[#E1BB60]">
                Advisory Solution Design
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-white leading-snug">
                Our Bespoke Practice Architecture
              </h3>
            </div>
          </div>
        </div>

        <ol className="space-y-3.5">
          {strategicSolutions.map((solution, idx) => (
            <li
              key={idx}
              className="flex items-start gap-3.5 rounded-xl bg-[#0A1F38]/80 border border-[#D4A843]/22 p-3.5 sm:p-4"
            >
              <span className="text-xs font-mono font-bold text-[#E5B552] tabular-nums pt-0.5 shrink-0">
                0{idx + 1}
              </span>
              <span className="text-sm text-slate-200/95 leading-relaxed">{solution}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
};
