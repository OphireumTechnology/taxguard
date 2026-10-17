import React, { useCallback, useEffect, useState } from 'react';
import { documentStatusText, vaultMessage, vaultService, type VaultDocument, type VaultExtraction } from '../../services/vaultService';

/** Staff review queue: approve / reject / request replacement, and field-by-field verification of OCR proposals. */
export function StaffDocumentReviewPanel() {
  const [queue, setQueue] = useState<{ status: 'loading' | 'ready' | 'error'; items: VaultDocument[]; message?: string }>({ status: 'loading', items: [] });
  const [selected, setSelected] = useState<VaultDocument | null>(null);
  const [fields, setFields] = useState<VaultExtraction[]>([]);
  const [note, setNote] = useState('');
  const [clientReason, setClientReason] = useState('');
  const [corrections, setCorrections] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    setQueue(q => ({ ...q, status: 'loading' }));
    vaultService.reviewQueue().then(r => setQueue({ status: 'ready', items: r.items })).catch(e => setQueue({ status: 'error', items: [], message: vaultMessage(e) }));
  }, []);
  useEffect(() => { load(); }, [load]);
  const open = (d: VaultDocument) => {
    setSelected(d); setNote(''); setClientReason(''); setNotice(null); setFields([]);
    vaultService.detail(d.clientId, d.documentId).then(r => setFields(r.extractions.filter(x => x.version === d.version))).catch(e => setNotice({ error: true, text: vaultMessage(e) }));
  };
  const act = async (op: () => Promise<unknown>, text: string, refreshQueue = true) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { await op(); setNotice({ error: false, text }); if (refreshQueue) { setSelected(null); load(); } else if (selected) open(selected); }
    catch (e) { setNotice({ error: true, text: vaultMessage(e) }); }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="doc-review-heading" className="tg-manager-card">
    <h2 id="doc-review-heading">Document Review</h2>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {queue.status === 'loading' && <p role="status">Loading review queue…</p>}
    {queue.status === 'error' && <p role="alert">{queue.message}</p>}
    {queue.status === 'ready' && queue.items.length === 0 && <p role="status">No scanned documents are awaiting review for your clients.</p>}
    {queue.items.length > 0 && <div className="tg-manager-scroll"><table><caption className="sr-only">Documents awaiting review</caption>
      <thead><tr>{['Client', 'File', 'Year', 'Category', 'Uploaded by', 'Received', ''].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{queue.items.map(d => <tr key={d.documentId + d.version}><td>{d.clientName || d.clientId}</td><td>{d.fileName} (v{d.version})</td><td>{d.taxYear}</td><td>{d.category}</td>
        <td>{d.uploaderRole === 'client' ? 'Client' : d.uploadedBy}</td><td>{d.createdAt.slice(0, 10)}</td>
        <td><button type="button" aria-pressed={selected?.documentId === d.documentId} onClick={() => open(d)}>Review</button></td></tr>)}</tbody></table></div>}
    {selected && <div aria-live="polite">
      <h3>{selected.fileName} — {documentStatusText(selected.status)}</h3>
      <button type="button" onClick={() => vaultService.download(selected.clientId, selected.documentId, selected.version).then(r => window.open(r.url, '_blank', 'noopener,noreferrer'))
        .catch(e => setNotice({ error: true, text: vaultMessage(e) }))}>Open (short-lived link)</button>
      {!selected.canReview && <p role="status">You uploaded this document; a different staff member must review it.</p>}
      <h4>Proposed extracted values (not used until verified)</h4>
      {fields.length === 0 ? <p>No OCR proposals for this version.</p> : <ul>{fields.map(f => <li key={f.fieldId}>
        <strong>{f.fieldKey}</strong>: {JSON.stringify(f.proposedValue)} <small>(confidence {Math.round(f.confidence * 100)}%, {f.provider})</small>
        {f.decision ? <span> — {f.decision.toLowerCase()}{f.decision === 'CORRECTED' ? `: ${JSON.stringify(f.verifiedValue)}` : ''}</span> : <>
          <button type="button" disabled={busy} onClick={() => act(() => vaultService.verifyField(selected.clientId, f.fieldId, 'ACCEPTED'), 'Value accepted.', false)}>Accept</button>
          <label>Corrected value<input value={corrections[f.fieldId] ?? ''} onChange={e => setCorrections({ ...corrections, [f.fieldId]: e.target.value })} /></label>
          <button type="button" disabled={busy || !(corrections[f.fieldId] ?? '').trim()} onClick={() => act(() => vaultService.verifyField(selected.clientId, f.fieldId, 'CORRECTED', corrections[f.fieldId].trim()), 'Corrected value recorded.', false)}>Save correction</button>
          <button type="button" disabled={busy} onClick={() => act(() => vaultService.verifyField(selected.clientId, f.fieldId, 'REJECTED'), 'Value rejected.', false)}>Reject value</button></>}
      </li>)}</ul>}
      <label>Internal review note (staff only)<input maxLength={500} value={note} onChange={e => setNote(e.target.value)} /></label>
      <label>Reason shown to client (required to reject or request a replacement)<input maxLength={500} value={clientReason} onChange={e => setClientReason(e.target.value)} /></label>
      <button type="button" disabled={busy || !selected.canReview} onClick={() => act(() => vaultService.review(selected.clientId, selected.documentId, selected.version, 'approve', selected.rowVersion, note || undefined), 'Document accepted.')}>Accept document</button>
      <button type="button" disabled={busy || !selected.canReview || clientReason.trim().length < 5} onClick={() => act(() => vaultService.review(selected.clientId, selected.documentId, selected.version, 'request_replacement', selected.rowVersion, note, clientReason), 'Replacement requested.')}>Request replacement</button>
      <button type="button" disabled={busy || !selected.canReview || clientReason.trim().length < 5} onClick={() => act(() => vaultService.review(selected.clientId, selected.documentId, selected.version, 'reject', selected.rowVersion, note, clientReason), 'Document rejected.')}>Reject</button>
    </div>}
  </section>;
}
