import React, { useEffect, useState } from 'react';
import { PracticeRequestError, practiceMessage, practiceService, type Workload } from '../../services/practiceService';

const MAX_STAFF = 25;
type Row = { userId: string; workload?: Workload; error?: string };

/**
 * Durable team workload for practice managers and administrators (Block 84): every staff member holding an ACTIVE case
 * in the practice summary, with their recorded open tasks by status, overdue tasks and assignments, plus a lookup of any
 * staff identifier. Counts only; no capacity target exists, so none is shown. Hidden when the durable store is off.
 */
export function TeamWorkloadPanel({ unavailableText }: { unavailableText?: string } = {}) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; rows: Row[]; more: number }>({ status: 'loading', rows: [], more: 0 });
  const [refresh, setRefresh] = useState(0);
  const [lookup, setLookup] = useState('');
  const [found, setFound] = useState<Row | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const summary = await practiceService.summary();
        const ids = summary.staffCaseCounts.map(s => s.userId);
        const rows = await Promise.all(ids.slice(0, MAX_STAFF).map(async userId => {
          try { return { userId, workload: await practiceService.workload(userId) }; } catch (e) { return { userId, error: practiceMessage(e) }; }
        }));
        if (live) setState({ status: 'ready', rows, more: Math.max(0, ids.length - MAX_STAFF) });
      } catch (e) {
        if (live) setState({ status: e instanceof PracticeRequestError && (e.status === 503 || e.status === 403) ? 'off' : 'error', rows: [], more: 0 });
      }
    })();
    return () => { live = false; };
  }, [refresh]);
  if (state.status === 'off') return unavailableText ? <p role="status">{unavailableText}</p> : null;

  const find = async (event: React.FormEvent) => {
    event.preventDefault();
    const userId = lookup.trim();
    if (!userId) return;
    try { setFound({ userId, workload: await practiceService.workload(userId) }); } catch (e) { setFound({ userId, error: practiceMessage(e) }); }
  };
  const row = (r: Row) => <tr key={r.userId}><th scope="row">{r.userId}</th>{r.workload ? <>
    <td>{r.workload.role}</td><td>{r.workload.openTasks}</td><td>{r.workload.overdueTasks}</td><td>{r.workload.byStatus.READY_FOR_REVIEW ?? 0}</td>
    <td>{r.workload.byStatus.WAITING_ON_CLIENT ?? 0}</td><td>{r.workload.assignedClients}</td><td>{r.workload.assignedEngagements + r.workload.clientWideAssignments}</td></>
    : <td colSpan={7} role="alert">{r.error}</td>}</tr>;
  const head = <thead><tr>{['Staff identifier', 'Role', 'Open tasks', 'Overdue', 'Ready for review', 'Waiting on client', 'Clients', 'Assignments'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>;

  return <section aria-labelledby="team-workload-heading" className="tg-manager-card">
    <h2 id="team-workload-heading">Recorded team workload <button type="button" onClick={() => setRefresh(n => n + 1)}>Refresh</button></h2>
    <p>Staff holding an active case, with their open practice tasks and current assignments as recorded. No capacity target is defined, so none is compared.</p>
    {state.status === 'loading' && <p role="status">Loading recorded team workload…</p>}
    {state.status === 'error' && <p role="alert">Team workload could not be loaded. Nothing is shown in its place.</p>}
    {state.status === 'ready' && (state.rows.length === 0 ? <p>No staff member holds an active case.</p> :
      <div className="tg-manager-scroll"><table aria-label="Team workload">{head}<tbody>{state.rows.map(row)}</tbody></table></div>)}
    {state.more > 0 && <p>{state.more} more staff member{state.more === 1 ? '' : 's'} hold active cases; look them up below.</p>}
    <form onSubmit={find} aria-label="Look up a staff member's workload">
      <label htmlFor="team-workload-lookup">Staff identifier</label>{' '}
      <input id="team-workload-lookup" value={lookup} maxLength={128} onChange={e => setLookup(e.target.value)} />{' '}
      <button type="submit">Show workload</button>
    </form>
    {found && <div className="tg-manager-scroll"><table aria-label="Looked-up workload">{head}<tbody>{row(found)}</tbody></table></div>}
  </section>;
}
