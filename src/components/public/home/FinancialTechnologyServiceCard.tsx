import React from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { ServiceTechnologyVisual } from './ServiceTechnologyVisual';
import type { CoreServiceCardSpec } from './coreServiceVisualAssets';

interface FinancialTechnologyServiceCardProps {
  service: CoreServiceCardSpec;
  icon: React.ReactNode;
  animate: boolean;
  onExploreServices: () => void;
  onScheduleConsultation: () => void;
}

/**
 * Spacious, enterprise-grade service card presenting a unique financial technology visual,
 * plain-English description, preserved capabilities, and clear navigation actions.
 * All headings, descriptions, and capability lists stay completely stationary.
 */
export const FinancialTechnologyServiceCard: React.FC<FinancialTechnologyServiceCardProps> = ({
  service,
  icon,
  animate,
  onExploreServices,
  onScheduleConsultation
}) => {
  return (
    <article className="group relative flex flex-col justify-between rounded-2xl border border-[rgba(148,163,184,0.2)] bg-gradient-to-b from-[#0D2542] to-[#081A30] p-6 sm:p-8 shadow-[0_18px_46px_rgba(2,10,20,0.42)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(212,168,67,0.52)]">
      {/* Subtle Top Metallic-Gold Hairline Accent on Hover */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(212,168,67,0.55)] to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="space-y-6">
        <ServiceTechnologyVisual
          webpSrc={service.webp}
          jpgSrc={service.jpg}
          alt={service.alt}
          categoryLabel={service.categoryLabel}
          icon={icon}
          animate={animate}
        />

        <div className="space-y-3">
          <h3 className="font-serif text-[1.4rem] sm:text-[1.6rem] font-bold leading-snug tracking-tight text-white">
            {service.title}
          </h3>
          <p className="text-[15px] sm:text-base leading-[1.65] text-slate-300">
            {service.description}
          </p>
        </div>

        {/* Preserved Substantive Service Capabilities */}
        <ul className="space-y-3 border-t border-[rgba(148,163,184,0.16)] pt-5">
          {service.capabilities.map((capability) => (
            <li
              key={capability}
              className="flex items-start gap-3 text-[15px] leading-[1.55] text-slate-200"
            >
              <Check
                className="mt-1 h-4 w-4 shrink-0 text-[#E5B552]"
                aria-hidden="true"
              />
              <span>{capability}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer Actions & Transparency Stage Alignment */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[rgba(148,163,184,0.16)] pt-5">
        <button
          type="button"
          onClick={onExploreServices}
          className="inline-flex min-h-[40px] items-center gap-1.5 text-sm font-semibold text-[#E5B552] transition-colors hover:text-white"
        >
          <span>Explore Service Details</span>
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onScheduleConsultation}
          className="inline-flex min-h-[40px] items-center text-xs sm:text-sm font-medium text-slate-300 transition-colors hover:text-[#E5B552]"
        >
          Schedule Consultation
        </button>
      </div>
    </article>
  );
};
