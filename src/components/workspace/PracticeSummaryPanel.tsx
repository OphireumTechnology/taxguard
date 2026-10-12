import React, { useEffect, useState } from 'react';
import { PracticeRequestError, practiceService, type PracticeSummary } from '../../services/practiceService';
import { MANAGER_STAGES } from './practiceManagerModel';

/**
 * Practice manager summary from durable records (proposal 032): counts and recorded balances only,
 * each with its definition. No capacity, SLA, productivity or forecast figure is shown because none
 * is defined by an authoritative policy. Hidden when the durable store is not enabled.
 */
export function PracticeSummaryPanel({ taxYear }: { taxYear?: number }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; data?: PracticeSummary }>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    practiceService.summary(taxYear).then(data => { if (live) setState({ status: 'ready', data }); })
      .catch(e => { if (live) setState({ status: e instanceof PracticeRequestError && (e.status === 503 || e.status === 403) ? 'off' : 'error' }); });
    return () => { live = false; };
  }, [taxYear]);
  if (state.status === 'off') return null;
  const d = state.data;
  const tile = (label: string, value: number | string, definition: string) => <li key={label} title={definition}><span>{label}</span> <strong>{value}</strong></li>;
  return <section aria-labelledby="practice-summary-heading" className="tg-manager-card">
    <h2 id="practice-summary-heading">Durable practice summary{taxYear ? ` — ${taxYear}` : ''}</h2>
    {state.status === 'loading' && <p role="status">Loading recorded practice figures…</p>}
    {state.status === 'error' && <p role="alert">Practice figures could not be loaded. Nothing is shown in their place.</p>}
    {d && <>
      <p>As of {d.asOf}. Hover a figure for its definition.</p>
      <ul className="tg-manager-kpis" aria-label="Recorded practice figures">
        {tile('Active cases', d.casesByStage.reduce((n, s) => n + s.active, 0), d.definitions.casesByStage)}
        {tile('On hold', d.casesByStage.reduce((n, s) => n + s.onHold, 0), d.definitions.casesByStage)}
        {tile('Deadlines this week', d.deadlines.dueThisWeek, d.definitions.deadlines)}
        {tile('Overdue deadlines', d.deadlines.overdue, d.definitions.deadlines)}
        {tile('Open tasks', d.tasks.open, d.definitions.tasks)}
        {tile('Overdue tasks', d.tasks.overdue, d.definitions.tasks)}
        {tile('Document requests outstanding', d.documentRequests.open + d.documentRequests.submitted, d.definitions.documentRequests)}
        {tile('Overdue requests', d.documentRequests.overdue, d.definitions.documentRequests)}
        {tile('Documents awaiting review', d.documentsAwaitingReview, d.definitions.documentsAwaitingReview)}
        {tile('Documents awaiting scan', d.documentsAwaitingScan, d.definitions.documentsAwaitingScan)}
        {tile('Open invoices', d.receivables.openInvoices, d.definitions.receivables)}
        {tile('Balance due', '$' + d.receivables.balanceDue, d.definitions.receivables)}
        {tile('Invoices awaiting approval', d.receivables.awaitingApproval, d.definitions.receivables)}
      </ul>
      <h3>Active cases by stage</h3>
      {d.casesByStage.length === 0 ? <p>No active cases are recorded.</p> : <table><caption className="sr-only">Cases by stage</caption>
        <thead><tr><th scope="col">Stage</th><th scope="col">Active</th><th scope="col">On hold</th></tr></thead>
        <tbody>{d.casesByStage.map(s => <tr key={s.stage}><td>{String(s.stage).padStart(2, '0')} {MANAGER_STAGES[s.stage - 1]}</td><td>{s.active}</td><td>{s.onHold}</td></tr>)}</tbody></table>}
      <h3>Assigned active cases per staff member</h3>
      <p>{d.definitions.staffCaseCounts}</p>
      {d.staffCaseCounts.length === 0 ? <p>No active assignments.</p> : <table><caption className="sr-only">Assigned cases per staff member</caption>
        <thead><tr><th scope="col">Staff</th><th scope="col">As preparer</th><th scope="col">As reviewer</th></tr></thead>
        <tbody>{d.staffCaseCounts.map(s => <tr key={s.userId}><td>{s.userId}</td><td>{s.asPreparer}</td><td>{s.asReviewer}</td></tr>)}</tbody></table>}
    </>}
  </section>;
}
