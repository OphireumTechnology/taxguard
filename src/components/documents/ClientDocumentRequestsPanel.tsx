import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_TYPES, newVaultKey, vaultMessage, vaultService } from '../../services/vaultService';
import { documentRequestService, requestMessage, requestStatusText, type ClientNotification, type DocumentRequestItem } from '../../services/documentRequestService';
import { getStoredToken } from '../../services/api';
import { useClientPanelSession } from '../../hooks/useClientPanelSession';

/** Client portal: documents the practice has requested (upload straight into a request) and in-app notices. */
export function ClientDocumentRequestsPanel({ clientId }: { clientId: string }) {
  const session = useClientPanelSession(clientId);
  return <RequestsSession key={session} clientId={clientId} />;
}
function RequestsSession({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<DocumentRequestItem[] | null>(null);
  const [notes, setNotes] = useState<{ unread: number; items: ClientNotification[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const keys = useRef<Record<string, string>>({});
  const live = useRef(false), seq = useRef(0), mutation = useRef(false);
  const load = useCallback(() => {
    const mine = ++seq.current, token = getStoredToken();
    const valid = () => live.current && seq.current === mine && getStoredToken() === token;
    setItems(null); setNotes(null); setError(null);
    documentRequestService.list(clientId).then(r => { if (valid()) { if (!Array.isArray(r?.items)) throw new Error('INVALID_REQUEST_RESPONSE'); setItems(r.items); } }).catch(e => { if (valid()) setError(requestMessage(e)); });
    documentRequestService.notifications(clientId).then(r => { if (valid()) setNotes(r); }).catch(() => { if (valid()) setNotes(null); });
  }, [clientId]);
  useEffect(() => { live.current = true; load(); return () => { live.current = false; ++seq.current; }; }, [load]);
  const uploadFor = async (q: DocumentRequestItem, file: File | undefined) => {
    if (!file || mutation.current) return;
    if (!q.acceptedTypes.includes(file.type)) { setNotice({ error: true, text: 'This request accepts: ' + q.acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ') + '.' }); return; }
    setBusy(q.requestId); setNotice(null);
    mutation.current = true;
    const token = getStoredToken(), valid = () => live.current && getStoredToken() === token;
    try {
      keys.current[q.requestId] ??= newVaultKey();
      const up = await vaultService.upload(clientId, file, { engagementId: q.engagementId, taxYear: q.taxYear, category: q.category }, keys.current[q.requestId]);
      if (!valid()) return;
      await documentRequestService.link(clientId, q.requestId, up.documentId, up.version);
      if (!valid()) return;
      delete keys.current[q.requestId];
      setNotice({ error: false, text: `Uploaded for "${q.title}". It will be checked before staff review it.` });
      load();
    } catch (e) { if (valid()) setNotice({ error: true, text: e instanceof Error && /^DOC_REQUEST|^ENGAGEMENT/.test(e.message) ? requestMessage(e) : vaultMessage(e) }); }
    finally { if (valid()) { mutation.current = false; setBusy(null); } }
  };
  const markRead = async (n: ClientNotification) => {
    if (mutation.current) return;
    mutation.current = true; ++seq.current;
    const token = getStoredToken(), valid = () => live.current && getStoredToken() === token;
    setBusy(n.notificationId); setNotice(null);
    try {
      const r = await documentRequestService.markRead(clientId, n.notificationId);
      if (!valid()) return;
      if (r?.read !== true) throw new Error('READ_NOT_CONFIRMED');
      setNotice({ error: false, text: 'Notice marked as read.' }); load();
    } catch { if (valid()) setNotice({ error: true, text: 'The server did not confirm this change. Try again.' }); }
    finally { if (valid()) { mutation.current = false; setBusy(null); } }
  };
  const open = (items ?? []).filter(q => q.status === 'OPEN' || q.status === 'SUBMITTED');
  return <section aria-labelledby="client-requests-heading" className="rounded-xl border border-slate-700 bg-[#071A2E] p-4 text-sm text-slate-200">
    <h2 id="client-requests-heading" className="text-lg font-bold text-white">Requested documents</h2>
    {error && <p role="alert">{error} <button type="button" onClick={load} disabled={busy !== null}>Retry requests</button></p>}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {items === null && !error && <p role="status">Loading requests…</p>}
    {items && items.length === 0 && <p>Your practice has not requested any documents.</p>}
    {items && items.length > 0 && <>
      <p>{open.length} of {items.length} request(s) still need attention.</p>
      <div className="overflow-x-auto" role="region" aria-label="Requested documents table" tabIndex={0}><table className="w-full"><caption className="sr-only">Requested documents</caption>
        <thead><tr>{['Document', 'Tax year', 'Due', 'Status', 'Upload'].map(h => <th key={h} scope="col" className="text-left">{h}</th>)}</tr></thead>
        <tbody>{items.map(q => <tr key={q.requestId}>
          <td>{q.title}{q.required ? '' : ' (optional)'}{q.instructions ? <div className="text-xs text-slate-400">{q.instructions}</div> : null}</td>
          <td>{q.taxYear}</td>
          <td>{q.dueDate ?? '—'}{q.overdue ? ' (overdue)' : ''}</td>
          <td>{requestStatusText(q.status)}</td>
          <td>{q.status === 'OPEN' || q.status === 'SUBMITTED'
            ? <input type="file" aria-label={`Upload for ${q.title}`} accept={q.acceptedTypes.filter(t => ACCEPTED_TYPES.includes(t)).join(',')} disabled={busy !== null}
                onChange={e => { void uploadFor(q, e.target.files?.[0]); e.target.value = ''; }} />
            : '—'}</td></tr>)}</tbody></table></div></>}
    <h3 className="mt-3 font-bold text-white">Notices {notes && notes.unread > 0 ? `(${notes.unread} unread)` : ''}</h3>
    {notes && notes.items.length === 0 && <p>No notices.</p>}
    {notes && notes.items.length > 0 && <ul>{notes.items.slice(0, 20).map(n => <li key={n.notificationId}>
      <span className={n.readAt ? 'text-slate-400' : 'font-semibold'}>{n.title}</span> <small>{new Date(n.createdAt).toLocaleDateString()}</small>
      {!n.readAt && <button type="button" className="ml-2 underline" disabled={busy !== null} onClick={() => void markRead(n)}
        aria-label={`Mark "${n.title}" as read`}>Mark read</button>}</li>)}</ul>}
    <p className="mt-2 text-xs text-slate-400">Notices appear here only; e-mail and text delivery are not enabled.</p>
  </section>;
}
