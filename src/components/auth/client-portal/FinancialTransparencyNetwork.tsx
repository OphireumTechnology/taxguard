import React, { useState } from 'react';
import {
  UserCheck,
  KeyRound,
  FolderLock,
  FileSearch,
  Scale,
  FileBarChart2
} from 'lucide-react';
import { TRANSPARENCY_NETWORK_STAGES } from './clientPortalVisualAssets';

interface FinancialTransparencyNetworkProps {
  /** Controls whether subtle SVG data-pathway pulse animations run. */
  animate: boolean;
}

const STAGE_ICONS = [
  UserCheck,
  KeyRound,
  FolderLock,
  FileSearch,
  Scale,
  FileBarChart2
] as const;

/**
 * Conceptual 6-stage blockchain-inspired financial transparency architecture.
 * Strictly illustrative — makes no claims of live blockchain infrastructure or live ledger telemetry.
 */
export const FinancialTransparencyNetwork: React.FC<FinancialTransparencyNetworkProps> = ({
  animate
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const activeStage = TRANSPARENCY_NETWORK_STAGES[activeIndex] ?? TRANSPARENCY_NETWORK_STAGES[0];

  return (
    <section
      aria-label="Conceptual financial transparency workflow"
      className={`rounded-2xl border border-[rgba(148,163,184,0.18)] bg-[#081C32]/90 p-5 shadow-[0_14px_38px_rgba(2,10,20,0.42)] ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 pb-4 border-b border-[rgba(148,163,184,0.14)]">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#D4A843]">
            Transparency &amp; Accountability Architecture
          </p>
          <h2 className="mt-1 font-serif text-base font-bold text-white">
            Structured Client Information Lifecycle
          </h2>
        </div>
        <span className="text-[11px] font-medium text-slate-400">
          Stage {activeStage.step} of 06
        </span>
      </div>

      {/* Animated Connecting Pathway (Desktop horizontal conduit) */}
      <div className="relative mt-4">
        <svg
          aria-hidden="true"
          viewBox="0 0 600 14"
          preserveAspectRatio="none"
          className="pointer-events-none mb-2 hidden h-3.5 w-full sm:block"
        >
          <line
            x1="28"
            y1="7"
            x2="572"
            y2="7"
            stroke="rgba(148, 163, 184, 0.22)"
            strokeWidth="1.25"
          />
          <line
            x1="28"
            y1="7"
            x2="572"
            y2="7"
            stroke="#D4A843"
            strokeWidth="1.75"
            strokeLinecap="round"
            className="destria-ecosystem-stream"
          />
          {[28, 137, 246, 354, 463, 572].map((cx, idx) => (
            <circle
              key={cx}
              cx={cx}
              cy="7"
              r={idx === activeIndex ? '4' : '2.75'}
              fill={idx === activeIndex ? '#E1BB60' : '#0D2745'}
              stroke={idx === activeIndex ? '#F8FAFC' : '#D4A843'}
              strokeWidth="1.25"
              className={idx === activeIndex ? 'destria-checkpoint-glow' : undefined}
            />
          ))}
        </svg>

        {/* 6 Connected Governance Nodes */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {TRANSPARENCY_NETWORK_STAGES.map((stage, index) => {
            const Icon = STAGE_ICONS[index] ?? UserCheck;
            const isSelected = index === activeIndex;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                aria-pressed={isSelected}
                className={`group flex flex-col items-start rounded-xl border px-2.5 py-2.5 text-left transition-colors focus-visible:outline-none ${
                  isSelected
                    ? 'border-[rgba(212,168,67,0.58)] bg-[#102D4F] text-white'
                    : 'border-[rgba(148,163,184,0.16)] bg-[#06182B]/70 text-slate-300 hover:border-[rgba(212,168,67,0.34)] hover:bg-[#0D2745]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      isSelected ? 'text-[#E1BB60]' : 'text-[#D4A843]/75 group-hover:text-[#E1BB60]'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-[10px] text-slate-400">{stage.step}</span>
                </div>
                <span className="mt-2 text-[11px] font-semibold leading-tight text-white">
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Stage Explanation */}
      <div className="mt-3.5 flex flex-col gap-1.5 border-t border-[rgba(148,163,184,0.14)] pt-3.5">
        <p className="text-xs leading-relaxed text-slate-200">
          <span className="font-semibold text-[#E1BB60]">{activeStage.label}:</span>{' '}
          {activeStage.summary}
        </p>
        <p className="text-[11px] text-slate-400">
          Conceptual visualization illustrating Destria&apos;s structured client document and professional oversight workflow.
        </p>
      </div>
    </section>
  );
};
