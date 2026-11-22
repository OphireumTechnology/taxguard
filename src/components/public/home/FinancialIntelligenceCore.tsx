import React from 'react';
import {
  FileSpreadsheet,
  Cpu,
  BarChart3,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';

export interface IntelligencePipelineStage {
  index: number;
  title: string;
  shortRole: string;
  capabilityIds: string[];
  icon: React.ComponentType<{ className?: string }>;
}

export const INTELLIGENCE_PIPELINE_STAGES: IntelligencePipelineStage[] = [
  {
    index: 0,
    title: 'Financial Documents',
    shortRole: 'Vault intake & optical structuring',
    capabilityIds: ['doc-recognition', 'secure-doc-mgmt'],
    icon: FileSpreadsheet,
  },
  {
    index: 1,
    title: 'Intelligent Processing',
    shortRole: 'Tax assembly & journal continuity',
    capabilityIds: ['ai-tax-prep', 'intelligent-bookkeeping'],
    icon: Cpu,
  },
  {
    index: 2,
    title: 'Financial Analysis',
    shortRole: 'Reconciliation, anomalies & strategy',
    capabilityIds: ['auto-reconciliation', 'anomaly-detection', 'strategic-analytics'],
    icon: BarChart3,
  },
  {
    index: 3,
    title: 'Compliance Verification',
    shortRole: 'Federal & multi-state stage tracking',
    capabilityIds: ['tax-compliance'],
    icon: ShieldCheck,
  },
  {
    index: 4,
    title: 'Professional Review',
    shortRole: 'Independent human accountability',
    capabilityIds: ['professional-review'],
    icon: UserCheck,
  },
];

interface FinancialIntelligenceCoreProps {
  activeStageIndex: number | null;
  activeCapabilityId: string | null;
  onSelectStage: (stageIndex: number | null) => void;
  shouldAnimate: boolean;
}

/**
 * Conceptual visualization representing the Destria Financial Intelligence Core
 * and the five-stage pathway connecting all nine capabilities.
 * Explicitly labeled as an architectural concept distinct from live telemetry.
 */
export const FinancialIntelligenceCore: React.FC<FinancialIntelligenceCoreProps> = ({
  activeStageIndex,
  activeCapabilityId,
  onSelectStage,
  shouldAnimate,
}) => {
  const resolvedStageIndex =
    activeStageIndex !== null
      ? activeStageIndex
      : activeCapabilityId
        ? INTELLIGENCE_PIPELINE_STAGES.find((stage) =>
            stage.capabilityIds.includes(activeCapabilityId)
          )?.index ?? null
        : null;

  return (
    <div
      className="relative mb-8 sm:mb-10 rounded-2xl bg-[#071B31]/90 border border-slate-700/60 backdrop-blur-md px-5 py-6 sm:px-7 sm:py-7 overflow-hidden"
      aria-label="Destria Financial Intelligence Core conceptual workflow"
    >
      {/* Subtle top metallic hairline reflection */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A843]/55 to-transparent"
        aria-hidden="true"
      />

      {/* Core header strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3.5">
          {/* Precision geometric Core Emblem */}
          <div className="relative w-10 h-10 shrink-0 flex items-center justify-center" aria-hidden="true">
            <svg viewBox="0 0 44 44" className="w-10 h-10">
              <circle
                cx="22"
                cy="22"
                r="19"
                fill="none"
                stroke="rgba(212, 168, 67, 0.35)"
                strokeWidth="1"
                strokeDasharray="4 4"
                className="destria-orbit-slow"
              />
              <circle
                cx="22"
                cy="22"
                r="13"
                fill="rgba(6, 24, 43, 0.9)"
                stroke="rgba(125, 211, 252, 0.45)"
                strokeWidth="1"
                strokeDasharray="10 6"
                className="destria-orbit-reverse"
              />
              <polygon
                points="22,13 29.8,17.5 29.8,26.5 22,31 14.2,26.5 14.2,17.5"
                fill="rgba(212, 168, 67, 0.14)"
                stroke="#E5B552"
                strokeWidth="1.2"
              />
              <circle cx="22" cy="22" r="2.6" fill="#E5B552" />
            </svg>
          </div>
          <div>
            <h3 className="font-serif text-base sm:text-lg font-bold text-white tracking-tight">
              Destria Financial Intelligence Core
            </h3>
            <p className="text-xs text-[#A9B7C8]">
              Structured information flow across five governed stages linking all nine capabilities
            </p>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 md:text-right">
          Conceptual Architecture Diagram · Select a stage to highlight connected capabilities
        </p>
      </div>

      {/* Interactive 5-Stage Pipeline with Animated Pathway Line */}
      <div className="relative">
        {/* Desktop animated conduit behind stage cards */}
        <svg
          viewBox="0 0 1000 32"
          preserveAspectRatio="none"
          className="hidden lg:block pointer-events-none absolute left-10 right-10 top-[26px] w-[calc(100%-5rem)] h-8"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="destria-core-line" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#E5B552" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#E5B552" stopOpacity="0.95" />
            </linearGradient>
          </defs>
          <path
            d="M 0 16 H 1000"
            fill="none"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth="1.2"
          />
          <path
            d="M 0 16 H 1000"
            fill="none"
            stroke="url(#destria-core-line)"
            strokeWidth="1.6"
            className="destria-ecosystem-stream"
            style={{ animationDuration: '4.6s' }}
          />
          {shouldAnimate && (
            <>
              <circle r="3" fill="#E5B552" opacity="0.95">
                <animateMotion dur="5.2s" repeatCount="indefinite" path="M 0 16 H 1000" />
              </circle>
              <circle r="2.5" fill="#7DD3FC" opacity="0.85">
                <animateMotion
                  dur="5.2s"
                  begin="2.6s"
                  repeatCount="indefinite"
                  path="M 0 16 H 1000"
                />
              </circle>
            </>
          )}
        </svg>

        <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {INTELLIGENCE_PIPELINE_STAGES.map((stage) => {
            const Icon = stage.icon;
            const isActive = resolvedStageIndex === stage.index;
            const isSelected = activeStageIndex === stage.index;

            return (
              <li key={stage.title} className="relative">
                <button
                  type="button"
                  onClick={() => onSelectStage(isSelected ? null : stage.index)}
                  onMouseEnter={() => onSelectStage(stage.index)}
                  onMouseLeave={() => {
                    if (!isSelected) onSelectStage(null);
                  }}
                  aria-pressed={isSelected}
                  className={`w-full h-full text-left rounded-xl px-3.5 py-3.5 border transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] ${
                    isActive
                      ? 'bg-[#0D2745]/95 border-[#D4A843]/75 shadow-[0_8px_28px_-12px_rgba(212,168,67,0.32)]'
                      : 'bg-[#06182B]/85 border-slate-700/60 hover:border-slate-500/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-colors ${
                        isActive
                          ? 'bg-[#D4A843]/15 border-[#D4A843]/60 text-[#E5B552]'
                          : 'bg-[#0A213C] border-slate-700/70 text-[#7DD3FC]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums">
                      0{stage.index + 1}
                    </span>
                  </div>
                  <div
                    className={`text-xs font-semibold transition-colors ${
                      isActive ? 'text-[#E5B552]' : 'text-white'
                    }`}
                  >
                    {stage.title}
                  </div>
                  <div className="mt-1 text-[11px] text-[#A9B7C8] leading-snug">
                    {stage.shortRole}
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
