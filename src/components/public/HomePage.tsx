import React, { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { COMPANY_BRANDING, COMPANY_CONTACT, COMPANY_MAILTO_HREF } from '../../config/companyBranding';
import { BRAND_ASSETS } from '../../utils/assets';
import { ServiceCardImage, EditorialSplitImage, FounderPortrait } from './images';
import { HeroFinancialEcosystem } from './home/HeroFinancialEcosystem';
import { IntelligenceCapabilitiesSection } from './home/IntelligenceCapabilitiesSection';
import { TaxWorkflowDemonstration } from './home/TaxWorkflowDemonstration';
import { BlockchainIntegritySection } from './home/BlockchainIntegritySection';
import { FinancialAnalyticsShowcase } from './home/FinancialAnalyticsShowcase';
import { SecurityArchitectureSection } from './home/SecurityArchitectureSection';
import { HumanAiCollaborationSection } from './home/HumanAiCollaborationSection';
import { useInViewMotion } from './home/useInViewMotion';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Calendar,
  Check,
  Clock,
  Compass,
  Cpu,
  Download,
  FileCheck2,
  FileSpreadsheet,
  HardHat,
  HeartHandshake,
  Home,
  Laptop,
  Lock,
  Mail,
  MapPin,
  Phone,
  Scale,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Truck,
  UploadCloud,
  Users,
  UtensilsCrossed,
  Workflow,
} from 'lucide-react';

const FOUR_PILLARS = [
  {
    number: '01',
    title: 'Growth',
    subtitle: 'Disciplined Capital Efficiency',
    description:
      'Structured evaluation of entity elections, statutory deductions, and qualifying tax credits designed to help individuals and enterprises retain capital for reinvestment.',
    icon: TrendingUp,
  },
  {
    number: '02',
    title: 'Protection',
    subtitle: 'Substantiated Compliance',
    description:
      'Multi-tier practitioner review paired with mathematical cross-checks so workpapers, schedules, and supporting records remain organized and defensible.',
    icon: ShieldCheck,
  },
  {
    number: '03',
    title: 'Technology',
    subtitle: 'AI-Assisted Precision',
    description:
      'Intelligent document intake, automated reconciliation assistance, and discrepancy highlighting reduce manual friction while preserving human decision-making.',
    icon: Cpu,
  },
  {
    number: '04',
    title: 'Legacy',
    subtitle: 'Multi-Generational Planning',
    description:
      'Long-term coordination across trusts, estates, business succession, and wealth planning frameworks built to protect family and enterprise continuity.',
    icon: Building2,
  },
] as const;

const SPECIALIZED_SECTORS = [
  {
    name: 'Construction & Contractors',
    focus: 'Job costing, percentage-of-completion schedules, equipment depreciation, and multistate nexus.',
    icon: HardHat,
  },
  {
    name: 'Real Estate & Syndications',
    focus: 'Schedule E portfolios, cost segregation coordination, partnership K-1s, and Section 1031 planning.',
    icon: Home,
  },
  {
    name: 'Healthcare & Medical Practices',
    focus: 'Entity structuring, physician compensation planning, retirement optimization, and practice accounting.',
    icon: Stethoscope,
  },
  {
    name: 'Legal & Professional Services',
    focus: 'Partnership allocations, trust accounting coordination, estimated tax projections, and PTET planning.',
    icon: Briefcase,
  },
  {
    name: 'Transportation & Logistics',
    focus: 'Fleet depreciation, multi-jurisdiction apportionment, per-diem compliance, and cash-flow reporting.',
    icon: Truck,
  },
  {
    name: 'Technology & E-Commerce',
    focus: 'Multi-state sales nexus oversight, R&D documentation support, equity compensation, and accrual accounting.',
    icon: Laptop,
  },
  {
    name: 'Restaurants & Hospitality',
    focus: 'Tip credit compliance, FICA reporting, multi-location bookkeeping, and margin reconciliation.',
    icon: UtensilsCrossed,
  },
  {
    name: 'Nonprofits & Foundations',
    focus: 'Form 990 compliance preparation, fund accounting clarity, grant tracking, and governance records.',
    icon: HeartHandshake,
  },
] as const;

export const HomePage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const heroRef = useRef<HTMLElement | null>(null);
  const { shouldAnimate: heroMotionActive } = useInViewMotion(heroRef);

  const handleExploreSolutions = () => {
    const target = document.getElementById('intelligent-capabilities');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      setCurrentPage('services');
    }
  };

  return (
    <div className="space-y-24 sm:space-y-28 lg:space-y-32 pb-24 text-slate-100 selection:bg-[#D4A843] selection:text-[#071D3A]">
      {/* 2. ADVANCED INTELLIGENT TAX TECHNOLOGY HERO SECTION */}
      <section
        ref={heroRef}
        className="relative pt-6 pb-14 sm:pt-10 sm:pb-18 md:pt-14 md:pb-20 overflow-x-clip"
        aria-label="Destria Tax Services Intelligent Financial Technology Overview"
      >
        {/* Subtle Architectural Grid & Restrained Ambient Lighting */}
        <div
          className={`absolute inset-0 pointer-events-none overflow-hidden ${heroMotionActive ? '' : 'destria-motion-paused'}`}
          aria-hidden="true"
        >
          <div className="absolute inset-0 destria-tech-grid-bg opacity-55 [mask-image:radial-gradient(ellipse_80%_75%_at_50%_38%,black_30%,transparent_100%)]" />
          <div className="absolute -top-24 left-1/4 w-[28rem] h-[28rem] rounded-full bg-[#D4A843]/15 blur-[140px]" />
          <div className="absolute top-1/4 right-6 w-[30rem] h-[30rem] rounded-full bg-[#3B82F6]/15 blur-[160px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-12 items-center">
            {/* Left Column: Authoritative Copy & Clear Conversion Path */}
            <div className="lg:col-span-6 xl:col-span-7 space-y-6 sm:space-y-7 text-left min-w-0">
              <div className="space-y-4">
                <p className="text-xs font-semibold tracking-[0.2em] text-[#E5B552] uppercase">
                  {COMPANY_BRANDING.displayName} &middot; Intelligent Tax &amp; Financial Technology
                </p>

                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[42px] xl:text-[52px] font-extrabold tracking-tight text-white leading-[1.12] [text-wrap:balance]">
                  Intelligent Tax Solutions.{' '}
                  <span className="text-[#E5B552]">Advanced Financial Technology.</span>{' '}
                  Human Expertise.
                </h1>

                <p className="font-serif text-lg sm:text-xl font-semibold text-slate-100 leading-snug max-w-2xl">
                  The Next Generation of Tax Preparation, Accounting &amp; Wealth Planning.
                </p>

                <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-normal leading-relaxed">
                  Destria Tax Services, LLC brings together experienced tax professionals, artificial intelligence, intelligent financial automation and secure digital technologies to deliver a more organized, transparent and informed approach to tax preparation, accounting, advisory and wealth planning.
                </p>
              </div>

              {/* Primary, Secondary, and Portal Actions */}
              <div className="pt-1 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentPage('book_consultation')}
                  className="px-5 sm:px-6 py-3.5 rounded-xl font-bold text-xs sm:text-sm text-[#071D3A] bg-gradient-to-r from-[#C99A35] via-[#E5B552] to-[#C99A35] hover:brightness-105 shadow-xl shadow-[#C99A35]/15 transition-all flex items-center justify-center gap-2 group whitespace-nowrap active:scale-[0.99]"
                  id="hero-schedule-btn"
                >
                  <Calendar className="w-4 h-4 text-[#071D3A] flex-shrink-0" />
                  <span>Schedule Confidential Consultation</span>
                  <ArrowRight className="w-4 h-4 flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={handleExploreSolutions}
                  className="px-5 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-white bg-[#0D2745] hover:bg-[#133860] border border-[#D4A843]/45 hover:border-[#E5B552] transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                  id="hero-explore-solutions-btn"
                >
                  <Compass className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Explore Intelligent Tax Solutions</span>
                </button>

                <a
                  href="/portal"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage('portal');
                  }}
                  className="px-5 py-3.5 rounded-xl font-semibold text-xs sm:text-sm text-slate-100 bg-[#071A2E]/90 hover:bg-[#0D2745] border border-slate-700 hover:border-sky-400/50 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                  id="hero-portal-btn"
                  role="link"
                >
                  <Lock className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Access Secure Client Portal</span>
                </a>
              </div>

              {/* 4 Grounded Practice Governance Indicators */}
              <div className="pt-6 border-t border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2745] text-[#E5B552] border border-slate-700/90 flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-snug">Dual-Layer Review</div>
                    <span className="text-[11px] text-slate-400">Human + AI Logic</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2745] text-[#E5B552] border border-slate-700/90 flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-snug">Year-Round</div>
                    <span className="text-[11px] text-slate-400">Strategic Advisory</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2745] text-[#E5B552] border border-slate-700/90 flex-shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-snug">Direct Access</div>
                    <span className="text-[11px] text-slate-400">Dedicated Advisors</span>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2745] text-[#E5B552] border border-slate-700/90 flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-snug">Access Controls</div>
                    <span className="text-[11px] text-slate-400">Role-Based Vault</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Continuously Animated Financial Intelligence Ecosystem around Official Destria Emblem */}
            <div className="lg:col-span-6 xl:col-span-5 relative min-w-0">
              <HeroFinancialEcosystem />
            </div>
          </div>
        </div>
      </section>

      {/* 3. AI AND PROFESSIONAL EXPERTISE OVERVIEW + FOUR PILLARS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-labelledby="pillars-heading">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10 sm:mb-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#E5B552] uppercase">
              Practice Foundation
            </p>
            <h2
              id="pillars-heading"
              className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
            >
              Technology-Enabled Precision, Anchored in Professional Stewardship
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Modern tax and financial engagements demand both speed of analysis and rigor of human judgment. Every Destria engagement is structured around four enduring pillars.
            </p>
          </div>
          <div className="text-xs text-slate-400 lg:text-right max-w-xs leading-relaxed">
            Serving individuals, business owners, and multi-entity organizations from Columbia, South Carolina across the United States.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FOUR_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.number}
                className="p-6 sm:p-7 rounded-2xl bg-[#0C2440]/80 border border-slate-700/80 hover:border-[#D4A843]/60 transition-all group flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-11 h-11 rounded-xl bg-[#071A2E] border border-slate-700 flex items-center justify-center text-[#E5B552] group-hover:border-[#D4A843]/50 transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-400 tabular-nums">
                      {pillar.number}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <h3 className="font-serif text-xl font-bold text-white">{pillar.title}</h3>
                    <div className="text-[11px] font-semibold text-[#E5B552] uppercase tracking-wider">
                      {pillar.subtitle}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 4. INTELLIGENT FINANCIAL CAPABILITIES SHOWCASE (9 CAPABILITY CARDS) */}
      <IntelligenceCapabilitiesSection />

      {/* 5. INTELLIGENT TAX PREPARATION WORKFLOW (10 SEQUENTIAL STAGES) */}
      <TaxWorkflowDemonstration />

      {/* 6. CORE TAX, ACCOUNTING & ADVISORY SERVICES + BOOKKEEPING INTEGRATION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16" aria-labelledby="core-services-heading">
        <div>
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 sm:mb-12 gap-6">
            <div className="space-y-3 max-w-2xl">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#E5B552] uppercase">
                Core Services
              </p>
              <h2
                id="core-services-heading"
                className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
              >
                Comprehensive Tax Preparation, Accounting &amp; Wealth Advisory
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Full-cycle individual and corporate tax preparation, proactive strategy, accounting integration, and wealth preservation structured for clarity and long-term continuity.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage('services')}
              className="text-xs font-bold text-[#E5B552] hover:text-white inline-flex items-center gap-1.5 transition-colors self-start md:self-end py-2 whitespace-nowrap"
            >
              <span>View Full Service Catalog</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-7 items-stretch">
            {/* Service 1: Tax Advisory & Strategic Planning */}
            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0C2440] border border-slate-700/80 hover:border-[#D4A843]/60 transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <ServiceCardImage
                  src={BRAND_ASSETS.taxAdvisoryPlanningJpg}
                  webpSrc={BRAND_ASSETS.taxAdvisoryPlanningWebp}
                  alt="Professional tax advisor discussing strategic tax planning with a client"
                  categoryBadge="Tax Advisory & Strategy"
                  icon={<Workflow className="w-5 h-5 text-[#E5B552]" />}
                />
                <h3 className="font-serif text-2xl font-bold text-white">Tax Advisory &amp; Strategic Planning</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Forward-looking federal and multistate tax planning designed to model transactions, evaluate entity structures, and align quarterly cash flow with statutory requirements.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-700/80">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Strategic Entity Selection &amp; Structuring (LLC, S-Corp, C-Corp)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Quarterly Tax Projections &amp; Estimated Payment Schedules</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Section 199A QBI &amp; State Pass-Through Entity Tax (PTET) Analysis</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>IRS Transcript Review &amp; Compliance Resolution Support</span>
                </li>
              </ul>
            </div>

            {/* Service 2: Corporate Compliance & Entity Filings */}
            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0C2440] border border-slate-700/80 hover:border-[#D4A843]/60 transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <ServiceCardImage
                  src={BRAND_ASSETS.corporateBusinessAdvisoryJpg}
                  webpSrc={BRAND_ASSETS.corporateBusinessAdvisoryWebp}
                  alt="Business professionals reviewing corporate financial and advisory matters"
                  categoryBadge="Corporate & Enterprise"
                  icon={<Building2 className="w-5 h-5 text-[#E5B552]" />}
                />
                <h3 className="font-serif text-2xl font-bold text-white">Corporate Compliance &amp; Entity Filings</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Structured compliance preparation for operating companies, partnerships, and multi-entity groups managing federal and multistate reporting obligations.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-700/80">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Form 1120-S (S-Corporation), Form 1065 (Partnership) &amp; Form 1120</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Multistate Nexus &amp; Apportionment Review</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Owner Reasonable Compensation &amp; Payroll Tax Coordination</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Organized Schedule K-1 Delivery via Secure Client Portal</span>
                </li>
              </ul>
            </div>

            {/* Service 3: Wealth, Estate & Asset Protection */}
            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0C2440] border border-slate-700/80 hover:border-[#D4A843]/60 transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <ServiceCardImage
                  src={BRAND_ASSETS.estateLegacyPlanningJpg}
                  webpSrc={BRAND_ASSETS.estateLegacyPlanningWebp}
                  alt="Advisor consulting with clients on wealth, estate and asset protection planning"
                  categoryBadge="Wealth & Legacy"
                  icon={<Scale className="w-5 h-5 text-[#E5B552]" />}
                />
                <h3 className="font-serif text-2xl font-bold text-white">Wealth, Estate &amp; Asset Protection</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Collaborative tax planning alongside estate attorneys and family fiduciaries to help structure trusts, gifts, and business transitions with clarity.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-700/80">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Revocable &amp; Irrevocable Trust Tax Reporting (Form 1041)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Estate &amp; Gift Tax Compliance Coordination (Form 706 / 709)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Business Succession &amp; Multi-Generational Transfer Planning</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Direct Coordination with Independent Legal &amp; Financial Counsel</span>
                </li>
              </ul>
            </div>

            {/* Service 4: Meticulous Individual Tax Filings */}
            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0C2440] border border-slate-700/80 hover:border-[#D4A843]/60 transition-all flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <ServiceCardImage
                  src={BRAND_ASSETS.meticulousTaxPrepJpg}
                  webpSrc={BRAND_ASSETS.meticulousTaxPrepWebp}
                  alt="Tax professional carefully reviewing tax documents and financial records"
                  categoryBadge="Accuracy & Compliance"
                  icon={<FileCheck2 className="w-5 h-5 text-[#E5B552]" />}
                />
                <h3 className="font-serif text-2xl font-bold text-white">Meticulous Individual Tax Filings</h3>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Disciplined preparation standards for executives, investors, and families with multi-source income, real estate holdings, and pass-through interests.
                </p>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-700/80">
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Federal Form 1040 &amp; Multi-State Individual Income Tax Returns</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Structured Workpaper Reconciliation &amp; Practitioner Quality Review</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Schedule C, Schedule E (Real Estate), Equity Comp &amp; K-1 Schedules</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Check className="w-4 h-4 text-[#E5B552] flex-shrink-0" />
                  <span>Client Review Walkthrough &amp; Formal Filing Authorization Package</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Bookkeeping, Financial Reporting & Accounting Integration Split */}
        <div className="rounded-3xl bg-[#0C2440]/70 border border-slate-700/80 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.2em] text-[#E5B552] uppercase">
                Intelligent Accounting &amp; Reporting
              </p>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Organized Bookkeeping, Ledger Reconciliation &amp; Client Portal Collaboration
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Keep business accounting and tax preparation connected throughout the year. Submit trial balances, charts of accounts, and monthly statements into our structured workspace so book-to-tax adjustments are tracked cleanly ahead of filing season.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-4 rounded-xl bg-[#071A2E] border border-slate-700/80">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="text-xs font-bold text-white">QuickBooks Exports</div>
                <div className="text-[11px] text-slate-400 mt-1">Trial balance &amp; chart of accounts review</div>
              </div>
              <div className="p-4 rounded-xl bg-[#071A2E] border border-slate-700/80">
                <TrendingUp className="w-5 h-5 text-sky-400 mb-2" />
                <div className="text-xs font-bold text-white">Xero Ledgers</div>
                <div className="text-[11px] text-slate-400 mt-1">General ledger &amp; book-to-tax mapping</div>
              </div>
              <div className="p-4 rounded-xl bg-[#071A2E] border border-slate-700/80">
                <Download className="w-5 h-5 text-[#E5B552] mb-2" />
                <div className="text-xs font-bold text-white">Structured Intake</div>
                <div className="text-[11px] text-slate-400 mt-1">CSV, Excel &amp; PDF statement ingestion</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                href="/portal"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage('portal');
                }}
                className="px-5 py-3 rounded-xl font-bold text-xs text-[#071D3A] bg-[#D4A843] hover:bg-[#E5B552] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                id="portal-upload-btn"
                role="link"
              >
                <span>Access Secure Client Portal</span>
                <UploadCloud className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setCurrentPage('tax_strategies')}
                className="px-5 py-3 rounded-xl font-semibold text-xs text-slate-100 bg-[#071A2E] hover:bg-[#102D4F] border border-slate-700 hover:border-[#D4A843]/50 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span>Explore Tax Strategies</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#E5B552]" />
              </button>
            </div>
          </div>

          <div className="lg:col-span-5">
            <EditorialSplitImage
              srcJpg={BRAND_ASSETS.bookkeepingReportingJpg}
              srcWebp={BRAND_ASSETS.bookkeepingReportingWebp}
              alt="Executive financial reporting and accounting workstation with financial ledger and digital integration"
              caption="Financial Reporting & Book-to-Tax Reconciliation"
              tag="Accounting Oversight"
              aspectRatio="4/3"
            />
          </div>
        </div>
      </section>

      {/* 7. BLOCKCHAIN-INSPIRED FINANCIAL DATA INTEGRITY */}
      <BlockchainIntegritySection />

      {/* 8. INTELLIGENT FINANCIAL ANALYTICS DEMONSTRATION */}
      <FinancialAnalyticsShowcase />

      {/* 9. SPECIALIZED INDUSTRIES & PROFESSIONAL SERVICES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-labelledby="industries-heading">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 sm:mb-12">
          <div className="max-w-2xl space-y-3">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#E5B552] uppercase">
              Specialized Sectors
            </p>
            <h2
              id="industries-heading"
              className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
            >
              Industry-Focused Tax &amp; Accounting Intelligence
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Every industry carries distinct depreciation rules, entity considerations, and compliance documentation standards. We tailor workpapers and planning around how your sector operates.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCurrentPage('industries')}
            className="text-xs font-bold text-[#E5B552] hover:text-white inline-flex items-center gap-1.5 transition-colors self-start md:self-end py-2 whitespace-nowrap"
          >
            <span>Explore All Industries</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SPECIALIZED_SECTORS.map((sector) => {
            const Icon = sector.icon;
            return (
              <button
                key={sector.name}
                type="button"
                onClick={() => setCurrentPage('industries')}
                className="text-left p-5 sm:p-6 rounded-2xl bg-[#0C2440]/80 border border-slate-700/80 hover:border-[#D4A843]/60 hover:bg-[#102D4F]/85 transition-all group flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#071A2E] border border-slate-700 flex items-center justify-center text-[#E5B552] group-hover:border-[#D4A843]/50 transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif text-base font-bold text-white leading-snug">
                    {sector.name}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{sector.focus}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#E5B552] group-hover:translate-x-0.5 transition-transform">
                  <span>View sector guidance</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 10. FINANCIAL SECURITY & PRIVACY ARCHITECTURE */}
      <SecurityArchitectureSection />

      {/* 11. HUMAN EXPERTISE & PROFESSIONAL ACCOUNTABILITY */}
      <HumanAiCollaborationSection />

      {/* EXECUTIVE LEADERSHIP INTRODUCTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-labelledby="home-leadership-heading">
        <div className="rounded-3xl bg-gradient-to-br from-[#0C2440] to-[#06182B] border border-[#D4A843]/40 p-6 sm:p-10 lg:p-12 shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-5 flex justify-center">
              <FounderPortrait
                size="full"
                priority={false}
                caption="Desmond Hinds • Founder & Chief Executive Officer"
                className="w-full max-w-[420px] lg:max-w-none"
              />
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold tracking-[0.2em] text-[#E5B552] uppercase">
                  Executive Leadership
                </p>
                <h2
                  id="home-leadership-heading"
                  className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
                >
                  Led by Desmond Hinds
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-[#E5B552]">
                  Founder &amp; Chief Executive Officer &bull; {COMPANY_BRANDING.displayName} &bull; {COMPANY_CONTACT.location}
                </p>
              </div>

              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Desmond Hinds founded {COMPANY_BRANDING.displayName} to unite disciplined tax compliance, modern financial technology, and personal executive stewardship. Every client relationship is anchored in accuracy, confidentiality, and year-round strategic guidance.
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentPage('founder')}
                  className="px-5 py-3 rounded-xl font-bold text-xs text-[#071D3A] bg-gradient-to-r from-[#C99A35] via-[#E5B552] to-[#C99A35] hover:brightness-105 transition-all inline-flex items-center gap-2 whitespace-nowrap shadow-lg"
                >
                  <span>View Full Executive Profile</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage('about')}
                  className="px-5 py-3 rounded-xl font-semibold text-xs text-slate-100 bg-[#071A2E] hover:bg-[#102D4F] border border-slate-700 hover:border-[#D4A843]/50 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <span>About {COMPANY_BRANDING.displayName}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 12. CONFIDENTIAL CONSULTATION CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-labelledby="cta-heading">
        <div className="relative rounded-3xl overflow-hidden border border-[#D4A843]/50 shadow-2xl">
          <div className="absolute inset-0 z-0" aria-hidden="true">
            <picture className="w-full h-full block" aria-hidden="true">
              <source srcSet={BRAND_ASSETS.executiveConsultationSuiteWebp} type="image/webp" />
              <img
                src={BRAND_ASSETS.executiveConsultationSuiteJpg}
                alt=""
                aria-hidden="true"
                width={1600}
                height={900}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover object-center"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-[#06182B] via-[#071A2E]/92 to-[#06182B]/88" />
          </div>

          <div className="relative z-10 p-8 sm:p-12 lg:p-16 text-center max-w-4xl mx-auto space-y-6">
            <p className="text-xs font-semibold tracking-[0.2em] text-[#E5B552] uppercase">
              Begin Your Confidential Engagement
            </p>
            <h2
              id="cta-heading"
              className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight [text-wrap:balance]"
            >
              Experience Modern Tax Preparation &amp; Financial Advisory Built Around Clarity
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Connect with {COMPANY_BRANDING.displayName} to discuss individual or corporate tax preparation, accounting organization, and year-round wealth planning supported by modern financial technology and experienced professionals.
            </p>

            {/* Official Contact Strip */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-200 pt-1">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#E5B552]" />
                <span>{COMPANY_CONTACT.location}</span>
              </span>
              <a
                href={COMPANY_CONTACT.phoneHref}
                className="inline-flex items-center gap-1.5 hover:text-[#E5B552] transition-colors"
              >
                <Phone className="w-3.5 h-3.5 text-[#E5B552]" />
                <span className="tabular-nums">{COMPANY_CONTACT.phoneDisplay}</span>
              </a>
              <a
                href={COMPANY_MAILTO_HREF}
                className="inline-flex items-center gap-1.5 hover:text-[#E5B552] transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-[#E5B552]" />
                <span>{COMPANY_CONTACT.email}</span>
              </a>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={() => setCurrentPage('book_consultation')}
                className="px-7 py-4 rounded-xl font-bold text-sm text-[#071D3A] bg-gradient-to-r from-[#C99A35] via-[#E5B552] to-[#C99A35] hover:brightness-105 transition-all shadow-xl whitespace-nowrap active:scale-[0.99]"
                id="cta-schedule-btn"
              >
                Schedule Confidential Consultation
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage('contact')}
                className="px-6 py-4 rounded-xl font-semibold text-sm text-white bg-[#0D2745] hover:bg-[#133860] border border-slate-700 hover:border-[#D4A843]/50 transition-all whitespace-nowrap"
                id="cta-contact-btn"
              >
                Contact Our Columbia Office
              </button>
              <a
                href="/portal"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage('portal');
                }}
                className="px-6 py-4 rounded-xl font-semibold text-sm text-slate-100 bg-[#071A2E]/90 hover:bg-[#0D2745] border border-slate-700 hover:border-sky-400/50 transition-all inline-flex items-center justify-center gap-2 whitespace-nowrap"
                id="cta-portal-btn"
                role="link"
              >
                <Lock className="w-4 h-4 text-[#E5B552]" />
                <span>Access Secure Client Portal</span>
              </a>
            </div>

            <div className="pt-6 border-t border-slate-700/70 text-[11px] text-slate-400 max-w-3xl mx-auto leading-relaxed">
              General Information Notice: The information and illustrative technology demonstrations presented on this website are for general informational purposes and do not constitute individualized tax, legal, accounting, or investment advice. Specific tax services and advisory recommendations require a formal client engagement agreement with {COMPANY_BRANDING.displayName}. All tax preparation and filing activities remain subject to qualified professional review, explicit client authorization, and applicable federal and state laws.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
