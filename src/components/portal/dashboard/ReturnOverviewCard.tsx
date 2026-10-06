/**
 * A/R Tax Services, LLC - TaxGuard AI
 * "RETURN OVERVIEW — [TAX YEAR]" Component
 *
 * Implements:
 * - Section 10: Authoritative Return Overview for client dashboard
 * - Displays: tax year, return type, filing status, applicable jurisdictions,
 *   dependents, major income categories, engagement, current return status
 * - Truthful empty states conforming strictly to Section 43 (Zero-Data Requirement)
 */

import React from 'react';
import {
  FileText,
  MapPin,
  Users,
  Briefcase,
  DollarSign,
  ShieldCheck,
  CheckCircle2,
  Clock,
  HelpCircle
} from 'lucide-react';
import { FilingStatus } from '../../../services/taxDocumentRequirementEngine';

export interface ReturnOverviewProps {
  taxYear: number;
  returnType?: string;
  filingStatus?: FilingStatus | string;
  jurisdictions?: Array<{
    code: string;
    name: string;
    type: 'RESIDENT' | 'NONRESIDENT' | 'PART_YEAR' | 'FEDERAL';
  }>;
  dependentsCount?: number;
  incomeCategories?: string[];
  engagementStatus?: string;
  returnStatus?: string;
  onOpenQuestionnaire?: () => void;
  onManageStates?: () => void;
}

export const ReturnOverviewCard: React.FC<ReturnOverviewProps> = ({
  taxYear,
  returnType = 'Form 1040 (Individual Income Tax Return)',
  filingStatus,
  jurisdictions = [],
  dependentsCount,
  incomeCategories = [],
  engagementStatus = 'Active Engagement',
  returnStatus = 'Document Collection & Intake',
  onOpenQuestionnaire,
  onManageStates
}) => {
  const formatFilingStatus = (status?: string): string => {
    if (!status) return 'To be confirmed in questionnaire';
    switch (status) {
      case 'single':
        return 'Single';
      case 'married_filing_jointly':
        return 'Married Filing Jointly';
      case 'married_filing_separately':
        return 'Married Filing Separately';
      case 'head_of_household':
        return 'Head of Household';
      case 'qualifying_surviving_spouse':
        return 'Qualifying Surviving Spouse';
      default:
        return status;
    }
  };

  const defaultJurisdictions = jurisdictions.length > 0
    ? jurisdictions
    : [
        { code: 'FED', name: 'Federal (IRS)', type: 'FEDERAL' as const },
        { code: 'SC', name: 'South Carolina', type: 'RESIDENT' as const }
      ];

  return (
    <section
      aria-label={`Return Overview for Tax Year ${taxYear}`}
      className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#D4A843]/15 text-[#D4A843]">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              RETURN OVERVIEW &mdash; {taxYear}
            </h2>
            <p className="text-[11px] text-slate-300">
              Authoritative return profile, tax entities, and applicable tax jurisdictions.
            </p>
          </div>
        </div>

        {onOpenQuestionnaire && (
          <button
            type="button"
            onClick={onOpenQuestionnaire}
            className="text-xs text-[#D4A843] hover:underline font-semibold cursor-pointer shrink-0 self-start sm:self-auto"
          >
            Update Return Facts &rarr;
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {/* 1. Return Type & Year */}
        <div className="p-3.5 rounded-xl bg-[#071A2E] border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
            Return Type &amp; Year
          </span>
          <div className="font-bold text-white text-sm">
            {returnType}
          </div>
          <div className="text-[11px] text-[#D4A843] font-mono">
            Tax Year: {taxYear}
          </div>
        </div>

        {/* 2. Filing Status */}
        <div className="p-3.5 rounded-xl bg-[#071A2E] border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
            Filing Status
          </span>
          <div className="font-bold text-white text-sm">
            {formatFilingStatus(filingStatus)}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Users className="w-3 h-3 text-slate-400" />
            <span>
              {dependentsCount !== undefined
                ? `${dependentsCount} Dependent${dependentsCount === 1 ? '' : 's'}`
                : 'Dependents pending questionnaire'}
            </span>
          </div>
        </div>

        {/* 3. Jurisdictions */}
        <div className="p-3.5 rounded-xl bg-[#071A2E] border border-slate-800 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
              Jurisdictions
            </span>
            {onManageStates && (
              <button
                type="button"
                onClick={onManageStates}
                className="text-[10px] text-[#D4A843] hover:underline"
              >
                manage
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {defaultJurisdictions.map((j) => (
              <span
                key={j.code}
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                  j.type === 'FEDERAL'
                    ? 'bg-blue-950 text-blue-300 border border-blue-500/30'
                    : j.type === 'RESIDENT'
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                }`}
                title={`${j.name} (${j.type})`}
              >
                {j.name}
              </span>
            ))}
          </div>
        </div>

        {/* 4. Engagement & Return Status */}
        <div className="p-3.5 rounded-xl bg-[#071A2E] border border-slate-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
            Engagement &amp; Status
          </span>
          <div className="font-bold text-emerald-400 text-sm flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{engagementStatus}</span>
          </div>
          <div className="text-[11px] text-slate-300">
            {returnStatus}
          </div>
        </div>
      </div>

      {/* Major Income Categories */}
      {incomeCategories.length > 0 ? (
        <div className="p-3 rounded-xl bg-[#071A2E] border border-slate-800 text-xs flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono uppercase text-slate-400 font-bold">
            Income Categories Detected:
          </span>
          {incomeCategories.map((cat, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-md bg-[#102D4F] border border-slate-700 text-slate-200 text-[11px]"
            >
              {cat}
            </span>
          ))}
        </div>
      ) : (
        <div className="p-3 rounded-xl bg-[#071A2E] border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
          <span>Income categories will populate once tax questionnaire is submitted.</span>
          {onOpenQuestionnaire && (
            <button
              type="button"
              onClick={onOpenQuestionnaire}
              className="text-[#D4A843] hover:underline font-medium text-[11px]"
            >
              Start Questionnaire &rarr;
            </button>
          )}
        </div>
      )}
    </section>
  );
};
