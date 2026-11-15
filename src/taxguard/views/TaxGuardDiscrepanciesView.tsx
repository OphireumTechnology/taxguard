import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const TaxGuardDiscrepanciesView: React.FC<{ clientId?: string; taxYear?: number }> = ({ taxYear }) => {
  return (
    <section className="rounded-2xl bg-[#0D2745] border border-slate-700/80 p-6 space-y-3 text-sm text-slate-200">
      <div className="flex items-center gap-2 text-white font-bold">
        <ShieldCheck className="w-5 h-5 text-[#D4A843]" />
        <h2>Document &amp; Return Discrepancy Review{taxYear ? ` (${taxYear})` : ''}</h2>
      </div>
      <p className="text-slate-300 text-xs">
        No unresolved discrepancies are currently flagged for your account. Any exceptions identified during professional review will appear here and in your Document Requests.
      </p>
    </section>
  );
};
