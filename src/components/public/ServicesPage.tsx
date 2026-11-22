import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FileCheck2,
  Building2,
  Scale,
  CreditCard,
  AlertCircle,
  History,
  LineChart,
  ScanText,
  FileSearch,
  HeartPulse,
  Briefcase,
  CalendarClock,
  Rocket,
  BookOpenCheck,
  MapPinned,
  Users,
  ScrollText,
  Landmark,
  KeyRound,
  Shield,
  Fingerprint,
  TrendingUp,
  BadgeDollarSign,
} from 'lucide-react';
import { useInViewMotion } from './home/useInViewMotion';
import {
  ServicesHeroSection,
  type ServiceCategoryId,
} from './services/ServicesHeroSection';
import { ServiceCategoryHeroBanner } from './services/ServiceCategoryHeroBanner';
import {
  ServiceOfferingCard,
  type ServiceOfferingItem,
} from './services/ServiceOfferingCard';
import { FinancialTransparencyFlow } from './services/FinancialTransparencyFlow';
import { AuditDefenseShowcase } from './services/AuditDefenseShowcase';
import { ServicesClosingCta } from './services/ServicesClosingCta';
import { CATEGORY_HERO_ASSETS } from './services/servicesVisualAssets';

const INDIVIDUAL_SERVICES: ServiceOfferingItem[] = [
  {
    id: 'ind_fed_state',
    index: '01',
    title: 'Federal & State Income Tax Preparation',
    desc: 'Comprehensive annual preparation of Form 1040 and all required state returns to ensure accurate filings and optimal liability management.',
    icon: FileCheck2,
  },
  {
    id: 'ind_amended',
    index: '02',
    title: 'Prior-Year & Amended Tax Returns (1040X)',
    desc: 'Identify missed deductions, correct past reporting mistakes, or file delinquent returns from previous tax seasons with confidence.',
    icon: History,
  },
  {
    id: 'ind_planning',
    index: '03',
    title: 'Tax Planning & Strategy Sessions',
    desc: 'Proactive year-round reviews analyzing withholding, retirement contributions, and timing strategies to mitigate upcoming tax burdens.',
    icon: LineChart,
  },
  {
    id: 'ind_w2_1099',
    index: '04',
    title: 'W-2, 1099 & Self-Employment Filings',
    desc: 'Accurate reporting for multi-employer wage earners, freelancers, gig economy participants, and independent 1099 contractors.',
    icon: ScanText,
  },
  {
    id: 'ind_transcript',
    index: '05',
    title: 'IRS Transcript Review & Analysis',
    desc: 'Direct retrieval and systematic audit of IRS transcripts to resolve account discrepancies, penalty notices, or historical records.',
    icon: FileSearch,
  },
  {
    id: 'ind_aca',
    index: '06',
    title: 'Affordable Care Act (ACA / Form 1095-A)',
    desc: 'Reconcile premium tax credits, handle Form 8962 calculations, and resolve Health Insurance Marketplace notices with ease.',
    icon: HeartPulse,
  },
];

const BUSINESS_SERVICES: ServiceOfferingItem[] = [
  {
    id: 'biz_entities',
    index: '01',
    title: 'Sole Proprietor, LLC, S-Corp & Partnership Returns',
    desc: 'Preparation of Forms 1065, 1120-S, 1120, and Schedule C with detailed partner/shareholder K-1 distribution reporting.',
    icon: Briefcase,
  },
  {
    id: 'biz_quarterly',
    index: '02',
    title: 'Quarterly Estimated Tax Filings',
    desc: 'Calculation of quarterly federal and state estimates to avoid costly underpayment penalties and manage cash flow predictability.',
    icon: CalendarClock,
  },
  {
    id: 'biz_startup',
    index: '03',
    title: 'Business Startup Tax Consultations',
    desc: 'Entity selection guidance (LLC vs S-Corp election), obtaining EIN, setting up chart of accounts, and foundational tax structuring.',
    icon: Rocket,
  },
  {
    id: 'biz_bookkeeping',
    index: '04',
    title: 'Bookkeeping Cleanup for Tax Purposes',
    desc: 'Reconcile disordered accounts, categorize historical transactions, and produce clear balance sheets ready for tax filing.',
    icon: BookOpenCheck,
  },
  {
    id: 'biz_multistate',
    index: '05',
    title: 'Multi-State Business Returns',
    desc: 'Navigate multi-state nexus, revenue apportionment, and foreign entity state registrations for growing multi-jurisdiction firms.',
    icon: MapPinned,
  },
  {
    id: 'biz_payroll',
    index: '06',
    title: 'Payroll Tax Filings & Compliance Support',
    desc: 'Ensure timely 941/940 quarterly payroll returns, W-2/W-3 submissions, and 1099-NEC vendor reporting to prevent tax penalties.',
    icon: Users,
  },
];

const ESTATE_SERVICES: ServiceOfferingItem[] = [
  {
    id: 'est_will',
    index: '01',
    title: 'Will & Living Will Preparation Guidance',
    desc: 'Assist in organizing family asset inventories and financial directives before formal review with an estate attorney.',
    icon: ScrollText,
  },
  {
    id: 'est_trust',
    index: '02',
    title: 'Revocable & Irrevocable Trust Setup Guidance',
    desc: 'Evaluate tax implications of grantor vs non-grantor trust structures to protect assets and ensure seamless generational transfer.',
    icon: Landmark,
  },
  {
    id: 'est_poa',
    index: '03',
    title: 'Power of Attorney (Financial & Medical)',
    desc: 'Coordinate designated agent documentation ensuring trusted family members or fiduciaries can act during emergencies.',
    icon: KeyRound,
  },
  {
    id: 'est_asset',
    index: '04',
    title: 'Asset Protection Planning Support',
    desc: 'Strategically structure assets, business holdings, and insurance reserves to safeguard wealth from frivolous liabilities.',
    icon: Shield,
  },
];

const CREDIT_SERVICES: ServiceOfferingItem[] = [
  {
    id: 'crd_identity',
    index: '01',
    title: 'Identity Theft Protection & Monitoring',
    desc: 'Implement proactive monitoring tools, fraud alerts, and credit freeze guidance to protect your Social Security number and financial identity.',
    icon: Fingerprint,
  },
  {
    id: 'crd_restoration',
    index: '02',
    title: 'Credit Restoration Services',
    desc: 'Assistance in reviewing tri-bureau reports, identifying reporting errors, disputing unlawful collections, and personalized score-rebuilding plans.',
    icon: TrendingUp,
  },
  {
    id: 'crd_business',
    index: '03',
    title: 'Personal & Business Credit Consultation',
    desc: 'Establish separate commercial credit profiles (D&B Paydex), build tier-1 vendor credit lines, and secure favorable loan terms.',
    icon: BadgeDollarSign,
  },
];

export const ServicesPage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [activeCategory, setActiveCategory] =
    useState<ServiceCategoryId>('individual');
  const pageRef = useRef<HTMLDivElement | null>(null);
  const { shouldAnimate } = useInViewMotion(pageRef, '200px 0px');

  return (
    <div
      ref={pageRef}
      className={`min-h-screen bg-[#06182B] text-[#F8FAFC] pb-20 overflow-x-clip ${
        shouldAnimate ? '' : 'destria-motion-paused'
      }`}
    >
      {/* 1. IMMERSIVE FINANCIAL TECHNOLOGY HERO SECTION */}
      <ServicesHeroSection
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        shouldAnimate={shouldAnimate}
      />

      {/* 2. ENTERPRISE CONTENT CONTAINER (~1,360px desktop layout) */}
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-10 pt-12 sm:pt-16 space-y-16 sm:space-y-20">
        {/* ACTIVE SERVICE CATEGORY PANEL */}
        <section
          role="tabpanel"
          aria-label="Selected service category details"
          className="space-y-8 sm:space-y-10"
        >
          {/* Category 1: Individual Tax Services */}
          {activeCategory === 'individual' && (
            <div className="space-y-8 sm:space-y-10">
              <ServiceCategoryHeroBanner
                sectionNumber="Section 01"
                title="Individual Tax Services"
                description="Accurate filings, maximum legal deductions, and complete peace of mind across personal, family, and high-net-worth portfolio returns."
                categoryLabel="Private Client Tax"
                imageJpg={CATEGORY_HERO_ASSETS.individual.jpg}
                imageWebp={CATEGORY_HERO_ASSETS.individual.webp}
                imageAlt={CATEGORY_HERO_ASSETS.individual.alt}
                icon={FileCheck2}
                highlights={[
                  'Structured digital intake & document verification',
                  'Federal & multi-state compliance precision',
                  'Independent professional review before filing',
                ]}
                shouldAnimate={shouldAnimate}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {INDIVIDUAL_SERVICES.map((item) => (
                  <ServiceOfferingCard
                    key={item.id}
                    item={item}
                    shouldAnimate={shouldAnimate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Category 2: Business Tax & Accounting */}
          {activeCategory === 'business' && (
            <div className="space-y-8 sm:space-y-10">
              <ServiceCategoryHeroBanner
                sectionNumber="Section 02"
                title="Business Tax & Accounting"
                description="Supporting your enterprise. Ensuring compliance. Fueling steady commercial growth across corporate entities, LLCs, and emerging ventures."
                categoryLabel="Corporate Advisory"
                imageJpg={CATEGORY_HERO_ASSETS.business.jpg}
                imageWebp={CATEGORY_HERO_ASSETS.business.webp}
                imageAlt={CATEGORY_HERO_ASSETS.business.alt}
                icon={Building2}
                highlights={[
                  'Digital ledger reconciliation & accounting intelligence',
                  'Entity structuring & multi-state return precision',
                  'Year-round quarterly planning & payroll governance',
                ]}
                shouldAnimate={shouldAnimate}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {BUSINESS_SERVICES.map((item) => (
                  <ServiceOfferingCard
                    key={item.id}
                    item={item}
                    shouldAnimate={shouldAnimate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Category 3: Financial Protection & Estate Coordination */}
          {activeCategory === 'estate' && (
            <div className="space-y-8 sm:space-y-10">
              <ServiceCategoryHeroBanner
                sectionNumber="Section 03"
                title="Financial Protection & Estate Coordination"
                description="Protecting what matters most. Coordinating estate frameworks and wealth preservation structures in harmony with certified legal counsel."
                categoryLabel="Legacy & Estates"
                imageJpg={CATEGORY_HERO_ASSETS.estate.jpg}
                imageWebp={CATEGORY_HERO_ASSETS.estate.webp}
                imageAlt={CATEGORY_HERO_ASSETS.estate.alt}
                icon={Scale}
                highlights={[
                  'Structured asset custody & continuity inventories',
                  'Fiduciary tax coordination across generations',
                  'Collaborative execution with licensed SC legal counsel',
                ]}
                shouldAnimate={shouldAnimate}
              />

              {/* Preserved Notice Concerning Legal Services */}
              <div
                role="note"
                aria-label="Notice Concerning Legal Services"
                className="relative rounded-2xl bg-[#081C33]/92 border border-[#D4A843]/40 p-5 flex items-start gap-3.5 overflow-hidden"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E5B552]/65 to-transparent"
                  aria-hidden="true"
                />
                <AlertCircle className="w-5 h-5 text-[#E5B552] shrink-0 mt-0.5" />
                <div className="text-xs sm:text-sm text-[#A9B7C8] leading-relaxed">
                  <strong className="text-white">
                    Notice Concerning Legal Services:
                  </strong>{' '}
                  DESTRIA TAX SERVICES, LLC provides financial guidance, tax
                  structuring, and administrative document coordination. We do
                  not provide formal legal representation, nor do accounting
                  personnel draft binding legal instruments without licensed
                  legal counsel. All formal wills, trusts, and powers of
                  attorney are executed in referral coordination with properly
                  licensed attorneys in South Carolina.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {ESTATE_SERVICES.map((item) => (
                  <ServiceOfferingCard
                    key={item.id}
                    item={item}
                    shouldAnimate={shouldAnimate}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Category 4: Credit & Financial Solutions */}
          {activeCategory === 'credit' && (
            <div className="space-y-8 sm:space-y-10">
              <ServiceCategoryHeroBanner
                sectionNumber="Section 04"
                title="Credit & Financial Solutions"
                description="Build. Protect. Move Forward with clarity, strong personal scores, and structured commercial credit lines."
                categoryLabel="Financial Architecture"
                imageJpg={CATEGORY_HERO_ASSETS.credit.jpg}
                imageWebp={CATEGORY_HERO_ASSETS.credit.webp}
                imageAlt={CATEGORY_HERO_ASSETS.credit.alt}
                icon={CreditCard}
                highlights={[
                  'Structured tri-bureau credit analysis & clarity',
                  'Proactive identity protection & monitoring guidance',
                  'Personal and commercial credit architecture',
                ]}
                shouldAnimate={shouldAnimate}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {CREDIT_SERVICES.map((item) => (
                  <ServiceOfferingCard
                    key={item.id}
                    item={item}
                    shouldAnimate={shouldAnimate}
                  />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 3. BLOCKCHAIN-INSPIRED CONCEPTUAL TRANSPARENCY FLOW */}
        <FinancialTransparencyFlow shouldAnimate={shouldAnimate} />

        {/* 4. ENHANCED IRS NOTICE RESOLUTION & AUDIT DEFENSE SUPPORT */}
        <AuditDefenseShowcase
          onRequestEvaluation={() => setCurrentPage('book_consultation')}
          shouldAnimate={shouldAnimate}
        />

        {/* 5. ENHANCED CONSULTATION CALL-TO-ACTION */}
        <ServicesClosingCta
          onBookAppointment={() => setCurrentPage('book_consultation')}
          onViewPricing={() => setCurrentPage('pricing')}
          shouldAnimate={shouldAnimate}
        />
      </div>
    </div>
  );
};
