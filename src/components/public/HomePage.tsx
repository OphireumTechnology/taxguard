import React, { useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { COMPANY_BRANDING, COMPANY_CONTACT, COMPANY_MAILTO_HREF } from '../../config/companyBranding';
import { BRAND_ASSETS } from '../../utils/assets';
import { FounderPortrait } from './images';
import { HeroFinancialEcosystem } from './home/HeroFinancialEcosystem';
import { IntelligenceCapabilitiesSection } from './home/IntelligenceCapabilitiesSection';
import { TaxWorkflowDemonstration } from './home/TaxWorkflowDemonstration';
import { CoreServicesShowcase } from './home/CoreServicesShowcase';
import { BlockchainIntegritySection } from './home/BlockchainIntegritySection';
import { FinancialAnalyticsShowcase } from './home/FinancialAnalyticsShowcase';
import { SecurityArchitectureSection } from './home/SecurityArchitectureSection';
import { HumanAiCollaborationSection } from './home/HumanAiCollaborationSection';
import { useInViewMotion } from './home/useInViewMotion';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Cpu,
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
  UtensilsCrossed,
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
    <div className="space-y-20 sm:space-y-24 lg:space-y-28 pb-20 text-slate-100 selection:bg-[#D4A843] selection:text-[#071D3A]">
      {/* 2. ENTERPRISE INTELLIGENT TAX & FINANCIAL TECHNOLOGY HERO SECTION */}
      <section
        ref={heroRef}
        className="relative pt-6 pb-10 sm:pt-8 sm:pb-12 lg:pt-10 lg:pb-14 overflow-x-clip border-b border-slate-800/60"
        aria-label="Destria Tax Services Intelligent Financial Technology Overview"
      >
        {/* Subtle Architectural Grid, Restrained Gold & Sapphire Illumination, and Ambient Particles */}
        <div
          className={`absolute inset-0 pointer-events-none overflow-hidden ${heroMotionActive ? '' : 'destria-motion-paused'}`}
          aria-hidden="true"
        >
          <div className="absolute inset-0 destria-tech-grid-bg opacity-35 [mask-image:radial-gradient(ellipse_82%_78%_at_50%_42%,black_20%,transparent_100%)]" />
          <div className="absolute -top-24 left-[12%] w-[26rem] h-[26rem] rounded-full bg-[#D4A843]/[0.08] blur-[150px]" />
          <div className="absolute top-[18%] right-[8%] w-[30rem] h-[30rem] rounded-full bg-[#3B82F6]/[0.09] blur-[165px]" />

          {/* Subtle Abstract Blockchain Nodes & Financial Data Pathways Spanning Hero Background */}
          <svg
            viewBox="0 0 1280 560"
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 w-full h-full opacity-50"
          >
            <defs>
              <linearGradient id="destriaHeroConnector" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#D4A843" stopOpacity="0" />
                <stop offset="35%" stopColor="#D4A843" stopOpacity="0.32" />
                <stop offset="70%" stopColor="#60A5FA" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#60A5FA" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M 40 430 L 210 430 L 260 390 L 510 390 L 580 340 L 760 340"
              fill="none"
              stroke="url(#destriaHeroConnector)"
              strokeWidth="1"
              className="destria-neural-stream"
            />
            <path
              d="M 80 110 L 340 110 L 390 148 L 620 148"
              fill="none"
              stroke="rgba(212, 168, 67, 0.16)"
              strokeWidth="0.9"
            />
            <circle cx="210" cy="430" r="2.5" fill="#D4A843" fillOpacity="0.45" />
            <circle cx="260" cy="390" r="2.5" fill="#60A5FA" fillOpacity="0.45" />
            <circle cx="510" cy="390" r="2.5" fill="#D4A843" fillOpacity="0.4" />
            <circle cx="340" cy="110" r="2" fill="#D4A843" fillOpacity="0.38" />
            <circle cx="390" cy="148" r="2" fill="#60A5FA" fillOpacity="0.38" />
          </svg>
        </div>

        {/* Flush Alignment with Navigation Header (max-w-7xl = 1280px, identical horizontal padding) */}
        <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-12 items-center">
            {/* Left Column (50%): Refined Executive Wording + Integrated FinTech Micro-Graphics */}
            <div className="lg:col-span-6 relative min-w-0 text-left space-y-6 sm:space-y-7 destria-hero-enter">
              {/* Brand Identifier + Subtle Financial Analytics Upward Trend Micro-Graphic */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="inline-flex items-center gap-3">
                  <span
                    className="h-px w-7 bg-gradient-to-r from-[#E5B552] to-[#D4A843]/30 flex-shrink-0"
                    aria-hidden="true"
                  />
                  <p className="text-[11px] sm:text-xs font-semibold tracking-[0.18em] text-[#E5B552] uppercase">
                    {COMPANY_BRANDING.uppercaseName}
                  </p>
                </div>

                {/* Minimalist Financial Analytics & Blockchain Node Micro-Visualization */}
                <svg
                  viewBox="0 0 132 28"
                  className="hidden sm:block w-[124px] h-[26px] flex-shrink-0 opacity-85"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient id="destriaTrendStroke" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#E5B552" stopOpacity="0.95" />
                    </linearGradient>
                  </defs>
                  <line x1="2" y1="24" x2="130" y2="24" stroke="rgba(148,163,184,0.22)" strokeWidth="0.8" />
                  <rect x="8" y="18" width="4" height="6" rx="0.8" fill="rgba(96,165,250,0.32)" />
                  <rect x="20" y="15" width="4" height="9" rx="0.8" fill="rgba(96,165,250,0.42)" />
                  <rect x="32" y="12" width="4" height="12" rx="0.8" fill="rgba(212,168,67,0.45)" />
                  <rect x="44" y="8" width="4" height="16" rx="0.8" fill="rgba(229,181,82,0.72)" />
                  <path
                    d="M 58 20 L 76 15 L 94 17 L 112 9 L 126 5"
                    fill="none"
                    stroke="url(#destriaTrendStroke)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="76" cy="15" r="2" fill="#60A5FA" />
                  <circle cx="112" cy="9" r="2" fill="#D4A843" />
                  <circle cx="126" cy="5" r="2.6" fill="#E5B552" />
                </svg>
              </div>

              {/* Primary Serif Headline + Concise Supporting Line with Intelligence Circuit Symbol */}
              <div className="space-y-4">
                <h1 className="font-serif text-[clamp(2.35rem,4.1vw,3.75rem)] font-bold tracking-tight text-white leading-[1.08] [text-wrap:balance]">
                  <span className="block">Intelligent Tax.</span>
                  <span className="block text-[#E5B552] mt-1">Advanced Finance.</span>
                </h1>

                {/* Supporting Headline with Intelligence Circuit Icon & Fine Gold Connecting Line */}
                <div className="flex items-center gap-3 pt-0.5">
                  <svg
                    viewBox="0 0 24 24"
                    className="w-5 h-5 text-[#E5B552] flex-shrink-0"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
                    <circle cx="12" cy="12" r="2" fill="#60A5FA" />
                    <path
                      d="M12 2.5V7M12 17V21.5M2.5 12H7M17 12H21.5M5.5 5.5L7.5 7.5M16.5 16.5L18.5 18.5M18.5 5.5L16.5 7.5M7.5 16.5L5.5 18.5"
                      stroke="currentColor"
                      strokeWidth="1.35"
                      strokeLinecap="round"
                    />
                  </svg>
                  <p className="text-base sm:text-lg font-medium tracking-[0.02em] text-white">
                    AI-Powered. Human-Led.
                  </p>
                  <span
                    className="hidden sm:block h-px flex-1 max-w-[140px] bg-gradient-to-r from-[#D4A843]/60 via-[#60A5FA]/35 to-transparent"
                    aria-hidden="true"
                  />
                </div>

                {/* Concise Introductory Description */}
                <p className="text-[15px] sm:text-base text-[#B8C5D6] max-w-xl font-normal leading-relaxed">
                  Tax, accounting and wealth planning enhanced by intelligent technology and professional expertise.
                </p>
              </div>

              {/* Three Compact Modern Visual Intelligence Indicators */}
              <div
                className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-0 pt-1 border-y border-slate-700/55 py-4"
                aria-label="Core Intelligence Pillars"
              >
                <div className="flex items-center gap-2.5 sm:pr-4">
                  <span
                    className="w-8 h-8 rounded-lg bg-[#0A213D]/90 border border-[#D4A843]/35 flex items-center justify-center text-[#E5B552] flex-shrink-0"
                    aria-hidden="true"
                  >
                    <Cpu className="w-4 h-4" />
                  </span>
                  <span className="text-xs sm:text-[13px] font-medium text-slate-100 whitespace-nowrap">
                    AI Intelligence
                  </span>
                </div>

                <div className="flex items-center gap-2.5 sm:px-4 sm:border-l sm:border-slate-700/55">
                  <span
                    className="w-8 h-8 rounded-lg bg-[#0A213D]/90 border border-[#D4A843]/35 flex items-center justify-center text-[#E5B552] flex-shrink-0"
                    aria-hidden="true"
                  >
                    <ShieldCheck className="w-4 h-4" />
                  </span>
                  <span className="text-xs sm:text-[13px] font-medium text-slate-100 whitespace-nowrap">
                    Secure Digital Vault
                  </span>
                </div>

                <div className="flex items-center gap-2.5 sm:pl-4 sm:border-l sm:border-slate-700/55">
                  <span
                    className="w-8 h-8 rounded-lg bg-[#0A213D]/90 border border-[#D4A843]/35 flex items-center justify-center text-[#E5B552] flex-shrink-0"
                    aria-hidden="true"
                  >
                    <Scale className="w-4 h-4" />
                  </span>
                  <span className="text-xs sm:text-[13px] font-medium text-slate-100 whitespace-nowrap">
                    Professional Expertise
                  </span>
                </div>
              </div>

              {/* Equal-Height, Horizontally Balanced Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 pt-0.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage('book_consultation')}
                  className="h-11 px-5 rounded-lg font-semibold text-xs sm:text-[13px] tracking-[0.02em] text-[#06182B] bg-gradient-to-r from-[#C99A35] via-[#E5B552] to-[#C99A35] hover:brightness-105 shadow-lg shadow-[#C99A35]/15 transition-all duration-150 inline-flex items-center justify-center gap-2 group whitespace-nowrap active:scale-[0.99]"
                  id="hero-schedule-btn"
                >
                  <span>Schedule Consultation</span>
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-150" />
                </button>

                <button
                  type="button"
                  onClick={handleExploreSolutions}
                  className="h-11 px-5 rounded-lg font-semibold text-xs sm:text-[13px] tracking-[0.02em] text-white bg-[#0C2544]/90 hover:bg-[#133860] border border-[#D4A843]/45 hover:border-[#E5B552] transition-all duration-150 inline-flex items-center justify-center whitespace-nowrap"
                  id="hero-explore-solutions-btn"
                >
                  <span>Explore Solutions</span>
                </button>

                <a
                  href="/portal"
                  onClick={(e) => {
                    e.preventDefault();
                    setCurrentPage('portal');
                  }}
                  className="h-11 px-5 rounded-lg font-medium text-xs sm:text-[13px] tracking-[0.02em] text-slate-200 hover:text-white bg-[#071A2E]/85 hover:bg-[#0D2745] border border-slate-700/85 hover:border-slate-500 transition-all duration-150 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                  id="hero-portal-btn"
                  role="link"
                >
                  <Lock className="w-3.5 h-3.5 text-[#E5B552] flex-shrink-0" />
                  <span>Client Portal</span>
                </a>
              </div>

              {/* Subtle Animated Data Particle Accents Along Bottom Left Edge */}
              <div
                className="pointer-events-none hidden lg:flex items-center gap-2 pt-1 opacity-60"
                aria-hidden="true"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#E5B552] destria-particle-float" />
                <span className="h-px w-12 bg-gradient-to-r from-[#E5B552]/70 to-[#60A5FA]/50" />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-[#60A5FA] destria-particle-float"
                  style={{ animationDelay: '1.2s' }}
                />
                <span className="h-px w-20 bg-gradient-to-r from-[#60A5FA]/50 to-transparent" />
              </div>
            </div>

            {/* Right Column (50%): Upgraded Seamless Financial Intelligence Ecosystem */}
            <div className="lg:col-span-6 relative min-w-0">
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

      {/* 6. CORE TAX, ACCOUNTING & ADVISORY SERVICES + INTELLIGENT ACCOUNTING SHOWCASE */}
      <CoreServicesShowcase onNavigate={setCurrentPage} />

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
