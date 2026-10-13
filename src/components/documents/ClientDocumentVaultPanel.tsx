import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ACCEPTED_TYPES, DOCUMENT_CATEGORIES, documentStatusText, newVaultKey, VaultRequestError, vaultMessage, vaultService, type VaultDocument } from '../../services/vaultService';

const label = (v: string) => v.replace(/_/g, ' ');

/** Client upload and status view for the secure vault. Bytes go to private storage via the server only. */
export function ClientDocumentVaultPanel({ clientId }: { clientId: string }) {
  const [targets, setTargets] = useState<Array<{ engagementId: string; title: string; taxYear: number }>>([]);
  const [docs, setDocs] = useState<{ status: 'loading' | 'ready' | 'error' | 'disabled'; items: VaultDocument[]; message?: string }>({ status: 'loading', items: [] });
  const [target, setTarget] = useState('');
  const [category, setCategory] = useState<string>('income');
  const [file, setFile] = useState<File | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const key = useRef(newVaultKey());
  const load = useCallback(() => {
    setDocs(d => ({ ...d, status: 'loading' }));
    vaultService.list(clientId).then(r => setDocs({ status: 'ready', items: r.items })).catch(e => setDocs(e instanceof VaultRequestError && e.code === 'DOCUMENT_VAULT_UNAVAILABLE' ? { status: 'disabled', items: [] } : { status: 'error', items: [], message: vaultMessage(e) }));
    vaultService.uploadTargets(clientId).then(r => { setTargets(r.items); if (r.items[0]) setTarget(t => t || `${r.items[0].engagementId}|${r.items[0].taxYear}`); }).catch(() => setTargets([]));
  }, [clientId]);
  useEffect(() => { load(); }, [load]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !target || busy) return;
    const [engagementId, year] = target.split('|');
    setBusy(true); setNotice(null);
    try {
      const r = await vaultService.upload(clientId, file, { engagementId, taxYear: Number(year), category }, key.current);
      key.current = newVaultKey(); setFile(null);
      setNotice({ error: false, text: `${file.name} uploaded: ${documentStatusText(r.status)}.` }); load();
    } catch (err) { setNotice({ error: true, text: vaultMessage(err) }); }
    finally { setBusy(false); }
  };
  const download = async (d: VaultDocument) => {
    try { const r = await vaultService.download(clientId, d.documentId, d.version); window.open(r.url, '_blank', 'noopener,noreferrer'); }
    catch (err) { setNotice({ error: true, text: vaultMessage(err) }); }
  };
  // Environments without the durable vault keep the existing document views only.
  if (docs.status === 'disabled') return null;
  return <section aria-labelledby="client-vault-heading" className="space-y-4 rounded-2xl border border-slate-700 bg-[#0D2745] p-4 text-sm text-slate-200">
    <header><h3 id="client-vault-heading" className="font-bold text-white">Secure document upload</h3>
      <p className="text-slate-400">Files are stored privately, scanned for malware and reviewed by your tax team before use.</p></header>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : 'text-emerald-300'}>{notice.text}</p>}
    {targets.length === 0 ? <p role="status">No open engagement is available for uploads yet.</p> : <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col">Engagement and tax year<select value={target} onChange={e => setTarget(e.target.value)} className="rounded border border-slate-600 bg-[#06182B] px-2 py-1">
        {targets.map(t => <option key={t.engagementId + t.taxYear} value={`${t.engagementId}|${t.taxYear}`}>{t.title} ({t.taxYear})</option>)}</select></label>
      <label className="flex flex-col">Category<select value={category} onChange={e => setCategory(e.target.value)} className="rounded border border-slate-600 bg-[#06182B] px-2 py-1">
        {DOCUMENT_CATEGORIES.map(c => <option key={c} value={c}>{label(c)}</option>)}</select></label>
      <label className="flex flex-col">File (PDF, JPEG, PNG, XLSX or CSV, up to 25 MB)<input type="file" accept={ACCEPTED_TYPES.join(',')} onChange={e => { setFile(e.target.files?.[0] ?? null); key.current = newVaultKey(); }} /></label>
      <button disabled={!file || busy} className="rounded-lg bg-[#D4A843] px-3 py-1.5 font-bold text-[#06182B] disabled:opacity-50">{busy ? 'Uploading…' : 'Upload securely'}</button>
    </form>}
    {docs.status === 'loading' && <p role="status">Loading documents…</p>}
    {docs.status === 'error' && <p role="alert">{docs.message}</p>}
    {docs.status === 'ready' && docs.items.length === 0 && <p role="status">No documents uploaded yet.</p>}
    {docs.items.length > 0 && <table className="w-full text-left"><caption className="sr-only">Your uploaded documents</caption>
      <thead><tr>{['File', 'Year', 'Category', 'Version', 'Status', ''].map(h => <th key={h} scope="col" className="p-1">{h}</th>)}</tr></thead>
      <tbody>{docs.items.map(d => <tr key={d.documentId + d.version} className="border-t border-slate-800"><td className="p-1">{d.fileName}</td><td className="p-1">{d.taxYear}</td>
        <td className="p-1">{label(d.category)}</td><td className="p-1">v{d.version}</td><td className="p-1">{documentStatusText(d.status)}{d.reviewNote ? ` — ${d.reviewNote}` : ''}</td>
        <td className="p-1">{d.quarantineStatus === 'CLEAN' && <button type="button" className="underline" onClick={() => download(d)} aria-label={`Download ${d.fileName}`}>Download</button>}</td></tr>)}</tbody></table>}
  </section>;
}
