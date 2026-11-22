import React, { useState } from 'react';
import {
  Compass,
  ClipboardCheck,
  Scale,
  FolderCheck,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';

interface GovernanceStage {
  step: string;
  title: string;
  conceptTag: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
}

const GOVERNANCE_STAGES: GovernanceStage[] = [
  {
    step: '01',
    title: 'Strategy Discovery',
    conceptTag: 'Tax Strategy',
    summary:
      'Identify relevant U.S. federal and state planning frameworks aligned with taxpayer entity type and objectives.',
    icon: Compass,
  },
  {
    step: '02',
    title: 'Eligibility Assessment',
    conceptTag: 'Qualification',
    summary:
      'Evaluate income thresholds, ownership structure, basis rules, and statutory phase-outs before adoption.',
    icon: ClipboardCheck,
  },
  {
    step: '03',
    title: 'Regulatory Authority',
    conceptTag: 'IRC & DOR Citation',
    summary:
      'Anchor every candidate position directly to Internal Revenue Code statutes, Treasury regulations, and state guidance.',
    icon: Scale,
  },
  {
    step: '04',
    title: 'Supporting Documentation',
    conceptTag: 'Evidence Verification',
    summary:
      'Organize required forms, contemporaneous records, and workpaper checklists for full substantiation.',
    icon: FolderCheck,
  },
  {
    step: '05',
    title: 'Professional Review',
    conceptTag: 'CPA Governance',
    summary:
      'Independent evaluation and suitability verification performed by an authorized Destria tax professional.',
    icon: UserCheck,
  },
  {
    step: '06',
    title: 'Informed Tax Planning',
    conceptTag: 'Approved Decision',
    summary:
      'Documented planning determination executed strictly within a formal, reviewed client engagement.',
    icon: ShieldCheck,
  },
];

interface TransparentGovernanceNetworkProps {
  shouldAnimate: boolean;
}

/**
 * Transparent Tax Strategy Governance section placed between Hero and Search.
 * Uses blockchain-inspired conceptual blocks and animated pathways without claiming
 * live distributed ledger execution or automatic strategy qualification.
 */
export const TransparentGovernanceNetwork: React.FC<
  TransparentGovernanceNetworkProps
> = ({ shouldAnimate }) => {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  return (
    <section
      aria-labelledby="transparent-governance-heading"
      className="relative rounded-[24px] bg-[#071A2F]/90 border border-slate-700/55 px-5 py-7 sm:px-8 sm:py-9 overflow-hidden shadow-[0_20px_60px_-30px_rgba(2,13,24,0.88)]"
    >
      {/* Top metallic gold reflection hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A843]/55 to-transparent"
        aria-hidden="true"
      />

      {/* Subtle architectural ledger mesh background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 12% 20%, rgba(212, 168, 67, 0.09), transparent 40%), radial-gradient(circle at 88% 80%, rgba(56, 189, 248, 0.08), transparent 42%), linear-gradient(to right, rgba(148, 163, 184, 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.045) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-6">
        {/* Heading Row */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#E5B552] uppercase">
              Traceable Planning Architecture
            </p>
            <h2
              id="transparent-governance-heading"
              className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight"
            >
              Transparent Tax Strategy Governance
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B7C8] leading-relaxed">
              Every tax planning strategy requires disciplined eligibility assessment, verification against applicable regulatory authority, complete supporting documentation, and independent professional approval before implementation.
            </p>
          </div>

          <p className="text-[11px] text-slate-400 lg:text-right max-w-xs leading-relaxed">
            Conceptual governance model illustrating structured review progression — not live client transactions or automated qualification.
          </p>
        </div>

        {/* 6 Connected Blockchain-Inspired Governance Blocks */}
        <div className="relative pt-1">
          {/* Desktop horizontal animated verification pathway behind the 6 blocks */}
          <svg
            viewBox="0 0 1200 40"
            preserveAspectRatio="none"
            className="hidden xl:block pointer-events-none absolute left-10 right-10 top-[30px] w-[calc(100%-5rem)] h-10"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ts-gov-chain" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#D4A843" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#E5B552" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            <path
              d="M 0 20 H 1200"
              fill="none"
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="1.2"
            />
            <path
              d="M 0 20 H 1200"
              fill="none"
              stroke="url(#ts-gov-chain)"
              strokeWidth="1.6"
              className="destria-ecosystem-stream"
              style={{ animationDuration: '5.4s' }}
            />
            {shouldAnimate && (
              <>
                <circle r="3" fill="#F3CE74" opacity="0.95">
                  <animateMotion dur="6.4s" repeatCount="indefinite" path="M 0 20 H 1200" />
                </circle>
                <circle r="2.5" fill="#7DD3FC" opacity="0.85">
                  <animateMotion
                    dur="6.4s"
                    begin="3.2s"
                    repeatCount="indefinite"
                    path="M 0 20 H 1200"
                  />
                </circle>
              </>
            )}
          </svg>

          <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
            {GOVERNANCE_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isHighlighted =
                focusedIndex === idx ||
                (focusedIndex !== null && Math.abs(focusedIndex - idx) === 1);
              const isPrimary = focusedIndex === idx;

              return (
                <li
                  key={stage.step}
                  tabIndex={0}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  onMouseLeave={() => setFocusedIndex(null)}
                  onFocus={() => setFocusedIndex(idx)}
                  onBlur={() => setFocusedIndex(null)}
                  className={`group relative rounded-xl bg-[#06182B]/90 backdrop-blur-sm border p-4 flex flex-col justify-between gap-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] ${
                    isPrimary
                      ? 'border-[#D4A843]/80 shadow-[0_12px_32px_-16px_rgba(212,168,67,0.38)] -translate-y-0.5'
                      : isHighlighted
                        ? 'border-[#D4A843]/45'
                        : 'border-slate-700/65 hover:border-[#D4A843]/55'
                  }`}
                >
                  {/* Top gold accent line on active block */}
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/80 to-transparent transition-opacity duration-200 ${
                      isPrimary ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-hidden="true"
                  />

                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div
                        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                          isPrimary
                            ? 'bg-[#D4A843]/15 border-[#D4A843]/70 text-[#E5B552]'
                            : 'bg-[#0A213C] border-slate-700/75 text-[#E5B552]'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-mono text-[11px] font-medium text-slate-400 tabular-nums">
                        {stage.step}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h3
                        className={`font-serif text-sm font-bold leading-snug transition-colors ${
                          isPrimary ? 'text-[#E5B552]' : 'text-white'
                        }`}
                      >
                        {stage.title}
                      </h3>
                      <p className="text-[11px] text-[#A9B7C8] leading-relaxed">
                        {stage.summary}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-700/50 text-[10px] font-medium tracking-wide text-sky-300/85">
                    {stage.conceptTag}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
};
