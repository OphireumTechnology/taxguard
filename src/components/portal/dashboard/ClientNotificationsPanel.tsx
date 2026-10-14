import React, { useCallback, useEffect, useRef, useState } from 'react';
import { documentRequestService, type ClientNotification } from '../../../services/documentRequestService';
import { VaultRequestError } from '../../../services/vaultService';

const KIND: Record<string, string> = { REQUEST_CREATED: 'New document request', REQUEST_REMINDER: 'Reminder', REQUEST_WAIVED: 'Request waived', REQUEST_CANCELLED: 'Request cancelled', REQUEST_FULFILLED: 'Request fulfilled', REPLACEMENT_REQUESTED: 'Replacement requested', DOCUMENT_REJECTED: 'Document not accepted' };
const kindLabel = (k: string) => KIND[k] ?? k.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
const button = 'px-3 py-1.5 rounded-lg border border-slate-600 text-xs font-bold hover:border-[#D4A843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4A843] disabled:opacity-50';

/**
 * In-portal notices recorded by the practice (proposal 031). Delivery outside the portal (e-mail,
 * SMS) is not commissioned, so nothing here claims a message was sent elsewhere.
 */
export function ClientNotificationsPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'unavailable'; unread: number; items: ClientNotification[] }>({ status: 'loading', unread: 0, items: [] });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const live = useRef(true);
  const load = useCallback(() => {
    setState(s => ({ ...s, status: 'loading' }));
    documentRequestService.notifications(clientId)
      .then(r => { if (live.current) setState({ status: 'ready', unread: r.unread, items: r.items }); })
      .catch(e => { if (live.current) setState({ status: e instanceof VaultRequestError && e.status === 503 ? 'unavailable' : 'error', unread: 0, items: [] }); });
  }, [clientId]);
  useEffect(() => { live.current = true; load(); return () => { live.current = false; }; }, [load]);

  const markRead = async (n: ClientNotification) => {
    if (busy) return;
    setBusy(n.notificationId); setNotice(null);
    try { await documentRequestService.markRead(clientId, n.notificationId); if (live.current) load(); }
    catch { if (live.current) setNotice({ error: true, text: 'The server did not confirm this change. Refresh and try again.' }); }
    finally { if (live.current) setBusy(null); }
  };

  return <section aria-labelledby="client-notifications-heading" className="max-w-3xl mx-auto py-6 px-4 space-y-4 text-sm text-slate-200">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 id="client-notifications-heading" className="text-lg font-bold text-white">Notifications</h2>
        <p className="text-xs text-slate-400">Notices recorded by your practice in this portal. E-mail and text delivery are not offered here.</p>
      </div>
      <button type="button" className={button} onClick={load} disabled={state.status === 'loading'}>Refresh</button>
    </header>
    {notice && <p role="alert" className="text-red-300">{notice.text}</p>}
    {state.status === 'loading' && <p role="status">Loading notifications…</p>}
    {state.status === 'unavailable' && <p role="status">Notifications are not enabled in this environment.</p>}
    {state.status === 'error' && <p role="alert">Notifications could not be loaded. <button type="button" className={button} onClick={load}>Retry</button></p>}
    {state.status === 'ready' && (state.items.length === 0
      ? <p role="status">You have no notifications.</p>
      : <>
        <p role="status">{state.unread === 0 ? 'All notifications are read.' : `${state.unread} unread`}</p>
        <ul className="space-y-2">{state.items.map(n => <li key={n.notificationId} className={`rounded-xl border p-3 ${n.readAt ? 'border-slate-700' : 'border-[#D4A843]/60'}`}>
          <p className="font-semibold text-white">{n.title}</p>
          <p className="text-xs text-slate-400">{kindLabel(n.kind)} · <time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>{n.readAt ? ' · Read' : ' · Unread'}</p>
          {!n.readAt && <button type="button" className={button + ' mt-2'} disabled={busy !== null} onClick={() => void markRead(n)} aria-label={`Mark "${n.title}" as read`}>
            {busy === n.notificationId ? 'Saving…' : 'Mark as read'}</button>}
        </li>)}</ul>
      </>)}
  </section>;
}
