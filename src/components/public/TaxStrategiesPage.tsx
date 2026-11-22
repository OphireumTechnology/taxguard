import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { TaxStrategyRecord, StrategyCategory } from '../../types';
import {
  INITIAL_TAX_STRATEGIES,
  STRATEGY_CATEGORIES_MAP,
} from '../../data/taxStrategiesData';
import {
  ShieldCheck,
  Search,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Plus,
  Edit3,
  UserCheck,
  FileText,
  ArrowRight,
  X,
} from 'lucide-react';
import { useInViewMotion } from './home/useInViewMotion';
import { StrategyAmbientBackdrop } from './tax-strategies/StrategyAmbientBackdrop';
import { TaxStrategyHeroVisual } from './tax-strategies/TaxStrategyHeroVisual';
import { TransparentGovernanceNetwork } from './tax-strategies/TransparentGovernanceNetwork';
import { StrategyCategoryCard } from './tax-strategies/StrategyCategoryCard';
import { STRATEGY_CATEGORY_VISUALS } from './tax-strategies/strategyVisualAssets';

export const TaxStrategiesPage: React.FC = () => {
  const { currentUser, setCurrentPage } = useApp();
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { shouldAnimate } = useInViewMotion(pageRef, '200px 0px');

  // Strategy records state initialized with authoritative data
  const [strategies, setStrategies] = useState<TaxStrategyRecord[]>(
    INITIAL_TAX_STRATEGIES
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStrategy, setSelectedStrategy] =
    useState<TaxStrategyRecord | null>(null);

  // Staff CMS Modal state
  const [isCmsOpen, setIsCmsOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] =
    useState<TaxStrategyRecord | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] =
    useState<StrategyCategory>('individuals');
  const [formSummary, setFormSummary] = useState('');
  const [formObjective, setFormObjective] = useState('');
  const [formTaxpayer, setFormTaxpayer] = useState('');
  const [formAuthorityTitle, setFormAuthorityTitle] = useState('');
  const [formCitation, setFormCitation] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formStatus, setFormStatus] = useState<
    'draft' | 'under_review' | 'approved' | 'active' | 'archived'
  >('active');

  const isStaff = Boolean(
    currentUser &&
      [
        'admin',
        'super_admin',
        'senior_reviewer',
        'reviewer',
        'accountant',
      ].includes(currentUser.role)
  );
  const canApprove = Boolean(
    currentUser &&
      ['admin', 'super_admin', 'senior_reviewer'].includes(currentUser.role)
  );

  // Filtered strategies (preserves exact search & category filter behavior)
  const filteredStrategies = useMemo(() => {
    return strategies.filter((strat) => {
      const matchesCategory =
        selectedCategory === 'all' || strat.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        strat.strategyName.toLowerCase().includes(q) ||
        strat.plainLanguageSummary.toLowerCase().includes(q) ||
        strat.taxObjective.toLowerCase().includes(q) ||
        strat.officialAuthority.codeCitation.toLowerCase().includes(q) ||
        strat.eligibleTaxpayerType.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [strategies, selectedCategory, searchQuery]);

  // Handle opening staff CMS modal
  const handleOpenCms = (strat?: TaxStrategyRecord) => {
    if (strat) {
      setEditingStrategy(strat);
      setFormName(strat.strategyName);
      setFormCategory(strat.category);
      setFormSummary(strat.plainLanguageSummary);
      setFormObjective(strat.taxObjective);
      setFormTaxpayer(strat.eligibleTaxpayerType);
      setFormAuthorityTitle(strat.officialAuthority.title);
      setFormCitation(strat.officialAuthority.codeCitation);
      setFormUrl(strat.officialAuthority.url);
      setFormStatus(strat.status);
    } else {
      setEditingStrategy(null);
      setFormName('');
      setFormCategory('individuals');
      setFormSummary('');
      setFormObjective('');
      setFormTaxpayer('');
      setFormAuthorityTitle('');
      setFormCitation('');
      setFormUrl('');
      setFormStatus('draft');
    }
    setIsCmsOpen(true);
  };

  // Handle saving strategy via staff CMS
  const handleSaveStrategy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSummary.trim()) return;

    if (editingStrategy) {
      const updated: TaxStrategyRecord = {
        ...editingStrategy,
        strategyName: formName,
        category: formCategory,
        plainLanguageSummary: formSummary,
        taxObjective: formObjective || editingStrategy.taxObjective,
        eligibleTaxpayerType:
          formTaxpayer || editingStrategy.eligibleTaxpayerType,
        officialAuthority: {
          title: formAuthorityTitle || editingStrategy.officialAuthority.title,
          codeCitation:
            formCitation || editingStrategy.officialAuthority.codeCitation,
          url: formUrl || editingStrategy.officialAuthority.url,
        },
        status: formStatus,
        lastReviewedDate: new Date().toISOString().split('T')[0],
        version: `${parseInt(editingStrategy.version.split('.')[0] || '1', 10) + 1}.0.0`,
      };

      if (formStatus === 'approved' && canApprove) {
        updated.approvalHistory = [
          ...updated.approvalHistory,
          {
            version: updated.version,
            approvedBy: `${currentUser?.name} (${currentUser?.role})`,
            approvedDate: new Date().toISOString().split('T')[0],
            notes: 'Formally approved through internal governance protocol',
          },
        ];
      }

      setStrategies((prev) =>
        prev.map((s) => (s.id === updated.id ? updated : s))
      );
      if (selectedStrategy?.id === updated.id) {
        setSelectedStrategy(updated);
      }
    } else {
      const newStrat: TaxStrategyRecord = {
        id: `strat_${Date.now()}`,
        strategyName: formName,
        category: formCategory,
        plainLanguageSummary: formSummary,
        eligibleTaxpayerType: formTaxpayer || 'General Qualifying Taxpayer',
        taxObjective:
          formObjective || 'Tax minimization and statutory compliance',
        applicableTaxYear: '2025 / 2026',
        jurisdiction: 'Federal (IRS) & South Carolina DOR',
        requiredDocuments: [
          'Prior Year Tax Return',
          'Applicable Form Workpapers',
        ],
        workflowChecklist: [
          {
            id: 'step_1',
            step: 'Client eligibility verification',
            requiredRole: 'accountant',
          },
          {
            id: 'step_2',
            step: 'Document review and substantiation',
            requiredRole: 'accountant',
          },
          {
            id: 'step_3',
            step: 'Senior reviewer sign-off',
            requiredRole: 'reviewer',
          },
        ],
        potentialBenefits: [
          'Significant tax liability reduction',
          'Fully compliant with Internal Revenue Code',
        ],
        materialRisksAndLimitations: [
          'Requires accurate client records',
          'Subject to statutory caps and phase-outs',
        ],
        officialAuthority: {
          title: formAuthorityTitle || 'Internal Revenue Code Authority',
          codeCitation: formCitation || '26 U.S.C.',
          url: formUrl || 'https://www.irs.gov',
        },
        status: formStatus,
        assignedProfessional: currentUser?.name || 'Elena Rostova, CPA',
        clientSuitabilityAssessment:
          'Assessed on an individual basis during confidential consultation.',
        professionalReviewRequirement: true,
        approvalHistory: [
          {
            version: '1.0.0',
            approvedBy: currentUser?.name || 'Desmond Hinds, CEO',
            approvedDate: new Date().toISOString().split('T')[0],
            notes: 'Initial drafted tax strategy entry',
          },
        ],
        expirationDate: '2026-12-31',
        lastReviewedDate: new Date().toISOString().split('T')[0],
        version: '1.0.0',
      };
      setStrategies((prev) => [newStrat, ...prev]);
    }

    setIsCmsOpen(false);
  };

  const categories = Object.keys(STRATEGY_CATEGORIES_MAP) as StrategyCategory[];
  const selectedVisual = selectedStrategy
    ? STRATEGY_CATEGORY_VISUALS[selectedStrategy.category]
    : null;

  return (
    <div
      ref={pageRef}
      className={`relative min-h-screen bg-[#06182B] text-[#F8FAFC] py-10 sm:py-14 px-4 sm:px-6 lg:px-8 overflow-x-clip ${
        shouldAnimate ? '' : 'destria-motion-paused'
      }`}
    >
      {/* Restrained Page-Level Technology Backdrop */}
      <StrategyAmbientBackdrop shouldAnimate={shouldAnimate} />

      <div className="relative z-10 max-w-7xl mx-auto space-y-10 sm:space-y-12">
        {/* 1. ADVANCED HERO SECTION */}
        <header className="space-y-6 border-b border-slate-700/50 pb-9 sm:pb-11">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold tracking-[0.16em] text-[#E5B552] uppercase">
              U.S. Tax Planning Resource Center · Destria Tax Services LLC
            </p>

            {isStaff && (
              <button
                type="button"
                onClick={() => handleOpenCms()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#D4A843] text-[#06182B] text-xs font-bold hover:bg-[#E1BB60] transition shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Strategy (Staff CMS)</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            {/* Left Column: Clean, Unobstructed Authoritative Typography */}
            <div className="lg:col-span-7 space-y-5">
              <div className="space-y-3">
                <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#F8FAFC] tracking-tight leading-[1.12] [text-wrap:balance]">
                  Comprehensive Tax Strategy Center
                </h1>
                <p className="text-sm sm:text-base font-semibold text-[#E5B552] tracking-wide">
                  Intelligent Tax Planning. Transparent Governance. Professional Confidence.
                </p>
                <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed max-w-2xl">
                  Explore professionally governed U.S. tax-planning strategies organized by entity type, industry, jurisdiction, and planning objective. Every strategy requires eligibility review and approval by an authorized tax professional.
                </p>
              </div>

              {/* Upgraded Statutory Notice & IRS Circular 230 Compliance Panel */}
              <div
                role="note"
                aria-label="Statutory Notice and IRS Circular 230"
                className="relative rounded-2xl bg-[#091E36]/92 border border-[#D4A843]/45 p-4 sm:p-5 flex items-start gap-3.5 shadow-[0_12px_32px_-20px_rgba(212,168,67,0.35)] overflow-hidden"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/65 to-transparent"
                  aria-hidden="true"
                />
                <div className="w-9 h-9 rounded-lg bg-[#06182B] border border-[#D4A843]/45 flex items-center justify-center text-[#E5B552] shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="space-y-1.5">
                  <h2 className="text-xs font-semibold text-[#F8FAFC] tracking-wide">
                    Statutory Notice &amp; Professional Review Requirement (IRS Circular 230)
                  </h2>
                  <p className="text-[#A9B7C8] text-xs leading-relaxed">
                    The tax planning strategies indexed below represent general educational frameworks under the Internal Revenue Code and South Carolina Department of Revenue guidelines. No strategy may be claimed on a return without human CPA eligibility verification.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column: Cinematic Financial Technology Visualization */}
            <div className="lg:col-span-5">
              <TaxStrategyHeroVisual shouldAnimate={shouldAnimate} />
            </div>
          </div>
        </header>

        {/* 2. TRANSPARENT TAX STRATEGY GOVERNANCE SECTION */}
        <TransparentGovernanceNetwork shouldAnimate={shouldAnimate} />

        {/* 3. MODERNIZED SEARCH & 16 CATEGORY FILTERS */}
        <section
          id="strategy-directory"
          aria-label="Search and filter tax strategies"
          className="rounded-2xl bg-[#071B31]/88 backdrop-blur-md border border-slate-700/60 p-5 sm:p-6 space-y-5 shadow-[0_16px_44px_-28px_rgba(2,13,24,0.85)] scroll-mt-24"
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
            <div className="relative flex-1">
              <label htmlFor="tax-strategy-search" className="sr-only">
                Search tax strategies by name, IRS code, objective, or entity type
              </label>
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-[#D4A843]" />
              <input
                id="tax-strategy-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search strategies by name, IRS code (e.g. § 179, § 1031, § 280A), objective, or entity type..."
                className="w-full pl-11 pr-10 py-3 rounded-xl bg-[#06182B]/95 border border-slate-700/80 text-sm text-[#F8FAFC] placeholder-[#7F91A6] focus:outline-none focus:border-[#D4A843] focus:ring-2 focus:ring-[#D4A843]/25 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search query"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-[#7F91A6] hover:text-[#F8FAFC] hover:bg-[#102D4F] transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
              <span className="text-xs text-[#A9B7C8] whitespace-nowrap">
                Indexed Frameworks:
              </span>
              <span className="font-mono text-xs font-semibold text-[#E5B552] bg-[#06182B] px-3.5 py-2.5 rounded-xl border border-[#D4A843]/35 tabular-nums whitespace-nowrap">
                {filteredStrategies.length}{' '}
                {filteredStrategies.length === 1 ? 'Strategy' : 'Strategies'}
              </span>
            </div>
          </div>

          {/* 16 Interactive Category Chips */}
          <div
            role="group"
            aria-label="Filter by tax strategy category"
            className="flex flex-wrap gap-2 border-t border-slate-700/45 pt-4"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              aria-pressed={selectedCategory === 'all'}
              className={`px-3.5 py-2 rounded-lg text-xs transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] ${
                selectedCategory === 'all'
                  ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-[0_6px_20px_-8px_rgba(212,168,67,0.65)]'
                  : 'bg-[#06182B]/90 text-[#A9B7C8] font-medium border border-slate-700/70 hover:border-[#D4A843]/55 hover:text-[#F8FAFC] hover:bg-[#0D2745]'
              }`}
            >
              All 16 Categories ({strategies.length})
            </button>

            {categories.map((cat) => {
              const count = strategies.filter((s) => s.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  aria-pressed={isSelected}
                  className={`px-3 py-2 rounded-lg text-xs transition-all inline-flex items-center gap-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5B552] ${
                    isSelected
                      ? 'bg-[#D4A843] text-[#06182B] font-bold shadow-[0_6px_20px_-8px_rgba(212,168,67,0.65)]'
                      : 'bg-[#06182B]/90 text-[#A9B7C8] font-medium border border-slate-700/70 hover:border-[#D4A843]/55 hover:text-[#F8FAFC] hover:bg-[#0D2745]'
                  }`}
                >
                  <span>{STRATEGY_CATEGORIES_MAP[cat]?.label}</span>
                  <span
                    className={`font-mono text-[10px] tabular-nums px-1.5 py-0.5 rounded ${
                      isSelected
                        ? 'bg-[#06182B]/90 text-[#E5B552]'
                        : 'bg-[#0D2745] text-slate-400'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 4. REDESIGNED 16 TAX STRATEGY CARDS GRID */}
        <section aria-label="Tax strategy frameworks catalog">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStrategies.map((strat) => (
              <StrategyCategoryCard
                key={strat.id}
                strategy={strat}
                isStaff={isStaff}
                shouldAnimate={shouldAnimate}
                onViewDossier={setSelectedStrategy}
                onEditStrategy={handleOpenCms}
              />
            ))}
          </div>

          {filteredStrategies.length === 0 && (
            <div className="text-center py-16 bg-[#091E36]/90 rounded-2xl border border-slate-700/60 space-y-4">
              <BookOpen className="w-10 h-10 text-[#7F91A6] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#F8FAFC]">
                  No strategies match your criteria
                </h3>
                <p className="text-xs text-[#A9B7C8]">
                  Try adjusting your keyword search or select &quot;All 16 Categories&quot;.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="px-4 py-2 rounded-xl bg-[#102D4F] border border-[#D4A843]/40 text-xs font-semibold text-[#E5B552] hover:bg-[#143657] transition"
              >
                Reset Filters
              </button>
            </div>
          )}
        </section>

        {/* 5. CONSULTATION CALL TO ACTION */}
        <section
          aria-label="Schedule tax strategy consultation"
          className="relative rounded-2xl bg-gradient-to-r from-[#091E36] via-[#0D2745] to-[#0A213C] border border-[#D4A843]/45 p-7 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_20px_60px_-28px_rgba(2,13,24,0.92)] overflow-hidden"
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/70 to-transparent"
            aria-hidden="true"
          />
          <div className="space-y-2 text-center sm:text-left">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#E5B552]">
              Confidential Advisory Engagement
            </p>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#F8FAFC]">
              Ready to Formulate Your Personalized Tax Strategy?
            </h2>
            <p className="text-xs sm:text-sm text-[#A9B7C8] max-w-2xl leading-relaxed">
              Book a direct consultation with Founder Desmond Hinds or our Senior Reviewers in Columbia, SC or via secure virtual video meeting. We review your entity structures, prior returns, and long-term financial legacy.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('book_consultation')}
            className="px-6 py-3.5 rounded-xl bg-[#D4A843] text-[#06182B] font-bold text-xs sm:text-sm hover:bg-[#E1BB60] transition whitespace-nowrap shadow-lg inline-flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span>Schedule Strategy Consultation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      </div>

      {/* DETAIL MODAL / DOSSIER */}
      {selectedStrategy && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="strategy-dossier-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020D18]/80 backdrop-blur-sm overflow-y-auto"
        >
          <div className="bg-[#091C33] border border-[#D4A843]/50 rounded-2xl max-w-3xl w-full overflow-hidden max-h-[90vh] flex flex-col relative shadow-2xl">
            {/* Compact visual banner header inside Dossier */}
            {selectedVisual && (
              <div className="relative h-32 sm:h-40 w-full shrink-0 overflow-hidden bg-[#051426] border-b border-slate-700/60">
                <picture>
                  <source srcSet={selectedVisual.webp} type="image/webp" />
                  <img
                    src={selectedVisual.jpg}
                    alt={selectedVisual.alt}
                    className="w-full h-full object-cover object-center opacity-80"
                    referrerPolicy="no-referrer"
                  />
                </picture>
                <div className="absolute inset-0 bg-gradient-to-t from-[#091C33] via-[#091C33]/40 to-transparent" />
                <button
                  type="button"
                  onClick={() => setSelectedStrategy(null)}
                  aria-label="Close strategy dossier"
                  className="absolute top-3.5 right-3.5 p-2 rounded-lg bg-[#06182B]/85 border border-slate-700/70 text-slate-300 hover:text-white hover:border-[#D4A843]/60 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-700/60 pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#E5B552]">
                      {STRATEGY_CATEGORIES_MAP[selectedStrategy.category]?.label}
                    </span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">
                      Version {selectedStrategy.version}
                    </span>
                    <span className="text-slate-600" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      Status:{' '}
                      <strong className="text-emerald-400 capitalize">
                        {selectedStrategy.status}
                      </strong>
                    </span>
                  </div>
                  <h2
                    id="strategy-dossier-title"
                    className="font-serif text-2xl sm:text-3xl font-bold text-white"
                  >
                    {selectedStrategy.strategyName}
                  </h2>
                </div>
                {!selectedVisual && (
                  <button
                    type="button"
                    onClick={() => setSelectedStrategy(null)}
                    aria-label="Close strategy dossier"
                    className="p-1.5 rounded-lg bg-[#0D2340] text-slate-400 hover:text-white transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Objective & Overview */}
              <div className="space-y-4 text-xs sm:text-sm">
                <div className="p-4 rounded-xl bg-[#0D2340] border border-slate-700/60 space-y-2">
                  <span className="text-xs font-bold text-[#E5B552] uppercase tracking-wider block">
                    Strategic Tax Objective
                  </span>
                  <p className="text-slate-200 leading-relaxed">
                    {selectedStrategy.taxObjective}
                  </p>
                </div>

                <div>
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Plain-Language Summary
                  </span>
                  <p className="text-slate-300 leading-relaxed">
                    {selectedStrategy.plainLanguageSummary}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-[#07172B] p-3.5 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block">
                      Eligible Taxpayer Type
                    </span>
                    <p className="text-slate-200 text-xs">
                      {selectedStrategy.eligibleTaxpayerType}
                    </p>
                  </div>
                  <div className="bg-[#07172B] p-3.5 rounded-xl border border-slate-700/60 space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 block">
                      Jurisdiction &amp; Authority
                    </span>
                    <p className="text-slate-200 text-xs">
                      {selectedStrategy.jurisdiction}
                    </p>
                  </div>
                </div>

                {/* Official Authority Link */}
                <div className="p-3.5 rounded-xl bg-[#07172B] border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                      Official Statutory Authority
                    </span>
                    <p className="text-xs text-white font-mono font-medium">
                      {selectedStrategy.officialAuthority.codeCitation}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {selectedStrategy.officialAuthority.title}
                    </p>
                  </div>
                  <a
                    href={selectedStrategy.officialAuthority.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#E5B552] hover:text-white font-semibold underline whitespace-nowrap"
                  >
                    <span>Verify at IRS.gov</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                {/* Benefits & Risks */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Potential Benefits</span>
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {selectedStrategy.potentialBenefits.map((b, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold">•</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Material Risks &amp; Limitations</span>
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {selectedStrategy.materialRisksAndLimitations.map(
                        (r, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-amber-400 font-bold">•</span>
                            <span>{r}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                </div>

                {/* Workflow Checklist */}
                <div className="space-y-2 pt-2 border-t border-slate-700/60">
                  <span className="text-xs font-bold text-[#E5B552] uppercase tracking-wider block">
                    Implementation Workflow &amp; Governance Checklist
                  </span>
                  <div className="space-y-2">
                    {selectedStrategy.workflowChecklist.map((step, idx) => (
                      <div
                        key={step.id || idx}
                        className="p-2.5 rounded-lg bg-[#07172B] border border-slate-700/60 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-[#0D2340] text-[#E5B552] flex items-center justify-center font-bold text-[10px] shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-slate-200">{step.step}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#0D2340] text-slate-400 uppercase font-mono shrink-0">
                          Role: {step.requiredRole}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Required Documents */}
                <div className="space-y-2 pt-2 border-t border-slate-700/60">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                    Required Documentation for Execution
                  </span>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                    {selectedStrategy.requiredDocuments.map((doc, idx) => (
                      <li
                        key={idx}
                        className="p-2.5 rounded-lg bg-[#07172B] border border-slate-700/60 flex items-center gap-2"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#D4A843] shrink-0" />
                        <span className="truncate">{doc}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suitability & Human Review */}
                <div className="p-4 rounded-xl bg-[#0D2340] border border-[#D4A843]/40 space-y-2 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[#E5B552]">
                      Assigned Professional &amp; Review Requirement
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Human CPA Verification Mandatory</span>
                    </span>
                  </div>
                  <p className="text-slate-300">
                    <strong>Assigned Lead:</strong>{' '}
                    {selectedStrategy.assignedProfessional}
                  </p>
                  <p className="text-slate-300">
                    <strong>Suitability Criteria:</strong>{' '}
                    {selectedStrategy.clientSuitabilityAssessment}
                  </p>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-700/60 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[11px] text-slate-400">
                  Last reviewed: {selectedStrategy.lastReviewedDate} ·
                  Expiration: {selectedStrategy.expirationDate}
                </span>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStrategy(null);
                      setCurrentPage('book_consultation');
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#D4A843] text-[#06182B] font-bold text-xs hover:bg-[#E1BB60] transition"
                  >
                    Book Strategy Review
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStrategy(null)}
                    className="px-4 py-2.5 rounded-xl bg-[#0D2340] text-slate-300 font-semibold text-xs hover:bg-[#1E3A5F] transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAFF CONTENT-MANAGEMENT SYSTEM (CMS) MODAL */}
      {isCmsOpen && isStaff && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
        >
          <div className="bg-[#0B1E36] border border-[#D4A843]/60 rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#E5B552]" />
                <span>
                  {editingStrategy
                    ? 'Edit Strategy Record'
                    : 'Author New Tax Strategy Record'}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCmsOpen(false)}
                aria-label="Close staff CMS modal"
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStrategy} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">
                    Strategy Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. S-Corp Reasonable Compensation"
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#D4A843] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">
                    Category (1 of 16 Domains)
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) =>
                      setFormCategory(e.target.value as StrategyCategory)
                    }
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#D4A843] outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {STRATEGY_CATEGORIES_MAP[cat]?.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">
                  Plain-Language Summary
                </label>
                <textarea
                  rows={2}
                  required
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="Concise, clear explanation for taxpayer comprehension..."
                  className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#D4A843] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">
                    Strategic Tax Objective
                  </label>
                  <input
                    type="text"
                    value={formObjective}
                    onChange={(e) => setFormObjective(e.target.value)}
                    placeholder="e.g. FICA tax savings, accelerated depreciation"
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#D4A843] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">
                    Eligible Taxpayer Type
                  </label>
                  <input
                    type="text"
                    value={formTaxpayer}
                    onChange={(e) => setFormTaxpayer(e.target.value)}
                    placeholder="e.g. S-Corporations, High-Earner W-2s"
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#D4A843] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">
                    Code Citation
                  </label>
                  <input
                    type="text"
                    value={formCitation}
                    onChange={(e) => setFormCitation(e.target.value)}
                    placeholder="e.g. 26 U.S.C. § 179"
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#D4A843] outline-none"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-slate-300 font-semibold">
                    Official Authority URL
                  </label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={(e) => setFormUrl(e.target.value)}
                    placeholder="https://www.irs.gov/..."
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#D4A843] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">
                  Governance Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) =>
                    setFormStatus(
                      e.target.value as
                        | 'draft'
                        | 'under_review'
                        | 'approved'
                        | 'active'
                        | 'archived'
                    )
                  }
                  className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#D4A843] outline-none"
                >
                  <option value="draft">Draft (Internal Only)</option>
                  <option value="under_review">Under Senior Review</option>
                  <option value="approved">Approved</option>
                  <option value="active">Active (Public Catalog)</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="pt-3 border-t border-[#1E3A5F] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCmsOpen(false)}
                  className="px-4 py-2 rounded-xl bg-[#0D2340] text-slate-300 font-semibold hover:bg-[#1E3A5F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#D4A843] text-[#06182B] font-bold hover:bg-[#E1BB60] transition"
                >
                  Save Strategy Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
