import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  TaxStrategyRecord, 
  StrategyCategory, 
  TaxStrategyWorkflowStep 
} from '../../types';
import { 
  INITIAL_TAX_STRATEGIES, 
  STRATEGY_CATEGORIES_MAP 
} from '../../data/taxStrategiesData';
import { 
  ShieldCheck, 
  Search, 
  Filter, 
  BookOpen, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Plus, 
  Edit3, 
  Calendar, 
  UserCheck, 
  FileText, 
  ArrowRight, 
  ChevronRight, 
  X, 
  Clock, 
  Briefcase, 
  Building2, 
  Coins, 
  Award, 
  Lock
} from 'lucide-react';
import { BrandedButton } from '../ui/BrandedButton';
import { BRAND_ASSETS } from '../../utils/assets';
import { EditorialSplitImage } from './images';

export const TaxStrategiesPage: React.FC = () => {
  const { currentUser, setCurrentPage } = useApp();

  // Strategy records state initialized with authoritative data
  const [strategies, setStrategies] = useState<TaxStrategyRecord[]>(INITIAL_TAX_STRATEGIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStrategy, setSelectedStrategy] = useState<TaxStrategyRecord | null>(null);

  // Staff CMS Modal state
  const [isCmsOpen, setIsCmsOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<TaxStrategyRecord | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<StrategyCategory>('individuals');
  const [formSummary, setFormSummary] = useState('');
  const [formObjective, setFormObjective] = useState('');
  const [formTaxpayer, setFormTaxpayer] = useState('');
  const [formAuthorityTitle, setFormAuthorityTitle] = useState('');
  const [formCitation, setFormCitation] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formStatus, setFormStatus] = useState<'draft' | 'under_review' | 'approved' | 'active' | 'archived'>('active');

  const isStaff = currentUser && ['admin', 'super_admin', 'senior_reviewer', 'reviewer', 'accountant'].includes(currentUser.role);
  const canApprove = currentUser && ['admin', 'super_admin', 'senior_reviewer'].includes(currentUser.role);

  // Filtered strategies
  const filteredStrategies = useMemo(() => {
    return strategies.filter(strat => {
      const matchesCategory = selectedCategory === 'all' || strat.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
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
      // Update existing
      const updated: TaxStrategyRecord = {
        ...editingStrategy,
        strategyName: formName,
        category: formCategory,
        plainLanguageSummary: formSummary,
        taxObjective: formObjective || editingStrategy.taxObjective,
        eligibleTaxpayerType: formTaxpayer || editingStrategy.eligibleTaxpayerType,
        officialAuthority: {
          title: formAuthorityTitle || editingStrategy.officialAuthority.title,
          codeCitation: formCitation || editingStrategy.officialAuthority.codeCitation,
          url: formUrl || editingStrategy.officialAuthority.url
        },
        status: formStatus,
        lastReviewedDate: new Date().toISOString().split('T')[0],
        version: `${parseInt(editingStrategy.version.split('.')[0] || '1', 10) + 1}.0.0`
      };

      if (formStatus === 'approved' && canApprove) {
        updated.approvalHistory = [
          ...updated.approvalHistory,
          {
            version: updated.version,
            approvedBy: `${currentUser?.name} (${currentUser?.role})`,
            approvedDate: new Date().toISOString().split('T')[0],
            notes: 'Formally approved through internal governance protocol'
          }
        ];
      }

      setStrategies(prev => prev.map(s => s.id === updated.id ? updated : s));
      if (selectedStrategy?.id === updated.id) {
        setSelectedStrategy(updated);
      }
    } else {
      // Create new
      const newStrat: TaxStrategyRecord = {
        id: `strat_${Date.now()}`,
        strategyName: formName,
        category: formCategory,
        plainLanguageSummary: formSummary,
        eligibleTaxpayerType: formTaxpayer || 'General Qualifying Taxpayer',
        taxObjective: formObjective || 'Tax minimization and statutory compliance',
        applicableTaxYear: '2025 / 2026',
        jurisdiction: 'Federal (IRS) & South Carolina DOR',
        requiredDocuments: ['Prior Year Tax Return', 'Applicable Form Workpapers'],
        workflowChecklist: [
          { id: 'step_1', step: 'Client eligibility verification', requiredRole: 'accountant' },
          { id: 'step_2', step: 'Document review and substantiation', requiredRole: 'accountant' },
          { id: 'step_3', step: 'Senior reviewer sign-off', requiredRole: 'reviewer' }
        ],
        potentialBenefits: ['Significant tax liability reduction', 'Fully compliant with Internal Revenue Code'],
        materialRisksAndLimitations: ['Requires accurate client records', 'Subject to statutory caps and phase-outs'],
        officialAuthority: {
          title: formAuthorityTitle || 'Internal Revenue Code Authority',
          codeCitation: formCitation || '26 U.S.C.',
          url: formUrl || 'https://www.irs.gov'
        },
        status: formStatus,
        assignedProfessional: currentUser?.name || 'Elena Rostova, CPA',
        clientSuitabilityAssessment: 'Assessed on an individual basis during confidential consultation.',
        professionalReviewRequirement: true,
        approvalHistory: [
          {
            version: '1.0.0',
            approvedBy: currentUser?.name || 'Desmond Hinds, CEO',
            approvedDate: new Date().toISOString().split('T')[0],
            notes: 'Initial drafted tax strategy entry'
          }
        ],
        expirationDate: '2026-12-31',
        lastReviewedDate: new Date().toISOString().split('T')[0],
        version: '1.0.0'
      };
      setStrategies(prev => [newStrat, ...prev]);
    }

    setIsCmsOpen(false);
  };

  const categories = Object.keys(STRATEGY_CATEGORIES_MAP) as StrategyCategory[];

  return (
    <div className="min-h-screen bg-[#07172B] text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-10">
        
        {/* Header / Hero Section */}
        <header className="space-y-5 border-b border-[#1E3A5F] pb-8 sm:pb-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold tracking-wide">
              <Award className="w-3.5 h-3.5 flex-shrink-0" />
              <span>U.S. Tax Planning Resource Center</span>
            </div>

            {isStaff && (
              <button
                onClick={() => handleOpenCms()}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#C6A15B] text-[#07172B] text-xs font-bold hover:bg-[#D4AF37] transition shadow-md active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>Add Strategy (Staff CMS)</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Comprehensive Tax Strategy Center
              </h1>
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal">
                Explore professionally governed U.S. tax-planning strategies organized by entity type, industry, jurisdiction, and planning objective. Every strategy requires eligibility review and approval by an authorized tax professional.
              </p>

              {/* Statutory Notice & Circular 230 Disclaimers Banner */}
              <div className="p-4 rounded-xl bg-[#0D2340]/90 border border-[#C6A15B]/40 flex items-start gap-3.5 text-xs text-slate-300 shadow-sm">
                <AlertTriangle className="w-5 h-5 text-[#C6A15B] flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h2 className="text-xs font-semibold text-white tracking-wide">
                    Statutory Notice &amp; Professional Review Requirement (IRS Circular 230)
                  </h2>
                  <p className="text-slate-300 text-xs leading-relaxed">
                    The tax planning strategies indexed below represent general educational frameworks under the Internal Revenue Code and South Carolina Department of Revenue guidelines. No strategy may be claimed on a return without human CPA eligibility verification.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <EditorialSplitImage
                src={BRAND_ASSETS.taxAdvisoryPlanningJpg}
                webpSrc={BRAND_ASSETS.taxAdvisoryPlanningWebp}
                alt="Strategic tax advisory blueprint detailing IRS code statutory frameworks, bracket analysis, and deduction modeling"
                badgeText="IRC Strategy Governance"
                className="w-full min-h-[260px]"
              />
            </div>
          </div>
        </header>

        {/* Search & Category Filtering Controls */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search strategies by name, IRS code (e.g. § 179, § 1031, § 280A), objective, or entity type..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#0B1E36] border border-[#1E3A5F] text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#C6A15B]"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 whitespace-nowrap">Showing:</span>
              <span className="text-xs font-bold text-[#C6A15B] bg-[#0D2340] px-3 py-2 rounded-xl border border-[#1E3A5F]">
                {filteredStrategies.length} Strategies
              </span>
            </div>
          </div>

          {/* 16 Category Badges */}
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedCategory === 'all'
                  ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow'
                  : 'bg-[#0B1E36] text-slate-300 border border-[#1E3A5F] hover:border-slate-500'
              }`}
            >
              All 16 Categories ({strategies.length})
            </button>
            {categories.map(cat => {
              const count = strategies.filter(s => s.category === cat).length;
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#C6A15B] text-[#07172B] font-bold shadow'
                      : 'bg-[#0B1E36] text-slate-300 border border-[#1E3A5F] hover:border-slate-500'
                  }`}
                >
                  <span>{STRATEGY_CATEGORIES_MAP[cat]?.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-[#07172B] text-[#C6A15B]' : 'bg-[#0D2340] text-slate-400'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Strategies Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStrategies.map(strat => {
            return (
              <div
                key={strat.id}
                className="bg-[#0B1E36] border border-[#1E3A5F] rounded-2xl p-6 flex flex-col justify-between hover:border-[#C6A15B]/60 transition group shadow-lg"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold tracking-wider uppercase text-[#C6A15B] bg-[#0D2340] px-2.5 py-1 rounded-md border border-[#C6A15B]/30">
                      {STRATEGY_CATEGORIES_MAP[strat.category]?.label || strat.category}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>TY {strat.applicableTaxYear}</span>
                    </span>
                  </div>

                  <h3 className="font-serif text-lg font-bold text-white group-hover:text-[#C6A15B] transition leading-snug">
                    {strat.strategyName}
                  </h3>

                  <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                    {strat.plainLanguageSummary}
                  </p>

                  <div className="pt-2 border-t border-[#1E3A5F]/70 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <Building2 className="w-3.5 h-3.5 text-[#C6A15B] flex-shrink-0" />
                      <span className="truncate"><strong>Eligibility:</strong> {strat.eligibleTaxpayerType}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                      <FileText className="w-3.5 h-3.5 text-[#C6A15B] flex-shrink-0" />
                      <span className="truncate"><strong>Authority:</strong> {strat.officialAuthority.codeCitation}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-5 mt-4 border-t border-[#1E3A5F] flex items-center justify-between gap-3">
                  <button
                    onClick={() => setSelectedStrategy(strat)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C6A15B] hover:text-[#D4AF37] transition"
                  >
                    <span>View Dossier & Checklist</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {isStaff && (
                    <button
                      onClick={() => handleOpenCms(strat)}
                      className="p-1.5 rounded-lg bg-[#0D2340] text-slate-300 hover:text-white hover:bg-[#1E3A5F] transition"
                      title="Edit Strategy (Staff)"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {filteredStrategies.length === 0 && (
          <div className="text-center py-16 bg-[#0B1E36] rounded-2xl border border-[#1E3A5F] space-y-4">
            <BookOpen className="w-10 h-10 text-slate-500 mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">No strategies match your criteria</h3>
              <p className="text-xs text-slate-400">Try adjusting your keyword search or select "All 16 Categories".</p>
            </div>
            <button
              onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
              className="px-4 py-2 rounded-xl bg-[#0D2340] border border-[#1E3A5F] text-xs font-semibold text-[#C6A15B] hover:bg-[#1E3A5F] transition"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Consultation Call to Action */}
        <div className="rounded-2xl bg-gradient-to-r from-[#0D2340] to-[#0B1E36] border border-[#C6A15B]/40 p-8 sm:p-10 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center sm:text-left">
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
              Ready to Formulate Your Personalized Tax Strategy?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Book a direct consultation with Founder Desmond Hinds or our Senior Reviewers in Columbia, SC or via secure virtual video meeting. We review your entity structures, prior returns, and long-term financial legacy.
            </p>
          </div>
          <button
            onClick={() => setCurrentPage('book_consultation')}
            className="px-6 py-3 rounded-xl bg-[#C6A15B] text-[#07172B] font-bold text-xs sm:text-sm hover:bg-[#D4AF37] transition whitespace-nowrap shadow-lg flex items-center gap-2"
          >
            <span>Schedule Strategy Consultation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* DETAIL MODAL / DOSSIER */}
      {selectedStrategy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0B1E36] border border-[#C6A15B]/50 rounded-2xl max-w-3xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto relative shadow-2xl">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#1E3A5F] pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#C6A15B] bg-[#0D2340] px-2 py-0.5 rounded border border-[#C6A15B]/30">
                    {STRATEGY_CATEGORIES_MAP[selectedStrategy.category]?.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    Version {selectedStrategy.version} • Status: <strong className="text-emerald-400 capitalize">{selectedStrategy.status}</strong>
                  </span>
                </div>
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                  {selectedStrategy.strategyName}
                </h2>
              </div>
              <button
                onClick={() => setSelectedStrategy(null)}
                className="p-1.5 rounded-lg bg-[#0D2340] text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Objective & Overview */}
            <div className="space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F] space-y-2">
                <span className="text-xs font-bold text-[#C6A15B] uppercase tracking-wider block">Strategic Tax Objective</span>
                <p className="text-slate-200 leading-relaxed">{selectedStrategy.taxObjective}</p>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Plain-Language Summary</span>
                <p className="text-slate-300 leading-relaxed">{selectedStrategy.plainLanguageSummary}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-[#07172B] p-3 rounded-xl border border-[#1E3A5F] space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Eligible Taxpayer Type</span>
                  <p className="text-slate-200 text-xs">{selectedStrategy.eligibleTaxpayerType}</p>
                </div>
                <div className="bg-[#07172B] p-3 rounded-xl border border-[#1E3A5F] space-y-1">
                  <span className="text-[11px] font-bold text-slate-400 block">Jurisdiction & Authority</span>
                  <p className="text-slate-200 text-xs">{selectedStrategy.jurisdiction}</p>
                </div>
              </div>

              {/* Official Authority Link */}
              <div className="p-3.5 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Official Statutory Authority</span>
                  <p className="text-xs text-white font-mono font-medium">{selectedStrategy.officialAuthority.codeCitation}</p>
                  <p className="text-[11px] text-slate-400">{selectedStrategy.officialAuthority.title}</p>
                </div>
                <a
                  href={selectedStrategy.officialAuthority.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[#C6A15B] hover:text-[#D4AF37] font-semibold underline whitespace-nowrap"
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
                    <span>Material Risks & Limitations</span>
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedStrategy.materialRisksAndLimitations.map((r, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Workflow Checklist */}
              <div className="space-y-2 pt-2 border-t border-[#1E3A5F]">
                <span className="text-xs font-bold text-[#C6A15B] uppercase tracking-wider block">
                  Implementation Workflow & Governance Checklist
                </span>
                <div className="space-y-2">
                  {selectedStrategy.workflowChecklist.map((step, idx) => (
                    <div key={step.id || idx} className="p-2.5 rounded-lg bg-[#07172B] border border-[#1E3A5F] flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-[#0D2340] text-[#C6A15B] flex items-center justify-center font-bold text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="text-slate-200">{step.step}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#0D2340] text-slate-400 uppercase font-mono">
                        Role: {step.requiredRole}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Required Documents */}
              <div className="space-y-2 pt-2 border-t border-[#1E3A5F]">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Required Documentation for Execution
                </span>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                  {selectedStrategy.requiredDocuments.map((doc, idx) => (
                    <li key={idx} className="p-2 rounded bg-[#07172B] border border-[#1E3A5F] flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-[#C6A15B] flex-shrink-0" />
                      <span className="truncate">{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Suitability & Human Review */}
              <div className="p-4 rounded-xl bg-[#0D2340] border border-[#C6A15B]/40 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#C6A15B]">Assigned Professional & Review Requirement</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold bg-emerald-950/40 px-2 py-0.5 rounded">
                    <UserCheck className="w-3 h-3" />
                    <span>Human CPA Verification Mandatory</span>
                  </span>
                </div>
                <p className="text-slate-300">
                  <strong>Assigned Lead:</strong> {selectedStrategy.assignedProfessional}
                </p>
                <p className="text-slate-300">
                  <strong>Suitability Criteria:</strong> {selectedStrategy.clientSuitabilityAssessment}
                </p>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#1E3A5F] flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400">
                Last reviewed: {selectedStrategy.lastReviewedDate} • Expiration: {selectedStrategy.expirationDate}
              </span>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setSelectedStrategy(null);
                    setCurrentPage('book_consultation');
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#C6A15B] text-[#07172B] font-bold text-xs hover:bg-[#D4AF37] transition"
                >
                  Book Strategy Review
                </button>
                <button
                  onClick={() => setSelectedStrategy(null)}
                  className="px-4 py-2.5 rounded-xl bg-[#0D2340] text-slate-300 font-semibold text-xs hover:bg-[#1E3A5F] transition"
                >
                  Close
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* STAFF CONTENT-MANAGEMENT SYSTEM (CMS) MODAL */}
      {isCmsOpen && isStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0B1E36] border border-[#C6A15B] rounded-2xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1E3A5F] pb-3">
              <h3 className="font-serif text-xl font-bold text-white flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#C6A15B]" />
                <span>{editingStrategy ? 'Edit Strategy Record' : 'Author New Tax Strategy Record'}</span>
              </h3>
              <button
                onClick={() => setIsCmsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStrategy} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">Strategy Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    placeholder="e.g. S-Corp Reasonable Compensation"
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#C6A15B] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">Category (1 of 16 Domains)</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as StrategyCategory)}
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#C6A15B] outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>
                        {STRATEGY_CATEGORIES_MAP[cat]?.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">Plain-Language Summary</label>
                <textarea
                  rows={2}
                  required
                  value={formSummary}
                  onChange={e => setFormSummary(e.target.value)}
                  placeholder="Concise, clear explanation for taxpayer comprehension..."
                  className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#C6A15B] outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">Strategic Tax Objective</label>
                  <input
                    type="text"
                    value={formObjective}
                    onChange={e => setFormObjective(e.target.value)}
                    placeholder="e.g. FICA tax savings, accelerated depreciation"
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#C6A15B] outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">Eligible Taxpayer Type</label>
                  <input
                    type="text"
                    value={formTaxpayer}
                    onChange={e => setFormTaxpayer(e.target.value)}
                    placeholder="e.g. S-Corporations, High-Earner W-2s"
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#C6A15B] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="block text-slate-300 font-semibold">Code Citation</label>
                  <input
                    type="text"
                    value={formCitation}
                    onChange={e => setFormCitation(e.target.value)}
                    placeholder="e.g. 26 U.S.C. § 179"
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#C6A15B] outline-none"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="block text-slate-300 font-semibold">Official Authority URL</label>
                  <input
                    type="url"
                    value={formUrl}
                    onChange={e => setFormUrl(e.target.value)}
                    placeholder="https://www.irs.gov/..."
                    className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#C6A15B] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-300 font-semibold">Governance Status</label>
                <select
                  value={formStatus}
                  onChange={e => setFormStatus(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#07172B] border border-[#1E3A5F] text-white focus:border-[#C6A15B] outline-none"
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
                  className="px-5 py-2 rounded-xl bg-[#C6A15B] text-[#07172B] font-bold hover:bg-[#D4AF37] transition"
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
