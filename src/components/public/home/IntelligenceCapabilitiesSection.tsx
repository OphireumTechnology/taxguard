import React, { useState } from 'react';
import {
  BrainCircuit,
  ScanText,
  GitCompareArrows,
  Scale,
  AlertTriangle,
  BookOpenCheck,
  LineChart,
  FolderLock,
  UserCheck,
  ArrowUpRight,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';

type CapabilityDomain = 'all' | 'tax' | 'accounting' | 'governance';

interface CapabilityCardItem {
  id: string;
  number: string;
  title: string;
  domain: Exclude<CapabilityDomain, 'all'>;
  statusLabel: 'Active Platform Workflow' | 'Guided Practice Capability' | 'Developing Capability';
  description: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CAPABILITIES: CapabilityCardItem[] = [
  {
    id: 'ai-tax-prep',
    number: '01',
    title: 'AI-Assisted Tax Preparation',
    domain: 'tax',
    statusLabel: 'Guided Practice Capability',
    description:
      'Structures individual and business tax packages by organizing intake questionnaires, source forms, and review checklists for preparers.',
    detail: 'All tax positions and return assemblies require credentialed human verification.',
    icon: BrainCircuit,
  },
  {
    id: 'doc-recognition',
    number: '02',
    title: 'Intelligent Document Recognition',
    domain: 'tax',
    statusLabel: 'Developing Capability',
    description:
      'Designed to classify W-2, 1099, K-1, and supporting statements automatically and highlight key reporting lines for intake staff.',
    detail: 'Extracted fields are staged as draft references pending preparer confirmation.',
    icon: ScanText,
  },
  {
    id: 'auto-reconciliation',
    number: '03',
    title: 'Automated Financial Reconciliation',
    domain: 'accounting',
    statusLabel: 'Guided Practice Capability',
    description:
      'Cross-checks ledger entries, trial balance groupings, and supporting workpapers to surface timing differences before period close.',
    detail: 'Supports structured book-to-tax schedules reviewed by accounting staff.',
    icon: GitCompareArrows,
  },
  {
    id: 'tax-compliance',
    number: '04',
    title: 'Tax Compliance Assistance',
    domain: 'tax',
    statusLabel: 'Active Platform Workflow',
    description:
      'Tracks federal and multi-state filing requirements, engagement stages, and supporting source references within a unified case workflow.',
    detail: 'Anchored in a structured 18-stage practice governance model.',
    icon: Scale,
  },
  {
    id: 'anomaly-detection',
    number: '05',
    title: 'Financial Anomaly Detection',
    domain: 'accounting',
    statusLabel: 'Developing Capability',
    description:
      'Flags unusual variances, missing recurring forms, or potential misclassifications so advisors can investigate proactively.',
    detail: 'Generates review prompts rather than automated adjustments.',
    icon: AlertTriangle,
  },
  {
    id: 'intelligent-bookkeeping',
    number: '06',
    title: 'Intelligent Bookkeeping',
    domain: 'accounting',
    statusLabel: 'Active Platform Workflow',
    description:
      'Maintains organized charts of accounts, journal workflows, and period-close controls built for clean year-end tax readiness.',
    detail: 'Structured for continuity between monthly accounting and annual compliance.',
    icon: BookOpenCheck,
  },
  {
    id: 'strategic-analytics',
    number: '07',
    title: 'Strategic Financial Analytics',
    domain: 'accounting',
    statusLabel: 'Developing Capability',
    description:
      'Synthesizes multi-period financial patterns to assist advisors during entity planning, cash-flow forecasting, and quarterly reviews.',
    detail: 'Advisory models are tailored individually within a formal client engagement.',
    icon: LineChart,
  },
  {
    id: 'secure-doc-mgmt',
    number: '08',
    title: 'Secure Document Management',
    domain: 'governance',
    statusLabel: 'Active Platform Workflow',
    description:
      'Provides a client-isolated document vault with structured request tracking, version control, and controlled practitioner access.',
    detail: 'Maintains clear document provenance from client upload through archive.',
    icon: FolderLock,
  },
  {
    id: 'professional-review',
    number: '09',
    title: 'Professional Review and Oversight',
    domain: 'governance',
    statusLabel: 'Active Platform Workflow',
    description:
      'Enforces separation between preparation and independent review so qualified tax professionals verify every return before client approval.',
    detail: 'Human accountability governs every compliance and advisory outcome.',
    icon: UserCheck,
  },
];

const FILTER_TABS: Array<{ id: CapabilityDomain; label: string }> = [
  { id: 'all', label: 'All Capabilities' },
  { id: 'tax', label: 'Tax & Compliance' },
  { id: 'accounting', label: 'Accounting & Analytics' },
  { id: 'governance', label: 'Security & Oversight' },
];

export const IntelligenceCapabilitiesSection: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [activeFilter, setActiveFilter] = useState<CapabilityDomain>('all');

  const visibleCards =
    activeFilter === 'all'
      ? CAPABILITIES
      : CAPABILITIES.filter((item) => item.domain === activeFilter);

  return (
    <section
      id="intelligent-capabilities"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28"
      aria-labelledby="capabilities-heading"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 sm:mb-12">
        <div className="space-y-3 max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-[#E5B552] uppercase">
            AI Financial Intelligence
          </p>
          <h2
            id="capabilities-heading"
            className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
          >
            Intelligence Behind Every Financial Decision
          </h2>
          <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
            Nine interconnected capabilities combining structured automation with independent professional review. Each capability is transparently labeled according to its current operational status within the platform.
          </p>
        </div>

        {/* Interactive Domain Filter Bar */}
        <div
          role="tablist"
          aria-label="Filter intelligence capabilities"
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0D2745] border border-slate-700/70 self-start lg:self-end"
        >
          {FILTER_TABS.map((tab) => {
            const selected = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setActiveFilter(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  selected
                    ? 'bg-[#D4A843] text-[#06182B]'
                    : 'text-slate-300 hover:text-white hover:bg-[#102D4F]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 9-Card Technology Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {visibleCards.map((cap) => {
          const IconComp = cap.icon;
          const isDeveloping = cap.statusLabel === 'Developing Capability';
          return (
            <article
              key={cap.id}
              className="group relative rounded-2xl bg-[#0A213C] border border-slate-700/70 hover:border-[#D4A843]/60 p-6 flex flex-col justify-between gap-5 transition-all duration-200 overflow-hidden"
            >
              {/* Controlled top border light accent on hover */}
              <div
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                aria-hidden="true"
              />

              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#06182B] border border-slate-700/80 group-hover:border-[#D4A843]/50 flex items-center justify-center text-[#D4A843] transition-colors shrink-0">
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                      {cap.number}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-serif text-xl font-bold text-white group-hover:text-[#E5B552] transition-colors">
                    {cap.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#A9B7C8] leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span
                    className={
                      isDeveloping
                        ? 'font-medium text-sky-300'
                        : 'font-semibold text-[#E5B552]'
                    }
                  >
                    {cap.statusLabel}
                  </span>
                  <span className="text-slate-400">Human Supervised</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {cap.detail}
                </p>
              </div>
            </article>
          );
        })}
      </div>

      {/* Subtle footer transition link to full services */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-slate-800/80 text-xs text-[#A9B7C8]">
        <p>
          Developing capabilities reflect active architectural enhancements and are introduced only after internal governance verification.
        </p>
        <button
          type="button"
          onClick={() => setCurrentPage('services')}
          className="inline-flex items-center gap-1.5 font-semibold text-[#E5B552] hover:text-white transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
        >
          <span>Explore Practice Service Catalog</span>
          <ArrowUpRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
