/**
 * A/R Tax Services, LLC — Stage 05: Reconcile Workspace
 * Comprehensive tie-out reconciliation between source documents, accounting ledgers,
 * and recorded tax return figures. Never hides unexplained variances.
 */

import React, { useState, useEffect } from 'react';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  FileSpreadsheet,
  HelpCircle,
  FolderOpen
} from 'lucide-react';
import { getStoredToken } from '../../../../services/api';

interface ReconciliationCategoryItem {
  id: string;
  category: string;
  sourceTotal: number;
  recordedTotal: number;
  variance: number;
  status: 'BALANCED' | 'VARIANCE_DETECTED' | 'UNDER_REVIEW';
  notes?: string;
}

interface StageFiveReconcileViewProps {
  clientId: string;
  selectedTaxYear: number;
  onNavigateToStageFour?: () => void;
  onNavigateToStageSix?: () => void;
}

export const StageFiveReconcileView: React.FC<StageFiveReconcileViewProps> = ({
  clientId,
  selectedTaxYear,
  onNavigateToStageFour,
  onNavigateToStageSix
}) => {
  const [items, setItems] = useState<ReconciliationCategoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    const loadReconciliations = async () => {
      setIsLoading(true);
      try {
        const token = getStoredToken();
        const res = await fetch(`/api/case-authority/tenantA/${clientId}/eng_${selectedTaxYear}_${clientId}/cases/${selectedTaxYear}/reconciliations`, {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          if (Array.isArray(data.reconciliations) && data.reconciliations.length > 0) {
            setItems(data.reconciliations.map((r: any) => ({
              id: r.id || r.reconciliationId,
              category: r.category || 'General',
              sourceTotal: Number(r.sourceTotal || 0),
              recordedTotal: Number(r.recordedTotal || 0),
              variance: Number(r.variance || 0),
              status: Math.abs(Number(r.variance || 0)) < 0.01 ? 'BALANCED' : 'VARIANCE_DETECTED',
              notes: r.notes
            })));
          } else {
            setItems([]);
          }
        } else {
          setItems([]);
        }
      } catch {
        if (isMounted) setItems([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    loadReconciliations();
    return () => {
      isMounted = false;
    };
  }, [clientId, selectedTaxYear]);

  const totalSource = items.reduce((sum, i) => sum + i.sourceTotal, 0);
  const totalRecorded = items.reduce((sum, i) => sum + i.recordedTotal, 0);
  const netVariance = totalRecorded - totalSource;
  const isBalanced = items.length > 0 && Math.abs(netVariance) < 0.01 && items.every(i => i.status === 'BALANCED');

  return (
    <div className="max-w-7xl mx-auto py-6 px-4 space-y-6">
      {/* 4-Question Orientation Header */}
      <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-700/60 pb-4">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
              Stage 05 of 18 · Reconcile
            </div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2 mt-1">
              <Scale className="w-5 h-5 text-[#D4A843]" />
              <span>Evidence &amp; Ledger Tie-Out Reconciliation</span>
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tax Year: <strong className="text-[#D4A843]">{selectedTaxYear}</strong></span>
            <span aria-hidden="true">·</span>
            <span>Status: <strong className={isBalanced ? 'text-emerald-400' : 'text-amber-400'}>
              {isBalanced ? 'Balanced ($0.00 Variance)' : items.length === 0 ? 'Pending Stage 04 Completion' : 'Variance Audit in Progress'}
            </strong></span>
          </div>
        </div>

        {/* The 4 Core Questions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">1. Where am I?</span>
            <p className="text-slate-200">Stage 05: Mathematical tie-outs ensuring 100% agreement between source documents and return entries.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">2. What do I need to do?</span>
            <p className="text-slate-200">Nothing required from you unless an unexplained variance is flagged by the CPA reviewer.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">3. What is A/R Tax doing?</span>
            <p className="text-slate-200">Cross-checking withholding, estimated tax vouchers, and W-2/1099 box allocations.</p>
          </div>
          <div className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block">4. What happens next?</span>
            <p className="text-slate-200">Once reconciled, the file advances to Stage 06 for independent Maker-Checker professional review.</p>
          </div>
        </div>
      </div>

      {/* Main Reconciliation Summary & Tables */}
      {isLoading ? (
        <div className="p-12 text-center bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl space-y-3">
          <RefreshCw className="w-6 h-6 text-[#D4A843] animate-spin mx-auto" />
          <p className="text-xs text-slate-300">Auditing reconciliation tie-outs...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl space-y-4">
          <FileSpreadsheet className="w-10 h-10 text-slate-500 mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Reconciliation Schedules Pending for TY {selectedTaxYear}</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Reconciliation tie-outs execute automatically after Stage 04 records are completed by your tax preparer.
            </p>
          </div>
          {onNavigateToStageFour && (
            <button
              type="button"
              onClick={onNavigateToStageFour}
              className="px-4 py-2 bg-[#D4A843] hover:bg-[#E1BB60] text-[#06182B] text-xs font-bold rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>View Stage 04 Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-4 bg-[#0D2745] rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px]">TOTAL SOURCE EVIDENCE</span>
              <span className="text-white text-lg font-bold">
                ${totalSource.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-4 bg-[#0D2745] rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px]">TOTAL RECORDED FIGURES</span>
              <span className="text-white text-lg font-bold">
                ${totalRecorded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="p-4 bg-[#0D2745] rounded-2xl border border-slate-800 space-y-1">
              <span className="text-slate-400 block text-[10px]">NET RECONCILIATION VARIANCE</span>
              <span className={`text-lg font-bold ${Math.abs(netVariance) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                ${netVariance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Line by line tie-outs */}
          <div className="bg-[#0D2745] border border-[rgba(148,163,184,0.18)] rounded-2xl p-6 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white border-b border-slate-700/60 pb-3">
              Statutory Schedule Tie-Out Breakdown
            </h3>
            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 bg-[#071A2E] rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-white block">{item.category}</span>
                    <span className="text-[11px] text-slate-400">
                      Source: ${item.sourceTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })} · Recorded: ${item.recordedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`font-mono font-bold ${Math.abs(item.variance) < 0.01 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      Variance: ${item.variance.toFixed(2)}
                    </span>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {Math.abs(item.variance) < 0.01 ? '✓ Balanced Tie-Out' : 'Audit Exception Open'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
