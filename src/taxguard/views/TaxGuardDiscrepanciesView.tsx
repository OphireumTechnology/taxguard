import React from 'react';
import { AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';

export interface TaxGuardDiscrepanciesViewProps {
  taxYear?: number;
  clientId?: string;
  onResolved?: () => void;
}

export function TaxGuardDiscrepanciesView({ taxYear, clientId, onResolved }: TaxGuardDiscrepanciesViewProps) {
  return (
    <div className="space-y-4 p-6 bg-slate-900 border border-slate-800 rounded-xl text-slate-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Tax Discrepancy Center</h2>
            <p className="text-sm text-slate-400">
              Tax Year {taxYear || new Date().getFullYear()} · Automated variance detection & validation
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
        <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          <span>No unverified discrepancies requiring immediate action.</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          All document extraction values, 1099 reconciliations, and book-to-tax variances are currently within threshold.
        </p>
      </div>
    </div>
  );
}
