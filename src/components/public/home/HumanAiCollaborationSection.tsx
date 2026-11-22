import React, { useEffect, useRef, useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  Pause,
  Play,
  Scale,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { BRAND_ASSETS } from '../../../utils/assets';
import { EditorialSplitImage } from '../images';
import { useInViewMotion } from './useInViewMotion';

interface GovernanceStage {
  step: string;
  title: string;
  owner: 'AI-Assisted' | 'Joint Verification' | 'Human Authority' | 'Client Decision';
  summary: string;
  safeguard: string;
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
    icon: BrainCircuit,
  },
  {
    step: '02',
    title: 'Financial Validation',
    owner: 'Joint Verification',
    summary:
      'Reconciles source forms against ledger balances, flags missing items or variances, and surfaces items requiring professional judgment.',
    safeguard: 'Every exception routes to a human preparer queue.',
    icon: ClipboardCheck,
  },
  {
    step: '03',
    title: 'Professional Review',
    owner: 'Human Authority',
    summary:
      'Experienced tax professionals evaluate tax positions, verify statutory deductions, confirm multi-state rules, and complete independent review.',
    safeguard: 'Qualified practitioners hold exclusive authority over tax conclusions.',
    icon: UserCheck,
  },
  {
    step: '04',
    title: 'Client Authorization',
    owner: 'Client Decision',
    summary:
      'Clients inspect their prepared return summary, discuss strategy with their advisor, and provide explicit written authorization prior to filing.',
    safeguard: 'No return is finalized or transmitted without client sign-off.',
    icon: FileSignature,
  },
  {
    step: '05',
    title: 'Authorized Tax Services',
    owner: 'Human Authority',
    summary:
      'Approved filings, advisory deliverables, and year-round planning schedules are documented in the engagement record with clear accountability.',
    safeguard: 'Complete record of who prepared, reviewed, and approved each milestone.',
    icon: ShieldCheck,
  },
];

const AI_SUPPORTS = [
  'Structured document ingestion, indexing, and line-item organization',
  'Cross-checking totals across statements, schedules, and trial balances',
  'Highlighting missing source forms, variances, and potential review items',
  'Drafting organized financial summaries to support advisory discussions',
];

const HUMAN_AUTHORITY = [
  'Interpreting federal and state tax law for each client’s specific facts',
  'Exercising independent professional judgment on every tax position',
  'Conducting mandatory human quality review prior to client delivery',
  'Obtaining explicit client authorization before any filing or representation',
];

export const HumanAiCollaborationSection: React.FC = () => {
  const sectionRef = useRef<HTMLElement | null>(null);
  const { shouldAnimate } = useInViewMotion(sectionRef);
  const [activeIndex, setActiveIndex] = useState(2);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (!shouldAnimate || !isPlaying) return;
    const interval = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % COLLABORATION_STAGES.length);
    }, 3600);
    return () => window.clearInterval(interval);
  }, [shouldAnimate, isPlaying]);

  const activeStage = COLLABORATION_STAGES[activeIndex];

  return (
    <section
      ref={sectionRef}
      id="human-ai-accountability"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      aria-labelledby="human-ai-heading"
    >
      <div className="rounded-3xl bg-gradient-to-b from-[#0C2440]/95 to-[#07182B] border border-slate-700/80 p-6 sm:p-10 lg:p-12 shadow-2xl space-y-10">
        {/* Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#E5B552] uppercase">
              Human Expertise &amp; Professional Accountability
            </p>
            <h2
              id="human-ai-heading"
              className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight [text-wrap:balance]"
            >
              Human Expertise. Artificial Intelligence. Working Together.
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Artificial intelligence accelerates document organization and financial verification, while experienced tax professionals remain firmly accountable for judgment, compliance, and client advisory. AI never approves, signs, or files tax returns independently.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            className="self-start lg:self-end inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#071A2E] hover:bg-[#102D4F] border border-slate-700 hover:border-[#D4A843]/50 text-xs font-semibold text-slate-200 transition-colors whitespace-nowrap"
            aria-pressed={isPlaying}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-[#E5B552]" /> : <Play className="w-3.5 h-3.5 text-[#E5B552]" />}
            <span>{isPlaying ? 'Pause Progression' : 'Play Progression'}</span>
          </button>
        </div>

        {/* 5-Stage Governance Progression */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {COLLABORATION_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;
              return (
                <button
                  key={stage.step}
                  type="button"
                  onClick={() => {
                    setActiveIndex(idx);
                    setIsPlaying(false);
                  }}
                  aria-current={isActive ? 'step' : undefined}
                  className={`text-left p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                    isActive
                      ? 'bg-[#102D4F] border-[#D4A843] shadow-lg shadow-[#D4A843]/10'
                      : isPast
                        ? 'bg-[#0A213C]/90 border-[#D4A843]/35 hover:border-[#D4A843]/60'
                        : 'bg-[#071A2E]/85 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        isActive ? 'text-[#E5B552]' : 'text-slate-400'
                      }`}
                    >
                      Stage {stage.step}
                    </span>
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                        isActive
                          ? 'bg-[#D4A843]/15 border-[#D4A843]/60 text-[#E5B552]'
                          : 'bg-[#071A2E] border-slate-700/80 text-slate-300'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm font-bold text-white leading-snug">{stage.title}</div>
                    <div className="text-[11px] font-medium text-[#E5B552]/90">{stage.owner}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Stage Detail Bar */}
          <div className="rounded-2xl bg-[#071A2E] border border-slate-700/80 p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                <span className="font-mono font-semibold text-[#E5B552] tabular-nums">
                  STEP {activeStage.step} OF 05
                </span>
                <span className="text-slate-500">&bull;</span>
                <span className="font-semibold text-slate-200">{activeStage.owner}</span>
              </div>
              <h3 className="font-serif text-lg sm:text-xl font-bold text-white">{activeStage.title}</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{activeStage.summary}</p>
            </div>
            <div className="md:max-w-xs w-full p-4 rounded-xl bg-[#0C2440] border border-[#D4A843]/30 space-y-1 flex-shrink-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[#E5B552]">
                <Scale className="w-3.5 h-3.5" />
                <span>Governance Safeguard</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">{activeStage.safeguard}</p>
            </div>
          </div>
        </div>

        {/* Responsibility Split + Human Advisory Photography */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-2">
          <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* AI-Assisted Support Column */}
            <div className="p-6 rounded-2xl bg-[#071A2E]/90 border border-slate-700/80 space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                  Technology Layer
                </div>
                <h3 className="font-serif text-lg font-bold text-white">What AI Supports</h3>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-300">
                {AI_SUPPORTS.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Human Authority Column */}
            <div className="p-6 rounded-2xl bg-[#0A213C] border border-[#D4A843]/40 space-y-4">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#E5B552]">
                  Practitioner Governance
                </div>
                <h3 className="font-serif text-lg font-bold text-white">What Professionals Own</h3>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-200">
                {HUMAN_AUTHORITY.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#E5B552] flex-shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Accountability Statement */}
            <div className="md:col-span-2 p-4 sm:p-5 rounded-xl bg-[#06182B] border border-slate-800 text-xs text-slate-300 leading-relaxed">
              <strong className="text-white font-semibold">Professional Accountability Commitment:</strong>{' '}
              All tax preparation, accounting, advisory, and filing activities at Destria Tax Services, LLC remain subject to qualified professional review, formal engagement terms, explicit client authorization, and applicable federal and state regulatory requirements.
            </div>
          </div>

          <div className="lg:col-span-5">
            <EditorialSplitImage
              srcJpg={BRAND_ASSETS.privateConsultationExpJpg}
              srcWebp={BRAND_ASSETS.privateConsultationExpWebp}
              alt="Destria Tax Services advisor consulting confidentially with a client on structured tax planning"
              caption="Direct Human Advisory & Accountability"
              tag="Credentialed Oversight"
              aspectRatio="4/3"
            />
          </div>
        </div>
      </div>
    </section>
  );
};
