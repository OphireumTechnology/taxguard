import React, { useRef, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  UserCheck,
  Layers,
} from 'lucide-react';
import { useInViewMotion } from './useInViewMotion';

type AnalyticsTab = 'classification' | 'reconciliation' | 'discrepancies';

const INCOME_CATEGORIES = [
  { label: 'Employment Wages (W-2)', share: 42, note: 'Illustrative proportion' },
  { label: 'Pass-Through Entities (Schedule K-1)', share: 28, note: 'Illustrative proportion' },
  { label: 'Operating Business Income (Schedule C)', share: 19, note: 'Illustrative proportion' },
  { label: 'Dividends & Interest (1099-DIV / INT)', share: 11, note: 'Illustrative proportion' },
];

const EXPENSE_CATEGORIES = [
  { label: 'Operating & Professional Services', share: 36, status: 'Categorized' },
  { label: 'Payroll & Qualified Benefits', share: 29, status: 'Categorized' },
  { label: 'Facilities & Depreciation Schedules', share: 21, status: 'Review Pending' },
  { label: 'Travel, Meals & Substantiated Deductions', share: 14, status: 'Substantiation Check' },
];

const TREND_SERIES = [
  { period: 'Q1', indexVal: 54 },
  { period: 'Q2', indexVal: 63 },
  { period: 'Q3', indexVal: 71 },
  { period: 'Q4', indexVal: 82 },
];

const RECONCILIATION_ITEMS = [
  { label: 'General Ledger Trial Balance', state: 'Matched in Model', ready: true },
  { label: 'Federal & Multi-State Source Forms', state: 'Indexed in Model', ready: true },
  { label: 'Book-to-Tax Schedule M-1 Adjustments', state: 'Awaiting Preparer Sign-Off', ready: false },
  { label: 'Prior-Year Carryforward Verification', state: 'Matched in Model', ready: true },
];

const DISCREPANCY_FLAGS = [
  {
    code: 'REV-01',
    title: 'Prior-year 1099-DIV issuer not yet present in current intake',
    action: 'Flagged for client document request',
    severity: 'Medium Priority',
  },
  {
    code: 'REV-02',
    title: 'Depreciation schedule basis requires practitioner confirmation',
    action: 'Assigned to independent reviewer checklist',
    severity: 'Review Required',
  },
  {
    code: 'REV-03',
    title: 'Multi-state apportionment worksheet awaiting Q4 payroll total',
    action: 'Pending bookkeeping period close',
    severity: 'In Progress',
  },
];

export const FinancialAnalyticsShowcase: React.FC = () => {
  const sectionRef = useRef<HTMLElement>(null);
  const { shouldAnimate } = useInViewMotion(sectionRef);
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('classification');
  const [selectedPeriod, setSelectedPeriod] = useState(3);

  // Build clean SVG trend polyline points inside 320x120 viewBox
  const chartPoints = TREND_SERIES.map((pt, i) => {
    const x = 28 + i * 88;
    const y = 104 - (pt.indexVal / 100) * 84;
    return { ...pt, x, y };
  });
  const linePath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x} 108 L ${chartPoints[0].x} 108 Z`;

  return (
    <section
      ref={sectionRef}
      id="financial-analytics"
      className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28 ${!shouldAnimate ? 'destria-motion-paused' : ''}`}
      aria-labelledby="analytics-heading"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
        <div className="space-y-3 max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] text-[#E5B552] uppercase">
            Financial Intelligence Interface · Illustrative Model
          </p>
          <h2
            id="analytics-heading"
            className="font-serif text-3xl sm:text-4xl font-bold text-white tracking-tight [text-wrap:balance]"
          >
            Structured Visibility Across Income, Reconciliation &amp; Review Readiness
          </h2>
          <p className="text-sm sm:text-base text-[#A9B7C8] leading-relaxed">
            An illustrative preview of how structured financial categorization, document completeness tracking, trend analysis, and discrepancy prompts support informed practitioner review.
          </p>
        </div>

        {/* Interactive View Switcher */}
        <div
          role="tablist"
          aria-label="Financial analytics demonstration views"
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0D2745] border border-slate-700/70 self-start lg:self-end"
        >
          {(
            [
              { id: 'classification', label: 'Income & Expenses' },
              { id: 'reconciliation', label: 'Reconciliation & Trends' },
              { id: 'discrepancies', label: 'Discrepancies & Review' },
            ] as Array<{ id: AnalyticsTab; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[#D4A843] text-[#06182B]'
                  : 'text-slate-300 hover:text-white hover:bg-[#102D4F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Analytics Workspace Frame */}
      <div className="rounded-2xl bg-[#0A213C] border border-slate-700/70 p-5 sm:p-7 lg:p-8 space-y-6">
        {/* Top Context Strip (Illustrative Label + Professional Review Status) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700/70 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-[#A9B7C8]">
            <BarChart3 className="w-4 h-4 text-[#D4A843]" />
            <span className="font-semibold text-white">Illustrative Analytics Demonstration</span>
            <span aria-hidden="true">·</span>
            <span>Sample Multi-Entity Profile (Not Live Taxpayer Data)</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#E5B552]">
            <UserCheck className="w-4 h-4" />
            <span>Professional Review Status: Pending Practitioner Sign-Off</span>
          </div>
        </div>

        {/* Dynamic Tab View */}
        {activeTab === 'classification' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Income Classification Panel */}
            <div className="lg:col-span-6 rounded-xl bg-[#06182B] border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Income Classification Breakdown</h3>
                <span className="text-[11px] text-slate-400">Illustrative Share</span>
              </div>
              <div className="space-y-3.5">
                {INCOME_CATEGORIES.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-200">{item.label}</span>
                      <span className="font-mono text-[#E5B552] tabular-nums">{item.share}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#3B82F6] to-[#D4A843] transition-all duration-500"
                        style={{ width: `${item.share}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Expense Categorization Panel */}
            <div className="lg:col-span-6 rounded-xl bg-[#06182B] border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Expense Categorization</h3>
                <span className="text-[11px] text-slate-400">Illustrative Allocation</span>
              </div>
              <div className="space-y-3.5">
                {EXPENSE_CATEGORIES.map((item) => (
                  <div key={item.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-200">{item.label}</span>
                      <span className="text-[11px] text-slate-400">
                        {item.status} · <span className="font-mono text-white tabular-nums">{item.share}%</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D4A843] to-[#E5B552] transition-all duration-500"
                        style={{ width: `${item.share}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reconciliation' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Document Completeness & Reconciliation Checklist */}
            <div className="lg:col-span-6 rounded-xl bg-[#06182B] border border-slate-800 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">Reconciliation &amp; Document Completeness</h3>
                <span className="font-mono text-xs text-[#E5B552] tabular-nums">3 / 4 Ready</span>
              </div>

              <div className="space-y-2.5">
                {RECONCILIATION_ITEMS.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[#0A213C] border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.ready ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <FileCheck className="w-4 h-4 text-[#E5B552] shrink-0" />
                      )}
                      <span className="text-slate-200 truncate">{item.label}</span>
                    </div>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                      {item.state}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive SVG Trend Chart */}
            <div className="lg:col-span-6 rounded-xl bg-[#06182B] border border-slate-800 p-5 flex flex-col justify-between gap-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">Illustrative Quarterly Readiness Index</h3>
                  <p className="text-[11px] text-slate-400">Select a quarter to inspect sample trend progression</p>
                </div>
                <span className="font-mono text-sm font-bold text-[#E5B552] tabular-nums">
                  {TREND_SERIES[selectedPeriod].period}: {TREND_SERIES[selectedPeriod].indexVal} pts
                </span>
              </div>

              <svg viewBox="0 0 320 124" className="w-full h-36" role="img" aria-label="Illustrative quarterly trend line">
                <defs>
                  <linearGradient id="destriaAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4A843" stopOpacity="0.32" />
                    <stop offset="100%" stopColor="#D4A843" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[28, 56, 84, 108].map((y) => (
                  <line key={y} x1="16" y1={y} x2="304" y2={y} stroke="rgba(148,163,184,0.12)" strokeWidth="1" />
                ))}
                <path d={areaPath} fill="url(#destriaAreaGrad)" />
                <path d={linePath} fill="none" stroke="#E5B552" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {chartPoints.map((pt, i) => (
                  <g key={pt.period} onClick={() => setSelectedPeriod(i)} className="cursor-pointer">
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={selectedPeriod === i ? 6 : 4}
                      fill={selectedPeriod === i ? '#E5B552' : '#0A213C'}
                      stroke="#E5B552"
                      strokeWidth="2"
                    />
                    <text
                      x={pt.x}
                      y="121"
                      textAnchor="middle"
                      fill={selectedPeriod === i ? '#F8FAFC' : '#94A3B8'}
                      fontSize="10"
                      fontFamily="monospace"
                    >
                      {pt.period}
                    </text>
                  </g>
                ))}
              </svg>

              <div className="flex items-center gap-2">
                {TREND_SERIES.map((pt, i) => (
                  <button
                    key={pt.period}
                    type="button"
                    onClick={() => setSelectedPeriod(i)}
                    className={`flex-1 py-1.5 rounded-md text-xs font-mono tabular-nums border transition-colors ${
                      selectedPeriod === i
                        ? 'bg-[#102D4F] border-[#E5B552] text-[#E5B552]'
                        : 'bg-[#0A213C] border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {pt.period}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'discrepancies' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Potential Financial Discrepancies */}
            <div className="lg:col-span-7 rounded-xl bg-[#06182B] border border-slate-800 p-5 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">Potential Financial Discrepancies (Sample Queue)</h3>
                <span className="text-[11px] text-[#E5B552]">3 Illustrative Prompts</span>
              </div>
              <div className="space-y-3">
                {DISCREPANCY_FLAGS.map((flag) => (
                  <div
                    key={flag.code}
                    className="rounded-lg bg-[#0A213C] border border-slate-800 p-3.5 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <AlertTriangle className="w-4 h-4 text-[#E5B552] mt-0.5 shrink-0" />
                      <div className="space-y-1 min-w-0">
                        <div className="text-xs font-semibold text-white">
                          <span className="font-mono text-[#E5B552] mr-2">{flag.code}</span>
                          {flag.title}
                        </div>
                        <div className="text-[11px] text-[#A9B7C8]">{flag.action}</div>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-sky-300 whitespace-nowrap shrink-0">
                      {flag.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Progress & Human Sign-Off Summary */}
            <div className="lg:col-span-5 rounded-xl bg-[#06182B] border border-slate-800 p-5 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <Layers className="w-4 h-4 text-[#D4A843]" />
                  <span>Tax Workflow Progress Snapshot</span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-400">Intake &amp; Document Completeness</span>
                    <span className="font-medium text-white">In Progress (Sample)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-400">Reconciliation Verification</span>
                    <span className="font-medium text-white">Draft Stage (Sample)</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-800">
                    <span className="text-slate-400">Independent Reviewer Sign-Off</span>
                    <span className="font-medium text-[#E5B552]">Required Before Release</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Client Authorization Gate</span>
                    <span className="font-medium text-[#E5B552]">Required Before Filing</span>
                  </div>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed pt-3 border-t border-slate-800">
                All discrepancies require human professional evaluation before tax positions are finalized.
              </div>
            </div>
          </div>
        )}

        {/* Prominent Bottom Disclosure */}
        <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
          <p>
            <strong className="text-slate-200">Illustrative Data Notice:</strong> All charts, proportions, and queue entries shown above are illustrative sample visuals created to demonstrate interface structure. They do not represent actual client records, guaranteed tax savings, or live firm statistics.
          </p>
        </div>
      </div>
    </section>
  );
};
