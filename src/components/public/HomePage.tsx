import React, { useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { TESTIMONIALS_DATA } from '../../data/mockData';
import { BrandLogo } from '../common/BrandLogo';
import { BRAND_ASSETS } from '../../utils/assets';
import { ServiceCardImage, EditorialSplitImage } from './images';
import {
  ShieldCheck,
  Clock,
  Users,
  Lock,
  ArrowRight,
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
  FileCheck2,
  Cpu,
  Sparkles,
  FileCheck,
  CheckCircle2
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const { setCurrentPage } = useApp();

  useEffect(() => {
    console.log('[DIAGNOSTIC] DESTRIA TAX SERVICES LLC Homepage mounted successfully');
  }, []);

  return (
    <div className="space-y-24 sm:space-y-28 lg:space-y-32 pb-24 text-slate-100 selection:bg-[#C99A35] selection:text-[#071D3A]">

      {/* 1. HERO SECTION: DESTRIA EXECUTIVE & AI TAX INTELLIGENCE SHOWCASE */}
      <section className="relative pt-6 pb-16 sm:pt-10 sm:pb-20 md:pt-14 md:pb-24 overflow-hidden" aria-label="Introduction and Overview">
        {/* Architectural atmospheric glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none opacity-25" aria-hidden="true">
          <div className="absolute -top-24 left-1/4 w-[28rem] h-[28rem] rounded-full bg-[#C99A35] blur-[140px]" />
          <div className="absolute top-1/3 right-10 w-[30rem] h-[30rem] rounded-full bg-[#1677C8] blur-[160px]" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">

            {/* Left Column: Authoritative Positioning & Clear Conversion Path */}
            <div className="lg:col-span-7 space-y-6 sm:space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2745] border border-[#C99A35]/40 text-[#E5B552] text-xs font-semibold tracking-wide shadow-sm">
                <Cpu className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Dual-Engine Financial Intelligence &bull; CPA Authority + AI Acceleration</span>
              </div>

              <div className="space-y-4">
                <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[52px] font-extrabold tracking-tight text-white leading-[1.15] break-words">
                  Intelligent Tax Preparation, Advisory &amp;{' '}
                  <span className="block text-[#E5B552] mt-1">Wealth Planning for Leaders.</span>
                </h1>

                <p className="text-base sm:text-lg text-slate-300 max-w-2xl font-normal leading-relaxed">
                  DESTRIA TAX SERVICES LLC combines seasoned CPA tax authority with private AI verification technology. We deliver high-precision tax preparation, forward-looking deduction optimization, and bank-grade audit resilience for founders, corporate executives, and high-net-worth families.
                </p>
              </div>

              {/* Action Buttons: Unified Conversion Hierarchy */}
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                <button
                  onClick={() => setCurrentPage('book_consultation')}
                  className="px-7 py-4 rounded-xl font-bold text-sm text-[#071D3A] bg-gradient-to-r from-[#C99A35] via-[#E5B552] to-[#C99A35] hover:brightness-105 shadow-xl transition-all flex items-center justify-center gap-2.5 group whitespace-nowrap active:scale-[0.99]"
                  id="hero-schedule-btn"
                >
                  <Calendar className="w-4 h-4 text-[#071D3A]" />
                  <span>Schedule Confidential Consultation</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <a
                  href="/portal"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage('portal');
                  }}
                  className="px-6 py-4 rounded-xl font-semibold text-sm text-slate-100 bg-[#0D2745] hover:bg-[#133860] border border-[#1677C8]/40 hover:border-[#C99A35]/60 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                  id="hero-portal-btn"
                  role="link"
                >
                  <Lock className="w-4 h-4 text-[#C99A35]" />
                  <span>Secure Client Portal</span>
                </a>
              </div>

              {/* 4 Trust & Governance Indicators */}
              <div className="pt-6 border-t border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2745] text-[#C99A35] border border-slate-700 flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-none">Dual-Layer Review</div>
                    <span className="text-[11px] text-slate-400">CPA + AI Logic</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2745] text-[#C99A35] border border-slate-700 flex-shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-none">Year-Round</div>
                    <span className="text-[11px] text-slate-400">Strategic Advisory</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2745] text-[#C99A35] border border-slate-700 flex-shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-none">Direct Access</div>
                    <span className="text-[11px] text-slate-400">Dedicated Advisor</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#0D2745] text-[#C99A35] border border-slate-700 flex-shrink-0">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white leading-none">SOC-2 &amp; TLS</div>
                    <span className="text-[11px] text-slate-400">Private Vault</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Authoritative Official Destria Emblem & Showcase */}
            <div className="lg:col-span-5 relative">
              <figure className="relative rounded-3xl bg-gradient-to-b from-[#0D2745] to-[#071D3A] border-2 border-[#C99A35]/50 p-6 sm:p-7 shadow-2xl space-y-5">

                {/* Firm Identifier Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-700/80">
                  <div className="flex items-center gap-3">
                    <img
                      src={BRAND_ASSETS.destriaLogo}
                      alt="DESTRIA TAX SERVICES LLC"
                      className="w-10 h-10 rounded-full shadow-md ring-1 ring-[#C99A35]"
                    />
                    <div>
                      <div className="text-xs font-bold text-white tracking-wider">DESTRIA TAX SERVICES LLC</div>
                      <div className="text-[10px] text-[#E5B552]">TAX PREPARATION, ADVISORY &amp; WEALTH PLANNING</div>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#071D3A] text-[#E5B552] border border-[#C99A35]/40">
                    Active Practice
                  </span>
                </div>

                {/* Master Official Circular Logo Feature */}
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-[#C99A35]/30 bg-[#071D3A] p-3 sm:p-4 shadow-inner flex items-center justify-center">
                  <img
                    id="home-hero-destria-logo"
                    src={BRAND_ASSETS.destriaLogo}
                    alt="DESTRIA TAX SERVICES LLC - Official Circular Emblem with D, Tax Document, and AI Neural Circuit"
                    className="w-full h-full rounded-full object-contain drop-shadow-xl"
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                  />
                </div>

                {/* Practice Location & Status Strip */}
                <div className="flex items-center justify-between text-xs text-slate-300 px-0.5 pt-0.5">
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-[#C99A35] flex-shrink-0" />
                    <span className="text-[11px] sm:text-xs">Columbia, SC &bull; Nationwide Client Support</span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-[#E5B552] px-2 py-0.5 rounded bg-[#071D3A] border border-[#C99A35]/40">
                    AI + Human CPA
                  </span>
                </div>

                {/* Firm Mission Banner */}
                <div className="p-3.5 rounded-xl bg-[#071D3A] border border-slate-700">
                  <div className="text-[11px] font-bold text-[#E5B552] tracking-wider uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#C99A35]" />
                    <span>Intelligent Tax Acceleration</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Automated document OCR, Schedule M-1 / M-3 book-to-tax cross-validation, and audit trace records reviewed by credentialed practitioners.
                  </p>
                </div>

                {/* Direct Action Link to Services */}
                <button
                  onClick={() => setCurrentPage('services')}
                  className="w-full py-3 rounded-xl text-xs font-bold text-[#071D3A] bg-[#C99A35] hover:bg-[#E5B552] transition-colors flex items-center justify-center gap-2"
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

      {/* 2. THE FOUR FOUNDATIONAL PILLARS OF DESTRIA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Core Advisory Principles">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold tracking-widest text-[#E5B552] uppercase">
            Our Foundation
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            The Four Pillars of DESTRIA
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Guided by principle, executed with technological precision. Every client engagement is anchored in these foundational commitments.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1: Growth */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0D2745]/60 border border-slate-700 hover:border-[#C99A35]/60 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#071D3A] border border-slate-700 flex items-center justify-center text-[#C99A35] mb-5 group-hover:scale-105 transition-transform shadow-inner">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">Growth</h3>
              <div className="text-xs font-semibold text-[#E5B552] mb-2.5 uppercase tracking-wider">
                Unlocking Capital Efficiency
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                We uncover high-value deductions, entity advantages, and research &amp; development tax credits that preserve working capital for business expansion.
              </p>
            </div>
          </div>

          {/* Pillar 2: Protection */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0D2745]/60 border border-slate-700 hover:border-[#C99A35]/60 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#071D3A] border border-slate-700 flex items-center justify-center text-[#C99A35] mb-5 group-hover:scale-105 transition-transform shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">Protection</h3>
              <div className="text-xs font-semibold text-[#E5B552] mb-2.5 uppercase tracking-wider">
                Audit Trace Verification
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Through our multi-tier human CPA verification and automated mathematical cross-checks, every line item is substantiated for complete audit resilience.
              </p>
            </div>
          </div>

          {/* Pillar 3: Technology */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0D2745]/60 border border-slate-700 hover:border-[#C99A35]/60 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#071D3A] border border-slate-700 flex items-center justify-center text-[#C99A35] mb-5 group-hover:scale-105 transition-transform shadow-inner">
                <Cpu className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">Technology</h3>
              <div className="text-xs font-semibold text-[#E5B552] mb-2.5 uppercase tracking-wider">
                AI Financial Acceleration
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Intelligent source document OCR, automated general ledger reconciliation, and instant discrepancies identification ensure error-free tax packages.
              </p>
            </div>
          </div>

          {/* Pillar 4: Legacy */}
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0D2745]/60 border border-slate-700 hover:border-[#C99A35]/60 transition-all group flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#071D3A] border border-slate-700 flex items-center justify-center text-[#C99A35] mb-5 group-hover:scale-105 transition-transform shadow-inner">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="font-serif text-xl font-bold text-white mb-2">Legacy</h3>
              <div className="text-xs font-semibold text-[#E5B552] mb-2.5 uppercase tracking-wider">
                Multi-Generational Wealth
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                We coordinate long-term trust, estate, and gift tax frameworks designed to transfer family and enterprise prosperity with minimal tax exposure.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAJOR ADVISORY & COMPLIANCE CAPABILITIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Practice Capabilities">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 sm:mb-16 gap-6">
          <div className="space-y-3 max-w-2xl">
            <span className="text-xs font-bold tracking-widest text-[#E5B552] uppercase">
              Core Capabilities
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Intelligent Tax Preparation &amp; Strategic Advisory
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              Full-cycle tax preparation, corporate compliance, and wealth preservation tailored for discerning individuals and growing business enterprises.
            </p>
          </div>
          <button
            onClick={() => setCurrentPage('services')}
            className="text-xs font-bold text-[#E5B552] hover:text-white flex items-center gap-1.5 transition-colors self-start md:self-end py-2"
          >
            <span>View Full Service Catalog</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          {/* Card 1: Tax Advisory and Planning */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0D2745] border border-slate-700 hover:border-[#C99A35]/60 transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <ServiceCardImage
                src={BRAND_ASSETS.taxAdvisoryPlanningJpg}
                webpSrc={BRAND_ASSETS.taxAdvisoryPlanningWebp}
                alt="Professional tax advisor discussing strategic tax planning with a client"
                categoryBadge="Tax Advisory & Strategy"
                icon={<Workflow className="w-5 h-5 text-[#C99A35]" />}
              />
              <h3 className="font-serif text-2xl font-bold text-white">Tax Advisory &amp; Strategic Planning</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Strategic federal and multistate tax planning engineered to legally minimize liabilities, model future transactions, and optimize entity structures.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-700/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Strategic Entity Selection &amp; Tax Structuring (LLC, S-Corp, C-Corp)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Quarterly Tax Projections &amp; Estimated Payment Schedules</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Section 199A QBI &amp; State Pass-Through Entity Tax (PTET) Optimization</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>IRS Transcript Review &amp; Statutory Resolution Guidance</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Business and Corporate Services */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0D2745] border border-slate-700 hover:border-[#C99A35]/60 transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <ServiceCardImage
                src={BRAND_ASSETS.corporateBusinessAdvisoryJpg}
                webpSrc={BRAND_ASSETS.corporateBusinessAdvisoryWebp}
                alt="Business professionals reviewing corporate financial and advisory matters"
                categoryBadge="Corporate & Enterprise"
                icon={<Building2 className="w-5 h-5 text-[#C99A35]" />}
              />
              <h3 className="font-serif text-2xl font-bold text-white">Corporate Compliance &amp; Entity Filings</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Comprehensive compliance and filing services for enterprise owners, partnerships, and operating companies across multiple state jurisdictions.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-700/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Form 1120-S (S-Corporation) &amp; Form 1065 (Partnership) Filings</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Multistate Corporate Nexus &amp; Apportionment Analysis</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Owner Reasonable Compensation Study &amp; Executive Payroll Review</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Electronic K-1 Distribution via Encrypted Client Portal</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Wealth, Estate and Asset Protection */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0D2745] border border-slate-700 hover:border-[#C99A35]/60 transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <ServiceCardImage
                src={BRAND_ASSETS.estateLegacyPlanningJpg}
                webpSrc={BRAND_ASSETS.estateLegacyPlanningWebp}
                alt="Advisor consulting with clients on wealth, estate and asset protection planning"
                categoryBadge="Asset Protection & Legacy"
                icon={<Scale className="w-5 h-5 text-[#C99A35]" />}
              />
              <h3 className="font-serif text-2xl font-bold text-white">Wealth, Estate &amp; Asset Protection</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Coordinating with estate attorneys and family fiduciaries to ensure assets transfer with minimal tax friction and maximum structural protection.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-700/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Revocable &amp; Irrevocable Trust Tax Organization</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Estate &amp; Gift Tax Advisory &amp; Form 706 / 709 Preparation</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Succession Planning &amp; Intergenerational Wealth Transfer</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Seamless Collaboration with Licensed Estate Legal Counsel</span>
              </li>
            </ul>
          </div>

          {/* Card 4: Meticulous Tax Preparation */}
          <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#0D2745] border border-slate-700 hover:border-[#C99A35]/60 transition-all flex flex-col justify-between space-y-6 group">
            <div className="space-y-4">
              <ServiceCardImage
                src={BRAND_ASSETS.meticulousTaxPrepJpg}
                webpSrc={BRAND_ASSETS.meticulousTaxPrepWebp}
                alt="Tax professional carefully reviewing tax documents and financial records"
                categoryBadge="Accuracy & Compliance"
                icon={<FileCheck2 className="w-5 h-5 text-[#C99A35]" />}
              />
              <h3 className="font-serif text-2xl font-bold text-white">Meticulous Individual Tax Filings</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Exhaustive review standards applied to every individual return. Every line item is verified for complete audit protection and maximum legitimate deductions.
              </p>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-300 pt-4 border-t border-slate-700/80">
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Form 1040 Federal &amp; 50-State Income Tax Returns</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Multi-Tier Dual Review (CPA Verification + AI Mathematical Engine)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Complex Schedule C, Schedule E (Real Estate) &amp; K-1 Pass-Throughs</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="w-4 h-4 text-[#C99A35] flex-shrink-0" />
                <span>Authorized IRS e-File Transmission with Real-Time Acceptance Tracking</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* 4. METHODOLOGY: THE DESTRIA 5-STAGE ADVISORY PROCESS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Advisory Methodology">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">

          <div className="lg:col-span-5 order-2 lg:order-1">
            <EditorialSplitImage
              srcJpg={BRAND_ASSETS.privateConsultationExpJpg}
              srcWebp={BRAND_ASSETS.privateConsultationExpWebp}
              alt="Professional tax advisor and client in a confidential consultation discussing structured tax strategy"
              caption="Confidential One-on-One Advisory"
              tag="Personal Attention"
              aspectRatio="4/3"
            />
          </div>

          <div className="lg:col-span-7 order-1 lg:order-2 space-y-6">
            <div className="space-y-3">
              <span className="text-xs font-bold tracking-widest text-[#E5B552] uppercase">
                Methodology
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Our Structured Advisory Journey
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Structured, transparent, and responsive from initial document intake to finalized e-filing and year-round strategic advisory.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              {[
                {
                  step: '01',
                  title: 'Confidential Consultation & Scope Definition',
                  desc: 'Schedule your initial consultation online. We accommodate virtual video meetings, direct phone conferences, or private in-person appointments.'
                },
                {
                  step: '02',
                  title: 'Secure Document Vault & Intelligent OCR Ingestion',
                  desc: 'Upload prior returns, W-2s, 1099s, and financial statements. Our private OCR system indexes line items and highlights potential omissions.'
                },
                {
                  step: '03',
                  title: 'Tailored Tax Reduction Blueprint',
                  desc: 'Our credentialed practitioners design a customized tax plan evaluating entity elections, timing deductions, and available statutory tax credits.'
                },
                {
                  step: '04',
                  title: 'Dual-Layer Review & Attestation Audit',
                  desc: 'Your returns undergo rigorous dual-layer quality verification (human CPA authorization plus mathematical model validation) prior to client signoff.'
                },
                {
                  step: '05',
                  title: 'Year-Round Proactive Advisory',
                  desc: 'We remain your trusted partners throughout the year for quarterly estimates, entity restructuring, real estate acquisitions, and IRS correspondence.'
                }
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 sm:p-4.5 rounded-xl bg-[#0D2745]/60 border border-slate-700 flex items-start gap-4 hover:border-[#C99A35]/40 transition-colors"
                >
                  <div className="font-serif text-lg font-bold text-[#E5B552] w-8 flex-shrink-0 pt-0.5">
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

      {/* 5. BOOKKEEPING, FINANCIAL REPORTING & SECURE COLLABORATION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Bookkeeping and Secure Collaboration">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 xl:gap-14 items-center">

          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <span className="text-xs font-bold tracking-widest text-[#E5B552] uppercase">
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
              <div className="p-4 rounded-xl bg-[#0D2745] border border-slate-700">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="text-xs font-bold text-white">QuickBooks Online</div>
                <div className="text-[11px] text-slate-400 mt-1">Direct chart of accounts sync</div>
              </div>
              <div className="p-4 rounded-xl bg-[#0D2745] border border-slate-700">
                <TrendingUp className="w-5 h-5 text-sky-400 mb-2" />
                <div className="text-xs font-bold text-white">Xero Accounting</div>
                <div className="text-[11px] text-slate-400 mt-1">General ledger &amp; reconciliation</div>
              </div>
              <div className="p-4 rounded-xl bg-[#0D2745] border border-slate-700">
                <Download className="w-5 h-5 text-amber-400 mb-2" />
                <div className="text-xs font-bold text-white">Secure Bank Feeds</div>
                <div className="text-[11px] text-slate-400 mt-1">CSV &amp; PDF statement intake</div>
              </div>
            </div>

            <div className="p-4.5 rounded-xl bg-[#071D3A] border border-slate-700 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#E5B552]">
                <Lock className="w-4 h-4" />
                <span>Confidential Document Transfer &amp; Dual-Review Controls</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                All client documents (W-2, 1099, K-1, P&amp;L statements) are encrypted in transit and at rest. Every return undergoes rigorous manual verification by an authorized preparer prior to any filing.
              </p>
            </div>

            <div className="pt-2 flex items-center gap-4">
              <a
                href="/portal"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage('portal');
                }}
                className="px-6 py-3.5 rounded-xl font-bold text-xs text-[#071D3A] bg-[#C99A35] hover:bg-[#E5B552] transition-all flex items-center gap-2 shadow-md"
                id="portal-upload-btn"
                role="link"
              >
                <span>Access Secure Client Portal</span>
                <UploadCloud className="w-4 h-4" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-5">
            <EditorialSplitImage
              srcJpg={BRAND_ASSETS.bookkeepingReportingJpg}
              srcWebp={BRAND_ASSETS.bookkeepingReportingWebp}
              alt="Executive financial reporting and accounting workstation with financial ledger and digital integration"
              caption="Financial Reporting &amp; Reconciliation"
              tag="Accounting Oversight"
              aspectRatio="4/3"
            />
          </div>

        </div>
      </section>

      {/* 6. CLIENT TESTIMONIALS & PERSPECTIVES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Client Perspectives">
        <div className="text-center max-w-2xl mx-auto space-y-3 mb-12 sm:mb-16">
          <span className="text-xs font-bold tracking-widest text-[#E5B552] uppercase">
            Client Perspectives
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Enduring Client Partnerships
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            What business owners, executives, and families say about working with DESTRIA TAX SERVICES LLC.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS_DATA.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="p-7 sm:p-8 rounded-2xl bg-[#0D2745]/60 border border-slate-700 flex flex-col justify-between space-y-4 hover:border-[#C99A35]/40 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-1 text-[#C99A35]">
                  {[...Array(item.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-xs sm:text-sm text-slate-200 italic leading-relaxed">
                  &ldquo;{item.quote}&rdquo;
                </p>
              </div>

              <div className="pt-4 border-t border-slate-700/70 flex items-center justify-between">
                <div>
                  <h3 className="font-serif text-sm font-bold text-white">{item.name}</h3>
                  <p className="text-[11px] text-[#E5B552]">{item.company}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">{item.location}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 7. FINAL EXECUTIVE CALL TO ACTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" aria-label="Call to Action">
        <div className="relative rounded-3xl overflow-hidden border border-[#C99A35]/50 shadow-2xl">

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
            <div className="absolute inset-0 bg-gradient-to-r from-[#071D3A] via-[#071D3A]/90 to-[#071D3A]/85" />
          </div>

          <div className="relative z-10 p-8 sm:p-14 lg:p-18 text-center max-w-3xl mx-auto space-y-6">
            <span className="text-xs font-bold tracking-widest text-[#E5B552] uppercase">
              Begin Your Engagement
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight">
              &ldquo;Your Financial Future Deserves Intelligent Leadership.&rdquo;
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto">
              Take the first step toward disciplined tax strategy, audit-grade compliance, and generational wealth preservation. Connect with DESTRIA TAX SERVICES LLC today.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => setCurrentPage('book_consultation')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl font-bold text-sm text-[#071D3A] bg-[#C99A35] hover:bg-[#E5B552] transition-all shadow-xl active:scale-[0.99]"
                id="cta-schedule-btn"
              >
                Schedule Confidential Consultation
              </button>
              <button
                onClick={() => setCurrentPage('contact')}
                className="w-full sm:w-auto px-7 py-4 rounded-xl font-semibold text-sm text-white bg-[#0D2745] hover:bg-[#133860] border border-slate-700 hover:border-[#C99A35]/50 transition-all"
                id="cta-contact-btn"
              >
                Contact Our Columbia Office
              </button>
            </div>

            <div className="pt-6 border-t border-slate-700/70 text-[11px] text-slate-400 max-w-2xl mx-auto leading-relaxed">
              General Information Notice: The information presented on this website is for general educational purposes and does not constitute individualized tax, legal, or investment advice. Specific advice requires a formal client engagement agreement. DESTRIA TAX SERVICES LLC is a registered tax preparation and financial consulting practice.
            </div>
          </div>
        </div>
      </section>

    </div>
  );
};
