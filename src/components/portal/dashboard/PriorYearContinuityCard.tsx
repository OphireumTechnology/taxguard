/**
 * A/R Tax Services, LLC - TaxGuard AI
 * Prior-Year Continuity & Carryforward Review Card
 *
 * Implements:
 * - Section 20: Prior-Year Continuity
 * - PRIOR-YEAR FACT → PROPOSED CARRYFORWARD → CLIENT CONFIRMATION → CURRENT-YEAR AUTHORITATIVE FACT
 * - Material changes update downstream requirements
 */

import React, { useState } from 'react';
import {
  History,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Edit2,
  Info
} from 'lucide-react';

export interface PriorYearFactItem {
  id: string;
  category: string;
  label: string;
  priorYearValue: string;
  isConfirmed: boolean;
}

export interface PriorYearContinuityCardProps {
  currentTaxYear: number;
  priorTaxYear: number;
  facts?: PriorYearFactItem[];
  onConfirmAll?: () => void;
  onConfirmFact?: (factId: string) => void;
  onModifyFact?: (factId: string) => void;
}

export const PriorYearContinuityCard: React.FC<PriorYearContinuityCardProps> = ({
  currentTaxYear,
  priorTaxYear,
  facts = [],
  onConfirmAll,
  onConfirmFact,
  onModifyFact
}) => {
  const [confirmedIds, setConfirmedIds] = useState<Record<string, boolean>>({});

  const defaultFacts: PriorYearFactItem[] = facts.length > 0
    ? facts
    : [
        {
          id: 'address',
          category: 'Residency',
          label: 'Primary Residence & Domicile',
          priorYearValue: 'Columbia, South Carolina (29201)',
          isConfirmed: false
        },
        {
          id: 'filing_status',
          category: 'Filing',
          label: 'Filing Status',
          priorYearValue: 'Single',
          isConfirmed: false
        },
        {
          id: 'dependents',
          category: 'Household',
          label: 'Qualifying Dependents',
          priorYearValue: 'None claimed in prior tax return',
          isConfirmed: false
        },
        {
          id: 'bank_direct_deposit',
          category: 'Refund / Banking',
          label: 'Direct Deposit Account',
          priorYearValue: 'Checking Account ending in ****4182',
          isConfirmed: false
        }
      ];

  const handleConfirm = (factId: string) => {
    setConfirmedIds(prev => ({ ...prev, [factId]: true }));
    onConfirmFact?.(factId);
  };

  const handleConfirmAll = () => {
    const all: Record<string, boolean> = {};
    defaultFacts.forEach(f => { all[f.id] = true; });
    setConfirmedIds(all);
    onConfirmAll?.();
  };

  const allConfirmed = defaultFacts.every(f => confirmedIds[f.id] || f.isConfirmed);

  return (
    <div className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#D4A843]/15 text-[#D4A843]">
            <History className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              PRIOR-YEAR CONTINUITY &mdash; {priorTaxYear} &rarr; {currentTaxYear}
            </h2>
            <p className="text-[11px] text-slate-300">
              TaxGuard carryforward proposal. Confirm existing facts or flag changes for {currentTaxYear}.
            </p>
          </div>
        </div>

        {!allConfirmed && (
          <button
            type="button"
            onClick={handleConfirmAll}
            className="px-3 py-1.5 rounded-lg bg-[#102D4F] hover:bg-[#143657] text-xs font-semibold text-[#D4A843] border border-slate-700 transition-colors cursor-pointer self-start sm:self-auto"
          >
            Confirm All as Unchanged
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {defaultFacts.map((fact) => {
          const isDone = confirmedIds[fact.id] || fact.isConfirmed;

          return (
            <div
              key={fact.id}
              className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                isDone
                  ? 'bg-[#071A2E]/70 border-emerald-900/40 text-slate-300'
                  : 'bg-[#071A2E] border-slate-800 text-white'
              }`}
            >
              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                  {fact.label}
                </span>
                <div className="text-xs font-medium text-slate-200">
                  {fact.priorYearValue}
                </div>
                <div className="text-[10px] text-slate-400">
                  Proposed for {currentTaxYear} from {priorTaxYear} record
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-1.5 pt-1">
                {isDone ? (
                  <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmed</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleConfirm(fact.id)}
                      className="px-2.5 py-1 rounded bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-[11px] font-bold cursor-pointer"
                    >
                      Confirm
                    </button>
                    {onModifyFact && (
                      <button
                        type="button"
                        onClick={() => onModifyFact(fact.id)}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Update value for current tax year"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
