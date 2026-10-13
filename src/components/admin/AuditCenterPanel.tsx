import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getStoredToken } from '../../services/api';
import { apiEndpoint } from '../../config/apiEndpoint';

type AuditEvent = { eventId: string; at: string; action: string; category: string; actorUid: string; actorRole: string | null; caseId: string | null; clientId: string | null;
  fields: Record<string, string | number | boolean>; redactedFields: number };
type Page = { items: AuditEvent[]; nextCursor: string | null };
const DAY = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

async function read<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const token = getStoredToken();
  if (!token) throw Object.assign(new Error('AUTH_REQUIRED'), { code: 'AUTH_REQUIRED', status: 401 });
  const response = await fetch(apiEndpoint('/api/audit-center' + path + '?' + new URLSearchParams(params)), { cache: 'no-store', credentials: 'omit', signal,
    headers: { Authorization: `Bearer ${token}` } });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(data?.code || 'AUDIT_REQUEST_FAILED'), { code: data?.code, status: response.status });
  return data as T;
}
export function auditErrorText(error: unknown) {
  const e = error as { code?: string; status?: number };
  if (e?.code === 'AUDIT_ADMIN_REQUIRED' || e?.status === 403) return 'The audit center is available to administrators only.';
  if (e?.code === 'AUDIT_STORE_UNAVAILABLE' || e?.status === 503) return 'The audit center is not available in this environment.';
  if (e?.code === 'AUDIT_RANGE_INVALID') return 'Choose a date range of at most 92 days.';
  return 'Audit records could not be loaded. Nothing is shown in their place.';
}

/**
 * Read-only, tenant-scoped audit events (proposal 041). The server returns allow-listed identifier
 * and status fields only and counts what it withheld; no secret, factor, token, message body,
 * reason, amount or taxpayer payload ever reaches this view.
 */
export function AuditCenterPanel() {
  const [filter, setFilter] = useState({ from: isoDay(Date.now() - 7 * DAY), to: isoDay(Date.now()), category: '', action: '', actorUid: '', clientId: '' });
  const [applied, setApplied] = useState(filter);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error'; items: AuditEvent[]; next: string | null; error?: string }>({ status: 'loading', items: [], next: null });
  const [categories, setCategories] = useState<Array<{ category: string; count: number }>>([]);
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const params = (f: typeof filter) => {
    const p: Record<string, string> = { from: new Date(f.from + 'T00:00:00Z').toISOString(), to: new Date(Date.parse(f.to + 'T00:00:00Z') + DAY).toISOString() };
    for (const k of ['category', 'action', 'actorUid', 'clientId'] as const) if (f[k].trim()) p[k] = f[k].trim();
    return p;
  };
  const load = useCallback((f: typeof filter, cursor?: string, signal?: AbortSignal) => {
    setState(s => ({ ...s, status: 'loading' }));
    read<Page>('/events', { ...params(f), limit: '50', ...(cursor ? { cursor } : {}) }, signal)
      .then(page => { if (mounted.current) setState(s => ({ status: 'ready', items: cursor ? [...s.items, ...page.items] : page.items, next: page.nextCursor })); })
      .catch(error => { if (mounted.current && !signal?.aborted) setState({ status: 'error', items: [], next: null, error: auditErrorText(error) }); });
    read<Array<{ category: string; count: number }>>('/categories', { from: params(f).from, to: params(f).to }, signal).then(c => mounted.current && setCategories(c)).catch(() => undefined);
  }, []);
  useEffect(() => { const controller = new AbortController(); load(applied, undefined, controller.signal); return () => controller.abort(); }, [applied, load]);
  const field = (k: keyof typeof filter, label: string, type = 'text') => <label className="block">{label}<input type={type} value={filter[k]} maxLength={128}
    onChange={e => setFilter({ ...filter, [k]: e.target.value })} className="w-full rounded border border-slate-500 bg-[#071A2E] px-2 py-1 text-white" /></label>;
  return <section aria-label="Audit center" className="space-y-4 rounded-xl border border-slate-600 bg-[#071A2E] p-4 text-sm text-slate-200">
    <header><h2 className="text-xl font-bold text-white">Compliance audit log</h2>
      <p className="text-slate-400">Read-only, tenant-scoped records of material actions. Only identifiers and status codes are shown; reasons, notes, message or document content, amounts, IP addresses and security material are withheld by the server.</p></header>
    <form aria-label="Audit filters" className="grid gap-3 md:grid-cols-3" onSubmit={e => { e.preventDefault(); setSelected(null); setApplied({ ...filter }); }}>
      {field('from', 'From (UTC date)', 'date')}{field('to', 'To (UTC date, inclusive)', 'date')}
      <label className="block">Category<select value={filter.category} onChange={e => setFilter({ ...filter, category: e.target.value })} className="w-full rounded border border-slate-500 bg-[#071A2E] px-2 py-1 text-white">
        <option value="">All categories</option>{categories.map(c => <option key={c.category} value={c.category}>{c.category.toLowerCase()} ({c.count})</option>)}</select></label>
      {field('action', 'Exact action code')}{field('actorUid', 'Actor UID')}{field('clientId', 'Client ID')}
      <button className="rounded border border-slate-500 px-3 py-2">Apply filters</button>
    </form>
    {state.status === 'loading' && state.items.length === 0 && <p role="status">Loading audit records…</p>}
    {state.status === 'error' && <p role="alert">{state.error} <button type="button" onClick={() => load(applied)}>Retry</button></p>}
    {state.status === 'ready' && state.items.length === 0 && <p>No audit records match these filters.</p>}
    {state.items.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Audit events</caption>
      <thead><tr>{['Time (UTC)', 'Action', 'Actor', 'Client', 'Details'].map(h => <th key={h} scope="col" className="p-2">{h}</th>)}</tr></thead>
      <tbody>{state.items.map(e => <tr key={e.eventId} className="border-t border-slate-700">
        <td className="p-2">{e.at.replace('T', ' ').slice(0, 19)}</td><td className="p-2">{e.action}</td><td className="p-2">{e.actorUid}{e.actorRole ? ` (${e.actorRole})` : ''}</td>
        <td className="p-2">{e.clientId ?? '—'}</td>
        <td className="p-2"><button type="button" aria-label={`Inspect event ${e.eventId}`} onClick={() => setSelected(e)}>Inspect</button></td></tr>)}</tbody></table></div>}
    {state.next && <button type="button" disabled={state.status === 'loading'} onClick={() => load(applied, state.next!)}>Load more</button>}
    {selected && <article aria-label="Audit event detail" className="space-y-2 rounded border border-amber-300 p-3">
      <h3 className="font-bold text-amber-200">{selected.action}</h3>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
        <dt>Event</dt><dd>{selected.eventId}</dd><dt>Time (UTC)</dt><dd>{selected.at}</dd><dt>Actor</dt><dd>{selected.actorUid}{selected.actorRole ? ` (${selected.actorRole})` : ''}</dd>
        {selected.caseId && <><dt>Case</dt><dd>{selected.caseId}</dd></>}
        {Object.entries(selected.fields).map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{String(v)}</dd></React.Fragment>)}
      </dl>
      {selected.redactedFields > 0 && <p>{selected.redactedFields} field{selected.redactedFields === 1 ? '' : 's'} withheld by redaction.</p>}
      <button type="button" onClick={() => setSelected(null)}>Close event</button>
    </article>}
  </section>;
}
