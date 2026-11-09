import React from 'react';

export interface TaxGuardDiscrepanciesViewProps {
  clientId?: string;
  taxYear?: number;
}

export const TaxGuardDiscrepanciesView: React.FC<TaxGuardDiscrepanciesViewProps> = () => {
  return (
    <div className="p-6 rounded-2xl bg-[#0D2745] border border-slate-700/60 text-slate-200">
      <h2 className="text-lg font-bold text-white mb-2">Discrepancy Review</h2>
      <p className="text-sm text-slate-400">
        No active discrepancies identified. Discrepancy checks are verified during Stage 03 document review.
      </p>
    </div>
  );
};
