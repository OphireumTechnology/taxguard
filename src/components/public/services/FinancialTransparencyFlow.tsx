import React, { useState } from 'react';
import {
  UserRound,
  FolderInput,
  Cpu,
  LineChart,
  UserCheck,
  FileCheck2,
  History,
} from 'lucide-react';

interface TransparencyStage {
  step: string;
  title: string;
  caption: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TRANSPARENCY_STAGES: TransparencyStage[] = [
  {
    step: '01',
    title: 'Client Information',
    caption: 'Structured intake & profile capture',
    icon: UserRound,
  },
  {
    step: '02',
    title: 'Document Collection',
    caption: 'Organized source forms & statements',
    icon: FolderInput,
  },
  {
    step: '03',
    title: 'Secure Information Processing',
    caption: 'Structured digital categorization',
    icon: Cpu,
  },
  {
    step: '04',
    title: 'Financial Analysis',
    caption: 'Reconciliation & planning evaluation',
    icon: LineChart,
  },
  {
    step: '05',
    title: 'Professional Review',
    caption: 'Independent specialist verification',
    icon: UserCheck,
  },
  {
    step: '06',
    title: 'Verified Records',
    caption: 'Approved compliance deliverables',
    icon: FileCheck2,
  },
  {
    step: '07',
    title: 'Traceable History',
    caption: 'Clear year-over-year continuity',
    icon: History,
  },
];

interface FinancialTransparencyFlowProps {
  shouldAnimate: boolean;
}

/**
 * Reusable blockchain-inspired conceptual transparency visualization showing
 * the seven-stage flow of financial information with professional oversight.
 */
export const FinancialTransparencyFlow: React.FC<
  FinancialTransparencyFlowProps
> = ({ shouldAnimate }) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <section
      aria-labelledby="transparency-flow-heading"
      className="relative rounded-[24px] bg-[#071A2F]/92 border border-slate-700/55 px-5 py-7 sm:px-8 sm:py-9 lg:px-10 overflow-hidden shadow-[0_22px_64px_-30px_rgba(2,13,24,0.9)]"
    >
      {/* Subtle metallic champagne gold top hairline */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A843]/60 to-transparent"
        aria-hidden="true"
      />

      {/* Restrained architectural grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            'radial-gradient(circle at 14% 18%, rgba(212, 168, 67, 0.09), transparent 44%), radial-gradient(circle at 86% 82%, rgba(56, 189, 248, 0.08), transparent 44%), linear-gradient(to right, rgba(148, 163, 184, 0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.045) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 100%, 48px 48px, 48px 48px',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#E5B552] uppercase">
              Structured Information Integrity
            </p>
            <h2
              id="transparency-flow-heading"
              className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight"
            >
              Transparent Financial Process Architecture
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B7C8] leading-relaxed">
              Every service engagement follows an orderly, documented sequence from initial client intake through independent professional review and organized record continuity.
            </p>
          </div>

          <p className="text-[11px] text-slate-400 lg:text-right max-w-xs leading-relaxed">
            Conceptual workflow illustration representing structured traceability and professional accountability — not a distributed blockchain ledger or live transaction feed.
          </p>
        </div>

        {/* 7-Stage Connected Digital Block Sequence */}
        <div className="relative pt-1">
          {/* Desktop horizontal animated verification pathway */}
          <svg
            viewBox="0 0 1260 40"
            preserveAspectRatio="none"
            className="hidden xl:block pointer-events-none absolute left-8 right-8 top-[30px] w-[calc(100%-4rem)] h-10"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="svc-chain-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.45" />
                <stop offset="50%" stopColor="#D4A843" stopOpacity="0.88" />
                <stop offset="100%" stopColor="#E5B552" stopOpacity="0.95" />
              </linearGradient>
            </defs>
            <path
              d="M 0 20 H 1260"
              fill="none"
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="1.2"
            />
            <path
              d="M 0 20 H 1260"
              fill="none"
              stroke="url(#svc-chain-grad)"
              strokeWidth="1.6"
              className="destria-ecosystem-stream"
              style={{ animationDuration: '5.8s' }}
            />
            {shouldAnimate && (
              <>
                <circle r="3" fill="#F3CE74" opacity="0.95">
                  <animateMotion dur="6.8s" repeatCount="indefinite" path="M 0 20 H 1260" />
                </circle>
                <circle r="2.4" fill="#7DD3FC" opacity="0.85">
                  <animateMotion
                    dur="6.8s"
                    begin="3.4s"
                    repeatCount="indefinite"
                    path="M 0 20 H 1260"
                  />
                </circle>
              </>
            )}
          </svg>

          <ol className="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
            {TRANSPARENCY_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isPrimary = activeIndex === idx;
              const isAdjacent =
                activeIndex !== null && Math.abs(activeIndex - idx) === 1;

              return (
                <li
                  key={stage.step}
                  tabIndex={0}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseLeave={() => setActiveIndex(null)}
                  onFocus={() => setActiveIndex(idx)}
                  onBlur={() => setActiveIndex(null)}
                  className={`group relative rounded-xl bg-[#06182B]/90 backdrop-blur-sm border p-3.5 flex flex-col justify-between gap-2.5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] ${
                    isPrimary
                      ? 'border-[#D4A843]/80 shadow-[0_12px_30px_-14px_rgba(212,168,67,0.38)] -translate-y-0.5'
                      : isAdjacent
                        ? 'border-[#D4A843]/45'
                        : 'border-slate-700/65 hover:border-[#D4A843]/55'
                  }`}
                >
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/80 to-transparent transition-opacity duration-200 ${
                      isPrimary ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-hidden="true"
                  />

                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-colors ${
                        isPrimary
                          ? 'bg-[#D4A843]/15 border-[#D4A843]/70 text-[#E5B552]'
                          : 'bg-[#0A213C] border-slate-700/75 text-[#E5B552]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span
                      className="font-mono text-[10px] text-slate-400 tabular-nums destria-checkpoint-glow"
                      style={{ animationDelay: `${idx * 0.45}s` }}
                    >
                      {stage.step}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <h3
                      className={`font-serif text-[13px] font-bold leading-snug transition-colors ${
                        isPrimary ? 'text-[#E5B552]' : 'text-white'
                      }`}
                    >
                      {stage.title}
                    </h3>
                    <p className="text-[11px] text-[#A9B7C8] leading-snug">
                      {stage.caption}
                    </p>
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
