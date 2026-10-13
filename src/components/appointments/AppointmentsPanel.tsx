import React, { useCallback, useEffect, useRef, useState } from 'react';
import { appointmentErrorText, appointmentsService, CATEGORY_LABEL, formatAppointmentTime, MODE_LABEL, newAppointmentKey, STATUS_LABEL, zonedLocalToIso,
  type Appointment, type AppointmentCategory, type AppointmentMode } from '../../services/appointmentsService';

type Mode = { kind: 'client'; clientId: string } | { kind: 'staff' } | { kind: 'practice' };
type Load<T> = { status: 'loading' | 'ready' | 'error' | 'off'; data: T | null; error?: string };
const viewerZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } })();
const DAY = 86_400_000;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const DURATIONS = [15, 30, 45, 60, 90, 120];

/**
 * Durable appointments (proposal 040). Every record shown comes from /api/scheduling and every
 * change is decided by the server (scope, staff eligibility, booking conflicts, transitions,
 * versions). A failed request keeps its idempotency key so an unchanged retry cannot act twice.
 */
export function AppointmentsPanel({ mode, actorId }: { mode: Mode; actorId?: string }) {
  const isClient = mode.kind === 'client';
  const [from, setFrom] = useState(startOfToday);
  const [staffFilter, setStaffFilter] = useState('');
  const [items, setItems] = useState<Load<Appointment[]>>({ status: 'loading', data: null });
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = useRef(new Map<string, string>());
  const keyFor = (purpose: string) => { let k = keys.current.get(purpose); if (!k) { k = newAppointmentKey(); keys.current.set(purpose, k); } return k; };
  const resetKey = (purpose: string) => keys.current.delete(purpose);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const load = useCallback((signal?: AbortSignal) => {
    setItems(previous => ({ status: 'loading', data: previous.data }));
    const promise = mode.kind === 'client' ? appointmentsService.listForClient(mode.clientId, signal)
      : appointmentsService.schedule(new Date(from).toISOString(), new Date(from + 14 * DAY).toISOString(), mode.kind === 'practice' && staffFilter.trim() ? staffFilter.trim() : undefined, signal);
    promise.then(data => { if (mounted.current) setItems({ status: 'ready', data }); })
      .catch(error => { if (!mounted.current || signal?.aborted) return;
        setItems({ status: (error?.status === 503 || error?.status === 403) && mode.kind !== 'client' ? 'off' : 'error', data: null, error: appointmentErrorText(error) }); });
  }, [mode.kind, (mode as { clientId?: string }).clientId, from, staffFilter]);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  const clientOf = (a: Appointment) => mode.kind === 'client' ? mode.clientId : a.clientId;
  const openDetail = useCallback((a: Appointment) => {
    setOpenId(a.appointmentId); setDetail(null);
    appointmentsService.get(clientOf(a), a.appointmentId).then(d => { if (mounted.current) setDetail(d); })
      .catch(error => { if (mounted.current) setNotice({ error: true, text: appointmentErrorText(error) }); });
  }, [mode]);

  const run = async (purpose: string, action: (key: string) => Promise<Appointment>, success: string) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      const result = await action(keyFor(purpose));
      if (!mounted.current) return;
      resetKey(purpose);
      setNotice({ error: false, text: success });
      load();
      if (openId === result.appointmentId) openDetail(result);
    } catch (error) { if (mounted.current) setNotice({ error: true, text: appointmentErrorText(error) }); }
    finally { if (mounted.current) setBusy(false); }
  };

  if (items.status === 'off') return null;
  const list = items.data ?? [];
  const now = Date.now();
  const upcoming = list.filter(a => Date.parse(a.endsAt) >= now && ['REQUESTED', 'CONFIRMED'].includes(a.status)).sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const rest = list.filter(a => !upcoming.includes(a));
  const heading = mode.kind === 'client' ? 'My appointments' : mode.kind === 'staff' ? 'My appointment schedule' : 'Practice appointment calendar';
  const row = (a: Appointment) => <li key={a.appointmentId} className="space-y-1">
    <button type="button" className="w-full text-left" aria-expanded={openId === a.appointmentId} onClick={() => openId === a.appointmentId ? setOpenId(null) : openDetail(a)}>
      <strong>{a.title}</strong> · {STATUS_LABEL[a.status]} · {CATEGORY_LABEL[a.category]} · {MODE_LABEL[a.mode]}
      {!isClient && <> · client {a.clientName || a.clientId}{mode.kind === 'practice' ? ` · staff ${a.staffUid ?? 'unassigned'}` : ''}</>}
      <br /><small>{formatAppointmentTime(a, viewerZone)}</small>
    </button>
    {openId === a.appointmentId && <AppointmentDetail appointment={detail ?? a} loaded={!!detail} isClient={isClient} busy={busy} actorId={actorId}
      onAction={(purpose, fn, text) => void run(purpose + ':' + a.appointmentId, fn, text)} clientId={clientOf(a)} onInputChange={purpose => resetKey(purpose + ':' + a.appointmentId)} />}
  </li>;

  return <section aria-label={heading} className="space-y-4 text-sm">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-lg font-bold">{heading}</h2>
      <div className="flex flex-wrap gap-2">
        {!isClient && <><button type="button" onClick={() => setFrom(f => f - 7 * DAY)}>Previous week</button><button type="button" onClick={() => setFrom(startOfToday())}>Today</button>
          <button type="button" onClick={() => setFrom(f => f + 7 * DAY)}>Next week</button></>}
        <button type="button" onClick={() => load()} disabled={items.status === 'loading'}>Refresh appointments</button>
      </div>
    </header>
    <p>Times are shown in each appointment's own time zone{viewerZone ? `; your device uses ${viewerZone}` : ''}.{!isClient && ` Showing ${new Date(from).toLocaleDateString()} – ${new Date(from + 14 * DAY).toLocaleDateString()}.`}</p>
    {mode.kind === 'practice' && <label>Filter by staff UID (blank for everyone)<input value={staffFilter} maxLength={128} onChange={e => setStaffFilter(e.target.value)} /></label>}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {items.status === 'loading' && !items.data && <p role="status">Loading appointments…</p>}
    {items.status === 'error' && <p role="alert">{items.error} <button type="button" onClick={() => load()}>Retry</button></p>}
    {items.status === 'ready' && list.length === 0 && <p>No appointments{isClient ? ' yet' : ' in this period'}.</p>}
    {upcoming.length > 0 && <><h3 className="font-bold">Upcoming</h3><ul aria-label="Upcoming appointments" className="space-y-2">{upcoming.map(row)}</ul></>}
    {rest.length > 0 && <><h3 className="font-bold">{isClient ? 'History' : 'Other appointments in this period'}</h3><ul aria-label="Appointment history" className="space-y-2">{rest.map(row)}</ul></>}
    <AppointmentForm isClient={isClient} fixedClientId={mode.kind === 'client' ? mode.clientId : undefined} defaultStaff={mode.kind === 'staff' ? actorId : undefined} busy={busy}
      onInputChange={() => resetKey('create')}
      onSubmit={(clientId, draft) => void run('create', key => appointmentsService.create(clientId, draft, key),
        isClient ? 'Appointment requested. The practice will confirm it.' : draft.confirm ? 'Appointment booked and confirmed.' : 'Appointment recorded as requested.')} />
  </section>;
}

function AppointmentDetail({ appointment: a, loaded, isClient, busy, clientId, onAction, onInputChange }: { appointment: Appointment; loaded: boolean; isClient: boolean; busy: boolean;
  clientId: string; actorId?: string; onAction: (purpose: string, fn: (key: string) => Promise<Appointment>, success: string) => void; onInputChange: (purpose: string) => void }) {
  const [reason, setReason] = useState('');
  const [move, setMove] = useState({ local: '', minutes: 60, timezone: a.timezone, staffUid: '' });
  const [edit, setEdit] = useState({ agenda: a.agenda ?? '', internalNote: a.internalNote ?? '', meetingUrl: a.meetingUrl ?? '', location: a.location ?? '' });
  const open = ['REQUESTED', 'CONFIRMED'].includes(a.status);
  const started = Date.parse(a.startsAt) <= Date.now();
  const act = (action: 'confirm' | 'complete' | 'no_show' | 'cancel', text: string) =>
    onAction(action, key => appointmentsService.transition(clientId, a.appointmentId, a.version, action, key, action === 'cancel' ? reason.trim() : undefined), text);
  return <div className="space-y-2 rounded border p-3" aria-label={`Appointment details: ${a.title}`}>
    <p>{formatAppointmentTime(a)} · {MODE_LABEL[a.mode]}{a.location ? ` · ${a.location}` : ''}</p>
    {a.agenda && <p className="whitespace-pre-wrap">Agenda: {a.agenda}</p>}
    {a.mode === 'REMOTE' && (a.meetingUrl ? <p>Meeting link: <a href={a.meetingUrl} target="_blank" rel="noopener noreferrer">{a.meetingUrl}</a></p>
      : <p>{a.status === 'CONFIRMED' || !isClient ? 'No meeting link recorded yet.' : 'The meeting link appears here once the appointment is confirmed.'}</p>)}
    {a.status === 'CANCELLED' && a.cancelReason && <p>Cancellation reason: {a.cancelReason}</p>}
    {!isClient && <>
      <p>Responsible staff: {a.staffUid ?? 'not assigned'}{a.internalNote ? ` · Internal note: ${a.internalNote}` : ''}</p>
      {loaded && a.history && <details><summary>Change history ({a.history.length})</summary><ol className="list-decimal pl-5">{a.history.map(h =>
        <li key={h.seq}>{new Date(h.at).toLocaleString()} · {h.action.replaceAll('_', ' ').toLowerCase()} · {h.actorUid} ({h.actorRole})</li>)}</ol></details>}
    </>}
    {open && <div className="flex flex-wrap gap-2">
      {!isClient && a.status === 'REQUESTED' && <button type="button" disabled={busy || !a.staffUid} title={a.staffUid ? undefined : 'Assign a staff member by rescheduling first'}
        onClick={() => act('confirm', 'Appointment confirmed.')}>Confirm appointment</button>}
      {!isClient && a.status === 'CONFIRMED' && started && <><button type="button" disabled={busy} onClick={() => act('complete', 'Marked completed.')}>Mark completed</button>
        <button type="button" disabled={busy} onClick={() => act('no_show', 'Marked as a no-show.')}>Mark no-show</button></>}
    </div>}
    {open && (!isClient || !started) && <form aria-label="Cancel appointment" onSubmit={e => { e.preventDefault(); act('cancel', 'Appointment cancelled.'); }}>
      <label>Cancellation reason (required)<input value={reason} minLength={5} maxLength={500} required onChange={e => { setReason(e.target.value); onInputChange('cancel'); }} /></label>
      <button disabled={busy || reason.trim().length < 5}>Cancel appointment</button>
    </form>}
    {open && !isClient && <form aria-label="Reschedule appointment" onSubmit={e => { e.preventDefault();
      const startsAt = zonedLocalToIso(move.local, move.timezone);
      if (!startsAt) return;
      onAction('reschedule', key => appointmentsService.reschedule(clientId, a.appointmentId, a.version, { startsAt, endsAt: new Date(Date.parse(startsAt) + move.minutes * 60_000).toISOString(),
        timezone: move.timezone, ...(move.staffUid.trim() ? { staffUid: move.staffUid.trim() } : {}) }, key), 'Appointment rescheduled.'); }}>
      <label>New start (local time in the zone below)<input type="datetime-local" required value={move.local} onChange={e => { setMove({ ...move, local: e.target.value }); onInputChange('reschedule'); }} /></label>
      <label>Length<select value={move.minutes} onChange={e => { setMove({ ...move, minutes: Number(e.target.value) }); onInputChange('reschedule'); }}>{DURATIONS.map(d => <option key={d} value={d}>{d} minutes</option>)}</select></label>
      <label>Time zone<input value={move.timezone} required onChange={e => { setMove({ ...move, timezone: e.target.value }); onInputChange('reschedule'); }} /></label>
      <label>Responsible staff UID (blank keeps the current one)<input value={move.staffUid} maxLength={128} onChange={e => { setMove({ ...move, staffUid: e.target.value }); onInputChange('reschedule'); }} /></label>
      {move.local && !zonedLocalToIso(move.local, move.timezone) && <p role="alert">That local time does not exist in this time zone (or the zone is invalid).</p>}
      <button disabled={busy}>Reschedule</button>
    </form>}
    {open && !isClient && <form aria-label="Edit appointment details" onSubmit={e => { e.preventDefault();
      onAction('update', key => appointmentsService.update(clientId, a.appointmentId, a.version, { agenda: edit.agenda || null, internalNote: edit.internalNote || null,
        ...(a.mode === 'IN_PERSON' ? { location: edit.location || null } : { meetingUrl: edit.meetingUrl || null }) }, key), 'Details saved.'); }}>
      <label>Agenda (visible to the client)<textarea maxLength={2000} value={edit.agenda} onChange={e => { setEdit({ ...edit, agenda: e.target.value }); onInputChange('update'); }} /></label>
      <label>Internal note (staff only)<textarea maxLength={2000} value={edit.internalNote} onChange={e => { setEdit({ ...edit, internalNote: e.target.value }); onInputChange('update'); }} /></label>
      {a.mode === 'IN_PERSON' ? <label>Location<input maxLength={300} value={edit.location} onChange={e => { setEdit({ ...edit, location: e.target.value }); onInputChange('update'); }} /></label>
        : <label>Meeting link (https)<input type="url" maxLength={500} value={edit.meetingUrl} onChange={e => { setEdit({ ...edit, meetingUrl: e.target.value }); onInputChange('update'); }} /></label>}
      <button disabled={busy}>Save details</button>
    </form>}
  </div>;
}

function AppointmentForm({ isClient, fixedClientId, defaultStaff, busy, onSubmit, onInputChange }: { isClient: boolean; fixedClientId?: string; defaultStaff?: string; busy: boolean;
  onSubmit: (clientId: string, draft: Parameters<typeof appointmentsService.create>[1]) => void; onInputChange: () => void }) {
  const [f, setF] = useState({ clientId: '', title: '', category: 'CONSULTATION' as AppointmentCategory, mode: 'REMOTE' as AppointmentMode, local: '', minutes: 60, timezone: viewerZone,
    agenda: '', staffUid: defaultStaff ?? '', meetingUrl: '', location: '', internalNote: '', confirm: !isClient });
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof f>) => { setF({ ...f, ...patch }); setError(''); onInputChange(); };
  return <form aria-label={isClient ? 'Request an appointment' : 'Book an appointment'} className="space-y-2 rounded border p-3" onSubmit={e => {
    e.preventDefault();
    const startsAt = zonedLocalToIso(f.local, f.timezone);
    const clientId = fixedClientId ?? f.clientId.trim();
    if (!clientId || f.title.trim().length < 3) { setError('Enter a client and a title of at least 3 characters.'); return; }
    if (!startsAt) { setError('Choose a valid start time and time zone.'); return; }
    onSubmit(clientId, { title: f.title.trim(), category: f.category, mode: f.mode, startsAt, endsAt: new Date(Date.parse(startsAt) + f.minutes * 60_000).toISOString(), timezone: f.timezone,
      ...(f.agenda.trim() ? { agenda: f.agenda.trim() } : {}),
      ...(!isClient ? { ...(f.staffUid.trim() ? { staffUid: f.staffUid.trim() } : {}), ...(f.internalNote.trim() ? { internalNote: f.internalNote.trim() } : {}),
        ...(f.mode === 'REMOTE' && f.meetingUrl.trim() ? { meetingUrl: f.meetingUrl.trim() } : {}), ...(f.mode === 'IN_PERSON' && f.location.trim() ? { location: f.location.trim() } : {}),
        confirm: f.confirm && !!f.staffUid.trim() } : {}) });
  }}>
    <h3 className="font-bold">{isClient ? 'Request an appointment' : 'Book an appointment'}</h3>
    {isClient && <p>Requests need at least 30 minutes notice. The practice assigns an advisor and confirms.</p>}
    {error && <p role="alert">{error}</p>}
    {!fixedClientId && <label className="block">Client ID<input required maxLength={64} value={f.clientId} onChange={e => set({ clientId: e.target.value })} /></label>}
    <label className="block">Title<input required minLength={3} maxLength={200} value={f.title} onChange={e => set({ title: e.target.value })} /></label>
    <label className="block">Category<select value={f.category} onChange={e => set({ category: e.target.value as AppointmentCategory })}>
      {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label className="block">Meeting type<select value={f.mode} onChange={e => set({ mode: e.target.value as AppointmentMode })}>
      {Object.entries(MODE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label className="block">Start (local time in the zone below)<input type="datetime-local" required value={f.local} onChange={e => set({ local: e.target.value })} /></label>
    <label className="block">Length<select value={f.minutes} onChange={e => set({ minutes: Number(e.target.value) })}>{DURATIONS.map(d => <option key={d} value={d}>{d} minutes</option>)}</select></label>
    <label className="block">Time zone<input required value={f.timezone} onChange={e => set({ timezone: e.target.value })} /></label>
    <label className="block">Agenda{isClient ? '' : ' (visible to the client)'}<textarea maxLength={2000} value={f.agenda} onChange={e => set({ agenda: e.target.value })} /></label>
    {!isClient && <>
      <label className="block">Responsible staff UID<input maxLength={128} value={f.staffUid} onChange={e => set({ staffUid: e.target.value })} /></label>
      {f.mode === 'REMOTE' && <label className="block">Meeting link (https)<input type="url" maxLength={500} value={f.meetingUrl} onChange={e => set({ meetingUrl: e.target.value })} /></label>}
      {f.mode === 'IN_PERSON' && <label className="block">Location<input maxLength={300} value={f.location} onChange={e => set({ location: e.target.value })} /></label>}
      <label className="block">Internal note (staff only)<textarea maxLength={2000} value={f.internalNote} onChange={e => set({ internalNote: e.target.value })} /></label>
      <label><input type="checkbox" checked={f.confirm} onChange={e => set({ confirm: e.target.checked })} /> Confirm now (needs a responsible staff member)</label>
    </>}
    <button disabled={busy}>{busy ? 'Saving…' : isClient ? 'Request appointment' : 'Book appointment'}</button>
  </form>;
}
