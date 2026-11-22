import React, { useMemo, useRef, useState } from 'react';
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
import { useInViewMotion } from './useInViewMotion';
import { EcosystemNetworkBackdrop } from './EcosystemNetworkBackdrop';
import {
  FinancialIntelligenceCore,
  INTELLIGENCE_PIPELINE_STAGES,
} from './FinancialIntelligenceCore';
import {
  CapabilityCardVisual,
  type CapabilityVisualId,
} from './CapabilityCardVisual';

type CapabilityDomain = 'all' | 'tax' | 'accounting' | 'governance';

interface CapabilityCardItem {
  id: CapabilityVisualId;
  number: string;
  title: string;
  domain: Exclude<CapabilityDomain, 'all'>;
  statusLabel:
    | 'Active Platform Workflow'
    | 'Guided Practice Capability'
    | 'Developing Capability';
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
    detail:
      'All tax positions and return assemblies require credentialed human verification.',
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
    detail:
      'Extracted fields are staged as draft references pending preparer confirmation.',
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
    detail:
      'Supports structured book-to-tax schedules reviewed by accounting staff.',
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
    detail:
      'Structured for continuity between monthly accounting and annual compliance.',
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
    detail:
      'Advisory models are tailored individually within a formal client engagement.',
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
    detail:
      'Maintains clear document provenance from client upload through archive.',
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
    detail:
      'Human accountability governs every compliance and advisory outcome.',
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
  const sectionRef = useRef<HTMLElement | null>(null);
  const { shouldAnimate } = useInViewMotion(sectionRef);

  const [activeFilter, setActiveFilter] = useState<CapabilityDomain>('all');
  const [hoveredCapabilityId, setHoveredCapabilityId] = useState<string | null>(
    null
  );
  const [selectedStageIndex, setSelectedStageIndex] = useState<number | null>(
    null
  );

  const visibleCards = useMemo(
    () =>
      activeFilter === 'all'
        ? CAPABILITIES
        : CAPABILITIES.filter((item) => item.domain === activeFilter),
    [activeFilter]
  );

  const stageHighlightedIds = useMemo(() => {
    if (selectedStageIndex === null) return new Set<string>();
    const stage = INTELLIGENCE_PIPELINE_STAGES.find(
      (s) => s.index === selectedStageIndex
    );
    return new Set<string>(stage ? stage.capabilityIds : []);
  }, [selectedStageIndex]);

  const handleFilterChange = (domain: CapabilityDomain) => {
    setActiveFilter(domain);
    setSelectedStageIndex(null);
  };

  return (
    <section
      ref={sectionRef}
      id="intelligent-capabilities"
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28 ${
        shouldAnimate ? '' : 'destria-motion-paused'
      }`}
      aria-labelledby="capabilities-heading"
    >
      <div className="relative rounded-[28px] bg-[#051527]/90 border border-slate-700/55 px-5 py-8 sm:px-8 sm:py-11 lg:px-10 lg:py-12 overflow-hidden shadow-[0_24px_80px_-32px_rgba(2,13,24,0.92)]">
        {/* Top subtle gold architectural edge illumination */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4A843]/60 to-transparent"
          aria-hidden="true"
        />

        {/* Animated Blockchain-Inspired Conceptual Transparency Network Backdrop */}
        <EcosystemNetworkBackdrop
          activeCapabilityId={hoveredCapabilityId}
          highlightedCapabilityIds={stageHighlightedIds}
          shouldAnimate={shouldAnimate}
        />

        <div className="relative z-10">
          {/* Section Header & Domain Filter Controls */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 sm:mb-10">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.16em] text-[#E5B552] uppercase">
                The Intelligent Financial Technology Ecosystem
              </p>
              <h2
                id="capabilities-heading"
                className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight leading-tight [text-wrap:balance]"
              >
                Advanced Intelligence. Transparent Processes. Professional Accountability.
              </h2>
              <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
                Discover an interconnected financial technology ecosystem designed to combine intelligent automation, structured financial workflows, secure information management and independent professional oversight.
              </p>
            </div>

            {/* Interactive Domain Filter Bar */}
            <div
              role="tablist"
              aria-label="Filter intelligence capabilities"
              className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#071B31]/90 backdrop-blur-md border border-slate-700/70 self-start lg:self-end"
            >
              {FILTER_TABS.map((tab) => {
                const selected = activeFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => handleFilterChange(tab.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] ${
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

          {/* Connected Destria Financial Intelligence Core */}
          <FinancialIntelligenceCore
            activeStageIndex={selectedStageIndex}
            activeCapabilityId={hoveredCapabilityId}
            onSelectStage={setSelectedStageIndex}
            shouldAnimate={shouldAnimate}
          />

          {/* 9-Card Interactive Technology Ecosystem Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {visibleCards.map((cap) => {
              const isDeveloping = cap.statusLabel === 'Developing Capability';
              const isGuided = cap.statusLabel === 'Guided Practice Capability';
              const isHighlighted =
                hoveredCapabilityId === cap.id ||
                stageHighlightedIds.has(cap.id);
              const isDimmedByStage =
                selectedStageIndex !== null &&
                !stageHighlightedIds.has(cap.id) &&
                hoveredCapabilityId !== cap.id;

              return (
                <article
                  key={cap.id}
                  tabIndex={0}
                  onMouseEnter={() => setHoveredCapabilityId(cap.id)}
                  onMouseLeave={() =>
                    setHoveredCapabilityId((prev) =>
                      prev === cap.id ? null : prev
                    )
                  }
                  onFocus={() => setHoveredCapabilityId(cap.id)}
                  onBlur={() =>
                    setHoveredCapabilityId((prev) =>
                      prev === cap.id ? null : prev
                    )
                  }
                  className={`group relative rounded-2xl bg-[#081C33]/88 backdrop-blur-md border flex flex-col justify-between transition-all duration-300 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] ${
                    isHighlighted
                      ? 'border-[#D4A843]/75 shadow-[0_18px_48px_-22px_rgba(212,168,67,0.38)] -translate-y-0.5'
                      : 'border-slate-700/65 hover:border-[#D4A843]/60 hover:-translate-y-0.5'
                  } ${isDimmedByStage ? 'opacity-65' : 'opacity-100'}`}
                >
                  {/* Controlled top border light accent on hover/focus */}
                  <div
                    className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#E5B552]/85 to-transparent transition-opacity duration-300 ${
                      isHighlighted
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100'
                    }`}
                    aria-hidden="true"
                  />

                  <div>
                    {/* Unique Capability Technology Visual & Micro-Overlay */}
                    <CapabilityCardVisual
                      id={cap.id}
                      number={cap.number}
                      icon={cap.icon}
                      isHighlighted={isHighlighted}
                      shouldAnimate={shouldAnimate}
                    />

                    {/* Card Narrative Content */}
                    <div className="px-5 pt-5 pb-4 sm:px-6 sm:pt-5 space-y-2.5">
                      <h3
                        className={`font-serif text-lg sm:text-xl font-bold leading-snug transition-colors ${
                          isHighlighted
                            ? 'text-[#E5B552]'
                            : 'text-white group-hover:text-[#E5B552]'
                        }`}
                      >
                        {cap.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-[#A9B7C8] leading-relaxed">
                        {cap.description}
                      </p>
                    </div>
                  </div>

                  {/* Clean Unboxed Status & Human Oversight Metadata Footer */}
                  <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-3.5 mt-auto border-t border-slate-700/55 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px]">
                      <span
                        className={
                          isDeveloping
                            ? 'font-semibold text-sky-300'
                            : isGuided
                              ? 'font-semibold text-[#E8C97A]'
                              : 'font-semibold text-[#E5B552]'
                        }
                      >
                        {cap.statusLabel}
                      </span>
                      <span className="text-slate-400">
                        Human Supervised
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {cap.detail}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Transparency & Governance Footer */}
          <div className="mt-8 sm:mt-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-6 border-t border-slate-700/55 text-xs text-[#A9B7C8]">
            <div className="space-y-1 max-w-3xl">
              <p>
                Developing capabilities reflect active architectural enhancements and are introduced only after internal governance verification.
              </p>
              <p className="text-[11px] text-slate-400">
                Network pathways and core diagrams are conceptual illustrations representing structured workflow transparency and independent professional oversight rather than distributed blockchain storage.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage('services')}
              className="inline-flex items-center gap-1.5 font-semibold text-[#E5B552] hover:text-white transition-colors whitespace-nowrap shrink-0 self-start lg:self-auto"
            >
              <span>Explore Practice Service Catalog</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
