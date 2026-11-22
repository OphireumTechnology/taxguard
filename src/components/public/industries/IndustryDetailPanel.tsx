import React from 'react';
import { ArrowRight, Shield } from 'lucide-react';
import type { IndustrySolutionRecord } from '../../../types';
import { getIndustryVisualProfile } from './industryVisualAssets';
import { IndustryTechnologyVisual } from './IndustryTechnologyVisual';
import { IndustryFinancialFlow } from './IndustryFinancialFlow';
import { IndustryChallengesPanel } from './IndustryChallengesPanel';
import { IndustryCompliancePanel } from './IndustryCompliancePanel';

interface IndustryDetailPanelProps {
  industry: IndustrySolutionRecord;
  icon: React.ElementType;
  onBookConsultation: () => void;
  onViewPricing: () => void;
  onViewStrategies: () => void;
  shouldAnimate: boolean;
}

/**
 * Comprehensive Selected Industry Detail Panel orchestrating executive overview,
 * photorealistic industry technology visualization, adaptive 7-stage financial
 * transparency flow, challenges/solutions architecture, and compliance panels.
 */
export const IndustryDetailPanel: React.FC<IndustryDetailPanelProps> = ({
  industry,
  icon: Icon,
  onBookConsultation,
  onViewPricing,
  onViewStrategies,
  shouldAnimate,
}) => {
  const profile = getIndustryVisualProfile(industry.slug);
  const shortName = industry.name.split(',')[0];

  return (
    <section
      id="selected-industry-detail-panel"
      aria-live="polite"
      aria-labelledby="selected-industry-heading"
      className="mx-auto max-w-[1360px] px-4 sm:px-6 lg:px-8"
    >
      <div
        key={industry.id}
        className="destria-hero-enter rounded-3xl bg-[#0B1F38]/95 border border-[#D4A843]/40 p-6 sm:p-9 lg:p-11 shadow-2xl space-y-9"
      >
        {/* Top Sector Spotlight Bar */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-slate-700/50 pb-7">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-bold uppercase tracking-[0.16em] text-[#E1BB60]">
              <Icon className="w-4 h-4 text-[#D4A843] shrink-0" aria-hidden="true" />
              <span>Strategic Sector Spotlight</span>
              <span className="text-slate-500" aria-hidden="true">
                ·
              </span>
              <span className="text-slate-300 tabular-nums">Sector {profile.sectorCode} of 08</span>
            </div>

            <h2
              id="selected-industry-heading"
              className="font-serif text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              {industry.name}
            </h2>

            <p className="text-sm sm:text-base font-medium text-[#E2BD67] leading-relaxed max-w-3xl">
              {industry.tagline}
            </p>
          </div>

          <div className="shrink-0">
            <button
              type="button"
              onClick={onBookConsultation}
              className="min-h-[44px] px-6 py-3 rounded-xl bg-gradient-to-r from-[#C99A3D] via-[#D9AE51] to-[#E5BE68] text-[#06182B] font-bold text-xs sm:text-sm hover:brightness-105 transition-all duration-200 shadow-lg shadow-[#D4A843]/15 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <span>Consult on {shortName}</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Spacious Two-Column Overview & Large Industry Technology Visualization */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* Left Narrative & Regulatory Standard */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <div className="text-[11px] font-bold tracking-[0.16em] uppercase text-[#D4A843]">
                Sector Advisory Overview
              </div>
              <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                {industry.description}
              </p>
            </div>

            <div className="rounded-2xl bg-[#07182C] border border-slate-700/55 p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#E1BB60] uppercase tracking-[0.14em]">
                <Shield className="w-4 h-4 text-[#D4A843] shrink-0" aria-hidden="true" />
                <span>Core Regulatory Standard</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Tailored adherence to South Carolina Department of Revenue statutory reporting and
                IRS Industry Specialization Program guidelines.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div className="rounded-xl bg-[#07182C]/90 border border-slate-700/45 p-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Primary Filings Covered
                </div>
                <div className="font-serif text-xl font-bold text-white tabular-nums">
                  {industry.applicableForms.length} Core Schedules
                </div>
              </div>
              <div className="rounded-xl bg-[#07182C]/90 border border-slate-700/45 p-4 space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Oversight Model
                </div>
                <div className="font-serif text-xl font-bold text-[#E5B552]">
                  Advisor Verified
                </div>
              </div>
            </div>
          </div>

          {/* Right Large Industry Technology Visualization */}
          <div className="lg:col-span-6">
            <IndustryTechnologyVisual
              slug={industry.slug}
              industryName={shortName}
              primaryForm={industry.applicableForms[0]}
              shouldAnimate={shouldAnimate}
            />
          </div>
        </div>

        {/* Adaptive 7-Stage Blockchain-Inspired Conceptual Transparency Flow */}
        <IndustryFinancialFlow
          slug={industry.slug}
          sectorTitle={shortName}
          shouldAnimate={shouldAnimate}
        />

        {/* Critical Challenges & Bespoke Practice Architecture */}
        <IndustryChallengesPanel
          keyChallenges={industry.keyChallenges}
          strategicSolutions={industry.strategicSolutions}
        />

        {/* Filings, Service Alignment & Illustrative Scenario */}
        <IndustryCompliancePanel
          applicableForms={industry.applicableForms}
          recommendedServicePlan={industry.recommendedServicePlan}
          clientCaseExample={industry.clientCaseExample}
          onViewPricing={onViewPricing}
          onViewStrategies={onViewStrategies}
          onBookConsultation={onBookConsultation}
        />
      </div>
    </section>
  );
};
