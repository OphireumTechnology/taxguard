import React, { useCallback, useEffect, useRef, useState } from 'react';
import { documentRequestService, type ClientNotification } from '../../../services/documentRequestService';
import { VaultRequestError } from '../../../services/vaultService';

/** Plain-language meaning of each server notification kind (proposal 031). Unknown kinds are shown neutrally. */
export const NOTIFICATION_KINDS: Record<string, { label: string; description: string }> = {
  REQUEST_CREATED: { label: 'New document request', description: 'Your practice asked you for a document.' },
  REQUEST_REMINDER: { label: 'Reminder', description: 'A document request is still open.' },
  REQUEST_FULFILLED: { label: 'Request fulfilled', description: 'A document request was marked as fulfilled.' },
  REQUEST_WAIVED: { label: 'Request waived', description: 'Your practice no longer needs this document.' },
  REQUEST_CANCELLED: { label: 'Request cancelled', description: 'Your practice cancelled this request.' },
  REPLACEMENT_REQUESTED: { label: 'Replacement requested', description: 'Your practice asked you to upload a new version of a document.' },
  DOCUMENT_REJECTED: { label: 'Document not accepted', description: 'A document you uploaded was not accepted. See Documents for the reason.' },
};
export const notificationKind = (k: string) => NOTIFICATION_KINDS[k] ?? { label: 'Practice notice', description: 'A notice from your practice.' };
const button = 'px-3 py-1.5 rounded-lg border border-slate-600 text-xs font-bold hover:border-[#D4A843] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4A843] disabled:opacity-50 min-h-[36px]';

type State = { status: 'loading' | 'ready' | 'error' | 'unavailable' | 'session'; unread: number; items: ClientNotification[] };

/**
 * In-portal notices recorded by the practice (proposal 031). Delivery outside the portal (e-mail,
 * SMS) is not commissioned, so nothing here claims a message was sent elsewhere. Only the latest
 * request's answer is applied (stale responses are ignored), and a changed or expired session
 * clears the list instead of showing another session's notices.
 */
export function ClientNotificationsPanel({ clientId, onOpenRequests }: { clientId: string; onOpenRequests?: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading', unread: 0, items: [] });
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const live = useRef(true);
  const seq = useRef(0);

  const load = useCallback(() => {
    const mine = ++seq.current;
    setState(s => ({ ...s, status: 'loading' }));
    documentRequestService.notifications(clientId)
      .then(r => {
        if (!live.current || mine !== seq.current) return;
        // Defensive: only well-formed records are shown.
        const items = Array.isArray(r?.items) ? r.items.filter(n => n && typeof n.notificationId === 'string' && typeof n.title === 'string' && typeof n.createdAt === 'string') : [];
        setState({ status: 'ready', unread: Number.isInteger(r?.unread) ? r.unread : items.filter(n => !n.readAt).length, items });
      })
      .catch(e => {
        if (!live.current || mine !== seq.current) return;
        const status = e instanceof VaultRequestError ? (e.status === 401 || e.code === 'SESSION_CHANGED' || e.code === 'AUTH_REQUIRED' ? 'session' : e.status === 503 ? 'unavailable' : 'error') : 'error';
        setState({ status, unread: 0, items: [] });
      });
  }, [clientId]);
  useEffect(() => { live.current = true; load(); return () => { live.current = false; seq.current++; }; }, [load]);

  const markRead = async (n: ClientNotification) => {
    if (busy) return;
    setBusy(n.notificationId); setNotice(null);
    try {
      await documentRequestService.markRead(clientId, n.notificationId);
      if (live.current) { setNotice({ error: false, text: `"${n.title}" marked as read.` }); load(); }
    } catch (e) {
      if (!live.current) return;
      if (e instanceof VaultRequestError && (e.status === 401 || e.code === 'SESSION_CHANGED')) setState({ status: 'session', unread: 0, items: [] });
      else setNotice({ error: true, text: 'The server did not confirm this change. It is still shown as unread. Try again.' });
    } finally { if (live.current) setBusy(null); }
  };

  const shown = unreadOnly ? state.items.filter(n => !n.readAt) : state.items;
  return <section aria-labelledby="client-notifications-heading" aria-busy={state.status === 'loading'} className="max-w-3xl mx-auto py-6 px-4 space-y-4 text-sm text-slate-200">
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 id="client-notifications-heading" className="text-lg font-bold text-white">Notifications</h2>
        <p className="text-xs text-slate-400">Notices recorded by your practice in this portal. E-mail and text delivery are not offered here.</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 text-xs"><input type="checkbox" checked={unreadOnly} onChange={e => setUnreadOnly(e.target.checked)} /> Unread only</label>
        <button type="button" className={button} onClick={load} disabled={state.status === 'loading'}>Refresh</button>
      </div>
    </header>
    <div aria-live="polite" className="sr-only">{notice && !notice.error ? notice.text : ''}</div>
    {notice?.error && <p role="alert" className="text-red-300">{notice.text}</p>}
    {state.status === 'loading' && <p role="status">Loading notifications…</p>}
    {state.status === 'session' && <p role="alert">Your session has ended or changed. Sign in again to see your notifications.</p>}
    {state.status === 'unavailable' && <p role="status">Notifications are not enabled in this environment.</p>}
    {state.status === 'error' && <p role="alert">Notifications could not be loaded. <button type="button" className={button} onClick={load}>Retry</button></p>}
    {state.status === 'ready' && (state.items.length === 0
      ? <p role="status">You have no notifications.</p>
      : <>
        <p role="status">{state.unread === 0 ? 'All notifications are read.' : `${state.unread} unread`}</p>
        {shown.length === 0 && <p>No unread notifications.</p>}
        <ul className="space-y-2" aria-label="Notifications">{shown.map(n => {
          const kind = notificationKind(n.kind);
          return <li key={n.notificationId} className={`rounded-xl border p-3 ${n.readAt ? 'border-slate-700' : 'border-[#D4A843]/60'}`}>
            <p className="font-semibold text-white">{!n.readAt && <span className="sr-only">Unread: </span>}{n.title}</p>
            <p className="text-xs">{kind.label} — {kind.description}</p>
            <p className="text-xs text-slate-400"><time dateTime={n.createdAt}>{new Date(n.createdAt).toLocaleString()}</time>{n.readAt ? <> · Read <time dateTime={n.readAt}>{new Date(n.readAt).toLocaleString()}</time></> : ' · Unread'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {!n.readAt && <button type="button" className={button} disabled={busy !== null} onClick={() => void markRead(n)} aria-label={`Mark "${n.title}" as read`}>
                {busy === n.notificationId ? 'Saving…' : 'Mark as read'}</button>}
              {n.requestId && onOpenRequests && <button type="button" className={button} onClick={onOpenRequests} aria-label={`Open document requests for "${n.title}"`}>Open document requests</button>}
            </div>
          </li>;
        })}</ul>
      </>)}
  </section>;
}
