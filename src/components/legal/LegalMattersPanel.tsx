import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredToken } from '../../services/api';
import { apiEndpoint } from '../../config/apiEndpoint';

type Matter = { matterId: string; category: string; title: string; summary: string | null; status: string; externalAttorney: string | null; lawFirm: string | null;
  attorneyBarNumber: string | null; filingDeadline: string | null; version: number; updatedAt: string; cancelReason: string | null;
  documents: Array<{ documentId: string; version: number; fileName: string | null }>; history?: Array<{ seq: number; action: string; actorUid: string; at: string }> };
const CATEGORIES: Record<string, string> = { estate_trust: 'Estate / trust', operating_agreement: 'Operating agreement', probate_document: 'Probate document',
  court_pleading: 'Court pleading', power_of_attorney: 'Power of attorney' };
const NEXT: Record<string, string> = { INTAKE: 'Start review', REVIEWING: 'Record referral to counsel', TRANSMITTED_TO_COUNSEL: 'Counsel reviewing', COUNSEL_REVIEW: 'Mark completed' };
const newKey = () => 'lg-' + (globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + Math.random().toString(36).slice(2));

async function call<T>(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<T> {
  const token = getStoredToken();
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED' });
  const r = await fetch(apiEndpoint('/api/legal-matters' + path), { method, cache: 'no-store', credentials: 'omit',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await r.json().catch(() => null);
  if (!r.ok) throw Object.assign(new Error(data?.code || 'LEGAL_REQUEST_FAILED'), { code: data?.code, status: r.status });
  return data as T;
}
export function legalErrorText(error: unknown) {
  switch ((error as { code?: string })?.code) {
    case 'LEGAL_STORE_UNAVAILABLE': return 'Legal coordination tracking is not available in this environment.';
    case 'LEGAL_COUNSEL_REQUIRED': return 'Record the external attorney and law firm before recording the referral.';
    case 'LEGAL_VERSION_CONFLICT': return 'This matter changed since it was loaded. Refresh and try again.';
    case 'LEGAL_REASON_REQUIRED': return 'Enter a reason (at least 5 characters).';
    case 'LEGAL_DISCLAIMER_REQUIRED': return 'The disclaimer must be acknowledged.';
    case 'LEGAL_DOCUMENT_NOT_ELIGIBLE': return 'Only scan-clean, non-rejected documents of this client can be referenced.';
    case 'LEGAL_DOCUMENT_NOT_FOUND': return 'No such document version for this client.';
    case 'LEGAL_MATTER_CLOSED': return 'This matter is closed.';
    case 'LEGAL_STAFF_REQUIRED': case 'LEGAL_ACCESS_DENIED': return 'You are not permitted to do this.';
    default: return 'The server did not confirm this. Nothing was changed; try again.';
  }
}

/** Staff view of legal-coordination tracking for one client (proposal 042). Tracking only: no signing, filing or transmission. */
export function LegalMattersPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'off'; items: Matter[]; error?: string }>({ status: 'loading', items: [] });
  const [disclaimer, setDisclaimer] = useState<{ version: string; text: string } | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ category: 'estate_trust', title: '', summary: '', acknowledged: false });
  const keys = useRef(new Map<string, string>());
  const keyFor = (p: string) => { let k = keys.current.get(p); if (!k) { k = newKey(); keys.current.set(p, k); } return k; };
  const load = useCallback(() => {
    setState(s => ({ ...s, status: 'loading' }));
    call<Matter[]>('GET', `/clients/${encodeURIComponent(clientId)}/matters`).then(items => setState({ status: 'ready', items }))
      .catch(e => setState({ status: e?.status === 503 ? 'off' : 'error', items: [], error: legalErrorText(e) }));
    call<{ version: string; text: string }>('GET', '/disclaimer').then(setDisclaimer).catch(() => undefined);
  }, [clientId]);
  useEffect(() => { load(); }, [load]);
  const run = async (purpose: string, fn: (key: string) => Promise<unknown>, text: string): Promise<boolean> => {
    if (busy) return false; setBusy(true); setNotice(null);
    try { await fn(keyFor(purpose)); keys.current.delete(purpose); setNotice({ error: false, text }); load(); return true; }
    catch (e) { setNotice({ error: true, text: legalErrorText(e) }); return false; } finally { setBusy(false); }
  };
  if (state.status === 'off') return null;
  const base = `/clients/${encodeURIComponent(clientId)}/matters`;
  return <section aria-label="Legal coordination" className="space-y-3 text-sm">
    <h4>Legal coordination (independent counsel)</h4>
    {disclaimer && <p className="text-slate-400">{disclaimer.text}</p>}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {state.status === 'loading' && state.items.length === 0 && <p role="status">Loading legal matters…</p>}
    {state.status === 'error' && <p role="alert">{state.error} <button type="button" onClick={load}>Retry</button></p>}
    {state.status === 'ready' && state.items.length === 0 && <p>No legal coordination matters for this client.</p>}
    <ul className="space-y-2">{state.items.map(m => <li key={m.matterId} className="rounded border p-2 space-y-1">
      <strong>{m.title}</strong> · {CATEGORIES[m.category] ?? m.category} · {m.status.replaceAll('_', ' ').toLowerCase()}
      {m.filingDeadline && <> · deadline {m.filingDeadline}</>}{m.cancelReason && <> · cancelled: {m.cancelReason}</>}
      <p>Counsel: {m.externalAttorney ? `${m.externalAttorney}, ${m.lawFirm}` : 'not recorded'} · Evidence: {m.documents.length ? m.documents.map(d => `${d.fileName ?? d.documentId} v${d.version}`).join(', ') : 'none'}</p>
      {!['COMPLETED', 'CANCELLED'].includes(m.status) && <MatterActions matter={m} busy={busy} onAction={(purpose, path, body, text) => void run(purpose + m.matterId, key => call('POST', `${base}/${m.matterId}/${path}`, body, key), text)}
        onEdit={purpose => keys.current.delete(purpose + m.matterId)} />}
    </li>)}</ul>
    <form aria-label="Open legal coordination matter" className="space-y-2 rounded border p-2" onSubmit={e => { e.preventDefault();
      if (!disclaimer || !form.acknowledged || form.title.trim().length < 3) { setNotice({ error: true, text: 'Enter a title and acknowledge the disclaimer.' }); return; }
      void run('create', key => call('POST', base, { category: form.category, title: form.title.trim(), ...(form.summary.trim() ? { summary: form.summary.trim() } : {}),
        disclaimerAcknowledged: true, disclaimerVersion: disclaimer.version }, key), 'Legal coordination matter opened.')
        .then(ok => { if (ok) setForm({ category: 'estate_trust', title: '', summary: '', acknowledged: false }); }); }}>
      <label className="block">Category<select value={form.category} onChange={e => { setForm({ ...form, category: e.target.value }); keys.current.delete('create'); }}>
        {Object.entries(CATEGORIES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
      <label className="block">Title<input value={form.title} minLength={3} maxLength={200} onChange={e => { setForm({ ...form, title: e.target.value }); keys.current.delete('create'); }} /></label>
      <label className="block">Summary<textarea value={form.summary} maxLength={2000} onChange={e => { setForm({ ...form, summary: e.target.value }); keys.current.delete('create'); }} /></label>
      <label><input type="checkbox" checked={form.acknowledged} onChange={e => setForm({ ...form, acknowledged: e.target.checked })} /> The disclaimer above was presented and acknowledged</label>
      <button disabled={busy}>Open matter</button>
    </form>
  </section>;
}

function MatterActions({ matter: m, busy, onAction, onEdit }: { matter: Matter; busy: boolean; onEdit: (purpose: string) => void;
  onAction: (purpose: string, path: string, body: unknown, text: string) => void }) {
  const [counsel, setCounsel] = useState({ externalAttorney: m.externalAttorney ?? '', lawFirm: m.lawFirm ?? '', attorneyBarNumber: m.attorneyBarNumber ?? '', filingDeadline: m.filingDeadline ?? '' });
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState({ documentId: '', version: '1' });
  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={() => onAction('advance', 'status', { version: m.version, action: 'advance' }, 'Status updated.')}>{NEXT[m.status]}</button>
    <form aria-label="Counsel details" onSubmit={e => { e.preventDefault(); onAction('counsel', 'update', { version: m.version, fields: { externalAttorney: counsel.externalAttorney || null,
      lawFirm: counsel.lawFirm || null, attorneyBarNumber: counsel.attorneyBarNumber || null, filingDeadline: counsel.filingDeadline || null } }, 'Counsel details saved.'); }}>
      {(['externalAttorney', 'lawFirm', 'attorneyBarNumber'] as const).map(k => <label key={k}>{k === 'externalAttorney' ? 'External attorney' : k === 'lawFirm' ? 'Law firm' : 'Bar number'}
        <input value={counsel[k]} maxLength={200} onChange={e => { setCounsel({ ...counsel, [k]: e.target.value }); onEdit('counsel'); }} /></label>)}
      <label>Filing deadline<input type="date" value={counsel.filingDeadline} onChange={e => { setCounsel({ ...counsel, filingDeadline: e.target.value }); onEdit('counsel'); }} /></label>
      <button disabled={busy}>Save counsel details</button>
    </form>
    <form aria-label="Reference a document" onSubmit={e => { e.preventDefault(); onAction('evidence', 'documents', { documentId: evidence.documentId.trim(), version: Number(evidence.version) }, 'Document referenced.'); }}>
      <label>Vault document ID<input value={evidence.documentId} maxLength={128} onChange={e => { setEvidence({ ...evidence, documentId: e.target.value }); onEdit('evidence'); }} /></label>
      <label>Version<input type="number" min={1} value={evidence.version} onChange={e => { setEvidence({ ...evidence, version: e.target.value }); onEdit('evidence'); }} /></label>
      <button disabled={busy || !evidence.documentId.trim()}>Reference document</button>
    </form>
    <form aria-label="Cancel matter" onSubmit={e => { e.preventDefault(); onAction('cancel', 'status', { version: m.version, action: 'cancel', reason: reason.trim() }, 'Matter cancelled.'); }}>
      <label>Cancellation reason<input value={reason} maxLength={500} onChange={e => { setReason(e.target.value); onEdit('cancel'); }} /></label>
      <button disabled={busy || reason.trim().length < 5}>Cancel matter</button>
    </form>
  </div>;
}
