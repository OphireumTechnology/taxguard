import React, { useState } from 'react';
import {
  FileText,
  FileCheck2,
  Cpu,
  Scale,
  UserCheck,
  BarChart3
} from 'lucide-react';
import type { TransparencyPathwayStage } from './coreServiceVisualAssets';

interface FinancialTransparencyFlowProps {
  stages: readonly TransparencyPathwayStage[];
  animate: boolean;
}

const STAGE_ICONS = [
  FileText,
  FileCheck2,
  Cpu,
  Scale,
  UserCheck,
  BarChart3
] as const;

/**
 * Reusable conceptual blockchain-inspired financial transparency architecture.
 * Illustrates structured financial traceability and professional review checkpoints
 * without implying a live blockchain network or simulated transactions.
 */
export const FinancialTransparencyFlow: React.FC<FinancialTransparencyFlowProps> = ({
  stages,
  animate
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const currentStage = stages[selectedIndex] ?? stages[0];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-[rgba(212,168,67,0.24)] bg-gradient-to-b from-[#0A1F38] to-[#07182C] p-6 sm:p-8 shadow-[0_16px_44px_rgba(2,10,20,0.45)] ${
        !animate ? 'destria-motion-paused' : ''
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.55)] to-transparent"
      />

      {/* Section Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between pb-5 border-b border-[rgba(148,163,184,0.16)]">
        <div className="space-y-1.5 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D4A843]">
            Financial Transparency &amp; Accountability Architecture
          </p>
          <h3 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">
            Traceable Information Pathway Across Every Engagement
          </h3>
        </div>
        <p className="text-xs font-medium text-slate-300 whitespace-nowrap">
          Checkpoint {currentStage.step} of 06
        </p>
      </div>

      {/* Animated Metallic-Gold Conduit Line (Desktop/Tablet) */}
      <div className="mt-6">
        <svg
          aria-hidden="true"
          viewBox="0 0 960 22"
          preserveAspectRatio="none"
          className="pointer-events-none mb-3 hidden h-5 w-full md:block"
        >
          <line
            x1="44"
            y1="11"
            x2="916"
            y2="11"
            stroke="rgba(148, 163, 184, 0.2)"
            strokeWidth="1.25"
          />
          <line
            x1="44"
            y1="11"
            x2="916"
            y2="11"
            stroke="#D4A843"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="destria-ecosystem-stream"
          />
          {[44, 218, 392, 566, 740, 916].map((cx, idx) => (
            <g key={cx}>
              <circle
                cx={cx}
                cy="11"
                r={idx === selectedIndex ? '7' : '4.5'}
                fill="none"
                stroke={idx === selectedIndex ? 'rgba(225,187,96,0.5)' : 'rgba(212,168,67,0.22)'}
                strokeWidth="1"
                className={idx === selectedIndex ? 'destria-checkpoint-glow' : undefined}
              />
              <circle
                cx={cx}
                cy="11"
                r={idx === selectedIndex ? '3.5' : '2.5'}
                fill={idx === selectedIndex ? '#E1BB60' : '#0D2745'}
                stroke="#D4A843"
                strokeWidth="1.2"
              />
            </g>
          ))}
        </svg>

        {/* Six Conceptual Nodes */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {stages.map((stage, index) => {
            const Icon = STAGE_ICONS[index] ?? FileText;
            const isSelected = index === selectedIndex;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedIndex(index)}
                onFocus={() => setSelectedIndex(index)}
                aria-pressed={isSelected}
                className={`group flex flex-col justify-between rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-none ${
                  isSelected
                    ? 'border-[rgba(212,168,67,0.62)] bg-[#102D4F] text-white'
                    : 'border-[rgba(148,163,184,0.18)] bg-[#06182B]/75 text-slate-300 hover:border-[rgba(212,168,67,0.38)] hover:bg-[#0D2745]'
                }`}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isSelected ? 'text-[#E1BB60]' : 'text-[#D4A843]/80 group-hover:text-[#E1BB60]'
                    }`}
                    aria-hidden="true"
                  />
                  <span className="font-mono text-xs text-slate-400">{stage.step}</span>
                </div>
                <span className="mt-3 text-[13px] font-semibold leading-snug text-white">
                  {stage.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Checkpoint Explanation + Conceptual Disclosure */}
      <div className="mt-5 flex flex-col gap-2 border-t border-[rgba(148,163,184,0.16)] pt-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm sm:text-[15px] leading-relaxed text-slate-200 max-w-3xl">
          <span className="font-semibold text-[#E1BB60]">{currentStage.label}:</span>{' '}
          {currentStage.description}
        </p>
        <p className="text-xs text-slate-400 lg:text-right lg:max-w-xs shrink-0">
          Conceptual workflow illustration representing structured financial oversight and document traceability.
        </p>
      </div>
    </div>
  );
};
