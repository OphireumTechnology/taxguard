import React, { useCallback, useEffect, useState } from 'react';
import { CommunicationRequestError, communicationErrorText, communicationsService, type CommThread } from '../../services/communicationsService';
import { ConversationPanel } from './ConversationPanel';

/**
 * Client conversations awaiting a staff reply on the clients this staff member may see (assigned
 * clients, or the whole tenant for practice managers). Hidden where durable messaging is not
 * configured; nothing is substituted for unavailable data.
 */
export function StaffMessageInboxPanel({ canArchive = false }: { canArchive?: boolean }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; items: CommThread[]; error?: string }>({ status: 'loading', items: [] });
  const [clientId, setClientId] = useState<string | null>(null);
  const load = useCallback((signal?: AbortSignal) => {
    setState(previous => ({ ...previous, status: 'loading' }));
    communicationsService.inbox(signal).then(items => setState({ status: 'ready', items }))
      .catch(error => { if (signal?.aborted) return; setState({ status: error instanceof CommunicationRequestError && (error.status === 503 || error.status === 403) ? 'off' : 'error', items: [], error: communicationErrorText(error) }); });
  }, []);
  useEffect(() => { const controller = new AbortController(); load(controller.signal); return () => controller.abort(); }, [load]);
  if (state.status === 'off') return null;
  return <section aria-labelledby="staff-inbox-heading" className="tg-acct-card space-y-3">
    <h2 id="staff-inbox-heading">Client messages awaiting reply <button type="button" onClick={() => load()}>Refresh</button></h2>
    {state.status === 'loading' && <p role="status">Loading client messages…</p>}
    {state.status === 'error' && <p role="alert">{state.error} <button type="button" onClick={() => load()}>Retry</button></p>}
    {state.status === 'ready' && state.items.length === 0 && <p>No client messages are waiting for a reply.</p>}
    {state.items.length > 0 && <ul aria-label="Messages awaiting reply">{state.items.map(t => <li key={t.threadId}>
      <strong>{t.subject}</strong> — client {t.clientId} · last message {new Date(t.lastMessageAt).toLocaleString()}{t.unread > 0 ? ` · ${t.unread} unread` : ''}
      {' '}<button type="button" onClick={() => setClientId(t.clientId)} aria-label={`Open conversations for client ${t.clientId}`}>Open</button></li>)}</ul>}
    {clientId && <div className="space-y-2">
      <ConversationPanel key={clientId} clientId={clientId} mode="staff" canArchive={canArchive} />
      <button type="button" onClick={() => { setClientId(null); load(); }}>Close client conversations</button>
    </div>}
  </section>;
}
