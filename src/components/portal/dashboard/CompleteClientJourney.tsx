/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Complete Client Journey Panel
 *
 * Implements Section 23 of Client Dashboard Architecture:
 * Reproduces the colored 7-stage client journey panel from the reference architecture:
 * 1. GETTING STARTED
 * 2. DOCUMENTS
 * 3. REVIEW
 * 4. TAX PREPARATION
 * 5. APPROVAL & SIGNATURE
 * 6. FILING
 * 7. COMPLETED
 *
 * Uses real workflow state to highlight active, completed, and upcoming stages.
 */

import React from 'react';
import {
  CheckCircle2,
  Lock,
  ArrowRight,
  ShieldCheck,
  FileText,
  FileCheck,
  Calculator,
  PenTool,
  Send,
  Archive
} from 'lucide-react';

export interface CompleteClientJourneyProps {
  currentStage: number; // 1-18
  onSelectStep?: (stageNumber: number) => void;
}

interface JourneyPhase {
  stageNumber: number;
  label: string;
  badge: string;
  colorScheme: {
    bg: string;
    border: string;
    accent: string;
    badgeBg: string;
    badgeText: string;
  };
  bullets: string[];
}

const JOURNEY_PHASES: JourneyPhase[] = [
  {
    stageNumber: 1,
    label: 'GETTING STARTED',
    badge: 'Stage 01',
    colorScheme: {
      bg: 'bg-[#0A223E]',
      border: 'border-blue-500/40',
      accent: 'text-blue-400',
      badgeBg: 'bg-blue-950',
      badgeText: 'text-blue-300'
    },
    bullets: [
      'Create account & security credentials',
      'Statutory profile & IRC § 7216 consent',
      'Select active tax filing year',
      'Provide basic taxpayer information'
    ]
  },
  {
    stageNumber: 2,
    label: 'DOCUMENTS',
    badge: 'Stages 02–03',
    colorScheme: {
      bg: 'bg-[#1E2310]',
      border: 'border-[#D4A843]/50',
      accent: 'text-[#D4A843]',
      badgeBg: 'bg-[#0D2745]',
      badgeText: 'text-[#E1BB60]'
    },
    bullets: [
      'Upload tax & financial documents',
      'Track personalized document checklist',
      'AI OCR extraction & document intelligence',
      'SHA-256 encrypted immutable vault'
    ]
  },
  {
    stageNumber: 4,
    label: 'REVIEW',
    badge: 'Stages 04–08',
    colorScheme: {
      bg: 'bg-[#1E1738]',
      border: 'border-purple-500/40',
      accent: 'text-purple-400',
      badgeBg: 'bg-purple-950',
      badgeText: 'text-purple-300'
    },
    bullets: [
      'All source documents reviewed by CPA',
      'Taxpayer information validated & reconciled',
      'Book-tax difference schedules compiled',
      'Clarification requests managed if needed'
    ]
  },
  {
    stageNumber: 9,
    label: 'TAX PREPARATION',
    badge: 'Stage 09',
    colorScheme: {
      bg: 'bg-[#082236]',
      border: 'border-cyan-500/40',
      accent: 'text-cyan-400',
      badgeBg: 'bg-cyan-950',
      badgeText: 'text-cyan-300'
    },
    bullets: [
      'Tax professionals prepare Form 1040',
      'Multi-state returns calculated accurately',
      'Preparation progress tracked in real time',
      'Technical tax questions addressed'
    ]
  },
  {
    stageNumber: 10,
    label: 'APPROVAL & SIGNATURE',
    badge: 'Stages 10–11',
    colorScheme: {
      bg: 'bg-[#0F2B1D]',
      border: 'border-emerald-500/40',
      accent: 'text-emerald-400',
      badgeBg: 'bg-emerald-950',
      badgeText: 'text-emerald-300'
    },
    bullets: [
      'Client reviews complete return draft',
      'Approves all schedules and deductions',
      'E-signs Form 8879 authorization securely',
      'Authorizes electronic filing transmission'
    ]
  },
  {
    stageNumber: 12,
    label: 'FILING',
    badge: 'Stages 12–14',
    colorScheme: {
      bg: 'bg-[#2A180E]',
      border: 'border-orange-500/40',
      accent: 'text-orange-400',
      badgeBg: 'bg-orange-950',
      badgeText: 'text-orange-300'
    },
    bullets: [
      'Electronic filing transmission to IRS & States',
      'Live transmission acknowledgments tracked',
      'Status updates delivered instantly',
      'Acceptance notifications recorded'
    ]
  },
  {
    stageNumber: 15,
    label: 'COMPLETED',
    badge: 'Stages 15–18',
    colorScheme: {
      bg: 'bg-[#0D2428]',
      border: 'border-teal-500/40',
      accent: 'text-teal-400',
      badgeBg: 'bg-teal-950',
      badgeText: 'text-teal-300'
    },
    bullets: [
      'Immediate access to completed return files',
      'Download certified deliverables anytime',
      '7-year records archive preservation',
      'Year-round advisory & renewal support'
    ]
  }
];

export const CompleteClientJourney: React.FC<CompleteClientJourneyProps> = ({
  currentStage,
  onSelectStep
}) => {
  return (
    <section
      aria-label="Complete Client Tax Journey"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#D4A843]" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
            COMPLETE CLIENT JOURNEY
          </h2>
          <span className="text-slate-500">&bull;</span>
          <span className="text-xs text-slate-300">
            End-to-end professional tax preparation lifecycle
          </span>
        </div>
        <span className="text-[11px] font-mono text-[#D4A843]">
          Circular 230 &bull; NIST AI RMF 1.0 Aligned
        </span>
      </div>

      {/* 7 Colored Phases Horizontal Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 text-xs">
        {JOURNEY_PHASES.map((phase, idx) => {
          const isCompleted = currentStage > phase.stageNumber + 1 || (phase.stageNumber === 1 && currentStage > 1);
          const isCurrent =
            (phase.stageNumber === 1 && currentStage === 1) ||
            (phase.stageNumber === 2 && (currentStage === 2 || currentStage === 3)) ||
            (phase.stageNumber === 4 && (currentStage >= 4 && currentStage <= 8)) ||
            (phase.stageNumber === 9 && currentStage === 9) ||
            (phase.stageNumber === 10 && (currentStage === 10 || currentStage === 11)) ||
            (phase.stageNumber === 12 && (currentStage >= 12 && currentStage <= 14)) ||
            (phase.stageNumber === 15 && currentStage >= 15);

          return (
            <div
              key={phase.label}
              onClick={() => {
                if (onSelectStep && (isCompleted || isCurrent)) {
                  onSelectStep(phase.stageNumber);
                }
              }}
              className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all select-none space-y-3 ${
                phase.colorScheme.bg
              } ${phase.colorScheme.border} ${
                isCurrent
                  ? 'ring-2 ring-[#D4A843] shadow-lg'
                  : isCompleted
                  ? 'opacity-95 hover:opacity-100 cursor-pointer'
                  : 'opacity-70 cursor-not-allowed'
              }`}
            >
              {/* Header */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${phase.colorScheme.badgeBg} ${phase.colorScheme.badgeText}`}
                  >
                    {phase.badge}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <span className="w-2 h-2 rounded-full bg-[#D4A843] animate-pulse shrink-0" />
                  ) : (
                    <Lock className="w-3 h-3 text-slate-500 shrink-0" />
                  )}
                </div>

                <h3 className={`font-bold text-[11px] font-mono tracking-tight ${phase.colorScheme.accent}`}>
                  {idx + 1}. {phase.label}
                </h3>
              </div>

              {/* Bullet list */}
              <ul className="space-y-1.5 text-[10px] text-slate-300 leading-snug list-disc pl-3">
                {phase.bullets.map((b, bIdx) => (
                  <li key={bIdx} className="marker:text-slate-500">
                    {b}
                  </li>
                ))}
              </ul>

              {/* Footer status */}
              <div className="pt-2 border-t border-white/10 text-[9px] font-mono font-semibold">
                {isCompleted && <span className="text-emerald-400">✓ Completed</span>}
                {isCurrent && <span className="text-[#E1BB60] font-bold">● Active Phase</span>}
                {!isCompleted && !isCurrent && <span className="text-slate-500">Upcoming</span>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
