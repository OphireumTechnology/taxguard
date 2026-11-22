import React from 'react';
import { ArrowRight, ChevronRight, FileText, Layers, ShieldCheck } from 'lucide-react';

interface IndustryCompliancePanelProps {
  applicableForms: string[];
  recommendedServicePlan: string;
  clientCaseExample: string;
  onViewPricing: () => void;
  onViewStrategies: () => void;
  onBookConsultation: () => void;
}

/**
 * Tax filing references, service alignment navigation, and refined
 * Illustrative Advisory Scenario panel with truthful disclosure.
 */
export const IndustryCompliancePanel: React.FC<IndustryCompliancePanelProps> = ({
  applicableForms,
  recommendedServicePlan,
  clientCaseExample,
  onViewPricing,
  onViewStrategies,
  onBookConsultation,
}) => {
  return (
    <div className="space-y-6">
      {/* Primary Federal & State Return Filings + Recommended Service Alignment */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Filings Panel */}
        <div className="lg:col-span-7 rounded-2xl bg-[#091D34] border border-slate-700/55 p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-[#D4A843] shrink-0" aria-hidden="true" />
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#E1BB60]">
              Primary Federal &amp; State Return Filings
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {applicableForms.map((form, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 rounded-xl bg-[#061629] border border-slate-700/55 px-4 py-3"
              >
                <span className="text-xs sm:text-sm font-mono font-medium text-white leading-snug">
                  {form}
                </span>
                <span className="text-[10px] font-mono text-[#D4A843]/80 tabular-nums shrink-0">
                  0{idx + 1}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Filing applicability depends on entity structure, multi-state nexus, and statutory
            eligibility reviewed during formal engagement onboarding.
          </p>
        </div>

        {/* Service Alignment Panel */}
        <div className="lg:col-span-5 rounded-2xl bg-[#091D34] border border-[#D4A843]/35 p-6 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <Layers className="w-4 h-4 text-[#D4A843] shrink-0" aria-hidden="true" />
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-[#E1BB60]">
                Recommended Service Alignment
              </h3>
            </div>
            <p className="font-serif text-lg sm:text-xl font-bold text-white leading-snug">
              {recommendedServicePlan}
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Structured year-round accounting, quarterly planning, and return preparation aligned
              with your industry&apos;s reporting cadence.
            </p>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-700/45">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onViewPricing}
                className="min-h-[40px] text-xs font-semibold text-[#E5B552] hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>View Plan Pricing &amp; Retainers</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>

              <span className="text-slate-600" aria-hidden="true">
                ·
              </span>

              <button
                type="button"
                onClick={onViewStrategies}
                className="min-h-[40px] text-xs font-semibold text-slate-300 hover:text-white transition-colors inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <span>Tax Strategy Center</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            </div>

            <button
              type="button"
              onClick={onBookConsultation}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#0D2745] border border-[#D4A843]/45 hover:border-[#D4A843] hover:bg-[#123257] text-xs font-bold text-white transition-colors inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <span>Request Engagement Proposal</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#E5B552] shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {/* Illustrative Advisory Scenario (Truthfully Framed — No Unsubstantiated "Proven" Claim) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#07182C] via-[#0A203A] to-[#061527] border border-[#D4A843]/30 p-6 sm:p-7 space-y-3">
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(212, 168, 67, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.04) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#E1BB60] uppercase tracking-[0.16em]">
            <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>Illustrative Engagement Scenario</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Informational Example · Results Vary by Facts &amp; Eligibility
          </span>
        </div>

        <blockquote className="relative z-10 font-serif italic text-sm sm:text-base text-slate-100 leading-relaxed">
          &ldquo;{clientCaseExample}&rdquo;
        </blockquote>

        <p className="relative z-10 text-[11px] text-slate-400 leading-relaxed">
          Representative advisory scenario retained from existing practice documentation for
          illustrative discussion only. Tax savings, credits, and accounting outcomes are never
          guaranteed and depend on verified financial records and applicable federal and state law.
        </p>
      </div>
    </div>
  );
};
