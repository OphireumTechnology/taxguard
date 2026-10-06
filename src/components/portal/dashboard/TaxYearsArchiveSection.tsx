/**
 * A/R Tax Services, LLC - TaxGuard AI
 * "MY TAX YEARS & RECORDS — 2022+" Section
 *
 * Implements:
 * - Section 18: Multi-Year Tax Records (2022, 2023, 2024, 2025, and future dynamically)
 * - Section 19: Organized archive cards with truthful empty states
 * - Section 43: Zero-Data Rule (no fabricated historical returns)
 */

import React, { useState } from 'react';
import {
  Calendar,
  Archive,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Download,
  Lock,
  ExternalLink
} from 'lucide-react';

export interface YearRecordSummary {
  taxYear: number;
  engagementStatus: string;
  returnStatus: string;
  documentsCount: number;
  filingDate?: string;
  hasFederalReturn: boolean;
  stateReturnsCount: number;
  hasAuthorizations: boolean;
  hasNotices: boolean;
  isArchived: boolean;
}

export interface TaxYearsArchiveSectionProps {
  currentTaxYear: number;
  availableYears?: number[];
  yearRecords?: Record<number, YearRecordSummary>;
  onSelectYear: (year: number) => void;
  onOpenArchiveYear?: (year: number) => void;
}

export const TaxYearsArchiveSection: React.FC<TaxYearsArchiveSectionProps> = ({
  currentTaxYear,
  availableYears = [2026, 2025, 2024, 2023, 2022],
  yearRecords = {},
  onSelectYear,
  onOpenArchiveYear
}) => {
  const [selectedTab, setSelectedTab] = useState<number | 'ALL'>('ALL');

  const displayedYears = selectedTab === 'ALL'
    ? availableYears
    : availableYears.filter(y => y === selectedTab);

  return (
    <section
      aria-label="My Tax Years and Records"
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#D4A843]/15 text-[#D4A843]">
            <Archive className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              MY TAX YEARS &amp; RECORDS
            </h2>
            <p className="text-[11px] text-slate-300">
              TaxGuard multi-year records, prior returns, and immutable evidence vault.
            </p>
          </div>
        </div>

        {/* Tab Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
          <button
            type="button"
            onClick={() => setSelectedTab('ALL')}
            className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
              selectedTab === 'ALL'
                ? 'bg-[#D4A843] text-[#06182B]'
                : 'bg-[#071A2E] text-slate-400 hover:text-white'
            }`}
          >
            All Years
          </button>
          {availableYears.map((yr) => (
            <button
              key={yr}
              type="button"
              onClick={() => setSelectedTab(yr)}
              className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                selectedTab === yr
                  ? 'bg-[#D4A843] text-[#06182B]'
                  : 'bg-[#071A2E] text-slate-400 hover:text-white'
              }`}
            >
              {yr}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Year Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
        {displayedYears.map((yr) => {
          const rec = yearRecords[yr];
          const isCurrentActive = yr === currentTaxYear;
          const hasRecords = Boolean(rec && (rec.documentsCount > 0 || rec.hasFederalReturn));

          return (
            <div
              key={yr}
              className={`p-4 rounded-xl border flex flex-col justify-between space-y-3 transition-all ${
                isCurrentActive
                  ? 'bg-[#071A2E] border-[#D4A843]/50 ring-1 ring-[#D4A843]/20 shadow-md'
                  : 'bg-[#071A2E] border-slate-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-white font-mono">
                      {yr}
                    </span>
                    {isCurrentActive && (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-[#D4A843]/20 text-[#D4A843] border border-[#D4A843]/40">
                        ACTIVE CYCLE
                      </span>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-slate-400">
                    {hasRecords ? (rec?.isArchived ? 'ARCHIVED' : 'IN WORKFLOW') : 'NO RECORDS'}
                  </span>
                </div>

                <div className="mt-2.5 space-y-1.5 text-[11px] text-slate-300">
                  {hasRecords ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Return Status:</span>
                        <strong className="text-white">{rec?.returnStatus || 'Complete'}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Source Documents:</span>
                        <span className="text-emerald-400 font-mono font-semibold">{rec?.documentsCount} Files</span>
                      </div>
                      {rec?.filingDate && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Filing Date:</span>
                          <span className="text-slate-200 font-mono">{new Date(rec.filingDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="py-2 text-slate-400 italic">
                      No TaxGuard records available for this year.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectYear(yr)}
                  className={`text-[11px] font-semibold cursor-pointer ${
                    isCurrentActive
                      ? 'text-[#D4A843] hover:underline'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {isCurrentActive ? 'Viewing Current Year' : `Switch to TY ${yr}`}
                </button>

                {hasRecords && onOpenArchiveYear && (
                  <button
                    type="button"
                    onClick={() => onOpenArchiveYear(yr)}
                    className="text-[10px] font-mono text-[#D4A843] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Archive</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
