import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_TYPES, DOCUMENT_CATEGORIES, documentStatusText, newVaultKey, VaultRequestError, vaultMessage, vaultService, type VaultDocument } from '../../services/vaultService';
import { getStoredToken } from '../../services/api';
import { useClientPanelSession } from '../../hooks/useClientPanelSession';

const label = (v: string) => v.replace(/_/g, ' ');
/** Client-actionable statuses. Internal review notes have no client-safe contract (C9). */
export const CLIENT_ACTIONABLE_STATUSES = ['REJECTED', 'REPLACEMENT_REQUESTED'];
const GUIDANCE: Record<string, string> = {
  SCAN_PENDING: 'The file is quarantined until its security scan finishes.',
  REJECTED_MALWARE: 'The security scan blocked this file. Upload a clean copy.',
  PENDING_REVIEW: 'Your practice will review it.',
};

/** Client upload and status view for the secure vault. Bytes go to private storage via the server only. */
export function ClientDocumentVaultPanel({ clientId }: { clientId: string }) {
  const session = useClientPanelSession(clientId);
  return <VaultSession key={session} clientId={clientId} />;
}
function VaultSession({ clientId }: { clientId: string }) {
  const [targets, setTargets] = useState<Array<{ engagementId: string; title: string; taxYear: number }>>([]);
  const [docs, setDocs] = useState<{ status: 'loading' | 'ready' | 'error' | 'disabled'; items: VaultDocument[]; message?: string }>({ status: 'loading', items: [] });
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState<string>('income');
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [replacing, setReplacing] = useState<VaultDocument | null>(null);
  const key = useRef(newVaultKey());
  const live = useRef(false);
  const sequence = useRef(0);
  const mutation = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const load = useCallback(() => {
    const mine = ++sequence.current, token = getStoredToken();
    const valid = () => live.current && sequence.current === mine && getStoredToken() === token;
    setDocs({ status: 'loading', items: [] }); setTargets([]);
    Promise.all([vaultService.list(clientId), vaultService.uploadTargets(clientId)]).then(([r, options]) => {
      if (!valid()) return;
      if (!Array.isArray(r?.items) || !Array.isArray(options?.items)) throw new VaultRequestError(502, 'INVALID_VAULT_RESPONSE');
      setDocs({ status: 'ready', items: r.items }); setTargets(options.items);
      setTarget(t => options.items.some(o => `${o.engagementId}|${o.taxYear}` === t) ? t : options.items[0] ? `${options.items[0].engagementId}|${options.items[0].taxYear}` : '');
    }).catch(e => { if (valid()) { setTargets([]); setDocs(e instanceof VaultRequestError && e.code === 'DOCUMENT_VAULT_UNAVAILABLE' ? { status: 'disabled', items: [] } : { status: 'error', items: [], message: vaultMessage(e) }); } });
  }, [clientId]);
  useEffect(() => { live.current = true; load(); return () => { live.current = false; ++sequence.current; }; }, [load]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !target || mutation.current || !targets.some(t => `${t.engagementId}|${t.taxYear}` === target)) return;
    mutation.current = true;
    const token = getStoredToken(), valid = () => live.current && getStoredToken() === token;
    const [engagementId, year] = target.split('|');
    setBusy(true); setNotice(null);
    try {
      // A replacement is a new version of the same document; the server decides whether it is allowed.
      const r = await vaultService.upload(clientId, file, { engagementId, taxYear: Number(year), category, ...(replacing ? { documentId: replacing.documentId } : {}) }, key.current);
      if (!valid()) return;
      key.current = newVaultKey(); setFile(null);
      if (input.current) input.current.value = '';
      setNotice({ error: false, text: `${file.name} uploaded${replacing ? ' as a replacement' : ''}: ${documentStatusText(r.status)}.` }); setReplacing(null); load();
    } catch (err) { if (valid()) setNotice({ error: true, text: vaultMessage(err) }); }
    finally { if (valid()) { mutation.current = false; setBusy(false); } }
  };
  const download = async (d: VaultDocument) => {
    const token = getStoredToken(), valid = () => live.current && getStoredToken() === token;
    try { const r = await vaultService.download(clientId, d.documentId, d.version); if (valid()) window.open(r.url, '_blank', 'noopener,noreferrer'); }
    catch (err) { if (valid()) setNotice({ error: true, text: vaultMessage(err) }); }
  };
  // Environments without the durable vault keep the existing document views only.
  if (docs.status === 'disabled') return null;
  return <section aria-labelledby="client-vault-heading" aria-busy={docs.status === 'loading' || busy} className="min-w-0 space-y-4 rounded-2xl border border-slate-700 bg-[#0D2745] p-4 text-sm text-slate-200">
    <header><h3 id="client-vault-heading" className="font-bold text-white">Secure document upload</h3>
      <p className="text-slate-400">Files are stored privately, scanned for malware and reviewed by your tax team before use.</p></header>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : 'text-emerald-300'}>{notice.text}</p>}
    {replacing && <p role="status" className="text-amber-200">Uploading a replacement for <strong>{replacing.fileName}</strong>. <button type="button" disabled={busy} className="underline" onClick={() => { setReplacing(null); setFile(null); if (input.current) input.current.value = ''; key.current = newVaultKey(); }}>Cancel replacement</button></p>}
    {targets.length === 0 ? docs.status === 'ready' && <p role="status">No open engagement is available for uploads yet.</p> : <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-col">Engagement and tax year<select disabled={busy || replacing !== null} value={target} onChange={e => { setTarget(e.target.value); key.current = newVaultKey(); }} className="max-w-full rounded border border-slate-600 bg-[#06182B] px-2 py-1">
        {targets.map(t => <option key={t.engagementId + t.taxYear} value={`${t.engagementId}|${t.taxYear}`}>{t.title} ({t.taxYear})</option>)}</select></label>
      <label className="flex flex-col">Category<select aria-label="Category" disabled={busy || replacing !== null} value={category} onChange={e => { setCategory(e.target.value); key.current = newVaultKey(); }} className="rounded border border-slate-600 bg-[#06182B] px-2 py-1">
        {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label>
      <label className="flex min-w-0 flex-col">File (PDF, JPEG, PNG, XLSX or CSV, up to 25 MB)<input ref={input} className="max-w-full" disabled={busy} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={e => { setFile(e.target.files?.[0] ?? null); key.current = newVaultKey(); }} /></label>
      <button disabled={!file || busy} className="rounded-lg bg-[#D4A843] px-3 py-1.5 font-bold text-[#06182B] disabled:opacity-50">{busy ? 'Uploading…' : 'Upload securely'}</button>
    </form>}
    {docs.status === 'loading' && <p role="status">Loading documents…</p>}
    {docs.status === 'error' && <p role="alert">{docs.message} <button type="button" onClick={load}>Retry documents</button></p>}
    {docs.status === 'ready' && docs.items.length === 0 && <p role="status">No documents uploaded yet.</p>}
    {docs.items.length > 0 && <div className="overflow-x-auto" role="region" aria-label="Uploaded documents" tabIndex={0}><table className="w-full text-left"><caption className="sr-only">Your uploaded documents</caption>
      <thead><tr>{['File', 'Year', 'Category', 'Version', 'Status', 'Actions'].map(h => <th key={h} scope="col" className="p-1">{h}</th>)}</tr></thead>
      <tbody>{docs.items.map(d => <tr key={d.documentId + d.version} className="border-t border-slate-800"><td className="p-1">{d.fileName}</td><td className="p-1">{d.taxYear}</td>
        <td className="p-1">{label(d.category)}</td><td className="p-1">v{d.version}</td><td className="p-1">{documentStatusText(d.status)}
          {CLIENT_ACTIONABLE_STATUSES.includes(d.status) && <span className="block text-amber-200">Please upload a replacement or message your practice for guidance.</span>}
          {GUIDANCE[d.status] && <span className="block text-xs text-slate-400">{GUIDANCE[d.status]}</span>}</td>
        <td className="p-1 space-x-2">{d.quarantineStatus === 'CLEAN' && <button type="button" className="underline" disabled={busy} onClick={() => download(d)} aria-label={`Download ${d.fileName}`}>Download</button>}
          {(CLIENT_ACTIONABLE_STATUSES.includes(d.status) || d.status === 'REJECTED_MALWARE') && !docs.items.some(other => other.documentId === d.documentId && other.version > d.version) && <button type="button" className="underline" disabled={busy || !targets.some(t => t.engagementId === d.engagementId && t.taxYear === d.taxYear)}
            onClick={() => { setReplacing(d); setCategory(d.category); setTarget(`${d.engagementId}|${d.taxYear}`); setFile(null); if (input.current) { input.current.value = ''; input.current.focus(); } setNotice(null); key.current = newVaultKey(); }}
            aria-label={`Upload a replacement for ${d.fileName}`}>Upload replacement</button>}</td></tr>)}</tbody></table></div>}
  </section>;
}
