import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const TaxGuardDiscrepanciesView: React.FC<{ clientId?: string; taxYear?: number; [key: string]: any }> = ({
  taxYear = 2025,
}) => (
  <section className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-6 space-y-3 text-sm text-slate-200">
    <div className="flex items-center gap-2 text-[#D4A843] font-semibold">
      <ShieldCheck className="w-5 h-5" />
      <span>TaxGuard Verification &amp; Discrepancy Center ({taxYear})</span>
    </div>
    <p className="text-slate-300">
      No unresolved client-facing discrepancies are open for this tax year. Any flagged items requiring clarification appear in your requests and messages.
    </p>
  </section>
);
