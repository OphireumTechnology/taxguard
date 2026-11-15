import React from 'react';

export const TaxGuardDiscrepanciesView: React.FC<{ [key: string]: any }> = () => {
  return (
    <section className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 text-slate-200 space-y-2">
      <h2 className="text-lg font-bold text-white">Document &amp; Reconciliation Discrepancies</h2>
      <p className="text-sm text-slate-300">
        No unresolved discrepancies are currently flagged for your active tax year.
      </p>
    </section>
  );
};
