import React, { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  FileSignature,
  Pause,
  Play,
  Scale,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useInViewMotion } from './useInViewMotion';
import { HumanAiCommandVisual } from './HumanAiCommandVisual';
import { ClientAuthorizationCheckpointVisual } from './ClientAuthorizationCheckpointVisual';
import { SecureFinancialTransparencyNetwork } from './SecureFinancialTransparencyNetwork';

interface GovernanceStage {
  step: string;
  title: string;
  owner: 'AI-Assisted' | 'Joint Verification' | 'Human Authority' | 'Client Decision';
  summary: string;
  safeguard: string;
  accent: 'cyan' | 'hybrid' | 'gold' | 'client';
  icon: React.ComponentType<{ className?: string }>;
}

const COLLABORATION_STAGES: GovernanceStage[] = [
  {
    step: '01',
    title: 'AI-Assisted Processing',
    owner: 'AI-Assisted',
    summary:
      'Organizes submitted statements, extracts structured figures, and indexes supporting workpapers so practitioners begin with clean records.',
    safeguard: 'Draft outputs remain tagged as unverified until reviewed.',
    accent: 'cyan',
    icon: BrainCircuit
  },
  {
    step: '02',
    title: 'Financial Validation',
    owner: 'Joint Verification',
    summary:
      'Reconciles source forms against ledger balances, flags missing items or variances, and surfaces items requiring professional judgment.',
    safeguard: 'Every exception routes to a human preparer queue.',
    accent: 'hybrid',
    icon: ClipboardCheck
  },
  {
    step: '03',
    title: 'Professional Review',
    owner: 'Human Authority',
    summary:
      'Experienced tax professionals evaluate tax positions, verify statutory deductions, confirm multi-state rules, and complete independent review.',
    safeguard: 'Qualified practitioners hold exclusive authority over tax conclusions.',
    accent: 'gold',
    icon: UserCheck
  },
  {
    step: '04',
    title: 'Client Authorization',
    owner: 'Client Decision',
    summary:
      'Review the prepared tax return summary, discuss the findings with your tax professional, and provide explicit authorization before filing.',
    safeguard: 'No return is finalized or transmitted without the required client authorization.',
    accent: 'client',
    icon: FileSignature
  },
  {
    step: '05',
    title: 'Authorized Tax Services',
    owner: 'Human Authority',
    summary:
      'Approved filings, advisory deliverables, and year-round planning schedules are documented in the engagement record with clear accountability.',
    safeguard: 'Complete record of who prepared, reviewed, and approved each milestone.',
    accent: 'gold',
    icon: ShieldCheck
  }
];

const AI_SUPPORTS = [
  'Structured document ingestion, indexing, and line-item organization',
  'Cross-checking totals across statements, schedules, and trial balances',
  'Highlighting missing source forms, variances, and potential review items',
  'Drafting organized financial summaries to support advisory discussions'
];

const HUMAN_AUTHORITY = [
  'Interpreting federal and state tax law for each client’s specific facts',
  'Exercising independent professional judgment on every tax position',
  'Conducting mandatory human quality review prior to client delivery',
  'Obtaining explicit client authorization before any filing or representation'
];

export const HumanAiCollaborationSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { shouldAnimate } = useInViewMotion(sectionRef);
  // Default to Stage 04 — Client Authorization
  const [activeIndex, setActiveIndex] = useState(3);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    if (!shouldAnimate || !isPlaying) return;
    const interval = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % COLLABORATION_STAGES.length);
    }, 4200);
    return () => window.clearInterval(interval);
  }, [shouldAnimate, isPlaying]);

  const activeStage = COLLABORATION_STAGES[activeIndex] ?? COLLABORATION_STAGES[3];

  return (
    <section
      ref={sectionRef}
      id="human-ai-accountability"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-x-clip"
      aria-labelledby="human-ai-heading"
    >
      <div
        className={`relative overflow-hidden rounded-3xl border border-[rgba(212,168,67,0.28)] bg-gradient-to-b from-[#0C2440] via-[#081B32] to-[#051424] p-6 sm:p-10 lg:p-12 shadow-[0_28px_72px_rgba(2,10,20,0.62)] space-y-10 ${
          !shouldAnimate ? 'destria-motion-paused' : ''
        }`}
      >
        {/* Subtle Animated Architectural Digital Grid Backdrop */}
        <div
          aria-hidden="true"
          className="destria-tech-grid-bg pointer-events-none absolute inset-0 opacity-30"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.1),transparent_48%),radial-gradient(ellipse_at_bottom_left,rgba(212,168,67,0.09),transparent_52%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#D4A843] to-sky-400/50 opacity-85"
        />

        {/* Header Row */}
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3.5">
            <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] text-[#E5B552] uppercase">
              Human Expertise &amp; Professional Accountability
            </p>
            <h2
              id="human-ai-heading"
              className="font-serif text-3xl sm:text-4xl lg:text-[2.6rem] font-bold text-white tracking-tight leading-[1.15] [text-wrap:balance]"
            >
              Human Expertise. Artificial Intelligence. Working Together.
            </h2>
            <p className="text-base sm:text-[17px] text-slate-300 leading-[1.65]">
              Artificial intelligence accelerates document organization and financial verification,
              while experienced tax professionals remain firmly accountable for judgment, compliance,
              and client advisory. AI never approves, signs, or files tax returns independently.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            className="self-start lg:self-end inline-flex min-h-[44px] items-center gap-2 px-4 py-2.5 rounded-xl bg-[#06182B]/90 hover:bg-[#102D4F] border border-[rgba(148,163,184,0.28)] hover:border-[rgba(212,168,67,0.55)] text-xs sm:text-sm font-semibold text-slate-100 transition-colors whitespace-nowrap"
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 text-[#E5B552]" aria-hidden="true" />
            ) : (
              <Play className="w-4 h-4 text-[#E5B552]" aria-hidden="true" />
            )}
            <span>{isPlaying ? 'Pause Progression' : 'Auto-Play Stages'}</span>
          </button>
        </div>

        {/* 5-Stage Interactive Technology Workflow */}
        <div className="relative space-y-5">
          {/* Animated Horizontal Network Conduit Connecting All 5 Stages (Desktop) */}
          <svg
            aria-hidden="true"
            viewBox="0 0 1000 26"
            preserveAspectRatio="none"
            className="pointer-events-none hidden h-6 w-full lg:block"
          >
            <defs>
              <linearGradient id="destriaWorkflowBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38BDF8" />
                <stop offset="48%" stopColor="#38BDF8" />
                <stop offset="72%" stopColor="#E5B552" />
                <stop offset="100%" stopColor="#D4A843" />
              </linearGradient>
            </defs>
            <line
              x1="96"
              y1="13"
              x2="904"
              y2="13"
              stroke="rgba(148, 163, 184, 0.22)"
              strokeWidth="1.5"
            />
            <line
              x1="96"
              y1="13"
              x2="904"
              y2="13"
              stroke="url(#destriaWorkflowBeam)"
              strokeWidth="2.2"
              strokeLinecap="round"
              className="destria-ecosystem-stream"
            />
            {[96, 298, 500, 702, 904].map((cx, idx) => {
              const isSelected = idx === activeIndex;
              const isStageFour = idx === 3;
              return (
                <g key={cx}>
                  <circle
                    cx={cx}
                    cy="13"
                    r={isSelected ? '8.5' : '5'}
                    fill="none"
                    stroke={
                      isStageFour
                        ? 'rgba(229, 181, 82, 0.72)'
                        : isSelected
                          ? 'rgba(56, 189, 248, 0.65)'
                          : 'rgba(148, 163, 184, 0.28)'
                    }
                    strokeWidth="1.25"
                    className={isSelected ? 'destria-checkpoint-glow' : undefined}
                  />
                  <circle
                    cx={cx}
                    cy="13"
                    r={isSelected ? '4' : '2.8'}
                    fill={
                      isStageFour
                        ? '#E5B552'
                        : isSelected
                          ? idx < 2
                            ? '#38BDF8'
                            : '#E5B552'
                          : '#0B223C'
                    }
                    stroke={idx < 2 ? '#38BDF8' : '#E5B552'}
                    strokeWidth="1.25"
                  />
                </g>
              );
            })}
          </svg>

          {/* 5 Glass-Like Interactive Stage Cards */}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            {COLLABORATION_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isActive = idx === activeIndex;
              const isStageFour = idx === 3;
              const isPast = idx < activeIndex;
              const isTechAccent = stage.accent === 'cyan' || stage.accent === 'hybrid';

              return (
                <button
                  key={stage.step}
                  type="button"
                  onClick={() => {
                    setActiveIndex(idx);
                    setIsPlaying(false);
                  }}
                  aria-current={isActive ? 'step' : undefined}
                  className={`group relative flex min-h-[132px] flex-col justify-between gap-4 rounded-2xl border p-4 sm:p-5 text-left backdrop-blur-md transition-all duration-300 ${
                    isActive
                      ? isStageFour
                        ? 'border-[#E5B552] bg-gradient-to-b from-[#13335A] to-[#0B223E] shadow-[0_0_30px_rgba(212,168,67,0.22),0_0_18px_rgba(56,189,248,0.14)] -translate-y-0.5'
                        : isTechAccent
                          ? 'border-sky-400/75 bg-gradient-to-b from-[#0E2E52] to-[#091E38] shadow-[0_0_24px_rgba(56,189,248,0.16)] -translate-y-0.5'
                          : 'border-[#E5B552] bg-gradient-to-b from-[#123156] to-[#0A203A] shadow-[0_0_24px_rgba(212,168,67,0.18)] -translate-y-0.5'
                      : isStageFour
                        ? 'border-[rgba(212,168,67,0.45)] bg-[#0A223E]/90 hover:border-[#E5B552] hover:bg-[#0E2A4A]'
                        : isPast
                          ? 'border-[rgba(56,189,248,0.3)] bg-[#09203A]/85 hover:border-[rgba(212,168,67,0.5)]'
                          : 'border-[rgba(148,163,184,0.2)] bg-[#06182B]/85 hover:border-[rgba(56,189,248,0.42)] hover:bg-[#0A203A]'
                  }`}
                >
                  {/* Top Subtle Highlight Line for Active or Stage 04 */}
                  {(isActive || isStageFour) && (
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-x-4 top-0 h-px ${
                        isStageFour
                          ? 'bg-gradient-to-r from-sky-400/70 via-[#E5B552] to-sky-400/70'
                          : isTechAccent
                            ? 'bg-gradient-to-r from-transparent via-sky-400 to-transparent'
                            : 'bg-gradient-to-r from-transparent via-[#E5B552] to-transparent'
                      }`}
                    />
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        isActive
                          ? isStageFour || !isTechAccent
                            ? 'text-[#E5B552]'
                            : 'text-sky-300'
                          : 'text-slate-400'
                      }`}
                    >
                      Stage {stage.step}
                    </span>

                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                        isActive
                          ? isStageFour
                            ? 'border-[#E5B552]/75 bg-[#D4A843]/20 text-[#E5B552] shadow-[0_0_14px_rgba(56,189,248,0.2)]'
                            : isTechAccent
                              ? 'border-sky-400/60 bg-sky-400/15 text-sky-300'
                              : 'border-[#E5B552]/65 bg-[#D4A843]/15 text-[#E5B552]'
                          : 'border-[rgba(148,163,184,0.24)] bg-[#06182B] text-slate-300 group-hover:text-white'
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[15px] font-bold text-white leading-snug">
                      {stage.title}
                    </div>
                    <div
                      className={`text-xs font-medium ${
                        isStageFour
                          ? 'text-[#E5B552]'
                          : isTechAccent
                            ? 'text-sky-300/90'
                            : 'text-[#E5B552]/90'
                      }`}
                    >
                      {stage.owner}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Stage Command Detail Panel */}
          <div className="rounded-2xl border border-[rgba(212,168,67,0.3)] bg-[#06182B]/92 p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6 backdrop-blur-md">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-mono font-semibold text-[#E5B552] tabular-nums">
                  STAGE {activeStage.step} OF 05
                </span>
                <span className="text-slate-500" aria-hidden="true">
                  &bull;
                </span>
                <span
                  className={`font-semibold ${
                    activeStage.accent === 'cyan' || activeStage.accent === 'hybrid'
                      ? 'text-sky-300'
                      : 'text-[#E5B552]'
                  }`}
                >
                  {activeStage.owner}
                </span>
              </div>
              <h3 className="font-serif text-xl sm:text-2xl font-bold text-white">
                {activeStage.step === '04'
                  ? 'Client Authorization — Your Decision, Your Control'
                  : activeStage.title}
              </h3>
              <p className="text-sm sm:text-base text-slate-200 leading-[1.65]">
                {activeStage.summary}
              </p>
            </div>

            <div className="w-full lg:max-w-sm shrink-0 rounded-xl border border-[rgba(212,168,67,0.38)] bg-[#0B223C] p-5 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#E5B552]">
                <Scale className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Governance Safeguard</span>
              </div>
              <p className="text-sm font-medium text-slate-100 leading-relaxed">
                {activeStage.safeguard}
              </p>
            </div>
          </div>

          {/* Dedicated Client Authorization Checkpoint Gate Visual */}
          <ClientAuthorizationCheckpointVisual
            activeStageIndex={activeIndex}
            animate={shouldAnimate}
          />
        </div>

        {/* Modernized Technology & Governance Cards + Enterprise Command Visual */}
        <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Panel A — Technology Layer (Cyan Accents) */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-sky-400/30 bg-gradient-to-b from-[#0A223E] to-[#06172B] p-6 sm:p-7 shadow-[0_14px_36px_rgba(2,10,20,0.42)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-400/75 to-transparent"
              />
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
                      Technology Layer
                    </p>
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-white">
                      What AI Supports
                    </h3>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/35 bg-sky-400/10 text-sky-300">
                    <Cpu className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>

                <ul className="space-y-3.5 border-t border-[rgba(148,163,184,0.16)] pt-5 text-sm sm:text-[15px] text-slate-200">
                  {AI_SUPPORTS.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <CheckCircle2
                        className="h-4 w-4 text-sky-400 flex-shrink-0 mt-1"
                        aria-hidden="true"
                      />
                      <span className="leading-[1.6]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-6 border-t border-[rgba(148,163,184,0.14)] pt-4 text-xs font-medium text-sky-300/85">
                AI assists with preparation speed and organization—never autonomous filing.
              </p>
            </div>

            {/* Panel B — Practitioner Governance (Metallic Gold Accents) */}
            <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[rgba(212,168,67,0.45)] bg-gradient-to-b from-[#0E2847] to-[#07192E] p-6 sm:p-7 shadow-[0_14px_36px_rgba(2,10,20,0.42)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#E5B552] to-transparent"
              />
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E5B552]">
                      Practitioner Governance
                    </p>
                    <h3 className="font-serif text-xl sm:text-2xl font-bold text-white">
                      What Professionals Own
                    </h3>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(212,168,67,0.45)] bg-[#D4A843]/15 text-[#E5B552]">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>

                <ul className="space-y-3.5 border-t border-[rgba(212,168,67,0.2)] pt-5 text-sm sm:text-[15px] text-slate-100">
                  {HUMAN_AUTHORITY.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <ShieldCheck
                        className="h-4 w-4 text-[#E5B552] flex-shrink-0 mt-1"
                        aria-hidden="true"
                      />
                      <span className="leading-[1.6]">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-6 border-t border-[rgba(212,168,67,0.2)] pt-4 text-xs font-medium text-[#E5B552]">
                Qualified professionals retain full authority, review responsibility, and client sign-off control.
              </p>
            </div>
          </div>

          {/* High-Presence Technology Command Visualization */}
          <div className="lg:col-span-5">
            <HumanAiCommandVisual animate={shouldAnimate} />
          </div>
        </div>

        {/* Interactive 6-Node Secure Financial Transparency Network */}
        <div className="relative">
          <SecureFinancialTransparencyNetwork animate={shouldAnimate} />
        </div>

        {/* Prominent Executive Accountability Commitment */}
        <div className="relative rounded-2xl border border-[rgba(212,168,67,0.34)] bg-[#051424]/95 p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[rgba(212,168,67,0.42)] bg-[#0D2745] text-[#E5B552]">
              <Scale className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#E5B552]">
                Professional Accountability Commitment
              </p>
              <p className="text-sm sm:text-[15px] leading-[1.65] text-slate-200">
                All tax preparation, accounting, advisory, and filing activities at Destria Tax
                Services, LLC remain subject to qualified professional review, formal engagement
                terms, explicit client authorization, and applicable federal and state regulatory
                requirements.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
