import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TESTIMONIALS_DATA } from '../../data/mockData';
import { BrandLogo } from '../common/BrandLogo';
import { BRAND_ASSETS } from '../../utils/assets';
import { FounderPortrait, ServiceCardImage, EditorialSplitImage } from './images';
import { 
  ShieldCheck, 
  Clock, 
  Users, 
  Lock, 
  ArrowRight, 
  CheckCircle2, 
  FileCheck2, 
  Building2, 
  TrendingUp, 
  Scale, 
  Calendar, 
  Download, 
  Check, 
  Star,
  ChevronRight,
  UploadCloud,
  FileSpreadsheet,
  Workflow,
  MapPin,
  Briefcase,
  Layers,
  FileText
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { setCurrentPage } = useApp();

  useEffect(() => {
    console.log('[DIAGNOSTIC] Premium Homepage mounted successfully');
  }, []);

  return (
    <div className="space-y-24 sm:space-y-28 lg:space-y-32 pb-24 text-slate-100 selection:bg-[#C99A3D] selection:text-[#06172C]">
      
      {/* 1. HERO SECTION: EXECUTIVE ADVISORY SHOWCASE */}
      <section className="relative pt-6 pb-16 sm:pt-10 sm:pb-20 md:pt-14 md:pb-24 overflow-hidden" aria-label="Introduction and Overview">
        {/* Architectural atmospheric glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-25" aria-hidden="true">
          <div className="absolute -top-24 left-1/4 w-[28rem] h-[28rem] rounded-full bg-[#C99A3D] blur-[140px]" />
          <div className="absolute top-1/3 right-10 w-[30rem] h-[30rem] rounded-full bg-[#1E3A5F] blur-[160px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">
            
            {/* Left Column: Authoritative Positioning & Clear Conversion Path */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2340] border border-[#C99A3D]/40 text-[#E2BD67] text-xs font-semibold tracking-wide shadow-sm">
                <ShieldCheck className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Professional Tax &amp; Strategic Advisory &bull; Columbia, South Carolina</span>
              </div>

              <div className="space-y-4">
                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[52px] font-extrabold tracking-tight text-white leading-[1.15] break-words">
                  Discreet, Strategic Tax Advisory for{' '}
                  <span className="block text-[#E2BD67] mt-1">Founders, Executives &amp; Families.</span>
                </h1>

                <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
                  Precision tax preparation, proactive liability reduction, and comprehensive financial structuring tailored for business owners, corporate leaders, and individuals with complex financial lives. Grounded in integrity, discretion, and enduring client partnerships.
                </p>
              </div>

              {/* Action Buttons: Unified Conversion Hierarchy */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button
                  onClick={() => setCurrentPage('book_consultation')}
                  className="px-7 py-4 rounded-xl font-bold text-sm text-[#07172B] bg-gradient-to-r from-[#C99A3D] via-[#E2BD67] to-[#C99A3D] hover:brightness-105 shadow-xl transition-all flex items-center justify-center gap-2.5 group whitespace-nowrap active:scale-[0.99]"
                  id="hero-schedule-btn"
                >
                  <Calendar className="w-4 h-4 text-[#07172B]" />
                  <span>Schedule a Confidential Consultation</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => window.location.hash = '#/client/login'}
                  className="px-6 py-4 rounded-xl font-semibold text-sm text-slate-100 bg-[#0D2340] hover:bg-[#132E52] border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                  id="hero-portal-btn"
                >
                  <Lock className="w-4 h-4 text-[#C99A3D]" />
                  <span>Secure Client Portal</span>
                </button>
              </div>

              {/* 4 Trust & Governance Indicators (Factual, Verified Standards) */}
              <div className="pt-6 border-t border-[#1E3A5F]/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2340] text-[#C99A3D] border border-[#1E3A5F] flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-none">Confidential</div>
                    <span className="text-[11px] text-slate-400">Strict Privacy</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2340] text-[#C99A3D] border border-[#1E3A5F] flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-none">Year-Round</div>
                    <span className="text-[11px] text-slate-400">Active Guidance</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2340] text-[#C99A3D] border border-[#1E3A5F] flex-shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-none">Direct Access</div>
                    <span className="text-[11px] text-slate-400">Dedicated Advisers</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2340] text-[#C99A3D] border border-[#1E3A5F] flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-none">TLS Protected</div>
                    <span className="text-[11px] text-slate-400">Encrypted Vault</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Editorial Hero Photography Showcase */}
            <div className="lg:col-span-5 relative">
              <figure className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-[#0D2340] to-[#07172B] border border-[#C99A3D]/40 p-4 sm:p-5 shadow-2xl space-y-4">
                
                {/* Firm Identifier Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#1E3A5F]">
                  <div className="flex items-center gap-2.5">
                    <BrandLogo variant="emblem" size="sm" />
                    <div>
                      <div className="text-xs font-bold text-white tracking-wider">A/R TAX SERVICES, LLC</div>
                      <div className="text-[10px] text-[#E2BD67]">Founder: Desmond Hinds</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-[#07172B] text-[#E2BD67] border border-[#C99A3D]/40">
                    2025/2026 Advisory
                  </span>
                </div>

                {/* Master Editorial Hero Image - CEO Corporate Portrait */}
                <div className="relative aspect-square w-full rounded-xl sm:rounded-2xl overflow-hidden border border-[#1E3A5F] bg-[#07172B] shadow-inner">
                  <img
                    id="home-hero-ceo-portrait"
                    src="/ceo/123456789-desmond.png?v=20260922-1"
                    alt="Desmond Hinds, Founder and Chief Executive Officer of A/R Tax Services, LLC"
                    className="home-ceo-image"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </div>

                {/* Practice Office & Advisory Status Strip (Cleanly positioned outside the photograph) */}
                <div className="flex items-center justify-between text-xs text-slate-300 px-0.5 pt-0.5">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-[#C99A3D] flex-shrink-0" />
                    <span className="text-[11px] sm:text-xs">Columbia, SC Practice Office</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#E2BD67] px-2 py-0.5 rounded bg-[#07172B] border border-[#C99A3D]/40">
                    Private Advisory
                  </span>
                </div>

                {/* Firm Mission Banner */}
                <div className="p-3.5 rounded-xl bg-[#07172B] border border-[#1E3A5F]">
                  <div className="text-[11px] font-bold text-[#E2BD67] tracking-wider uppercase">
                    More Than Taxes. A Strategic Financial Path.
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Customized planning to legally minimize liabilities, maintain uncompromised statutory compliance, and preserve generational wealth.
                  </p>
                </div>

                {/* Direct Action Link to Services */}
                <button
                  onClick={() => setCurrentPage('services')}
                  className="w-full py-3 rounded-xl text-xs font-bold text-[#07172B] bg-[#C99A3D] hover:bg-[#E2BD67] transition-colors flex items-center justify-center gap-2"
                  id="hero-explore-plans-btn"
                >
                  <span>Explore Practice Capabilities</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </figure>
            </div>

          </div>
        </div>
      </section>

      {/* 2. THE FOUR BRAND PILLARS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Core Advisory Principles">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold tracking-widest text-[#E2BD67] uppercase">
            Our Foundation
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            The Four Pillars of A/R Tax Services
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Guided by principle, executed with precision. Every advisory engagement is anchored in these foundational commitments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1: Growth */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0D2340]/60 border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-center text-[#C99A3D] mb-5 group-hover:scale-105 transition-transform shadow-inner">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">Growth</h3>
              <div className="text-xs font-semibold text-[#E2BD67] mb-2.5 uppercase tracking-wider">
                Creating Opportunities
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                We proactively uncover legitimate tax opportunities, entity advantages, and deductions that maximize capital retention and foster business expansion.
              </p>
            </div>
          </div>

          {/* Pillar 2: Protection */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0D2340]/60 border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-center text-[#C99A3D] mb-5 group-hover:scale-105 transition-transform shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">Protection</h3>
              <div className="text-xs font-semibold text-[#E2BD67] mb-2.5 uppercase tracking-wider">
                Safeguarding What Matters
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Through meticulous multi-tier review standards, audit readiness, and compliant accounting practices, we insulate your assets from avoidable exposures.
              </p>
            </div>
          </div>

          {/* Pillar 3: People */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0D2340]/60 border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-center text-[#C99A3D] mb-5 group-hover:scale-105 transition-transform shadow-inner">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">People</h3>
              <div className="text-xs font-semibold text-[#E2BD67] mb-2.5 uppercase tracking-wider">
                Empowering Clients
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Taxes should never feel opaque or overwhelming. We translate complex tax codes into clear, actionable strategies that give clients complete peace of mind.
              </p>
            </div>
          </div>

          {/* Pillar 4: Legacy */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0D2340]/60 border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#07172B] border border-[#1E3A5F] flex items-center justify-center text-[#C99A3D] mb-5 group-hover:scale-105 transition-transform shadow-inner">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">Legacy</h3>
              <div className="text-xs font-semibold text-[#E2BD67] mb-2.5 uppercase tracking-wider">
                Building Generations
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Enduring wealth extends far beyond a single filing deadline. We coordinate long-term financial frameworks designed to protect and pass down prosperity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAJOR ADVISORY & COMPLIANCE CAPABILITIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Practice Capabilities">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-16 gap-6">
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-bold tracking-widest text-[#E2BD67] uppercase">
              Core Capabilities
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Comprehensive Tax &amp; Advisory Services
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              End-to-end tax preparation, corporate compliance, and wealth preservation tailored for discerning individuals and growing business entities.
            </p>
          </div>
          <button
            onClick={() => setCurrentPage('services')}
            className="text-xs font-bold text-[#E2BD67] hover:text-white flex items-center gap-1.5 transition-colors self-start md:self-end py-2"
          >
            <span>View Full Service Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: Tax Advisory & Planning */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <ServiceCardImage
                src={BRAND_ASSETS.taxAdvisoryPlanningJpg}
                webpSrc={BRAND_ASSETS.taxAdvisoryPlanningWebp}
                alt="Strategic tax advisory architecture displaying multi-year tax projection scenarios, S-Corp and LLC entity structure, and pass-through deduction optimization"
                categoryBadge="Tax Advisory & Strategy"
                icon={<Workflow className="w-5 h-5 text-[#C99A3D]" />}
              />
              <h3 className="font-serif text-2xl font-bold text-white">Tax Advisory &amp; Planning</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Strategic federal and multistate tax planning engineered to legally minimize liabilities, model future transactions, and optimize entity structures.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-[#1E3A5F]/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Strategic Entity Selection &amp; Tax Structuring (LLC, S-Corp, C-Corp)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Quarterly Tax Projections &amp; Estimated Payment Schedules</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Prior-Year Return Diagnostic &amp; Formal Amendments (1040X)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>IRS Transcript Review &amp; Statutory Resolution Guidance</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Business & Corporate Services */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <ServiceCardImage
                src={BRAND_ASSETS.corporateBusinessAdvisoryJpg}
                webpSrc={BRAND_ASSETS.corporateBusinessAdvisoryWebp}
                alt="Corporate tax compliance suite illustrating Form 1120-S, Form 1065, multistate nexus apportionment, and executive reasonable compensation benchmarks"
                categoryBadge="Corporate & Enterprise"
                icon={<Building2 className="w-5 h-5 text-[#C99A3D]" />}
              />
              <h3 className="font-serif text-2xl font-bold text-white">Business &amp; Corporate Services</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Comprehensive compliance and filing services for enterprise owners, partnerships, and growing companies across multiple state jurisdictions.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-[#1E3A5F]/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Form 1120-S (S-Corporation) &amp; Form 1065 (Partnership) Filings</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Multistate Corporate Nexus &amp; Apportionment Analysis</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Executive Compensation &amp; Owner Reasonable Salary Reviews</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Corporate State Filings &amp; Annual Franchise Reporting</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Wealth, Estate & Asset Coordination */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <ServiceCardImage
                src={BRAND_ASSETS.estateLegacyPlanningJpg}
                webpSrc={BRAND_ASSETS.estateLegacyPlanningWebp}
                alt="Comprehensive family wealth structure mapping revocable and irrevocable trusts, business equity, real estate assets, and generational wealth preservation"
                categoryBadge="Asset Protection & Legacy"
                icon={<Scale className="w-5 h-5 text-[#C99A3D]" />}
              />
              <h3 className="font-serif text-2xl font-bold text-white">Wealth, Estate &amp; Asset Protection</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Coordinating with estate attorneys and family fiduciaries to ensure assets transfer with minimal tax friction and maximum structural protection.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-[#1E3A5F]/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Revocable &amp; Irrevocable Trust Tax Organization</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Estate &amp; Gift Tax Advisory &amp; Form 706 / 709 Preparation</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Succession Planning &amp; Intergenerational Wealth Transfer</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Seamless Collaboration with Licensed Estate Legal Counsel</span>
              </li>
            </ul>
          </div>

          {/* Card 4: Meticulous Tax Preparation & Review */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C99A3D]/60 transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <ServiceCardImage
                src={BRAND_ASSETS.meticulousTaxPrepJpg}
                webpSrc={BRAND_ASSETS.meticulousTaxPrepWebp}
                alt="Multi-screen tax preparation workstation demonstrating 7-step review workflow, Form 1040 line-item reconciliation, and certified IRS electronic filing"
                categoryBadge="Accuracy & Compliance"
                icon={<FileCheck2 className="w-5 h-5 text-[#C99A3D]" />}
              />
              <h3 className="font-serif text-2xl font-bold text-white">Meticulous Tax Preparation</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Exhaustive review standards applied to every individual and business return. Every line item is substantiated for total audit resilience.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-[#1E3A5F]/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Form 1040 Federal &amp; 50-State Income Tax Returns</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Multi-Tier Professional Quality &amp; Accuracy Verification</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Complex Schedule C, Schedule E (Real Estate) &amp; K-1 Pass-Throughs</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                <span>Secure Electronic Filing (IRS e-file) with Confirmation Tracking</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. FOUNDER & LEADERSHIP SPOTLIGHT: DESMOND HINDS */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Executive Leadership">
        <div className="rounded-3xl bg-gradient-to-br from-[#0B2748] to-[#06172C] border border-[#C99A3D]/40 p-6 sm:p-10 lg:p-12 shadow-2xl space-y-8">
          
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#1E3A5F]/80 pb-6">
            <div>
              <span className="inline-block text-xs font-bold tracking-widest text-[#E2BD67] uppercase mb-1">
                A MESSAGE FROM OUR FOUNDER
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-[40px] font-bold text-white tracking-tight leading-tight">
                Personal Guidance. Enduring Financial Confidence.
              </h2>
              <div className="text-sm font-semibold text-[#E2BD67] mt-1">
                Desmond Hinds &bull; Founder &amp; CEO, A/R Tax Services, LLC &bull; Columbia, South Carolina
              </div>
            </div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#06172C] border border-[#C99A3D]/50 text-[11px] font-bold tracking-widest text-[#E2BD67] uppercase shadow-sm self-start sm:self-center">
              <span className="w-2 h-2 rounded-full bg-[#C99A3D]" />
              PRACTICE LEADER
            </div>
          </div>

          {/* Executive Spotlight Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch pt-2">
            
            {/* Authentic Executive Portrait Column with Official Corporate Signage */}
            <div className="lg:col-span-5 flex flex-col justify-center">
              <FounderPortrait
                size="lg"
                variant="portrait"
                priority={false}
                caption="Desmond Hinds â€¢ Founder & Chief Executive Officer"
                className="w-full"
              />
            </div>

            {/* Narrative, Welcome Message & Verified Credentials */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                {/* Firm Mission & Tagline Plaque */}
                <div className="p-4 sm:p-5 rounded-xl bg-[#06172C]/90 border-l-4 border-[#C99A3D] text-[#F8F6F1] shadow-md">
                  <div className="text-base sm:text-lg font-serif italic leading-relaxed text-white">
                    &ldquo;People &bull; Plans &bull; Progress&rdquo;
                  </div>
                  <div className="text-xs font-semibold text-[#E2BD67] mt-1.5">
                    &mdash; Desmond Hinds, Founder &amp; Chief Executive Officer
                  </div>
                </div>

                {/* Welcoming Supporting Message from Desmond Hinds */}
                <div className="space-y-3.5 text-xs sm:text-sm text-slate-200 leading-relaxed max-w-[72ch]">
                  <p>
                    &ldquo;Welcome to A/R Tax Services, LLC. We understand that every individual, family, and business has a distinct financial story. Our commitment is to provide attentive, confidential, and carefully considered tax support built around your circumstances, responsibilities, and long-term objectives.
                  </p>
                  <p>
                    Whether you are managing a growing enterprise, coordinating complex family interests, planning across generations, or seeking greater clarity in your financial affairs, our goal is to give you a professional environment where your concerns are heard and your next steps are approached with care.
                  </p>
                  <p>
                    We value enduring relationships founded on preparation, transparency, discretion, and trust. We look forward to learning about your priorities and helping you move forward with greater confidence.&rdquo;
                  </p>
                </div>

                {/* Verified Professional Credentials */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-[#06172C]/70 border border-[#1E3A5F]">
                    <div className="text-[11px] font-bold text-[#E2BD67] uppercase tracking-wider">IRS Registered</div>
                    <div className="text-[11px] text-slate-300 mt-1">AFSP Registered Tax Return Preparer</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#06172C]/70 border border-[#1E3A5F]">
                    <div className="text-[11px] font-bold text-[#E2BD67] uppercase tracking-wider">Software Certified</div>
                    <div className="text-[11px] text-slate-300 mt-1">Certified QuickBooks ProAdvisor</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#06172C]/70 border border-[#1E3A5F]">
                    <div className="text-[11px] font-bold text-[#E2BD67] uppercase tracking-wider">Advanced Candidacy</div>
                    <div className="text-[11px] text-slate-300 mt-1">Enrolled Agent (EA) Candidate</div>
                  </div>
                </div>
              </div>

              {/* Direct Action Card with Specified CTAs */}
              <div className="bg-[#06172C]/80 p-5 sm:p-6 rounded-2xl border border-[#C99A3D]/40 shadow-lg space-y-4">
                <div>
                  <div className="text-xs font-bold text-[#E2BD67] tracking-wider uppercase mb-1">
                    Confidential Client Onboarding &amp; Consultation
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Schedule a private advisory session to review corporate positioning, multi-tier tax strategy, or prior-year returns with our leadership.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setCurrentPage('book_consultation')}
                    className="h-12 px-6 rounded-xl font-bold text-xs sm:text-sm text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-md flex items-center justify-center gap-2 whitespace-nowrap flex-1"
                    id="founder-book-btn"
                  >
                    <Calendar className="w-4 h-4 text-[#06172C] flex-shrink-0" />
                    <span>Schedule a Confidential Consultation</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage('founder')}
                    className="h-12 px-6 rounded-xl font-semibold text-xs sm:text-sm text-slate-100 bg-[#0B2748]/70 hover:bg-[#0B2748] border border-[#C99A3D]/40 hover:border-[#C99A3D] transition-colors flex items-center justify-center whitespace-nowrap"
                    id="founder-profile-btn"
                  >
                    <span>Meet Our Founder</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 5. CLIENT EXPERIENCE & CONSULTATION METHODOLOGY */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Advisory Methodology">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">
          
          {/* Left Column: Image of Discreet One-on-One Consultation Experience */}
          <div className="lg:col-span-5 order-2 lg:order-1">
            <EditorialSplitImage
              srcJpg={BRAND_ASSETS.privateConsultationExpJpg}
              srcWebp={BRAND_ASSETS.privateConsultationExpWebp}
              alt="Four-phase private client advisory engagement roadmap covering discovery and diagnostic, strategic architecture, meticulous execution, and ongoing stewardship"
              caption="Confidential One-on-One Consultation"
              tag="Personal Attention"
              aspectRatio="4/3"
            />
          </div>

          {/* Right Column: 5-Step Clear Advisory Journey */}
          <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
            <div className="space-y-3">
              <span className="text-xs font-bold tracking-widest text-[#E2BD67] uppercase">
                Methodology
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Our Structured Consultation Process
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Structured, transparent, and responsive from initial document intake to finalized e-filing and year-round advisory support.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {[
                {
                  step: '01',
                  title: 'Confidential Consultation Request',
                  desc: 'Request your consultation online or connect with our Columbia, SC office directly. We accommodate virtual, phone, or in-person appointments.'
                },
                {
                  step: '02',
                  title: 'In-Depth Discovery & Document Review',
                  desc: 'We examine prior returns, corporate entities, income streams, and long-term financial goals to identify immediate risk areas and opportunities.'
                },
                {
                  step: '03',
                  title: 'Customized Strategic Plan',
                  desc: 'Our professionals design a tailored tax blueprint addressing deductions, compliance obligations, and entity-level optimizations.'
                },
                {
                  step: '04',
                  title: 'Meticulous Preparation & Secondary Audit',
                  desc: 'Your returns are prepared and verified through a rigorous internal quality check before authorized electronic transmission.'
                },
                {
                  step: '05',
                  title: 'Proactive Year-Round Guidance',
                  desc: 'We remain accessible throughout the year for quarterly estimates, life events, corporate expansions, and official tax correspondence.'
                }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className="p-4 sm:p-4.5 rounded-xl bg-[#0D2340]/60 border border-[#1E3A5F] flex items-start gap-4 hover:border-[#C99A3D]/40 transition-colors"
                >
                  <div className="font-serif text-lg font-bold text-[#E2BD67] w-8 flex-shrink-0 pt-0.5">
                    {item.step}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-white">{item.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* 6. BOOKKEEPING, FINANCIAL REPORTING & SECURE COLLABORATION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Bookkeeping and Secure Collaboration">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">
          
          {/* Left: Explanation of Real Integrations and Secure Workflow */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <span className="text-xs font-bold tracking-widest text-[#E2BD67] uppercase">
                Seamless Connectivity &amp; Reporting
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Accurate Financial Reporting &amp; Seamless Accounting Integration
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Connect your business bookkeeping smoothly to our secure advisory environment. We synchronize trial balances, charts of accounts, and ledger details through authorized read-only channels.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
              <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F]">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="text-xs font-bold text-white">QuickBooks Online</div>
                <div className="text-[11px] text-slate-400 mt-1">Direct chart of accounts sync</div>
              </div>
              <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F]">
                <TrendingUp className="w-5 h-5 text-sky-400 mb-2" />
                <div className="text-xs font-bold text-white">Xero Accounting</div>
                <div className="text-[11px] text-slate-400 mt-1">General ledger &amp; reconciliation</div>
              </div>
              <div className="p-4 rounded-xl bg-[#0D2340] border border-[#1E3A5F]">
                <Download className="w-5 h-5 text-amber-400 mb-2" />
                <div className="text-xs font-bold text-white">Secure Bank Feeds</div>
                <div className="text-[11px] text-slate-400 mt-1">CSV &amp; PDF statement intake</div>
              </div>
            </div>

            <div className="p-4.5 rounded-xl bg-[#07172B] border border-[#1E3A5F] space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#E2BD67]">
                <Lock className="w-4 h-4" />
                <span>Confidential Document Transfer &amp; Multi-Tier Review</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                All uploaded documents (W-2, 1099, K-1, profit &amp; loss statements) are transmitted using transport layer encryption (TLS). Every financial return undergoes rigorous manual verification by an authorized preparer prior to any filing.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-4">
              <button
                onClick={() => window.location.hash = '#/client/login'}
                className="px-6 py-3.5 rounded-xl font-bold text-xs text-[#07172B] bg-[#C99A3D] hover:bg-[#E2BD67] transition-all flex items-center gap-2"
                id="portal-upload-btn"
              >
                <span>Upload Documents via Client Portal</span>
                <UploadCloud className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right: Bookkeeping and Financial Workspace Image */}
          <div className="lg:col-span-5">
            <EditorialSplitImage
              srcJpg={BRAND_ASSETS.bookkeepingReportingJpg}
              srcWebp={BRAND_ASSETS.bookkeepingReportingWebp}
              alt="Accurate financial dashboard and general ledger reconciliation suite displaying chart of accounts, trial balance, and real-time bank integrations"
              caption="Financial Reporting & Reconciliation Suite"
              tag="Accounting Oversight"
              aspectRatio="4/3"
            />
          </div>

        </div>
      </section>

      {/* 7. PRIVATE ADVISORY ENGAGEMENTS (Credible Overview, No Public Price Tags) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Advisory Engagement Models">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold tracking-widest text-[#E2BD67] uppercase">
            Client Engagements
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Tailored Engagement Structures
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Every clientâ€™s financial blueprint is unique. Engagements are tailored to your entity complexity and filings required, with personalized proposals presented inside the secure client portal.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Tier 1 */}
          <div className="p-8 rounded-3xl bg-[#0D2340]/70 border border-[#1E3A5F] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-[#E2BD67] tracking-wider uppercase">Individual &amp; Family</span>
                <h3 className="font-serif text-2xl font-bold text-white mt-1">Individual Tax Advisory</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Designed for professionals, property owners, and high-earning households requiring thorough multi-state or complex schedule filing.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-3 border-t border-[#1E3A5F]/70">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Form 1040 Federal &amp; State Filings</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Schedule C &amp; Schedule E (Rental Real Estate)</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Comprehensive Deduction Substantiation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Prior-Year Review &amp; Analysis</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => setCurrentPage('book_consultation')}
              className="w-full py-3.5 rounded-xl text-xs font-bold text-slate-100 bg-[#07172B] hover:bg-[#132E52] border border-[#1E3A5F] hover:border-[#C99A3D] transition-all"
            >
              Inquire About Individual Filing
            </button>
          </div>

          {/* Tier 2 (Highlighted) */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-[#0D2340] to-[#07172B] border-2 border-[#C99A3D] shadow-2xl relative flex flex-col justify-between space-y-6">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#C99A3D] text-[#07172B] text-[11px] font-extrabold uppercase tracking-widest px-3.5 py-1 rounded-full shadow-md">
              Most Requested
            </div>
            <div className="space-y-4 pt-1">
              <div>
                <span className="text-xs font-bold text-[#E2BD67] tracking-wider uppercase">Business &amp; Founders</span>
                <h3 className="font-serif text-2xl font-bold text-white mt-1">Corporate &amp; Entity Advisory</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Specialized compliance and strategic quarterly positioning for LLCs, S-Corporations, and partnerships seeking capital efficiency.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-3 border-t border-[#1E3A5F]/70">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Form 1120-S &amp; Form 1065 Returns</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Quarterly Estimated Tax Management</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Multi-State Apportionment Review</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Year-End Accounting Synchronization</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => setCurrentPage('book_consultation')}
              className="w-full py-3.5 rounded-xl text-xs font-bold text-[#07172B] bg-[#C99A3D] hover:bg-[#E2BD67] transition-all shadow-md"
            >
              Request Corporate Consultation
            </button>
          </div>

          {/* Tier 3 */}
          <div className="p-8 rounded-3xl bg-[#0D2340]/70 border border-[#1E3A5F] flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold text-[#E2BD67] tracking-wider uppercase">Comprehensive Oversight</span>
                <h3 className="font-serif text-2xl font-bold text-white mt-1">Executive Advisory Retainer</h3>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Ongoing year-round strategic oversight for high-net-worth clients, multiple entities, and intergenerational trust coordination.
              </p>
              <ul className="space-y-2.5 text-xs text-slate-300 pt-3 border-t border-[#1E3A5F]/70">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Year-Round Priority Advisor Access</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Entity Restructuring &amp; Tax Modeling</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>Estate &amp; Attorney Legal Coordination</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#C99A3D] flex-shrink-0" />
                  <span>IRS Notice Defense &amp; Representation</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => setCurrentPage('book_consultation')}
              className="w-full py-3.5 rounded-xl text-xs font-bold text-slate-100 bg-[#07172B] hover:bg-[#132E52] border border-[#1E3A5F] hover:border-[#C99A3D] transition-all"
            >
              Inquire About Executive Advisory
            </button>
          </div>
        </div>
      </section>

      {/* 8. CLIENT PERSPECTIVES & TESTIMONIALS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Client Perspectives">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold tracking-widest text-[#E2BD67] uppercase">
            Client Perspectives
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Real Relationships. Tangible Results.
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            What business owners, executives, and families say about working with A/R Tax Services, LLC.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS_DATA.slice(0, 3).map((item) => (
            <div 
              key={item.id}
              className="p-7 sm:p-8 rounded-2xl bg-[#0D2340]/60 border border-[#1E3A5F] flex flex-col justify-between space-y-4 hover:border-[#C99A3D]/40 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-[#C99A3D]">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-slate-200 italic leading-relaxed">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-[#1E3A5F]/70 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-sm font-bold text-white">{item.name}</h3>
                  <p className="text-[11px] text-[#E2BD67]">{item.company}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{item.location}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 9. FINAL EXECUTIVE CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Call to Action">
        <div className="relative rounded-3xl overflow-hidden border border-[#C99A3D]/50 shadow-2xl">
          
          {/* Executive Suite Background Image with Restrained Navy Overlay */}
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
                referrerPolicy="no-referrer"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-r from-[#06172C] via-[#06172C]/90 to-[#06172C]/85" />
          </div>

          <div className="relative z-10 p-8 sm:p-14 lg:p-18 text-center max-w-3xl mx-auto space-y-6">
            <span className="text-xs font-bold tracking-widest text-[#E2BD67] uppercase">
              Begin Your Engagement
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              &ldquo;Your Financial Goals Are Within Reach.&rdquo;
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Take the first step toward disciplined tax strategy, financial protection, and generational wealth preservation. Schedule a confidential consultation with Desmond Hinds and the A/R Tax Services team today.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setCurrentPage('book_consultation')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm text-[#07172B] bg-[#C99A3D] hover:bg-[#E2BD67] transition-all shadow-xl active:scale-[0.99]"
                id="cta-schedule-btn"
              >
                Schedule Your Confidential Consultation
              </button>
              <button
                onClick={() => setCurrentPage('contact')}
                className="w-full sm:w-auto px-7 py-4 rounded-xl font-semibold text-sm text-white bg-[#0D2340] hover:bg-[#132E52] border border-[#1E3A5F] hover:border-[#C99A3D]/50 transition-all"
                id="cta-contact-btn"
              >
                Contact Our Columbia Office
              </button>
            </div>

            {/* Factual, Verified Legal Disclaimer */}
            <div className="pt-6 border-t border-[#1E3A5F]/70 text-[11px] text-slate-400 max-w-2xl mx-auto leading-relaxed">
              General Information Notice: The information presented on this website is for general educational purposes and does not constitute individualized tax, legal, or investment advice. Specific advice requires a formal client engagement agreement. A/R Tax Services, LLC is a private tax preparation and financial consulting firm based in Columbia, South Carolina.
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};



