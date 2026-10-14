import React from 'react';
import { Lock, ShieldCheck, UserCheck } from 'lucide-react';
import { stageCapability } from '../../../../taxguard/stageCapabilities';

export interface TaxStageStatusViewProps {
  stage: number;
  selectedTaxYear: number;
  /** Status reported by the verified client workflow, if any. */
  workflowStatus?: string;
  onNavigate?: (target: 'documents' | 'messages' | 'home') => void;
}

const EVIDENCE: Record<string, string> = {
  SYSTEM_VERIFIED: 'Checked by the system from recorded data',
  HUMAN_ATTESTED: 'Confirmed by your case reviewer',
  BLOCKED: 'Not available',
};

/**
 * Truthful stage view for the client portal. It never shows figures, signatures, filing or
 * acknowledgement states: blocked stages say why they are blocked and what the client can do now.
 */
export const TaxStageStatusView: React.FC<TaxStageStatusViewProps> = ({ stage, selectedTaxYear, workflowStatus, onNavigate }) => {
  const s = stageCapability(stage);
  if (!s) return <p role="alert" className="p-6">Unknown stage.</p>;
  const blocked = s.evidence === 'BLOCKED';
  const headingId = `stage-${s.stage}-heading`;
  return (
    <section aria-labelledby={headingId} data-testid={`tax-stage-${s.stage}`} className="max-w-3xl mx-auto py-6 px-4 space-y-4 text-sm text-slate-200">
      <header className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-5 space-y-2">
        <p className="text-[11px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">Stage {String(s.stage).padStart(2, '0')} of 18 · Tax year {selectedTaxYear}</p>
        <h1 id={headingId} className="text-xl font-bold text-white flex items-center gap-2">
          {blocked ? <Lock aria-hidden="true" className="w-5 h-5 text-amber-400" /> : <ShieldCheck aria-hidden="true" className="w-5 h-5 text-emerald-400" />}
          {s.name}
        </h1>
        <p>{s.purpose}</p>
      </header>
      {blocked && (
        <div role="status" className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-4 space-y-1">
          <p className="font-bold text-amber-200">This stage is not available.</p>
          <p>{s.blockedReason}</p>
        </div>
      )}
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">Status in your workflow</dt>
          <dd className="font-semibold text-white">{blocked ? 'Not available' : workflowStatus ? workflowStatus.replace(/_/g, ' ') : 'Not reported'}</dd></div>
        <div className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">How this stage is confirmed</dt>
          <dd className="font-semibold text-white">{EVIDENCE[s.evidence]}</dd></div>
        <div className="rounded-xl border border-slate-700 p-3 sm:col-span-2"><dt className="text-xs text-slate-400 flex items-center gap-1"><UserCheck aria-hidden="true" className="w-3.5 h-3.5" /> Responsibility</dt>
          <dd>{s.responsibility}</dd></div>
        <div className="rounded-xl border border-slate-700 p-3 sm:col-span-2"><dt className="text-xs text-slate-400">What you can do now</dt>
          <dd>{s.clientGuidance}</dd></div>
      </dl>
      {onNavigate && (
        <nav aria-label="Next steps" className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate('documents')} className="px-3 py-2 rounded-lg border border-slate-600 hover:border-[#D4A843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4A843]">Open documents</button>
          <button type="button" onClick={() => onNavigate('messages')} className="px-3 py-2 rounded-lg border border-slate-600 hover:border-[#D4A843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4A843]">Message your advisor</button>
          <button type="button" onClick={() => onNavigate('home')} className="px-3 py-2 rounded-lg border border-slate-600 hover:border-[#D4A843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4A843]">Back to overview</button>
        </nav>
      )}
    </section>
  );
};
