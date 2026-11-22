import React, { useRef } from 'react';
import {
  ArrowRight,
  Building2,
  FileCheck2,
  Scale,
  Workflow
} from 'lucide-react';
import { useInViewMotion } from './useInViewMotion';
import { FinancialDataNetworkBackdrop } from './FinancialDataNetworkBackdrop';
import { FinancialTechnologyServiceCard } from './FinancialTechnologyServiceCard';
import { FinancialTransparencyFlow } from './FinancialTransparencyFlow';
import { IntelligentAccountingShowcase } from './IntelligentAccountingShowcase';
import {
  CORE_SERVICES_CATALOG,
  FINANCIAL_TRANSPARENCY_STAGES
} from './coreServiceVisualAssets';

interface CoreServicesShowcaseProps {
  onNavigate: (page: string) => void;
}

const SERVICE_CARD_ICONS = {
  'tax-advisory': Workflow,
  'corporate-compliance': Building2,
  'wealth-estate': Scale,
  'individual-tax': FileCheck2
} as const;

/**
 * Redesigned Homepage Core Services and Intelligent Accounting & Reporting sections.
 * Preserves all legitimate Destria service capabilities, tax form references, and navigation links.
 */
export const CoreServicesShowcase: React.FC<CoreServicesShowcaseProps> = ({ onNavigate }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const { shouldAnimate } = useInViewMotion(sectionRef);

  return (
    <section
      ref={sectionRef}
      className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12 sm:space-y-16 overflow-x-clip"
      aria-labelledby="core-services-heading"
    >
      {/* Part 1: Core Services Header + 2-Column Enterprise Service Cards */}
      <div className="relative">
        <FinancialDataNetworkBackdrop animate={shouldAnimate} />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between mb-10 sm:mb-12">
          <div className="space-y-3.5 max-w-3xl">
            <p className="text-xs sm:text-sm font-semibold tracking-[0.22em] text-[#E5B552] uppercase">
              Core Services
            </p>
            <h2
              id="core-services-heading"
              className="font-serif text-[2rem] sm:text-[2.45rem] lg:text-[2.75rem] font-bold leading-[1.15] text-white tracking-tight [text-wrap:balance]"
            >
              Intelligent Tax, Accounting &amp; Wealth Advisory
            </h2>
            <p className="text-base sm:text-[1.0625rem] text-slate-300 leading-[1.65] max-w-2xl">
              Comprehensive tax preparation, strategic financial planning, and professional
              accounting services, supported by intelligent technology and responsible financial
              oversight.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('services')}
            className="inline-flex min-h-[46px] items-center gap-2 self-start md:self-end rounded-xl border border-[rgba(212,168,67,0.5)] bg-[#0B223C]/90 px-5 py-2.5 text-sm font-semibold text-[#E5B552] transition-colors hover:border-[#E5B552] hover:bg-[#123154] hover:text-white whitespace-nowrap"
          >
            <span>View Full Service Catalog</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-7 lg:grid-cols-2 lg:gap-8 items-stretch">
          {CORE_SERVICES_CATALOG.map((service) => {
            const Icon = SERVICE_CARD_ICONS[service.id];
            return (
              <FinancialTechnologyServiceCard
                key={service.id}
                service={service}
                icon={<Icon className="h-5 w-5 text-[#E5B552]" aria-hidden="true" />}
                animate={shouldAnimate}
                onExploreServices={() => onNavigate('services')}
                onScheduleConsultation={() => onNavigate('book_consultation')}
              />
            );
          })}
        </div>
      </div>

      {/* Part 2: Reusable Conceptual Blockchain-Inspired Financial Transparency Pathway */}
      <FinancialTransparencyFlow
        stages={FINANCIAL_TRANSPARENCY_STAGES}
        animate={shouldAnimate}
      />

      {/* Part 3: Intelligent Accounting & Financial Transparency Showcase */}
      <IntelligentAccountingShowcase
        animate={shouldAnimate}
        onOpenClientPortal={() => onNavigate('portal')}
        onExploreTaxStrategies={() => onNavigate('tax_strategies')}
      />
    </section>
  );
};
