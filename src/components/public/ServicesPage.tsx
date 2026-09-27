import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BRAND_ASSETS } from '../../utils/assets';
import { ServiceCardImage, EditorialSplitImage } from './images';
import { 
  FileCheck2, 
  Building2, 
  Scale, 
  CreditCard, 
  Check, 
  ArrowRight, 
  Calendar, 
  AlertCircle,
  ShieldCheck,
  FileSpreadsheet,
  FileText
} from 'lucide-react';

export const ServicesPage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [activeCategory, setActiveCategory] = useState<'individual' | 'business' | 'estate' | 'credit'>('individual');

  return (
    <div className="space-y-20 pb-20 text-slate-100">
      
      {/* Header Banner */}
      <section className="relative pt-12 pb-16 border-b border-[#1E3A5F]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0D2340] border border-[#C6A15B]/40 text-[#C6A15B] text-xs font-semibold">
            <span>Boutique Accounting & Tax Solutions</span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-extrabold text-white">
            Our Comprehensive Services
          </h1>
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            From individual tax preparation to complex multi-tier business accounting and legacy coordination. 
            Meticulous, client-centered, and compliant.
          </p>

          {/* Quick Category Selector Pills */}
          <div className="pt-6 flex flex-wrap justify-center gap-2.5">
            {[
              { id: 'individual', label: 'Individual Tax Services', icon: FileCheck2 },
              { id: 'business', label: 'Business Tax & Bookkeeping', icon: Building2 },
              { id: 'estate', label: 'Financial Protection & Estates', icon: Scale },
              { id: 'credit', label: 'Credit & Financial Solutions', icon: CreditCard },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeCategory === tab.id
                    ? 'bg-[#C6A15B] text-[#07172B] shadow-md font-bold'
                    : 'bg-[#0D2340] text-slate-300 hover:text-white border border-[#1E3A5F]'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Detailed Services Content */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        {/* Category 1: Individual Tax Services */}
        {(activeCategory === 'individual' || activeCategory === undefined) && (
          <div className="space-y-8">
            <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] overflow-hidden p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-2 border-l-4 border-[#C6A15B] pl-4">
                  <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">Section 01</span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">Individual Tax Services</h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Accurate filings, maximum legal deductions, and complete peace of mind across personal, family, and high-net-worth portfolio returns.
                  </p>
                </div>
                <div className="lg:col-span-5">
                  <ServiceCardImage
                    src={BRAND_ASSETS.meticulousTaxPrepJpg}
                    webpSrc={BRAND_ASSETS.meticulousTaxPrepWebp}
                    alt="Multi-screen workstation displaying certified Form 1040 tax return preparation, deduction substantiation, and IRS e-file status"
                    categoryBadge="Private Client Tax"
                    icon={<FileCheck2 className="w-5 h-5 text-[#C6A15B]" />}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'Federal & State Income Tax Preparation',
                  desc: 'Comprehensive annual preparation of Form 1040 and all required state returns to ensure accurate filings and optimal liability management.'
                },
                {
                  title: 'Prior-Year & Amended Tax Returns (1040X)',
                  desc: 'Identify missed deductions, correct past reporting mistakes, or file delinquent returns from previous tax seasons with confidence.'
                },
                {
                  title: 'Tax Planning & Strategy Sessions',
                  desc: 'Proactive year-round reviews analyzing withholding, retirement contributions, and timing strategies to mitigate upcoming tax burdens.'
                },
                {
                  title: 'W-2, 1099 & Self-Employment Filings',
                  desc: 'Accurate reporting for multi-employer wage earners, freelancers, gig economy participants, and independent 1099 contractors.'
                },
                {
                  title: 'IRS Transcript Review & Analysis',
                  desc: 'Direct retrieval and systematic audit of IRS transcripts to resolve account discrepancies, penalty notices, or historical records.'
                },
                {
                  title: 'Affordable Care Act (ACA / Form 1095-A)',
                  desc: 'Reconcile premium tax credits, handle Form 8962 calculations, and resolve Health Insurance Marketplace notices with ease.'
                }
              ].map((item, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C6A15B]/50 transition-all space-y-3">
                  <div className="flex items-center gap-2 text-[#C6A15B]">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <h3 className="font-serif text-base font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category 2: Business Tax Services */}
        {(activeCategory === 'business' || activeCategory === undefined) && (
          <div className="space-y-8">
            <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] overflow-hidden p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-2 border-l-4 border-[#C6A15B] pl-4">
                  <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">Section 02</span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">Business Tax &amp; Accounting</h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Supporting your enterprise. Ensuring compliance. Fueling steady commercial growth across corporate entities, LLCs, and emerging ventures.
                  </p>
                </div>
                <div className="lg:col-span-5">
                  <ServiceCardImage
                    src={BRAND_ASSETS.corporateBusinessAdvisoryJpg}
                    webpSrc={BRAND_ASSETS.corporateBusinessAdvisoryWebp}
                    alt="Corporate tax compliance suite illustrating Form 1120-S, Form 1065, and multistate nexus apportionment"
                    categoryBadge="Corporate Advisory"
                    icon={<Building2 className="w-5 h-5 text-[#C6A15B]" />}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  title: 'Sole Proprietor, LLC, S-Corp & Partnership Returns',
                  desc: 'Preparation of Forms 1065, 1120-S, 1120, and Schedule C with detailed partner/shareholder K-1 distribution reporting.'
                },
                {
                  title: 'Quarterly Estimated Tax Filings',
                  desc: 'Calculation of quarterly federal and state estimates to avoid costly underpayment penalties and manage cash flow predictability.'
                },
                {
                  title: 'Business Startup Tax Consultations',
                  desc: 'Entity selection guidance (LLC vs S-Corp election), obtaining EIN, setting up chart of accounts, and foundational tax structuring.'
                },
                {
                  title: 'Bookkeeping Cleanup for Tax Purposes',
                  desc: 'Reconcile disordered accounts, categorize historical transactions, and produce clear balance sheets ready for tax filing.'
                },
                {
                  title: 'Multi-State Business Returns',
                  desc: 'Navigate multi-state nexus, revenue apportionment, and foreign entity state registrations for growing multi-jurisdiction firms.'
                },
                {
                  title: 'Payroll Tax Filings & Compliance Support',
                  desc: 'Ensure timely 941/940 quarterly payroll returns, W-2/W-3 submissions, and 1099-NEC vendor reporting to prevent tax penalties.'
                }
              ].map((item, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-[#0D2340] border border-[#1E3A5F] hover:border-[#C6A15B]/50 transition-all space-y-3">
                  <div className="flex items-center gap-2 text-[#C6A15B]">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <h3 className="font-serif text-base font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category 3: Financial Protection & Estate Coordination */}
        {(activeCategory === 'estate' || activeCategory === undefined) && (
          <div className="space-y-8">
            <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] overflow-hidden p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-2 border-l-4 border-[#C6A15B] pl-4">
                  <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">Section 03</span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">Financial Protection &amp; Estate Coordination</h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Protecting what matters most. Coordinating estate frameworks and wealth preservation structures in harmony with certified legal counsel.
                  </p>
                </div>
                <div className="lg:col-span-5">
                  <ServiceCardImage
                    src={BRAND_ASSETS.estateLegacyPlanningJpg}
                    webpSrc={BRAND_ASSETS.estateLegacyPlanningWebp}
                    alt="Estate coordination blueprint detailing trust structures, asset protection, and generational wealth preservation"
                    categoryBadge="Legacy & Estates"
                    icon={<Scale className="w-5 h-5 text-[#C6A15B]" />}
                  />
                </div>
              </div>
            </div>

            {/* Legal Services Notice Banner */}
            <div className="p-4 rounded-xl bg-[#07172B] border border-[#C6A15B]/30 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#C6A15B] flex-shrink-0 mt-0.5" />
              <div className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-white">Notice Concerning Legal Services:</strong> A/R Tax Services, LLC provides financial guidance, tax structuring, and administrative document coordination. We do not provide formal legal representation, nor do accounting personnel draft binding legal instruments without licensed legal counsel. All formal wills, trusts, and powers of attorney are executed in referral coordination with properly licensed attorneys in South Carolina.
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: 'Will & Living Will Preparation Guidance',
                  desc: 'Assist in organizing family asset inventories and financial directives before formal review with an estate attorney.'
                },
                {
                  title: 'Revocable & Irrevocable Trust Setup Guidance',
                  desc: 'Evaluate tax implications of grantor vs non-grantor trust structures to protect assets and ensure seamless generational transfer.'
                },
                {
                  title: 'Power of Attorney (Financial & Medical)',
                  desc: 'Coordinate designated agent documentation ensuring trusted family members or fiduciaries can act during emergencies.'
                },
                {
                  title: 'Asset Protection Planning Support',
                  desc: 'Strategically structure assets, business holdings, and insurance reserves to safeguard wealth from frivolous liabilities.'
                }
              ].map((item, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-[#0D2340] border border-[#1E3A5F] space-y-3">
                  <div className="flex items-center gap-2 text-[#C6A15B]">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <h3 className="font-serif text-base font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Category 4: Credit & Financial Solutions */}
        {(activeCategory === 'credit' || activeCategory === undefined) && (
          <div className="space-y-8">
            <div className="rounded-2xl bg-[#0D2340] border border-[#1E3A5F] overflow-hidden p-6 sm:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                <div className="lg:col-span-7 space-y-2 border-l-4 border-[#C6A15B] pl-4">
                  <span className="text-xs font-bold tracking-widest text-[#C6A15B] uppercase">Section 04</span>
                  <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">Credit &amp; Financial Solutions</h2>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                    Build. Protect. Move Forward with clarity, strong personal scores, and structured commercial credit lines.
                  </p>
                </div>
                <div className="lg:col-span-5">
                  <ServiceCardImage
                    src={BRAND_ASSETS.taxCreditResearchJpg}
                    webpSrc={BRAND_ASSETS.taxCreditResearchWebp}
                    alt="Credit score analysis and financial restoration plan"
                    categoryBadge="Financial Architecture"
                    icon={<CreditCard className="w-5 h-5 text-[#C6A15B]" />}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                {
                  title: 'Identity Theft Protection & Monitoring',
                  desc: 'Implement proactive monitoring tools, fraud alerts, and credit freeze guidance to protect your Social Security number and financial identity.'
                },
                {
                  title: 'Credit Restoration Services',
                  desc: 'Assistance in reviewing tri-bureau reports, identifying reporting errors, disputing unlawful collections, and personalized score-rebuilding plans.'
                },
                {
                  title: 'Personal & Business Credit Consultation',
                  desc: 'Establish separate commercial credit profiles (D&B Paydex), build tier-1 vendor credit lines, and secure favorable loan terms.'
                }
              ].map((item, idx) => (
                <div key={idx} className="p-6 rounded-2xl bg-[#0D2340] border border-[#1E3A5F] space-y-3">
                  <div className="flex items-center gap-2 text-[#C6A15B]">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <h3 className="font-serif text-base font-bold text-white">{item.title}</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Audit Support & IRS Representation Feature */}
        <div className="rounded-3xl bg-[#0B2748] border border-[#C99A3D]/40 p-8 sm:p-10 lg:p-12 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-5">
              <EditorialSplitImage
                src={BRAND_ASSETS.auditRepresentationJpg}
                webpSrc={BRAND_ASSETS.auditRepresentationWebp}
                alt="Executive audit representation and tax controversy defense"
                badgeText="Audit Defense"
                className="w-full h-full min-h-[260px]"
              />
            </div>
            <div className="lg:col-span-7 space-y-4">
              <span className="text-xs font-bold tracking-widest text-[#C99A3D] uppercase">
                Advisory Assurance
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl font-bold text-white">
                IRS Notice Resolution &amp; Audit Defense Support
              </h3>
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                Received a CP2000, statutory deficiency notice, or audit examination inquiry from the IRS or South Carolina Department of Revenue? Our tax professionals reconstruct workpapers, retrieve IRS transcripts, calculate penalty abatements, and draft formal responses.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button
                  onClick={() => setCurrentPage('book_consultation')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-[#06172C] bg-gradient-to-r from-[#C99A3D] to-[#E2BD67] hover:brightness-105 transition-all shadow-md"
                >
                  Request Notice Evaluation
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Box */}
        <div className="p-10 rounded-3xl bg-gradient-to-r from-[#0D2340] via-[#07172B] to-[#0D2340] border border-[#C6A15B]/40 text-center space-y-4">
          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            Ready to Discuss Your Specific Tax or Business Needs?
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Schedule a confidential consultation with Desmond Hinds or our tax specialists. 
            We review your situation and recommend the optimal service plan.
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setCurrentPage('book_consultation')}
              className="px-6 py-3 rounded-xl font-bold text-xs text-[#07172B] bg-[#C6A15B] hover:bg-[#D9BF7A] transition-all shadow-md"
            >
              Book an Appointment
            </button>
            <button
              onClick={() => setCurrentPage('pricing')}
              className="px-6 py-3 rounded-xl font-semibold text-xs text-white bg-[#07172B] hover:bg-[#132E52] border border-[#1E3A5F] transition-all"
            >
              View Service Plans & Pricing
            </button>
          </div>
        </div>

      </section>

    </div>
  );
};
