import React, { useCallback, useEffect, useRef, useState } from 'react';
import { latestRequestGate } from '../../hooks/latestRequestGate';
import { JOB_STATUSES, jobActions, jobMessage, JobRequestError, jobService, type DurableJob, type JobStatus } from '../../services/jobService';

const PAGE = 25;
const UNAVAILABLE = 'Verified queue, worker leases and dead-letter records are unavailable in this workspace. No worker activity or completed jobs are inferred.';

/**
 * The practice's durable background jobs for administrators (proposal 20261019240000). Lists what the database recorded,
 * filters by status, and offers only the actions the database allows: re-queue a dead-lettered or failed job, cancel one
 * not yet completed. No worker is commissioned, so nothing here runs a job. Falls back to the unavailable notice when the
 * durable queue is not enabled.
 */
export function AdminJobQueuePanel() {
  const [status, setStatus] = useState<JobStatus | ''>('');
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; total?: number; jobs?: DurableJob[] }>({ status: 'loading' });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Only the newest list request may set the list: an older response that arrives later (for example the first load,
  // after the refresh that follows a cancel) would otherwise show a job's former state (Block 103).
  const gate = useRef(latestRequestGate()).current;
  const load = useCallback(() => {
    const request = gate.begin();
    setState(s => ({ ...s, status: 'loading' }));
    jobService.list({ ...(status ? { status } : {}), limit: PAGE, offset })
      .then(r => { if (gate.isLatest(request)) setState({ status: 'ready', total: r.total, jobs: r.jobs }); })
      .catch(e => { if (gate.isLatest(request)) setState({ status: e instanceof JobRequestError && e.status === 503 ? 'off' : 'error' }); });
  }, [status, offset, gate]);
  useEffect(() => { load(); }, [load]);

  const act = async (job: DurableJob, action: 'retry' | 'cancel') => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const updated = await jobService[action](job.id);
      setNotice({ error: false, text: action === 'retry' ? `Job re-queued with ${updated.maxAttempts} attempts allowed.` : 'Job cancelled.' });
      load();
    } catch (e) { setNotice({ error: true, text: jobMessage(e) }); }
    finally { setBusy(false); }
  };

  return <section aria-labelledby="admin-jobs-heading" className="space-y-4 text-slate-300">
    <h1 id="admin-jobs-heading" className="text-xl font-bold text-white">Durable Job Queue</h1>
    {state.status === 'off' ? <p role="status">{UNAVAILABLE}</p> : <>
      <p>Recorded jobs only. No worker is commissioned, so no job here has been run by TaxGuard unless its status says so.</p>
      <div className="flex flex-wrap gap-3 items-end">
        <label>Status{' '}<select value={status} onChange={e => { setOffset(0); setStatus(e.target.value as JobStatus | ''); }} className="text-slate-900">
          <option value="">All</option>{JOB_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
        <button type="button" onClick={load} disabled={state.status === 'loading'} className="p-2 rounded-lg border border-slate-500">Refresh jobs</button>
      </div>
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {state.status === 'loading' && <p role="status">Loading recorded jobs…</p>}
      {state.status === 'error' && <p role="alert">Jobs could not be loaded. Nothing is shown in their place.</p>}
      {state.status === 'ready' && (state.jobs!.length === 0 ? <p role="status">No jobs are recorded{status ? ` with status ${status}` : ''}.</p> :
        <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="text-left py-2">{state.total} recorded job{state.total === 1 ? '' : 's'}</caption>
          <thead><tr>{['Type', 'Client', 'Status', 'Attempts', 'Last error', 'Created', 'Actions'].map(h => <th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead>
          <tbody>{state.jobs!.map(j => { const can = jobActions(j.status); return <tr key={j.id} className="border-t border-slate-700">
            <td className="p-2">{j.jobType}</td><td className="p-2">{j.clientId ?? 'Practice-wide'}{j.caseId ? ` · ${j.caseId}` : ''}</td>
            <td className="p-2">{j.status}</td><td className="p-2">{j.attemptCount} of {j.maxAttempts}</td>
            <td className="p-2">{j.lastErrorCode ? `${j.lastErrorCode}${j.lastErrorMessage ? ': ' + j.lastErrorMessage : ''}` : '—'}</td>
            <td className="p-2"><time dateTime={j.createdAt}>{j.createdAt.slice(0, 16).replace('T', ' ')}</time></td>
            <td className="p-2 space-x-2">
              {can.retry && <button type="button" disabled={busy} onClick={() => act(j, 'retry')} aria-label={`Re-queue ${j.jobType} job ${j.id}`}>Re-queue</button>}
              {can.cancel && <button type="button" disabled={busy} onClick={() => act(j, 'cancel')} aria-label={`Cancel ${j.jobType} job ${j.id}`}>Cancel</button>}
            </td></tr>; })}</tbody></table></div>)}
      {state.status === 'ready' && (state.total ?? 0) > PAGE && <div className="flex gap-2">
        <button type="button" disabled={offset === 0} onClick={() => setOffset(o => Math.max(0, o - PAGE))}>Previous</button>
        <span>{offset + 1}–{Math.min(offset + PAGE, state.total!)} of {state.total}</span>
        <button type="button" disabled={offset + PAGE >= state.total!} onClick={() => setOffset(o => o + PAGE)}>Next</button></div>}
    </>}
  </section>;
}
