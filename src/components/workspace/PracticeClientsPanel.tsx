import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ENGAGEMENT_TRANSITIONS, newPracticeKey, practiceMessage, practiceService, type PracticeClientDetail, type PracticeClientRow } from '../../services/practiceService';

const ROLES = ['preparer', 'reviewer', 'bookkeeper', 'case_owner'];
const TYPES = ['tax_preparation', 'bookkeeping', 'tax_planning', 'advisory', 'representation', 'payroll'];
const label = (v: string) => v.replace(/_/g, ' ');

/** Client directory and engagement lifecycle. The server and database enforce every rule shown here. */
export function PracticeClientsPanel() {
  const [filter, setFilter] = useState({ q: '', status: 'active' });
  const [list, setList] = useState<{ status: 'loading' | 'ready' | 'error'; items: PracticeClientRow[]; next: string | null; message?: string }>({ status: 'loading', items: [], next: null });
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; data?: PracticeClientDetail; message?: string }>({ status: 'idle' });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [engagementForm, setEngagementForm] = useState({ title: '', type: 'tax_preparation', taxYear: String(new Date().getFullYear() - 1) });
  const [teamForm, setTeamForm] = useState({ engagementId: '', taxYear: '', role: 'preparer', userId: '', reason: '' });
  const [noteBody, setNoteBody] = useState('');
  const [taskForm, setTaskForm] = useState({ title: '', assignedUserId: '', dueDate: '' });
  const [statusReason, setStatusReason] = useState('');
  const keys = useRef<Record<string, string>>({});
  const keyFor = (action: string) => (keys.current[action] ??= newPracticeKey());
  const selectedRef = useRef(selected); selectedRef.current = selected;

  const loadList = useCallback((cursor?: string) => {
    setList(l => ({ ...l, status: 'loading' }));
    practiceService.listClients({ ...filter, ...(cursor ? { cursor } : {}) })
      .then(r => setList(l => ({ status: 'ready', items: cursor ? [...l.items, ...r.items] : r.items, next: r.nextCursor })))
      .catch(e => setList({ status: 'error', items: [], next: null, message: practiceMessage(e) }));
  }, [filter]);
  useEffect(() => { loadList(); }, [loadList]);
  const loadDetail = useCallback((clientId: string) => {
    setDetail({ status: 'loading' });
    practiceService.clientDetail(clientId).then(data => { if (selectedRef.current === clientId) setDetail({ status: 'ready', data }); })
      .catch(e => { if (selectedRef.current === clientId) setDetail({ status: 'error', message: practiceMessage(e) }); });
  }, []);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  const run = async (action: string, op: () => Promise<unknown>, success: string) => {
    if (busy || !selected) return false;
    const client = selected;
    setBusy(true); setNotice(null);
    try { await op(); delete keys.current[action]; if (selectedRef.current === client) { setNotice({ error: false, text: success }); loadDetail(client); } return true; }
    catch (e) { if (selectedRef.current === client) setNotice({ error: true, text: practiceMessage(e) }); return false; }
    finally { setBusy(false); }
  };
  const d = detail.data;
  return <section aria-labelledby="practice-clients-heading" className="tg-manager-card">
    <h2 id="practice-clients-heading">Clients &amp; Engagements</h2>
    <form className="tg-manager-controls" onSubmit={e => { e.preventDefault(); loadList(); }}>
      <label>Search clients<input value={filter.q} maxLength={100} onChange={e => setFilter({ ...filter, q: e.target.value })} /></label>
      <label>Status<select value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}><option value="active">Active</option><option value="archived">Archived</option><option value="">All</option></select></label>
      <button>Search</button>
    </form>
    {list.status === 'loading' && <p role="status">Loading clients…</p>}
    {list.status === 'error' && <p role="alert">{list.message}</p>}
    {list.status === 'ready' && list.items.length === 0 && <p role="status">No clients match, or none are assigned to you.</p>}
    {list.items.length > 0 && <div className="tg-manager-scroll"><table><caption className="sr-only">Authorized clients</caption>
      <thead><tr>{['Client', 'Type', 'Status', 'Open engagements', 'Team', 'Open tasks', 'Next deadline'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{list.items.map(c => <tr key={c.clientId}><td><button type="button" aria-pressed={selected === c.clientId} onClick={() => { setSelected(c.clientId); setNotice(null); }}>{c.name || c.clientId}</button><small>{c.clientId}</small></td>
        <td>{label(c.clientType)}</td><td>{c.status}</td><td>{c.engagements}</td><td>{c.team.map(t => `${label(t.role)}: ${t.userId}`).join(', ') || 'Unassigned'}</td><td>{c.openTasks}</td>
        <td>{c.nextDeadline ? c.nextDeadline.slice(0, 10) : 'None recorded'}</td></tr>)}</tbody></table></div>}
    {list.next && <button type="button" onClick={() => loadList(list.next!)}>Load more clients</button>}

    {selected && <div aria-live="polite">
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {detail.status === 'loading' && <p role="status">Loading client…</p>}
      {detail.status === 'error' && <p role="alert">{detail.message}</p>}
      {d && detail.status === 'ready' && <>
        <h3>{d.client.name || d.client.clientId} <small>({label(d.client.clientType)}, {d.client.status})</small></h3>
        <h4>Engagements</h4>
        {d.engagements.length === 0 && <p>No engagements yet.</p>}
        <ul>{d.engagements.map(e => <li key={e.engagementId}><strong>{e.title}</strong> · {label(e.type)} · {e.status} · tax years {e.taxYears.map(y => y.taxYear).join(', ')}
          {(ENGAGEMENT_TRANSITIONS[e.status] || []).map(next => <button key={next} type="button" disabled={busy}
            onClick={() => run('eng-status', () => practiceService.setEngagementStatus(d.client.clientId, e.engagementId, next, e.version, statusReason || undefined), `Engagement set to ${label(next)}.`)}>Set {label(next)}</button>)}</li>)}</ul>
        <label>Reason for hold, cancellation or archive (recorded)<input value={statusReason} maxLength={500} onChange={e => setStatusReason(e.target.value)} /></label>
        <form onSubmit={e => { e.preventDefault(); void run('engagement', () => practiceService.createEngagement(d.client.clientId, { title: engagementForm.title, type: engagementForm.type,
            taxYears: [Number(engagementForm.taxYear)] }, keyFor('engagement')), 'Engagement created as draft.'); }}>
          <h4>New engagement</h4>
          <label>Title<input required minLength={3} maxLength={255} value={engagementForm.title} onChange={e => setEngagementForm({ ...engagementForm, title: e.target.value })} /></label>
          <label>Type<select value={engagementForm.type} onChange={e => setEngagementForm({ ...engagementForm, type: e.target.value })}>{TYPES.map(t => <option key={t} value={t}>{label(t)}</option>)}</select></label>
          <label>Tax year<input type="number" min={2000} max={2100} required value={engagementForm.taxYear} onChange={e => setEngagementForm({ ...engagementForm, taxYear: e.target.value })} /></label>
          <button disabled={busy}>Create engagement</button>
        </form>
        <h4>Team</h4>
        <ul>{d.team.map(t => <li key={t.assignmentId}>{label(t.role)}: {t.userId} · {t.engagementId} / {t.taxYear}</li>)}</ul>
        {d.team.length === 0 && <p>No active assignments.</p>}
        <form onSubmit={e => { e.preventDefault(); void run('assign', () => practiceService.assign(d.client.clientId, teamForm.engagementId, { taxYear: Number(teamForm.taxYear), role: teamForm.role,
            userId: teamForm.userId.trim(), reason: teamForm.reason }, keyFor('assign')), 'Team assignment recorded.'); }}>
          <label>Engagement<select required value={teamForm.engagementId} onChange={e => setTeamForm({ ...teamForm, engagementId: e.target.value, taxYear: String(d.engagements.find(x => x.engagementId === e.target.value)?.taxYears[0]?.taxYear ?? '') })}>
            <option value="">Select</option>{d.engagements.filter(e => e.status in ENGAGEMENT_TRANSITIONS).map(e => <option key={e.engagementId} value={e.engagementId}>{e.title}</option>)}</select></label>
          <label>Tax year<input type="number" required value={teamForm.taxYear} onChange={e => setTeamForm({ ...teamForm, taxYear: e.target.value })} /></label>
          <label>Role<select value={teamForm.role} onChange={e => setTeamForm({ ...teamForm, role: e.target.value })}>{ROLES.map(r => <option key={r} value={r}>{label(r)}</option>)}</select></label>
          <label>Staff identifier<input required maxLength={128} value={teamForm.userId} onChange={e => setTeamForm({ ...teamForm, userId: e.target.value })} /></label>
          <label>Reason (recorded)<input required minLength={5} maxLength={500} value={teamForm.reason} onChange={e => setTeamForm({ ...teamForm, reason: e.target.value })} /></label>
          <button disabled={busy}>Assign</button>
        </form>
        <h4>Tasks</h4>
        <ul>{d.tasks.map(t => <li key={t.taskId}>{t.title} · {t.status} · {t.assignedUserId || 'unassigned'}{t.dueDate ? ` · due ${t.dueDate.slice(0, 10)}` : ''}
          {!['COMPLETED', 'CANCELLED'].includes(t.status) && <button type="button" disabled={busy} onClick={() => run('task-status', () => practiceService.setTaskStatus(d.client.clientId, t.taskId, 'COMPLETED', t.version), 'Task completed.')}>Mark complete</button>}</li>)}</ul>
        <form onSubmit={e => { e.preventDefault(); void run('task', () => practiceService.createTask(d.client.clientId, { title: taskForm.title, assignedUserId: taskForm.assignedUserId || undefined,
            dueDate: taskForm.dueDate ? new Date(taskForm.dueDate + 'T00:00:00Z').toISOString() : undefined }, keyFor('task')), 'Task created.')
          .then(ok => { if (ok) setTaskForm({ title: '', assignedUserId: '', dueDate: '' }); }); }}>
          <label>Task<input required minLength={3} maxLength={255} value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} /></label>
          <label>Assignee<input maxLength={128} value={taskForm.assignedUserId} onChange={e => setTaskForm({ ...taskForm, assignedUserId: e.target.value })} /></label>
          <label>Due<input type="date" value={taskForm.dueDate} onChange={e => setTaskForm({ ...taskForm, dueDate: e.target.value })} /></label>
          <button disabled={busy}>Add task</button>
        </form>
        <h4>Notes</h4>
        <form onSubmit={e => { e.preventDefault(); void run('note', () => practiceService.addNote(d.client.clientId, noteBody), 'Note added.').then(ok => { if (ok) setNoteBody(''); }); }}>
          <label>Internal note (staff only, cannot be edited)<textarea required maxLength={4000} value={noteBody} onChange={e => setNoteBody(e.target.value)} /></label>
          <button disabled={busy || !noteBody.trim()}>Add note</button>
        </form>
        <ul>{d.notes.map(n => <li key={n.noteId}>{n.body}<small> — {n.authorUid} ({n.authorRole}), {new Date(n.createdAt).toLocaleString()}</small></li>)}</ul>
        <h4>Client status</h4>
        <button type="button" disabled={busy || statusReason.trim().length < 5} onClick={() => run('client-status', () => practiceService.setClientStatus(d.client.clientId,
          d.client.status === 'archived' ? 'active' : 'archived', statusReason), d.client.status === 'archived' ? 'Client reactivated.' : 'Client archived.')}>
          {d.client.status === 'archived' ? 'Reactivate client' : 'Archive client'}</button>
        <h4>Activity</h4>
        <ul>{d.activity.slice(0, 20).map((a, i) => <li key={a.at + i}>{label(a.action.toLowerCase())} · {a.actorUid} · {new Date(a.at).toLocaleString()}</li>)}</ul>
      </>}
    </div>}
  </section>;
}
