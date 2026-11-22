import React from 'react';
import {
  Activity,
  BarChart3,
  Briefcase,
  CheckSquare,
  FileSpreadsheet,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { getIndustryVisualProfile } from './industryVisualAssets';

const FLOW_STAGES = [
  { id: 'operations', index: '01', title: 'Business Operations', icon: Briefcase },
  { id: 'records', index: '02', title: 'Financial Records', icon: FileSpreadsheet },
  { id: 'verification', index: '03', title: 'Data Verification', icon: CheckSquare },
  { id: 'intelligence', index: '04', title: 'Accounting Intelligence', icon: BarChart3 },
  { id: 'compliance', index: '05', title: 'Tax Compliance', icon: Scale },
  { id: 'review', index: '06', title: 'Professional Review', icon: ShieldCheck },
  { id: 'reporting', index: '07', title: 'Transparent Reporting', icon: Activity },
] as const;

interface IndustryFinancialFlowProps {
  slug: string;
  sectorTitle: string;
  shouldAnimate: boolean;
}

/**
 * Reusable 7-stage conceptual blockchain-inspired financial transparency flow
 * adapting its operational descriptions to the active industry.
 */
export const IndustryFinancialFlow: React.FC<IndustryFinancialFlowProps> = ({
  slug,
  sectorTitle,
  shouldAnimate,
}) => {
  const profile = getIndustryVisualProfile(slug);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#07182C] border border-slate-700/55 p-6 sm:p-7 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#E1BB60]">
            Conceptual Financial Transparency Pathway
          </div>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-white leading-tight">
            Traceable Process Architecture for {sectorTitle}
          </h3>
        </div>
        <div className="text-xs text-slate-400">
          7 Connected Accountability Checkpoints · Human Verified
        </div>
      </div>

      {/* Connected 7-Stage Pathway */}
      <div className="relative">
        {/* Desktop Animated Horizontal Conduit Behind Nodes */}
        <svg
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
          className={`hidden xl:block pointer-events-none absolute top-9 left-8 right-8 w-[calc(100%-4rem)] h-8 ${
            shouldAnimate ? '' : 'destria-motion-paused'
          }`}
          aria-hidden="true"
        >
          <line
            x1="0"
            y1="20"
            x2="1200"
            y2="20"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth="1.5"
          />
          <line
            x1="0"
            y1="20"
            x2="1200"
            y2="20"
            stroke="#E5B552"
            strokeOpacity="0.82"
            strokeWidth="2"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '6.8s' }}
          />
        </svg>

        <ol className="relative z-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {FLOW_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const adaptedNote = profile.flowAdaptations[idx];
            return (
              <li
                key={stage.id}
                className="flex flex-col justify-between rounded-xl bg-[#0A203A]/95 border border-slate-700/55 hover:border-[#D4A843]/55 transition-colors p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[#061629] border border-[#D4A843]/40 flex items-center justify-center text-[#E1BB60] shrink-0">
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-[#D4A843]/85 tabular-nums">
                    {stage.index}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-bold text-white leading-snug">{stage.title}</div>
                  <div className="text-[11px] text-slate-300/90 leading-snug">{adaptedNote}</div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Truthful Conceptual Disclosure */}
      <p className="text-[11px] text-slate-400 leading-relaxed pt-1 border-t border-slate-700/40">
        Conceptual financial transparency model illustrating structured documentation, verification
        review, and professional accountability for {sectorTitle}. This visual does not represent
        operational blockchain infrastructure or decentralized ledger recording.
      </p>
    </div>
  );
};
