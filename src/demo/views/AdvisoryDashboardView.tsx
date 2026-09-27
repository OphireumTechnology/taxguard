/**
 * A/R Tax Services, LLC - Tax Strategy & Advisory Demonstration Workspace
 * Entity structuring, S-Corp Reasonable Compensation modeling, Multi-state nexus, R&D tax credit studies.
 */

import React, { useState } from 'react';
import { Sparkles, Calculator, PieChart, ShieldCheck, CheckCircle, TrendingUp, Layers } from 'lucide-react';
import { TaxPlanningScenarioModeler, EntityRelationshipGraph } from '../../taxguard';

interface AdvisoryDashboardViewProps {
  onOpenAiAssistant: () => void;
  activeNavId?: string;
  onSelectNav?: (id: string) => void;
}

export const AdvisoryDashboardView: React.FC<AdvisoryDashboardViewProps> = ({ 
  onOpenAiAssistant,
  activeNavId,
  onSelectNav
}) => {
  const validTabs = ['scenarios', 'entity_graph', 'compensation', 'entity', 'rd_credit', 'roadmap'];
  const [activeTabState, setActiveTabState] = useState<'scenarios' | 'entity_graph' | 'compensation' | 'entity' | 'rd_credit' | 'roadmap'>('scenarios');
  const activeTab = (activeNavId && validTabs.includes(activeNavId))
    ? (activeNavId as 'scenarios' | 'entity_graph' | 'compensation' | 'entity' | 'rd_credit' | 'roadmap')
    : activeTabState;

  const handleSelectTab = (tabId: 'scenarios' | 'entity_graph' | 'compensation' | 'entity' | 'rd_credit' | 'roadmap') => {
    setActiveTabState(tabId);
    if (onSelectNav) {
      onSelectNav(tabId);
    }
  };

  // Interactive Reasonable Compensation calculation state
  const [netBusinessProfit, setNetBusinessProfit] = useState(250000);
  const [w2Salary, setW2Salary] = useState(115000);

  const distribution = Math.max(0, netBusinessProfit - w2Salary);
  const seTaxSavings = Math.round(distribution * 0.153 * 0.9235); // Approx FICA savings subject to limits

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border border-neutral-300 p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-mono uppercase text-neutral-500">
            A/R Tax Services, LLC • Advanced Strategic Tax Planning Practice
          </div>
          <h2 className="text-base font-bold text-black uppercase">
            Tax Strategy &amp; Entity Advisory Modeler
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAiAssistant}
            className="px-3 py-1.5 bg-black text-white text-xs font-bold uppercase hover:bg-neutral-800 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Strategy Modeler</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-neutral-300 flex flex-wrap gap-1 text-xs">
        {[
          { id: 'scenarios', label: '21-Strategy Tax Planning & 5 Scenarios', icon: TrendingUp },
          { id: 'entity_graph', label: 'Multi-Entity Flow & Basis Graph', icon: Layers },
          { id: 'compensation', label: 'Reasonable Compensation Study', icon: Calculator },
          { id: 'entity', label: 'Entity Choice & Restructuring', icon: PieChart },
          { id: 'rd_credit', label: 'Section 41 R&D Study', icon: ShieldCheck },
          { id: 'roadmap', label: 'Client Strategic Action Plan', icon: CheckCircle }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleSelectTab(tab.id as any)}
            className={`px-3 py-2 border-b-2 font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-black text-black font-bold'
                : 'border-transparent text-neutral-600 hover:text-black'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: 21-Strategy Tax Planning & 5 Scenarios */}
      {activeTab === 'scenarios' && (
        <div className="pt-1">
          <TaxPlanningScenarioModeler userRole="advisory" />
        </div>
      )}

      {/* Tab: Multi-Entity Flow & Basis Graph */}
      {activeTab === 'entity_graph' && (
        <div className="pt-1">
          <EntityRelationshipGraph userRole="advisory" />
        </div>
      )}

      {/* Tab: Compensation */}
      {activeTab === 'compensation' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
          <div className="border-b border-neutral-200 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-black">
              Interactive S-Corporation Salary vs. Shareholder Distribution Optimizer
            </h3>
            <p className="text-xs text-neutral-600">
              Assesses RCReports wage comparability benchmarks and models FICA self-employment savings under Rev. Rul. 74-44.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border border-neutral-200 space-y-3 bg-neutral-50">
              <div className="space-y-1">
                <label className="block font-bold text-black uppercase text-[11px]">
                  Estimated Net S-Corp Operating Profit ($):
                </label>
                <input
                  type="number"
                  value={netBusinessProfit}
                  onChange={(e) => setNetBusinessProfit(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-neutral-300 font-mono text-xs bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-black uppercase text-[11px]">
                  Modeled Officer W-2 Salary ($):
                </label>
                <input
                  type="number"
                  value={w2Salary}
                  onChange={(e) => setW2Salary(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-neutral-300 font-mono text-xs bg-white"
                />
                <div className="text-[10px] text-neutral-500">
                  RCReports defensible industry median: $110,000 - $125,000
                </div>
              </div>
            </div>

            <div className="p-4 border border-black space-y-3 bg-white">
              <span className="font-bold text-black uppercase text-xs">
                Modeled Tax Economics
              </span>
              <div className="space-y-2 font-mono">
                <div className="flex justify-between pb-1 border-b border-neutral-200">
                  <span>Shareholder Distribution:</span>
                  <strong>${distribution.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between pb-1 border-b border-neutral-200">
                  <span>Effective W-2 Ratio:</span>
                  <strong>{Math.round((w2Salary / (netBusinessProfit || 1)) * 100)}%</strong>
                </div>
                <div className="flex justify-between pt-1 text-black font-bold">
                  <span>Estimated Annual FICA Tax Savings:</span>
                  <span className="text-base">${seTaxSavings.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Entity */}
      {activeTab === 'entity' && (
        <div className="border border-neutral-300 p-5 space-y-4 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Entity Structure Comparative Matrix
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1.5">
              <span className="font-bold text-black uppercase">Sole Proprietorship / Single-Member LLC</span>
              <p className="text-neutral-600">All net profit subject to 15.3% SE tax. Simple compliance, Schedule C filing.</p>
            </div>
            <div className="p-3 border border-black bg-white space-y-1.5">
              <span className="font-bold text-black uppercase">S-Corporation (Recommended for Perotti)</span>
              <p className="text-neutral-700">W-2 salary subject to FICA; distributions avoid SE tax. Requires 1120-S filing.</p>
            </div>
            <div className="p-3 border border-neutral-200 bg-neutral-50 space-y-1.5">
              <span className="font-bold text-black uppercase">C-Corporation</span>
              <p className="text-neutral-600">21% flat corporate federal rate, potential Section 1202 QSBS exclusion upon sale.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: R&D */}
      {activeTab === 'rd_credit' && (
        <div className="border border-neutral-300 p-5 space-y-3 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            IRC § 41 Credit for Increasing Research Activities
          </h3>
          <p className="text-neutral-700">
            Four-Part Test verification completed for proprietary logistics automation software. Estimated federal tax credit: <strong>$14,200.00</strong>.
          </p>
        </div>
      )}

      {/* Tab: Roadmap */}
      {activeTab === 'roadmap' && (
        <div className="border border-neutral-300 p-5 space-y-3 bg-white text-xs">
          <h3 className="text-xs font-bold uppercase tracking-wider text-black">
            Client Strategic Action Plan
          </h3>
          <div className="space-y-2">
            <div className="p-2 border border-neutral-200 flex items-center justify-between">
              <span>Execute S-Corporation Election (Form 2553)</span>
              <span className="font-bold text-black">Completed</span>
            </div>
            <div className="p-2 border border-neutral-200 flex items-center justify-between">
              <span>Formalize Accountable Plan for Home Office &amp; Mileage</span>
              <span className="font-bold text-black">In Effect</span>
            </div>
            <div className="p-2 border border-neutral-200 flex items-center justify-between">
              <span>Establish Solo 401(k) / Cash Balance Pension Plan</span>
              <span className="font-bold text-neutral-600">Target Q3 2026</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
