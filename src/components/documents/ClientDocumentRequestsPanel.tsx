import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_TYPES, newVaultKey, vaultMessage, vaultService } from '../../services/vaultService';
import { documentRequestService, requestMessage, requestStatusText, type ClientNotification, type DocumentRequestItem } from '../../services/documentRequestService';

/** Client portal: documents the practice has requested (upload straight into a request) and in-app notices. */
export function ClientDocumentRequestsPanel({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<DocumentRequestItem[] | null>(null);
  const [notes, setNotes] = useState<{ unread: number; items: ClientNotification[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const keys = useRef<Record<string, string>>({});
  const load = useCallback(() => {
    documentRequestService.list(clientId).then(r => { setItems(r.items); setError(null); }).catch(e => setError(requestMessage(e)));
    documentRequestService.notifications(clientId).then(setNotes).catch(() => setNotes(null));
  }, [clientId]);
  useEffect(() => { load(); }, [load]);
  const uploadFor = async (q: DocumentRequestItem, file: File | undefined) => {
    if (!file || busy) return;
    if (!q.acceptedTypes.includes(file.type)) { setNotice({ error: true, text: 'This request accepts: ' + q.acceptedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ') + '.' }); return; }
    setBusy(q.requestId); setNotice(null);
    try {
      keys.current[q.requestId] ??= newVaultKey();
      const up = await vaultService.upload(clientId, file, { engagementId: q.engagementId, taxYear: q.taxYear, category: q.category }, keys.current[q.requestId]);
      await documentRequestService.link(clientId, q.requestId, up.documentId, up.version);
      delete keys.current[q.requestId];
      setNotice({ error: false, text: `Uploaded for "${q.title}". It will be checked before staff review it.` });
      load();
    } catch (e) { setNotice({ error: true, text: e instanceof Error && /^DOC_REQUEST|^ENGAGEMENT/.test(e.message) ? requestMessage(e) : vaultMessage(e) }); }
    finally { setBusy(null); }
  };
  const open = (items ?? []).filter(q => q.status === 'OPEN' || q.status === 'SUBMITTED');
  return <section aria-labelledby="client-requests-heading" className="rounded-xl border border-slate-700 bg-[#071A2E] p-4 text-sm text-slate-200">
    <h2 id="client-requests-heading" className="text-lg font-bold text-white">Requested documents</h2>
    {error && <p role="alert">{error}</p>}
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {items === null && !error && <p role="status">Loading requests…</p>}
    {items && items.length === 0 && <p>Your practice has not requested any documents.</p>}
    {items && items.length > 0 && <>
      <p>{open.length} of {items.length} request(s) still need attention.</p>
      <table className="w-full"><caption className="sr-only">Requested documents</caption>
        <thead><tr>{['Document', 'Tax year', 'Due', 'Status', 'Upload'].map(h => <th key={h} scope="col" className="text-left">{h}</th>)}</tr></thead>
        <tbody>{items.map(q => <tr key={q.requestId}>
          <td>{q.title}{q.required ? '' : ' (optional)'}{q.instructions ? <div className="text-xs text-slate-400">{q.instructions}</div> : null}</td>
          <td>{q.taxYear}</td>
          <td>{q.dueDate ?? '—'}{q.overdue ? ' (overdue)' : ''}</td>
          <td>{requestStatusText(q.status)}</td>
          <td>{q.status === 'OPEN' || q.status === 'SUBMITTED'
            ? <input type="file" aria-label={`Upload for ${q.title}`} accept={q.acceptedTypes.filter(t => ACCEPTED_TYPES.includes(t)).join(',')} disabled={busy !== null}
                onChange={e => { void uploadFor(q, e.target.files?.[0]); e.target.value = ''; }} />
            : '—'}</td></tr>)}</tbody></table></>}
    <h3 className="mt-3 font-bold text-white">Notices {notes && notes.unread > 0 ? `(${notes.unread} unread)` : ''}</h3>
    {notes && notes.items.length === 0 && <p>No notices.</p>}
    {notes && notes.items.length > 0 && <ul>{notes.items.slice(0, 20).map(n => <li key={n.notificationId}>
      <span className={n.readAt ? 'text-slate-400' : 'font-semibold'}>{n.title}</span> <small>{new Date(n.createdAt).toLocaleDateString()}</small>
      {!n.readAt && <button type="button" className="ml-2 underline" onClick={() => documentRequestService.markRead(clientId, n.notificationId).then(load).catch(() => undefined)}
        aria-label={`Mark "${n.title}" as read`}>Mark read</button>}</li>)}</ul>}
    <p className="mt-2 text-xs text-slate-400">Notices appear here only; e-mail and text delivery are not enabled.</p>
  </section>;
}
