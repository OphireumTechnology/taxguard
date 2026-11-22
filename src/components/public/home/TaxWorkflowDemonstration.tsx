import React, { useEffect, useRef, useState } from 'react';
import {
  UploadCloud,
  ScanLine,
  FileSpreadsheet,
  FolderTree,
  GitCompareArrows,
  Scale,
  AlertCircle,
  UserCheck,
  FileSignature,
  Archive,
  Play,
  Pause,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useInViewMotion } from './useInViewMotion';

interface WorkflowStage {
  step: number;
  title: string;
  shortTitle: string;
  phase: 'AI-Assisted Intake & Analysis' | 'Human Review & Authorization';
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  artifact: string;
  checkNote: string;
  requiresHuman: boolean;
}

const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    step: 1,
    title: 'Secure financial document submission',
    shortTitle: 'Submission',
    phase: 'AI-Assisted Intake & Analysis',
    icon: UploadCloud,
    summary: 'Clients upload source statements into an isolated, access-controlled client vault with timestamped intake logging.',
    artifact: 'Illustrative intake bundle: W-2, 1099-INT, K-1, Trial Balance',
    checkNote: 'File integrity recorded at receipt',
    requiresHuman: false,
  },
  {
    step: 2,
    title: 'Intelligent document recognition',
    shortTitle: 'Recognition',
    phase: 'AI-Assisted Intake & Analysis',
    icon: ScanLine,
    summary: 'Document layouts and form headers are scanned to identify tax schedules, issuer sections, and reporting tax year.',
    artifact: 'Form structure scan · Multi-page document index',
    checkNote: 'Legibility & page completeness verified',
    requiresHuman: false,
  },
  {
    step: 3,
    title: 'Financial data extraction',
    shortTitle: 'Extraction',
    phase: 'AI-Assisted Intake & Analysis',
    icon: FileSpreadsheet,
    summary: 'Structured line items are mapped into draft workpaper fields while retaining direct visual references to source pages.',
    artifact: 'Staged draft entries linked to source line references',
    checkNote: 'Draft extraction queued for validation',
    requiresHuman: false,
  },
  {
    step: 4,
    title: 'Document classification',
    shortTitle: 'Classification',
    phase: 'AI-Assisted Intake & Analysis',
    icon: FolderTree,
    summary: 'Records are grouped by income stream, deduction category, entity ownership, and federal or state jurisdiction.',
    artifact: 'Categorized workpaper binder · Federal & multi-state tags',
    checkNote: 'Aligned to engagement checklist',
    requiresHuman: false,
  },
  {
    step: 5,
    title: 'Financial reconciliation',
    shortTitle: 'Reconciliation',
    phase: 'AI-Assisted Intake & Analysis',
    icon: GitCompareArrows,
    summary: 'Extracted totals are cross-checked against bookkeeping ledgers, prior-year carryforwards, and supporting schedules.',
    artifact: 'Book-to-tax reconciliation summary & balance checks',
    checkNote: 'Cross-schedule arithmetic consistency checked',
    requiresHuman: false,
  },
  {
    step: 6,
    title: 'Tax compliance analysis',
    shortTitle: 'Compliance',
    phase: 'AI-Assisted Intake & Analysis',
    icon: Scale,
    summary: 'Structured checklists evaluate applicable filing requirements, elections, and statutory documentation rules.',
    artifact: 'Rule reference summary · Supporting documentation map',
    checkNote: 'Prepared for practitioner statutory analysis',
    requiresHuman: false,
  },
  {
    step: 7,
    title: 'Potential discrepancy identification',
    shortTitle: 'Discrepancies',
    phase: 'AI-Assisted Intake & Analysis',
    icon: AlertCircle,
    summary: 'Missing forms, year-over-year variances, or unresolved ledger differences are surfaced as structured review items.',
    artifact: 'Open review prompts · Missing-item follow-up list',
    checkNote: 'Routed to assigned tax practitioner',
    requiresHuman: false,
  },
  {
    step: 8,
    title: 'Human professional review',
    shortTitle: 'Human Review',
    phase: 'Human Review & Authorization',
    icon: UserCheck,
    summary: 'Qualified tax professionals independently inspect source documents, evaluate tax positions, and resolve open items.',
    artifact: 'Preparer workpapers + independent reviewer sign-off',
    checkNote: 'Mandatory human judgment & quality control',
    requiresHuman: true,
  },
  {
    step: 9,
    title: 'Client approval',
    shortTitle: 'Client Approval',
    phase: 'Human Review & Authorization',
    icon: FileSignature,
    summary: 'Clients review the finalized draft return, discuss questions with their advisor, and provide explicit written authorization.',
    artifact: 'Client review package & formal authorization record',
    checkNote: 'No filing proceeds without client approval',
    requiresHuman: true,
  },
  {
    step: 10,
    title: 'Authorized filing and record management',
    shortTitle: 'Filing & Archive',
    phase: 'Human Review & Authorization',
    icon: Archive,
    summary: 'Following professional sign-off and client authorization, filing workflows proceed and records are organized for retention.',
    artifact: 'Authorized return record & structured archive entry',
    checkNote: 'Full audit trail preserved for future reference',
    requiresHuman: true,
  },
];

export const TaxWorkflowDemonstration: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { shouldAnimate } = useInViewMotion(sectionRef);
  const [activeStep, setActiveStep] = useState(0);
  const [userPaused, setUserPaused] = useState(false);

  const isRunning = shouldAnimate && !userPaused;

  useEffect(() => {
    if (!isRunning) return;
    const id = window.setInterval(() => {
      setActiveStep((prev) => (prev + 1) % WORKFLOW_STAGES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, [isRunning]);

  const stage = WORKFLOW_STAGES[activeStep];
  const StageIcon = stage.icon;
  const progressPct = ((activeStep + 1) / WORKFLOW_STAGES.length) * 100;

  return (
    <section
      ref={sectionRef}
      id="intelligent-workflow"
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28 ${!isRunning ? 'destria-motion-paused' : ''}`}
      aria-labelledby="workflow-demo-heading"
    >
      <div className="rounded-2xl bg-[#0A213C] border border-slate-700/70 p-6 sm:p-8 lg:p-10 space-y-8 overflow-hidden">
        {/* Header Row */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <p className="text-xs font-semibold tracking-[0.14em] text-[#E5B552] uppercase">
              Intelligent Tax Processing Lifecycle · Illustrative Workflow
            </p>
            <h2
              id="workflow-demo-heading"
              className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
            >
              From Secure Document Intake to Human-Authorized Filing
            </h2>
            <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
              Observe how information progresses across ten structured stages—pairing intelligent document preparation with mandatory human professional review and explicit client authorization.
            </p>
          </div>

          {/* Playback & Step Controls */}
          <div className="flex items-center gap-2 shrink-0 self-start lg:self-end">
            <button
              type="button"
              onClick={() => setActiveStep((prev) => (prev - 1 + WORKFLOW_STAGES.length) % WORKFLOW_STAGES.length)}
              aria-label="Previous workflow stage"
              className="w-10 h-10 rounded-lg bg-[#06182B] hover:bg-[#102D4F] border border-slate-700 text-slate-200 flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setUserPaused((p) => !p)}
              aria-pressed={userPaused}
              className="h-10 px-4 rounded-lg bg-[#06182B] hover:bg-[#102D4F] border border-slate-700 text-xs font-semibold text-slate-100 inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              {userPaused ? <Play className="w-3.5 h-3.5 text-[#D4A843]" /> : <Pause className="w-3.5 h-3.5 text-[#D4A843]" />}
              <span>{userPaused ? 'Play Sequence' : 'Pause Sequence'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveStep((prev) => (prev + 1) % WORKFLOW_STAGES.length)}
              aria-label="Next workflow stage"
              className="w-10 h-10 rounded-lg bg-[#06182B] hover:bg-[#102D4F] border border-slate-700 text-slate-200 flex items-center justify-center transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Continuous Progress Track */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#A9B7C8]">
            <span className="font-mono tabular-nums text-[#E5B552]">
              Stage {String(stage.step).padStart(2, '0')} of 10
            </span>
            <span>{stage.phase}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#06182B] overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-[#3B82F6] via-[#D4A843] to-[#E5B552] transition-all duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Interactive 10-Stage Selector Grid */}
        <div
          className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3"
          role="tablist"
          aria-label="Ten tax preparation lifecycle stages"
        >
          {WORKFLOW_STAGES.map((item, idx) => {
            const Icon = item.icon;
            const isCurrent = idx === activeStep;
            const isComplete = idx < activeStep;
            return (
              <button
                key={item.step}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                onClick={() => {
                  setActiveStep(idx);
                  setUserPaused(true);
                }}
                className={`text-left rounded-xl p-3 border transition-all duration-200 flex flex-col justify-between gap-2 min-h-[82px] ${
                  isCurrent
                    ? 'bg-[#102D4F] border-[#E5B552] shadow-[0_0_24px_rgba(212,168,67,0.18)]'
                    : isComplete
                    ? 'bg-[#071A2E] border-[#D4A843]/35 hover:border-[#D4A843]/70'
                    : 'bg-[#06182B]/80 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-mono text-[11px] font-semibold tabular-nums ${
                      isCurrent ? 'text-[#E5B552]' : isComplete ? 'text-[#D4A843]' : 'text-slate-400'
                    }`}
                  >
                    {String(item.step).padStart(2, '0')}
                  </span>
                  {isComplete ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isCurrent ? 'text-[#E5B552]' : item.requiresHuman ? 'text-sky-300' : 'text-slate-400'
                      }`}
                    />
                  )}
                </div>
                <div className="text-xs font-semibold text-white leading-snug">
                  {item.shortTitle}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Stage Interactive Scanner & Detail Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch pt-2">
          {/* Left: Animated Document Scan & Verification Visualizer */}
          <div className="lg:col-span-5 rounded-xl bg-[#06182B] border border-slate-700/80 p-5 flex flex-col justify-between gap-4 relative overflow-hidden">
            {/* Scanning Light Beam */}
            <div
              className="pointer-events-none absolute inset-x-4 top-0 h-16 bg-gradient-to-b from-transparent via-[#D4A843]/20 to-transparent destria-scan-line"
              aria-hidden="true"
            />

            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-[#0D2745] border border-[#D4A843]/40 flex items-center justify-center text-[#E5B552]">
                  <StageIcon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Illustrative Processing View</div>
                  <div className="text-[11px] text-[#A9B7C8]">
                    Step {String(stage.step).padStart(2, '0')} · {stage.requiresHuman ? 'Human Gate Active' : 'Structured Assist'}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] text-[#E5B552] tabular-nums">
                {Math.round(progressPct)}%
              </span>
            </div>

            {/* Abstract Document & Validation Lines */}
            <div className="relative z-10 space-y-2.5 py-2" aria-hidden="true">
              {[
                { label: 'Source Document Reference', width: '92%', active: activeStep >= 0 },
                { label: 'Field Mapping & Classification', width: '84%', active: activeStep >= 2 },
                { label: 'Reconciliation & Variance Check', width: '78%', active: activeStep >= 4 },
                { label: 'Credentialed Human Review Gate', width: '100%', active: activeStep >= 7 },
              ].map((row, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{row.label}</span>
                    <span className={row.active ? 'text-[#E5B552]' : 'text-slate-500'}>
                      {row.active ? 'Verified in Sequence' : 'Pending Stage'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800/90 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        row.active
                          ? idx === 3
                            ? 'bg-emerald-400'
                            : 'bg-[#D4A843]'
                          : 'bg-slate-700'
                      }`}
                      style={{ width: row.active ? row.width : '18%' }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="relative z-10 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
              <span className="truncate">{stage.artifact}</span>
              <ShieldCheck className="w-4 h-4 text-[#D4A843] shrink-0 ml-2" />
            </div>
          </div>

          {/* Right: Stage Narrative & Governance Boundary */}
          <div
            className="lg:col-span-7 rounded-xl bg-[#071A2E] border border-slate-700/80 p-6 flex flex-col justify-between gap-5"
            aria-live="polite"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#E5B552] font-semibold">
                <span>Stage {String(stage.step).padStart(2, '0')}</span>
                <span aria-hidden="true">·</span>
                <span>{stage.phase}</span>
              </div>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                {stage.title}
              </h3>
              <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
                {stage.summary}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-700/70">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">Validation Checkpoint</div>
                <div className="text-xs sm:text-sm font-medium text-white">{stage.checkNote}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-400">Authority Control</div>
                <div className="text-xs sm:text-sm font-medium text-white">
                  {stage.requiresHuman
                    ? 'Required Human & Client Sign-Off'
                    : 'AI-Assisted Draft · Practitioner Verified'}
                </div>
              </div>
            </div>

            {/* Mandatory Compliance Notice */}
            <p className="text-[11px] text-slate-400 leading-relaxed pt-3 border-t border-slate-800">
              <strong className="text-slate-200">Illustrative Workflow Notice:</strong> This demonstration illustrates the conceptual structure of Destria&apos;s tax preparation lifecycle. It does not display live taxpayer data or verify production automation for every stage. Artificial intelligence never approves, signs, or files tax returns without credentialed human review and explicit client authorization.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
