/**
 * A/R Tax Services, LLC - Firm Owner & Executive Demonstration Workspace
 * Practice realization rates, Revenue pacing, Firm capacity utilization, High-level KPIs.
 */

import React from 'react';
import { Sparkles, TrendingUp, DollarSign, Users, Award, ShieldCheck } from 'lucide-react';

interface ExecutiveDashboardViewProps {
  onOpenAiAssistant: () => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({ onOpenAiAssistant }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Executive Leadership &amp; Managing Partner Practice
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Executive Practice Intelligence &amp; Realization Briefing
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Executive Briefing</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        <div className="p-4 border border-neutral-200 bg-neutral-50 space-y-1">
          <span className="font-bold uppercase text-[10px] text-neutral-500">Practice Realization Rate</span>
          <div className="font-mono text-xl font-bold text-black">94.2%</div>
          <div className="text-[10px] text-neutral-600">+2.4% vs. 2025 filing season</div>
        </div>

        <div className="p-4 border border-neutral-200 bg-neutral-50 space-y-1">
          <span className="font-bold uppercase text-[10px] text-neutral-500">Average Return Fee</span>
          <div className="font-mono text-xl font-bold text-black">$2,140.00</div>
          <div className="text-[10px] text-neutral-600">Driven by S-Corp advisory mix</div>
        </div>

        <div className="p-4 border border-neutral-200 bg-neutral-50 space-y-1">
          <span className="font-bold uppercase text-[10px] text-neutral-500">Capacity Utilization</span>
          <div className="font-mono text-xl font-bold text-black">78.5%</div>
          <div className="text-[10px] text-neutral-600">Capacity headroom: 21.5%</div>
        </div>

        <div className="p-4 border border-black bg-white space-y-1">
          <span className="font-bold uppercase text-[10px] text-black">QC First-Pass Yield</span>
          <div className="font-mono text-xl font-bold text-black">91.0%</div>
          <div className="text-[10px] text-neutral-600">Zero material audit rejections</div>
        </div>
      </div>

      {/* Strategic Initiatives */}
      <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-black">
          Strategic Practice Growth &amp; Advisory Expansion Roadmap
        </h3>
        <div className="space-y-2">
          <div className="p-3 border border-neutral-200 flex items-center justify-between">
            <div>
              <strong>Expansion of Fractional CFO &amp; CAS Services</strong>
              <div className="text-[11px] text-neutral-600">Targeting 40 recurring monthly business advisory clients for Q3 2026.</div>
            </div>
            <span className="border border-black px-2 py-0.5 font-bold text-[10px]">On Track</span>
          </div>

          <div className="p-3 border border-neutral-200 flex items-center justify-between">
            <div>
              <strong>IRS Qualified Intermediary &amp; Section 1031 Exchange Advisory</strong>
              <div className="text-[11px] text-neutral-600">Partnering with commercial real estate brokerages in Charleston &amp; Columbia.</div>
            </div>
            <span className="border border-neutral-300 px-2 py-0.5 text-[10px] font-mono">In Review</span>
          </div>
        </div>
      </div>
    </div>
  );
};
