import React from 'react';
import { CheckCircle2, ShieldAlert } from 'lucide-react';

export interface TaxGuardDiscrepanciesViewProps {
  clientId?: string;
  taxYear?: number;
  discrepancies?: Array<{
    id: string;
    title: string;
    severity?: string;
    description?: string;
    status?: string;
  }>;
}

export const TaxGuardDiscrepanciesView: React.FC<TaxGuardDiscrepanciesViewProps> = ({
  taxYear,
  discrepancies = [],
}) => {
  return (
    <section className="max-w-4xl mx-auto py-6 px-4 space-y-4 text-sm text-slate-200">
      <header className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-5">
        <p className="text-[11px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">
          Document &amp; Data Integrity{taxYear ? ` · Tax Year ${taxYear}` : ''}
        </p>
        <h2 className="text-xl font-bold text-white mt-1">Discrepancy Review</h2>
        <p className="text-xs text-slate-300 mt-1">
          Items flagged during professional verification appear here for clarification.
        </p>
      </header>
      {discrepancies.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <p className="text-slate-200">No open discrepancies require your attention right now.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {discrepancies.map(item => (
            <li
              key={item.id}
              className="rounded-xl border border-amber-500/30 bg-[#0D2745] p-4 flex items-start gap-3"
            >
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-white">{item.title}</p>
                {item.description && <p className="text-xs text-slate-300 mt-1">{item.description}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
