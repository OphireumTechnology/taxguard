import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredToken } from '../../../services/api';
import { apiEndpoint } from '../../../config/apiEndpoint';

const CATEGORIES: Record<string, string> = { estate_trust: 'Estate / trust', operating_agreement: 'Operating agreement', probate_document: 'Probate document',
  court_pleading: 'Court pleading', power_of_attorney: 'Power of attorney' };
const STEP: Record<string, string> = { MATTER_OPENED: 'Request received', STATUS_REVIEWING: 'Under review by the practice', STATUS_TRANSMITTED_TO_COUNSEL: 'Referred to independent counsel',
  STATUS_COUNSEL_REVIEW: 'Counsel reviewing', STATUS_COMPLETED: 'Completed', CANCELLED: 'Closed' };
const STATUS: Record<string, string> = { INTAKE: 'Received', REVIEWING: 'Under review', TRANSMITTED_TO_COUNSEL: 'Referred to counsel', COUNSEL_REVIEW: 'Counsel reviewing',
  COMPLETED: 'Completed', CANCELLED: 'Closed' };
const newKey = () => 'cl-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));
async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
  const r = await fetch(apiEndpoint(path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.code || 'REQUEST_FAILED'), { code: data?.code, status: r.status });
  return data as T;
}
const unavailable = (e: unknown) => (e as { status?: number })?.status === 503 ? 'This is not available in this environment.' : 'This could not be loaded. Please retry.';

/**
 * Client view of legal-coordination matters (proposals 042 / 044). Status, category, dates, progress
 * steps, referenced documents and — only once a referral is recorded — the independent counsel.
 * No legal advice, signatures, submissions or document transmission happen here.
 */
export function ClientLegalPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: any[]; error?: string }>({ status: 'loading', items: [] });
  const [disclaimer, setDisclaimer] = useState<{ version: string; text: string } | null>(null);
  const [form, setForm] = useState({ category: 'estate_trust', title: '', summary: '', acknowledged: false });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const load = useCallback(() => {
    setState(s => ({ ...s, status: 'loading' }));
    call<any[]>('GET', `/api/legal-matters/clients/${encodeURIComponent(clientId)}/matters`).then(items => setState({ status: 'ready', items }))
      .catch(e => setState({ status: 'error', items: [], error: unavailable(e) }));
    call<{ version: string; text: string }>('GET', '/api/legal-matters/disclaimer').then(setDisclaimer).catch(() => undefined);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);
  const set = (patch: Partial<typeof form>) => { setForm({ ...form, ...patch }); key.current = newKey(); };
  return <section aria-label="Legal coordination" className="space-y-3">
    <h2>Legal coordination</h2>
    {disclaimer && <p className="tg-client-note">{disclaimer.text}</p>}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {state.status === 'loading' && state.items.length === 0 && <p role="status">Loading…</p>}
    {state.status === 'error' && <p role="alert">{state.error} <button type="button" onClick={load}>Retry</button></p>}
    {state.status === 'ready' && state.items.length === 0 && <p>No legal coordination requests.</p>}
    <ul className="tg-client-list">{state.items.map(m => <li key={m.matterId}>
      <strong>{m.title}</strong> · {CATEGORIES[m.category] ?? m.category} · {STATUS[m.status] ?? m.status}
      <p>Opened {new Date(m.createdAt).toLocaleDateString()}{m.filingDeadline ? ` · deadline ${m.filingDeadline}` : ''}</p>
      {m.externalAttorney && <p>Independent counsel: {m.externalAttorney}, {m.lawFirm}</p>}
      {Array.isArray(m.progress) && m.progress.length > 0 && <ol aria-label={`Progress: ${m.title}`}>{m.progress.map((p: any, i: number) =>
        <li key={i}>{STEP[p.step] ?? p.step} — {new Date(p.at).toLocaleDateString()}</li>)}</ol>}
      {m.documents?.length > 0 && <p>Documents referenced: {m.documents.map((d: any) => d.fileName ?? d.documentId).join(', ')}</p>}
    </li>)}</ul>
    <form aria-label="Request legal coordination" onSubmit={e => { e.preventDefault();
      if (!disclaimer || !form.acknowledged || form.title.trim().length < 3) { setNotice({ error: true, text: 'Enter a title and confirm you have read the statement above.' }); return; }
      if (busy) return; setBusy(true); setNotice(null);
      call('POST', `/api/legal-matters/clients/${encodeURIComponent(clientId)}/matters`, { category: form.category, title: form.title.trim(), ...(form.summary.trim() ? { summary: form.summary.trim() } : {}),
        disclaimerAcknowledged: true, disclaimerVersion: disclaimer.version }, key.current)
        .then(() => { setForm({ category: 'estate_trust', title: '', summary: '', acknowledged: false }); key.current = newKey(); setNotice({ error: false, text: 'Request received. The practice will review it.' }); load(); })
        .catch(() => setNotice({ error: true, text: 'Your request was not received. Please try again.' })).finally(() => setBusy(false)); }}>
      <h3>Ask the practice to coordinate with independent counsel</h3>
      <label>Topic<select value={form.category} onChange={e => set({ category: e.target.value })}>{Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label>Title<input value={form.title} minLength={3} maxLength={200} onChange={e => set({ title: e.target.value })} /></label>
      <label>Summary (optional)<textarea value={form.summary} maxLength={2000} onChange={e => set({ summary: e.target.value })} /></label>
      <label><input type="checkbox" checked={form.acknowledged} onChange={e => set({ acknowledged: e.target.checked })} /> I have read the statement above</label>
      <button className="tg-client-primary-button" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
    </form>
  </section>;
}

/** Client request for a different advisor (proposal 045). The practice reviews it; approval alone does not change the team. */
export function ClientAdvisorRequestPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: any[]; error?: string }>({ status: 'loading', items: [] });
  const [form, setForm] = useState({ reason: '', preferredSpecialization: '' });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newKey());
  const load = useCallback(() => {
    call<any[]>('GET', `/api/reassignment/clients/${encodeURIComponent(clientId)}/requests`).then(items => setState({ status: 'ready', items }))
      .catch(e => setState({ status: 'error', items: [], error: unavailable(e) }));
  }, [clientId]);
  useEffect(() => { load(); }, [load]);
  const pending = state.items.some(r => r.status === 'PENDING');
  return <section aria-label="My advisor" className="space-y-3">
    <h2>My advisor</h2>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {state.status === 'loading' && <p role="status">Loading…</p>}
    {state.status === 'error' && <p role="alert">{state.error} <button type="button" onClick={load}>Retry</button></p>}
    {state.items.length > 0 && <ul className="tg-client-list">{state.items.map(r => <li key={r.requestId}>
      <strong>{r.status === 'PENDING' ? 'Under review' : r.status === 'APPROVED' ? 'Approved' : 'Not approved'}</strong> — requested {new Date(r.createdAt).toLocaleDateString()}
      {r.reviewNote && <p>Note from the practice: {r.reviewNote}</p>}</li>)}</ul>}
    {!pending && <form aria-label="Request a different advisor" onSubmit={e => { e.preventDefault();
      if (form.reason.trim().length < 10) { setNotice({ error: true, text: 'Please give a reason of at least 10 characters.' }); return; }
      if (busy) return; setBusy(true); setNotice(null);
      call('POST', `/api/reassignment/clients/${encodeURIComponent(clientId)}/requests`, { reason: form.reason.trim(), ...(form.preferredSpecialization.trim() ? { preferredSpecialization: form.preferredSpecialization.trim() } : {}) }, key.current)
        .then(() => { setForm({ reason: '', preferredSpecialization: '' }); key.current = newKey(); setNotice({ error: false, text: 'Your request was sent to practice leadership for review.' }); load(); })
        .catch(() => setNotice({ error: true, text: 'Your request was not received. Please try again.' })).finally(() => setBusy(false)); }}>
      <h3>Request a different advisor</h3>
      <label>Reason (at least 10 characters)<textarea value={form.reason} maxLength={2000} onChange={e => { setForm({ ...form, reason: e.target.value }); key.current = newKey(); }} /></label>
      <label>Preferred specialization (optional)<input value={form.preferredSpecialization} maxLength={200} onChange={e => { setForm({ ...form, preferredSpecialization: e.target.value }); key.current = newKey(); }} /></label>
      <button className="tg-client-primary-button" disabled={busy}>{busy ? 'Sending…' : 'Send request'}</button>
    </form>}
  </section>;
}
