import React, { useEffect, useState } from 'react';
import { PracticeRequestError, practiceService, type MyWork } from '../../services/practiceService';
import { ACCOUNTANT_STAGES } from './accountantDashboardModel';

const stageName = (n: number) => `${String(n).padStart(2, '0')} ${ACCOUNTANT_STAGES[n - 1] ?? ''}`.trim();

/**
 * The signed-in preparer's or reviewer's durable work queue (proposal 032). Every count is a list of
 * recorded rows with the definition shown on hover; nothing is estimated. Hidden when the durable
 * store is not enabled in this environment.
 */
export function DurableMyWorkPanel({ heading = 'My durable work queue' }: { heading?: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; data?: MyWork }>({ status: 'loading' });
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let live = true;
    practiceService.myWork().then(data => { if (live) setState({ status: 'ready', data }); })
      .catch(e => { if (live) setState({ status: e instanceof PracticeRequestError && (e.status === 503 || e.status === 403) ? 'off' : 'error' }); });
    return () => { live = false; };
  }, [refresh]);
  if (state.status === 'off') return null;
  const d = state.data;
  const tiles: Array<[string, number | undefined, string]> = d ? [
    ['Cases awaiting me', d.cases.filter(c => c.awaitingMe).length, d.definitions.cases],
    ['Documents to review', d.documentsToReview.length, d.definitions.documentsToReview],
    ['Requests outstanding', d.requestsOutstanding.length, d.definitions.requestsOutstanding],
    ['Entries to review', d.entriesAwaitingMyReview.length, d.definitions.entriesAwaitingMyReview],
    ['Returned to me', d.entriesReturnedToMe.length, d.definitions.entriesReturnedToMe],
    ['Book-to-tax to review', d.bookToTaxAwaitingReview, d.definitions.bookToTaxAwaitingReview],
  ] : [];
  return <section aria-labelledby="durable-my-work-heading" className="tg-acct-card">
    <h2 id="durable-my-work-heading">{heading} <button type="button" onClick={() => setRefresh(n => n + 1)}>Refresh</button></h2>
    {state.status === 'loading' && <p role="status">Loading your work queue…</p>}
    {state.status === 'error' && <p role="alert">Your work queue could not be loaded. Nothing is shown in its place.</p>}
    {d && <>
      <ul className="tg-acct-kpis" aria-label="Work queue counts">{tiles.map(([label, value, definition]) => <li key={label} title={definition}><span>{label}</span> <strong>{value}</strong></li>)}</ul>
      {d.cases.length === 0 ? <p>No active cases are assigned to you.</p> : <div className="max-w-full overflow-x-auto"><table><caption>My cases</caption>
        <thead><tr>{['Client', 'Tax year', 'Stage', 'My role', 'Next step'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{d.cases.map(c => <tr key={c.caseId}><td>{c.clientName || c.clientId}</td><td>{c.taxYear}</td><td>{stageName(c.activeStage)}{c.status === 'ON_HOLD' ? ' (on hold)' : ''}</td><td>{c.myRole}</td>
          <td>{c.evidence === 'BLOCKED' ? 'Blocked until a verified tax engine exists' : c.awaitingMe ? (c.evidence === 'HUMAN_ATTESTED' ? 'Your attestation' : 'Your verification') : 'Waiting on another role'}</td></tr>)}</tbody></table></div>}
      {d.documentsToReview.length > 0 && <><h3>Documents awaiting review</h3><ul>{d.documentsToReview.map(x => <li key={x.documentId + x.version}>{x.fileName} — {x.clientId} {x.taxYear}</li>)}</ul></>}
      {d.requestsOutstanding.length > 0 && <><h3>Document requests outstanding</h3><ul>{d.requestsOutstanding.map(q => <li key={q.requestId}>{q.title} — {q.clientId} {q.taxYear}{q.overdue ? ' (overdue)' : ''}</li>)}</ul></>}
      {d.entriesReturnedToMe.length > 0 && <><h3>Entries returned to me</h3><ul>{d.entriesReturnedToMe.map(e => <li key={e.entryId}>{e.entryNumber} {e.description} — {e.clientId}</li>)}</ul></>}
    </>}
  </section>;
}
