import React, { useEffect, useState } from 'react';
import { PracticeRequestError, practiceService, type DeadlineEscalations, type EscalationLevelName, type PracticeSearch, type StaffNotifications,
  type Workload } from '../../services/practiceService';

export const LEVEL_LABELS: Record<EscalationLevelName, string> = { NORMAL: 'Normal', APPROACHING: 'Approaching', DUE_SOON: 'Due soon', OVERDUE: 'Overdue', CRITICAL: 'Critical' };
export const ENTITY_LABELS: Record<PracticeSearch['matches'][number]['entityType'], string> = { client: 'Client', case: 'Case', task: 'Task', document_request: 'Document request' };

/** When a deadline falls due, in whole hours, as the server computed it. */
export function dueText(hoursUntilDue: number): string {
  if (hoursUntilDue === 0) return 'due now';
  const n = Math.abs(hoursUntilDue), unit = n >= 48 ? `${Math.round(n / 24)} days` : `${n} hour${n === 1 ? '' : 's'}`;
  return hoursUntilDue > 0 ? `due in ${unit}` : `${unit} overdue`;
}

/** A staff notification in words. A task the recipient may no longer see is named only as unavailable. */
export function notificationText(n: StaffNotifications['notifications'][number]): string {
  if (!n.available || !n.task) return 'A task was assigned to you that you can no longer see.';
  return `Task assigned to you by ${n.createdBy}: ${n.task.title}${n.task.assignedToMe ? '' : ' (since reassigned)'}`;
}

type Load<T> = { status: 'loading' | 'ready' | 'error'; data?: T };
const isOff = (e: unknown) => e instanceof PracticeRequestError && (e.status === 503 || e.status === 403);

/**
 * Durable practice operations for the signed-in staff member (Blocks 84–88): their own workload, the deadlines in their
 * scope that are due soon or overdue, their in-app notifications, and a search of the practice records they may see.
 * Every figure is the server's, with its definition on hover. Hidden when the durable store is not enabled.
 */
export function PracticeOperationsPanel() {
  const [off, setOff] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [workload, setWorkload] = useState<Load<Workload>>({ status: 'loading' });
  const [deadlines, setDeadlines] = useState<Load<DeadlineEscalations>>({ status: 'loading' });
  const [notes, setNotes] = useState<Load<StaffNotifications>>({ status: 'loading' });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Load<PracticeSearch> | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let live = true;
    const load = <T,>(p: Promise<T>, set: (v: Load<T>) => void) => p.then(data => { if (live) set({ status: 'ready', data }); })
      .catch(e => { if (!live) return; if (isOff(e)) setOff(true); else set({ status: 'error' }); });
    load(practiceService.workload(), setWorkload);
    load(practiceService.deadlineEscalations(2), setDeadlines);
    load(practiceService.notifications(), setNotes);
    return () => { live = false; };
  }, [refresh]);
  if (off) return null;

  const markRead = async (id: string) => {
    setNotice('');
    try { await practiceService.markNotificationRead(id); setRefresh(n => n + 1); setNotice('Notification marked as read.'); }
    catch { setNotice('The notification could not be marked as read. Nothing was changed.'); }
  };
  const search = async (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim().length < 2) { setResults({ status: 'error' }); return; }
    setResults({ status: 'loading' });
    try { setResults({ status: 'ready', data: await practiceService.search(query.trim()) }); } catch { setResults({ status: 'error' }); }
  };
  const w = workload.data, d = deadlines.data, n = notes.data;
  const tiles: Array<[string, number, string]> = w ? [
    ['Open tasks', w.openTasks, w.definitions.openTasks], ['Overdue tasks', w.overdueTasks, w.definitions.overdueTasks],
    ['Assigned clients', w.assignedClients, w.definitions.assignedClients], ['Assigned engagements', w.assignedEngagements, w.definitions.assignedEngagements],
  ] : [];

  return <section aria-labelledby="practice-operations-heading" className="tg-acct-card">
    <h2 id="practice-operations-heading">Practice operations <button type="button" onClick={() => setRefresh(x => x + 1)}>Refresh</button></h2>
    {notice && <p role="status">{notice}</p>}

    <h3>My workload</h3>
    {workload.status === 'loading' && <p role="status">Loading your workload…</p>}
    {workload.status === 'error' && <p role="alert">Your workload could not be loaded. Nothing is shown in its place.</p>}
    {w && <ul className="tg-acct-kpis" aria-label="Workload counts">{tiles.map(([label, value, def]) => <li key={label} title={def}><span>{label}</span> <strong>{value}</strong></li>)}</ul>}

    <h3>Deadlines due soon or overdue</h3>
    {deadlines.status === 'loading' && <p role="status">Loading deadlines…</p>}
    {deadlines.status === 'error' && <p role="alert">Deadlines could not be loaded. Nothing is shown in its place.</p>}
    {d && (d.deadlines.length === 0 ? <p>No deadline in your scope is due within {d.thresholds.dueSoonHours} hours or overdue.</p>
      : <ul aria-label="Escalated deadlines">{d.deadlines.map(x => <li key={x.deadlineId}>
          <strong>{LEVEL_LABELS[x.levelName]}</strong> — {x.title} ({x.clientId}{x.taxYear ? ` ${x.taxYear}` : ''}), {dueText(x.hoursUntilDue)}</li>)}</ul>)}
    {d && <p className="text-xs" title={d.thresholds.source}>Levels: due soon within {d.thresholds.dueSoonHours} hours; critical after {d.thresholds.criticalOverdueHours} hours overdue
      {d.thresholds.statutoryOverdueIsCritical ? ' or when a statutory deadline is overdue' : ''}. These are default thresholds, not a reviewed policy.</p>}

    <h3>My notifications {n ? <span aria-label="Unread notifications">({n.unread} unread)</span> : null}</h3>
    {notes.status === 'loading' && <p role="status">Loading notifications…</p>}
    {notes.status === 'error' && <p role="alert">Notifications could not be loaded. Nothing is shown in its place.</p>}
    {n && (n.notifications.length === 0 ? <p>You have no notifications.</p>
      : <ul aria-label="Staff notifications">{n.notifications.map(x => <li key={x.notificationId}>{notificationText(x)}
          {x.readAt ? ' (read)' : <> <button type="button" onClick={() => markRead(x.notificationId)}>Mark as read</button></>}</li>)}</ul>)}

    <h3>Search</h3>
    <form onSubmit={search} role="search" aria-label="Search practice records">
      <label htmlFor="practice-search-input">Search clients, cases, tasks and document requests</label>{' '}
      <input id="practice-search-input" value={query} minLength={2} maxLength={100} onChange={e => setQuery(e.target.value)} />{' '}
      <button type="submit">Search</button>
    </form>
    {results?.status === 'loading' && <p role="status">Searching…</p>}
    {results?.status === 'error' && <p role="alert">Enter at least two characters. If you did, the search could not be completed.</p>}
    {results?.data && (results.data.matches.length === 0 ? <p>No records you may see match “{results.data.query}”.</p>
      : <><p>{results.data.totalMatches} match{results.data.totalMatches === 1 ? '' : 'es'}{results.data.totalMatches > results.data.matches.length ? `, showing ${results.data.matches.length}` : ''}.</p>
        <ul aria-label="Search results">{results.data.matches.map(m => <li key={m.entityType + m.id}>{ENTITY_LABELS[m.entityType]}: {m.label}
          {m.entityType !== 'client' ? ` — ${m.clientId}` : ''}{m.status ? ` (${m.status})` : ''}</li>)}</ul></>)}
  </section>;
}
