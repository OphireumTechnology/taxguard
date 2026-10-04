/**
 * A/R Tax Services, LLC — Stage 08: Plan Workspace
 * Multi-year tax planning and advisory scenarios.
 * Strictly separates CURRENT AUTHORITATIVE RETURN DATA from PLANNING SCENARIOS / PROJECTIONS.
 * AI planning suggestions are advisory proposals only and require professional review.
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  ShieldCheck,
  Calendar,
  AlertCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  Sparkles,
  DollarSign
} from 'lucide-react';

interface PlanningScenario {
  id: string;
  title: string;
  targetTaxYear: number;
  description: string;
  projectedSavings: number;
  recommendationCategory: 'Retirement' | 'Depreciation' | 'Entity Structure' | 'Charitable' | 'State Tax';
  advisoryBasis: string;
  status: 'PROPOSAL_UNDER_REVIEW' | 'CLIENT_ADOPTED' | 'DISMISSED';
}

interface StageEightPlanViewProps {
  clientId: string;
  selectedTaxYear: number;
}

export const StageEightPlanView: React.FC<StageEightPlanViewProps> = ({
  clientId,
  selectedTaxYear
}) => {
  const [scenarios] = useState<PlanningScenario[]>([
    {
      id: 'plan_sep_401k',
      title: 'Elective SEP / Solo 401(k) Contribution Maximization',
      targetTaxYear: selectedTaxYear + 1,
      description: 'Maximizing deductible elective retirement contributions can significantly reduce federal taxable income and South Carolina top-bracket state exposure.',
      projectedSavings: 11400,
      recommendationCategory: 'Retirement',
      advisoryBasis: 'IRC § 404(a)(8) / IRC § 408(k)',
      status: 'PROPOSAL_UNDER_REVIEW'
    },
    {
      id: 'plan_bonus_deprec',
      title: 'Section 179 & Bonus Depreciation Allocation',
      targetTaxYear: selectedTaxYear + 1,
      description: 'Reviewing qualified capital expenditures for accelerated first-year cost recovery versus standard multi-year MACRS depreciation.',
      projectedSavings: 8650,
      recommendationCategory: 'Depreciation',
      advisoryBasis: 'IRC § 179 / IRC § 168(k)',
      status: 'PROPOSAL_UNDER_REVIEW'
    }
  ]);

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 08 of 18 · Plan
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <TrendingUp className="w-5 h-5 text-[#D4A843]" />
              <span>Multi-Year Tax Planning &amp; Advisory Projections</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Current Year: <strong className="text-white">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Planning Horizon: <strong className="text-[#D4A843]">{selectedTaxYear + 1}–{selectedTaxYear + 3}</strong></span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 08: Advisory modeling evaluating future tax-saving opportunities and timing strategies.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Review the advisory scenarios below and discuss with your CPA during your annual consultation.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Modeling tax brackets, contribution ceilings, and statutory phase-outs for the upcoming tax years.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Your return continues to Stage 09 (Prepare Taxes) for final Form 1040 and state schedules drafting.</p>
          </div>
        </div>
      </div>

      {/* Critical Statutory Notice: Projections vs Authoritative Data */}
      <div className="p-4 bg-[#071A2E] border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs text-amber-200">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-white">Strict Advisory Governance:</strong> Planning projections displayed on this page are non-binding advisory estimates for future tax years. They do NOT alter or represent your certified {selectedTaxYear} tax return filing, which is governed deterministically under Stage 09.
        </p>
      </div>

      {/* Planning Scenarios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {scenarios.map(sc => (
          <div
            key={sc.id}
            className="p-5 bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl shadow-xl space-y-3 flex flex-col justify-between"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase font-bold text-[#D4A843] bg-[#071A2E] px-2 py-0.5 rounded border border-slate-800">
                  {sc.recommendationCategory}
                </span>
                <span className="text-[10px] font-mono text-slate-400">Target TY {sc.targetTaxYear}</span>
              </div>
              <h3 className="text-sm font-bold text-white">{sc.title}</h3>
              <p className="text-slate-300 text-[11px] leading-relaxed">{sc.description}</p>
              <div className="text-[10px] font-mono text-slate-400">Statutory Basis: {sc.advisoryBasis}</div>
            </div>

            <div className="pt-3 border-t border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-400 block">Est. Tax Impact</span>
                <span className="text-emerald-400 font-bold font-mono text-sm">
                  Up to ~${sc.projectedSavings.toLocaleString()}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 bg-blue-950 text-blue-300 rounded border border-blue-500/40 font-bold">
                ADVISORY PROPOSAL
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
