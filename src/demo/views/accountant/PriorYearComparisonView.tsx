/**
 * A/R Tax Services, LLC - Prior-Year vs Current-Year Comparison View
 * Section 19: Prior Year → Current Year Change Report & Discrepancy Reconciliation.
 */

import React, { useState } from 'react';
import { 
  GitCompare, 
  CheckCircle, 
  AlertTriangle, 
  TrendingUp, 
  ArrowRight, 
  DollarSign, 
  ShieldCheck,
  FileText
} from 'lucide-react';
import { accountantCenterService } from '../../services/AccountantCenterService';

interface PriorYearComparisonViewProps {
  isDark: boolean;
}

export const PriorYearComparisonView: React.FC<PriorYearComparisonViewProps> = ({ isDark }) => {
  const [items, setItems] = useState(() => accountantCenterService.getPriorYearComparison());
  const client = accountantCenterService.getSelectedClient();
  const taxYear = accountantCenterService.getSelectedTaxYear();

  const handleReconcile = (id: string) => {
    accountantCenterService.reconcilePriorYearItem(id, 'Reconciled & Signed-off');
    setItems(accountantCenterService.getPriorYearComparison());
  };

  const cardBg = isDark ? 'bg-neutral-900 border-neutral-800' : 'bg-white border-neutral-300';
  const textPrimary = isDark ? 'text-white' : 'text-neutral-900';
  const textSecondary = isDark ? 'text-neutral-400' : 'text-neutral-600';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={`p-5 border rounded-lg shadow-sm ${cardBg} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div>
          <div className="text-[10px] font-mono uppercase bg-neutral-200/80 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300 px-2 py-0.5 rounded inline-block font-bold mb-1">
            Section 19 &bull; Comparative Intelligence
          </div>
          <h2 className={`text-lg font-bold uppercase tracking-tight ${textPrimary}`}>
            Prior-Year &rarr; Current-Year Variance &amp; Change Analysis
          </h2>
          <p className={`text-xs ${textSecondary} mt-0.5`}>
            Comparing CY{taxYear} intake against benchmark TY{taxYear - 1} filing records for <strong>{client.name}</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-bold">
            Baseline: TY{Number(taxYear) - 1} Accepted Return
          </span>
        </div>
      </div>

      {/* Comparative Table */}
      <div className={`border rounded-lg shadow-sm overflow-x-auto ${cardBg}`}>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/60 font-mono text-[10px] uppercase text-neutral-500 border-b border-neutral-200 dark:border-neutral-800">
              <th className="p-3">Audit Area</th>
              <th className="p-3">Previous Value (TY{Number(taxYear) - 1})</th>
              <th className="p-3">Current Value (TY{taxYear})</th>
              <th className="p-3">Document Source</th>
              <th className="p-3">Difference / Shift</th>
              <th className="p-3 max-w-sm">AI Variance Diagnosis</th>
              <th className="p-3">Review Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {items.map((row) => {
              const prev = row.previousValue || row.priorYearValue;
              const curr = row.currentValue || row.currentYearValue;
              const diff = row.difference || row.differenceDescription;
              const src = row.source || row.itemLabel;
              const isReconciled = !row.requiresReview || row.accountantReviewStatus === 'VERIFIED & RECONCILED';

              return (
                <tr key={row.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                  <td className="p-3 font-bold text-neutral-900 dark:text-white">
                    {row.area}
                  </td>

                  <td className="p-3 font-mono text-neutral-600 dark:text-neutral-400">
                    {prev}
                  </td>

                  <td className="p-3 font-mono font-bold text-neutral-900 dark:text-white">
                    {curr}
                  </td>

                  <td className="p-3 font-mono text-[11px] text-neutral-500">
                    {src}
                  </td>

                  <td className="p-3 font-mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200">
                    {diff}
                  </td>

                  <td className="p-3 text-neutral-700 dark:text-neutral-300 text-[11px] max-w-sm">
                    {row.aiExplanation}
                  </td>

                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      isReconciled
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      {row.accountantReviewStatus}
                    </span>
                  </td>

                  <td className="p-3 text-right">
                    {!isReconciled && (
                      <button
                        onClick={() => handleReconcile(row.id)}
                        className="px-2.5 py-1 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 rounded text-[10px] font-bold uppercase hover:opacity-90"
                      >
                        Sign-Off
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
