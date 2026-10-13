import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredToken } from '../../services/api';
import { apiEndpoint } from '../../config/apiEndpoint';

const newKey = () => 'rr-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
  const r = await fetch(apiEndpoint('/api/reassignment' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.code || 'REQUEST_FAILED'), { code: data?.code, status: r.status });
  return data as T;
}
const text = (e: unknown) => ({ REASSIGNMENT_VERSION_CONFLICT: 'This request changed since it was loaded. Refresh and try again.', REASSIGNMENT_ALREADY_REVIEWED: 'This request was already reviewed.',
  REASSIGNMENT_REVIEWER_REQUIRED: 'Only practice leadership reviews reassignment requests.', REASSIGNMENT_STORE_UNAVAILABLE: 'Reassignment requests are not available in this environment.' } as Record<string, string>)[
  (e as { code?: string })?.code ?? ''] ?? 'The server did not confirm this. Nothing was changed; try again.';

/** Practice-leadership review of client reassignment requests (proposal 045). Approval does not change the team. */
export function ReassignmentRequestsPanel() {
  const [status, setStatus] = useState('PENDING');
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'off'; items: any[]; error?: string }>({ status: 'loading', items: [] });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = useRef(new Map<string, string>());
  const load = useCallback(() => {
    setState(s => ({ ...s, status: 'loading' }));
    call<any[]>('GET', '/queue?' + new URLSearchParams(status ? { status } : {})).then(items => setState({ status: 'ready', items }))
      .catch(e => setState({ status: e?.status === 503 ? 'off' : 'error', items: [], error: text(e) }));
  }, [status]);
  useEffect(() => { load(); }, [load]);
  const review = (r: any, decision: 'approve' | 'reject') => {
    if (busy) return;
    const purpose = decision + r.requestId; let key = keys.current.get(purpose); if (!key) { key = newKey(); keys.current.set(purpose, key); }
    setBusy(true); setNotice(null);
    call('POST', `/queue/${encodeURIComponent(r.requestId)}/review`, { version: r.version, decision, ...(notes[r.requestId]?.trim() ? { note: notes[r.requestId].trim() } : {}) }, key)
      .then(() => { keys.current.delete(purpose); setNotice({ error: false, text: decision === 'approve' ? 'Request approved. Change the team in Clients & Engagements; approval alone does not reassign.' : 'Request not approved.' }); load(); })
      .catch(e => setNotice({ error: true, text: text(e) })).finally(() => setBusy(false));
  };
  if (state.status === 'off') return <p role="status">Reassignment requests are not available in this environment.</p>;
  return <section aria-label="Reassignment requests" className="space-y-3 text-sm">
    <header className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">Client reassignment requests</h2>
      <label>Status<select value={status} onChange={e => setStatus(e.target.value)}>{['PENDING', 'APPROVED', 'REJECTED', ''].map(s => <option key={s} value={s}>{s ? s.toLowerCase() : 'all'}</option>)}</select></label>
      <button type="button" onClick={load}>Refresh</button></header>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {state.status === 'loading' && state.items.length === 0 && <p role="status">Loading reassignment requests…</p>}
    {state.status === 'error' && <p role="alert">{state.error} <button type="button" onClick={load}>Retry</button></p>}
    {state.status === 'ready' && state.items.length === 0 && <p>No reassignment requests with this status.</p>}
    <ul className="space-y-2">{state.items.map(r => <li key={r.requestId} className="rounded border p-2 space-y-1">
      <strong>{r.clientName ?? r.clientId}</strong> · {r.status.toLowerCase()} · {new Date(r.createdAt).toLocaleString()}
      <p className="whitespace-pre-wrap">Reason: {r.reason}</p>{r.preferredSpecialization && <p>Preferred specialization: {r.preferredSpecialization}</p>}
      <p>Current team: {r.currentTeam?.length ? r.currentTeam.map((t: any) => `${t.userId} (${t.role})`).join(', ') : 'none'}</p>
      {r.reviewNote && <p>Note to client: {r.reviewNote}{r.reviewedBy ? ` — ${r.reviewedBy}` : ''}</p>}
      {r.status === 'PENDING' && <div className="space-y-1">
        <label>Note to the client (optional)<textarea maxLength={2000} value={notes[r.requestId] ?? ''} onChange={e => { setNotes({ ...notes, [r.requestId]: e.target.value }); keys.current.delete('approve' + r.requestId); keys.current.delete('reject' + r.requestId); }} /></label>
        <button type="button" disabled={busy} onClick={() => review(r, 'approve')}>Approve request</button>
        <button type="button" disabled={busy} onClick={() => review(r, 'reject')}>Do not approve</button>
      </div>}
    </li>)}</ul>
  </section>;
}
