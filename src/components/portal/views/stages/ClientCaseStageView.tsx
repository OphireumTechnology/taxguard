import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Lock } from 'lucide-react';
import { stageCapability } from '../../../../taxguard/stageCapabilities';
import { clientPortalContracts, portalErrorMessage, type CaseStages, type PortalEngagement } from '../../../../services/clientPortalContracts';

/** Plain-language labels for the server's system checks and attestation checklist codes (proposal 026). */
export const CHECK_LABELS: Record<string, string> = {
  postedEntries: 'Accounting entries for the year have been recorded',
  noEntriesAwaitingReview: 'No recorded entry is waiting for review',
  ledgerBalanced: 'The records balance',
  closedReconciliation: 'At least one account reconciliation is complete',
  noReconciliationInProgress: 'No reconciliation is still in progress',
  allBankTransactionsPosted: 'Every bank transaction for the year has been recorded',
  documents_received_or_waived: 'Requested documents received or waived',
  documents_in_private_storage: 'Documents stored privately',
  documents_reviewed_for_completeness: 'Documents reviewed for completeness',
  discrepancies_recorded_or_resolved: 'Discrepancies recorded or resolved',
  workpapers_reviewed: 'Workpapers reviewed',
  no_unresolved_blocking_exceptions: 'No unresolved blocking exceptions',
  reports_reviewed_for_release: 'Reports reviewed for release',
  planning_considerations_documented: 'Planning considerations documented',
};
const label = (code: string) => CHECK_LABELS[code] ?? code.replace(/_/g, ' ');
const STATUS: Record<string, string> = { COMPLETED: 'Completed', IN_PROGRESS: 'In progress', LOCKED: 'Not started' };
const CASE_STATUS: Record<string, string> = { ACTIVE: 'Active', ON_HOLD: 'On hold — your practice has paused work', CLOSED: 'Closed', CANCELLED: 'Cancelled' };

type Load = { status: 'loading' } | { status: 'choose'; options: PortalEngagement[] } | { status: 'none' } | { status: 'error'; message: string } | { status: 'ready'; data: CaseStages };

/**
 * Client view of stages 04-08 from the server's recorded case state (contract C3). Shows status,
 * evidence availability and what the practice must still confirm; never figures, workpapers,
 * reviewer identities or internal notes. The browser does not change or infer progression.
 */
export function ClientCaseStageView({ clientId, stage, taxYear, onNavigate }: { clientId: string; stage: number; taxYear: number; onNavigate?: (t: 'documents' | 'messages') => void }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [engagementId, setEngagementId] = useState('');
  const [refresh, setRefresh] = useState(0);
  const seq = useRef(0);
  const cap = stageCapability(stage);

  useEffect(() => {
    const mine = ++seq.current, controller = new AbortController();
    setLoad({ status: 'loading' });
    (async () => {
      let eng = engagementId;
      if (!eng) {
        const rows = (await clientPortalContracts.engagements(clientId, controller.signal)).items.filter(r => r.taxYear === taxYear && r.engagementStatus !== 'cancelled');
        if (mine !== seq.current) return;
        if (rows.length === 0) { setLoad({ status: 'none' }); return; }
        if (rows.length > 1) { setLoad({ status: 'choose', options: rows }); return; }
        eng = rows[0].engagementId;
      }
      const data = await clientPortalContracts.caseStages(clientId, eng, taxYear, controller.signal);
      if (mine === seq.current) setLoad({ status: 'ready', data });
    })().catch(e => { if (mine === seq.current && (e as Error)?.name !== 'AbortError') setLoad({ status: 'error', message: portalErrorMessage(e) }); });
    return () => { controller.abort(); };
  }, [clientId, taxYear, engagementId, refresh]);

  if (!cap) return null;
  const headingId = `case-stage-${stage}-heading`;
  return <section aria-labelledby={headingId} aria-busy={load.status === 'loading'} data-testid={`client-case-stage-${stage}`} className="max-w-3xl mx-auto py-6 px-4 space-y-4 text-sm text-slate-200">
    <header className="rounded-2xl bg-[#0D2745] border border-[rgba(148,163,184,0.18)] p-5 space-y-2">
      <p className="text-[11px] font-mono uppercase tracking-widest text-[#D4A843] font-bold">Stage {String(stage).padStart(2, '0')} of 18 · Tax year {taxYear}</p>
      <h1 id={headingId} className="text-xl font-bold text-white">{cap.name}</h1>
      <p>{cap.purpose}</p>
      <p className="text-xs text-slate-400">{cap.responsibility}</p>
    </header>
    {load.status === 'loading' && <p role="status">Loading the recorded status…</p>}
    {load.status === 'error' && <p role="alert">{load.message} <button type="button" className="underline" onClick={() => setRefresh(n => n + 1)}>Retry</button></p>}
    {load.status === 'none' && <p role="status">No engagement is open for tax year {taxYear}. Your practice opens engagements; contact them if you expected one.</p>}
    {load.status === 'choose' && <label className="flex flex-col gap-1 max-w-md">You have more than one engagement for {taxYear}. Choose one:
      <select className="bg-slate-800 rounded-lg border border-slate-600 px-2 py-1.5" value={engagementId} onChange={e => setEngagementId(e.target.value)}>
        <option value="">Select an engagement</option>{load.options.map(o => <option key={o.engagementId} value={o.engagementId}>{o.title}</option>)}</select></label>}
    {load.status === 'ready' && !load.data.caseExists && <p role="status">Your practice has not opened the case for this engagement yet, so no stage has started.</p>}
    {load.status === 'ready' && load.data.caseExists && (() => {
      const d = load.data;
      const row = d.stages.find(s => s.stage === stage);
      const isActive = d.activeStage === stage;
      return <>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">This stage</dt>
            <dd className="font-semibold text-white">{row ? STATUS[row.status] ?? row.status : 'Not recorded'}{row?.completedAt ? <> · <time dateTime={row.completedAt}>{new Date(row.completedAt).toLocaleDateString()}</time></> : null}</dd></div>
          <div className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">Case</dt>
            <dd className="font-semibold text-white">{CASE_STATUS[d.caseStatus] ?? d.caseStatus} · current stage {String(d.activeStage).padStart(2, '0')}</dd></div>
        </dl>
        {isActive && d.activeStagePolicy && <div className="rounded-xl border border-slate-700 p-3 space-y-2">
          <p className="font-semibold text-white">{d.activeStagePolicy.evidence === 'SYSTEM_VERIFIED' ? 'Checked by the system from recorded data' : 'To be confirmed by your case reviewer'}</p>
          <ul className="space-y-1" aria-label="Stage requirements">
            {d.activeStagePolicy.evidence === 'SYSTEM_VERIFIED' && d.activeStageChecks && Object.entries(d.activeStageChecks).map(([k, ok]) => <li key={k} className="flex items-start gap-2">
              {ok ? <CheckCircle2 aria-hidden="true" className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle aria-hidden="true" className="w-4 h-4 text-slate-500 shrink-0" />}
              <span>{label(k)}<span className="sr-only">{ok ? ' — met' : ' — not yet'}</span></span></li>)}
            {d.activeStagePolicy.evidence === 'HUMAN_ATTESTED' && d.activeStagePolicy.checklist.map(k => <li key={k} className="flex items-start gap-2">
              <Lock aria-hidden="true" className="w-4 h-4 text-slate-500 shrink-0" /><span>{label(k)}<span className="sr-only"> — awaiting reviewer confirmation</span></span></li>)}
          </ul>
        </div>}
        {!isActive && row?.status === 'LOCKED' && <p role="status">This stage starts after Stage {String(d.activeStage).padStart(2, '0')} is completed.</p>}
        <dl className="grid gap-3 grid-cols-2 sm:grid-cols-4" aria-label="Your documents for this engagement">
          {([['Accepted documents', d.evidence.verifiedDocuments], ['In review', d.evidence.documentsInReview], ['Need your action', d.evidence.documentsNeedingAction], ['Open requests', d.evidence.openDocumentRequests]] as const)
            .map(([k, v]) => <div key={k} className="rounded-xl border border-slate-700 p-3"><dt className="text-xs text-slate-400">{k}</dt><dd className="text-lg font-bold text-white">{v}</dd></div>)}
        </dl>
        <p className="text-xs text-slate-400">{d.team.preparerAssigned && d.team.reviewerAssigned ? (d.team.independentReview ? 'A preparer and an independent reviewer are assigned.' : 'A preparer and a reviewer are assigned.') : 'Your practice has not completed staffing for this engagement yet.'}</p>
        {onNavigate && <nav aria-label="Next steps" className="flex flex-wrap gap-2">
          <button type="button" onClick={() => onNavigate('documents')} className="px-3 py-2 rounded-lg border border-slate-600 min-h-[40px] hover:border-[#D4A843]">Open documents</button>
          <button type="button" onClick={() => onNavigate('messages')} className="px-3 py-2 rounded-lg border border-slate-600 min-h-[40px] hover:border-[#D4A843]">Message your advisor</button>
        </nav>}
      </>;
    })()}
  </section>;
}
