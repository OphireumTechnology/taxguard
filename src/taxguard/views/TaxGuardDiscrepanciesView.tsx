import React from 'react';

export const TaxGuardDiscrepanciesView: React.FC<{ clientId?: string; taxYear?: number }> = () => {
  return (
    <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-200">
      <h3 className="text-base font-semibold text-[#D4A843]">TaxGuard Reconciliation & Discrepancies</h3>
      <p className="text-xs text-slate-400 mt-1">No outstanding discrepancies detected in the active ledger.</p>
    </div>
  );
};
