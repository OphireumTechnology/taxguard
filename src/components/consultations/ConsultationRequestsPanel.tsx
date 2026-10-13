import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredToken } from '../../services/api';
import { apiEndpoint } from '../../config/apiEndpoint';
import { appointmentErrorText, zonedLocalToIso } from '../../services/appointmentsService';

type Req = { requestId: string; reference: string; fullName: string; email: string; phone: string | null; preferredContact: string; topic: string; modePreference: string;
  preferredWindows: Array<{ date: string; partOfDay: string }>; timezone: string; message: string | null; status: string; decisionReason: string | null;
  convertedClientId: string | null; convertedAppointmentId: string | null; version: number; createdAt: string };
const newKey = () => 'cr-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
  const r = await fetch(apiEndpoint('/api/consultations' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.code || 'CONSULTATION_REQUEST_FAILED'), { code: data?.code, status: r.status });
  return data as T;
}
function errorText(e: unknown) {
  const code = (e as { code?: string })?.code ?? '';
  if (code.startsWith('APPOINTMENT_')) return appointmentErrorText(e);
  switch (code) {
    case 'CONSULTATION_REVIEWER_REQUIRED': return 'Only practice managers and administrators review consultation requests.';
    case 'CONSULTATION_REASON_REQUIRED': return 'Enter a reason (at least 5 characters).';
    case 'CONSULTATION_TRANSITION_INVALID': return 'This request can no longer be changed that way.';
    case 'CONSULTATION_VERSION_CONFLICT': return 'This request changed since it was loaded. Refresh and try again.';
    case 'CONSULTATION_CLIENT_NOT_FOUND': return 'Choose an existing, active client of the practice.';
    case 'CONSULTATION_STORE_UNAVAILABLE': return 'Consultation requests are not available in this environment.';
    default: return 'The server did not confirm this. Nothing was changed; try again.';
  }
}

/** Manager review of public consultation requests (proposal 043); conversion books through proposal 040. */
export function ConsultationRequestsPanel() {
  const [status, setStatus] = useState('NEW');
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'off'; items: Req[]; error?: string }>({ status: 'loading', items: [] });
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = useRef(new Map<string, string>());
  const keyFor = (p: string) => { let k = keys.current.get(p); if (!k) { k = newKey(); keys.current.set(p, k); } return k; };
  const load = useCallback(() => {
    setState(s => ({ ...s, status: 'loading' }));
    call<Req[]>('GET', '/requests?' + new URLSearchParams(status ? { status } : {})).then(items => setState({ status: 'ready', items }))
      .catch(e => setState({ status: e?.status === 503 ? 'off' : 'error', items: [], error: errorText(e) }));
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const run = async (purpose: string, fn: (key: string) => Promise<unknown>, text: string) => {
    if (busy) return; setBusy(true); setNotice(null);
    try { await fn(keyFor(purpose)); keys.current.delete(purpose); setNotice({ error: false, text }); load(); }
    catch (e) { setNotice({ error: true, text: errorText(e) }); } finally { setBusy(false); }
  };
  if (state.status === 'off') return <p role="status">Consultation requests are not available in this environment.</p>;
  return <section aria-label="Consultation requests" className="space-y-3 text-sm">
    <header className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">Consultation requests</h2>
      <label>Status<select value={status} onChange={e => setStatus(e.target.value)}>{['NEW', 'IN_REVIEW', 'CONVERTED', 'DECLINED', 'SPAM', ''].map(s =>
        <option key={s} value={s}>{s ? s.replace('_', ' ').toLowerCase() : 'all'}</option>)}</select></label>
      <button type="button" onClick={load}>Refresh requests</button></header>
    <p className="text-slate-400">Requests come from the public website. Visitors have no account; nothing is booked until you convert a request for an existing client. No e-mail is sent automatically — contact the visitor yourself.</p>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {state.status === 'loading' && state.items.length === 0 && <p role="status">Loading consultation requests…</p>}
    {state.status === 'error' && <p role="alert">{state.error} <button type="button" onClick={load}>Retry</button></p>}
    {state.status === 'ready' && state.items.length === 0 && <p>No consultation requests with this status.</p>}
    <ul className="space-y-2">{state.items.map(q => <li key={q.requestId} className="rounded border p-2 space-y-1">
      <button type="button" aria-expanded={open === q.requestId} onClick={() => setOpen(open === q.requestId ? null : q.requestId)}>
        <strong>{q.reference}</strong> · {q.fullName} · {q.topic.replaceAll('_', ' ').toLowerCase()} · {q.status.replace('_', ' ').toLowerCase()} · {new Date(q.createdAt).toLocaleString()}</button>
      {open === q.requestId && <RequestDetail q={q} busy={busy} onEdit={p => keys.current.delete(p + q.requestId)}
        onAction={(purpose, path, body, text) => void run(purpose + q.requestId, key => call('POST', `/requests/${q.requestId}/${path}`, body, key), text)} />}
    </li>)}</ul>
  </section>;
}

function RequestDetail({ q, busy, onAction, onEdit }: { q: Req; busy: boolean; onEdit: (purpose: string) => void; onAction: (purpose: string, path: string, body: unknown, text: string) => void }) {
  const [reason, setReason] = useState('');
  const [c, setC] = useState({ clientId: '', title: 'Consultation', local: '', minutes: 60, timezone: q.timezone, staffUid: '', confirm: true });
  const edit = (patch: Partial<typeof c>) => { setC({ ...c, ...patch }); onEdit('convert'); };
  const startsAt = zonedLocalToIso(c.local, c.timezone);
  return <div className="space-y-2" aria-label={`Consultation request ${q.reference}`}>
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3">
      <dt>E-mail</dt><dd>{q.email}</dd>{q.phone && <><dt>Phone</dt><dd>{q.phone}</dd></>}<dt>Prefers</dt><dd>{q.preferredContact.toLowerCase()} · {q.modePreference.replace('_', ' ').toLowerCase()}</dd>
      <dt>Available</dt><dd>{q.preferredWindows.map(w => `${w.date} ${w.partOfDay.toLowerCase()}`).join('; ')} ({q.timezone})</dd>
      {q.message && <><dt>Message</dt><dd className="whitespace-pre-wrap">{q.message}</dd></>}
      {q.decisionReason && <><dt>Reason</dt><dd>{q.decisionReason}</dd></>}
      {q.convertedAppointmentId && <><dt>Appointment</dt><dd>{q.convertedAppointmentId} for client {q.convertedClientId}</dd></>}
    </dl>
    {q.status === 'NEW' && <button type="button" disabled={busy} onClick={() => onAction('review', 'decision', { version: q.version, action: 'review' }, 'Request marked in review.')}>Start review</button>}
    {['NEW', 'IN_REVIEW'].includes(q.status) && <form aria-label="Decline or mark spam" onSubmit={e => e.preventDefault()}>
      <label>Reason<input value={reason} maxLength={500} onChange={e => { setReason(e.target.value); onEdit('decline'); onEdit('spam'); }} /></label>
      <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => onAction('decline', 'decision', { version: q.version, action: 'decline', reason: reason.trim() }, 'Request declined.')}>Decline</button>
      <button type="button" disabled={busy || reason.trim().length < 5} onClick={() => onAction('spam', 'decision', { version: q.version, action: 'spam', reason: reason.trim() }, 'Request marked as spam.')}>Mark spam</button>
    </form>}
    {q.status === 'IN_REVIEW' && <form aria-label="Convert to appointment" onSubmit={e => { e.preventDefault(); if (!startsAt) return;
      onAction('convert', 'convert', { version: q.version, clientId: c.clientId.trim(), appointment: { title: c.title.trim(), category: 'CONSULTATION', mode: q.modePreference, startsAt,
        endsAt: new Date(Date.parse(startsAt) + c.minutes * 60_000).toISOString(), timezone: c.timezone, ...(c.staffUid.trim() ? { staffUid: c.staffUid.trim(), confirm: c.confirm } : {}) } },
        'Request converted into an appointment.'); }}>
      <p>Link an existing client of the practice; the appointment rules (staff eligibility, conflicts) apply.</p>
      <label>Existing client ID<input required maxLength={64} value={c.clientId} onChange={e => edit({ clientId: e.target.value })} /></label>
      <label>Title<input required minLength={3} maxLength={200} value={c.title} onChange={e => edit({ title: e.target.value })} /></label>
      <label>Start (local time in the zone below)<input type="datetime-local" required value={c.local} onChange={e => edit({ local: e.target.value })} /></label>
      <label>Length<select value={c.minutes} onChange={e => edit({ minutes: Number(e.target.value) })}>{[30, 45, 60, 90].map(m => <option key={m} value={m}>{m} minutes</option>)}</select></label>
      <label>Time zone<input required value={c.timezone} onChange={e => edit({ timezone: e.target.value })} /></label>
      <label>Responsible staff UID<input maxLength={128} value={c.staffUid} onChange={e => edit({ staffUid: e.target.value })} /></label>
      <label><input type="checkbox" checked={c.confirm} onChange={e => edit({ confirm: e.target.checked })} /> Confirm now</label>
      {c.local && !startsAt && <p role="alert">That local time does not exist in this time zone (or the zone is invalid).</p>}
      <button disabled={busy || !startsAt}>Convert to appointment</button>
    </form>}
  </div>;
}
