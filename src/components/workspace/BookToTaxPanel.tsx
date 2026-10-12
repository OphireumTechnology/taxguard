import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookToTaxRequestError, bookToTaxApi, bookToTaxMessage, centsText, newB2tKey, type B2tOverview } from '../../services/bookToTaxService';

const FAMILIES = ['1040', '1041', '1065', '1120', '1120S', '990', '706', '709'];
const button = 'rounded-lg border border-slate-600 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50';
const input = 'rounded-lg border border-slate-600 bg-[#06182B] px-2 py-1 text-xs text-white';

/** Durable book-to-tax workpapers: mappings, adjustments and reconciled snapshots for professional review. No tax is computed. */
export function BookToTaxPanel({ clientId, taxYear, accounts }: { clientId: string; taxYear: number; accounts: Array<{ id: string; accountNumber: string; accountName: string }> }) {
  const [family, setFamily] = useState('1040');
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'disabled'; data?: B2tOverview; message?: string }>({ status: 'loading' });
  const [categories, setCategories] = useState<Array<{ categoryCode: string; label: string }>>([]);
  const [adj, setAdj] = useState({ categoryCode: '', amount: '', adjustmentType: 'PERMANENT', description: '' });
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const adjKey = useRef(newB2tKey());
  const load = useCallback(() => {
    bookToTaxApi.overview(clientId, taxYear, family).then(data => setState({ status: 'ready', data }))
      .catch(e => setState(e instanceof BookToTaxRequestError && e.code === 'B2T_UNAVAILABLE' ? { status: 'disabled' } : { status: 'error', message: bookToTaxMessage(e) }));
    bookToTaxApi.categories(family).then(r => setCategories(r.items)).catch(() => setCategories([]));
  }, [clientId, taxYear, family]);
  useEffect(() => { load(); }, [load]);
  if (state.status === 'disabled') return <p role="status" className="text-xs text-slate-400">Durable book-to-tax workpapers are not enabled in this environment.</p>;
  const run = async (op: () => Promise<unknown>, text: string) => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try { await op(); setNotice({ error: false, text }); load(); } catch (e) { setNotice({ error: true, text: bookToTaxMessage(e) }); } finally { setBusy(false); }
  };
  const d = state.data;
  const open = d?.mappingSets.find(s => ['DRAFT', 'PENDING_REVIEW'].includes(s.status));
  const approved = d?.mappingSets.find(s => s.status === 'APPROVED');
  const current = open ?? approved;
  const mapped = new Map(current?.mappings.map(m => [m.accountId, m.categoryCode]) ?? []);
  return <section aria-labelledby="b2t-heading" className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#0D2745] p-4 text-xs text-slate-300">
    <header><h3 id="b2t-heading" className="font-mono font-bold uppercase tracking-wider">Book-to-tax workpapers</h3>
      <p>Firm-defined groupings and reviewed adjustments for professional review. TaxGuard computes no tax and asserts no form line or rule.</p></header>
    <label className="flex flex-col">Return family<select className={input} value={family} onChange={e => setFamily(e.target.value)}>{FAMILIES.map(f => <option key={f}>{f}</option>)}</select></label>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : 'text-emerald-300'}>{notice.text}</p>}
    {state.status === 'loading' && <p role="status">Loading workpapers…</p>}
    {state.status === 'error' && <p role="alert">{state.message}</p>}
    {d && <>
      <h4 className="font-bold text-white">Account mapping {current ? `v${current.version} (${current.status.toLowerCase().replace('_', ' ')})` : '(none)'}</h4>
      {categories.length === 0 && <p>No categories are defined for {family}. A practice manager must define the firm's categories first.</p>}
      {!open && <button type="button" className={button} disabled={busy} onClick={() => run(() => bookToTaxApi.openSet(clientId, taxYear, family), 'Draft mapping version opened.')}>Start new mapping version</button>}
      {current && <table className="w-full text-left"><caption className="sr-only">Account to category mapping</caption><thead><tr><th scope="col">Account</th><th scope="col">Category</th></tr></thead>
        <tbody>{accounts.map(a => <tr key={a.id}><td>{a.accountNumber} · {a.accountName}</td><td>{open?.status === 'DRAFT'
          ? <select aria-label={`Category for ${a.accountNumber}`} className={input} value={mapped.get(a.id) ?? ''} disabled={busy}
              onChange={e => run(() => bookToTaxApi.setMapping(clientId, open.setId, a.id, e.target.value || null), 'Mapping saved.')}>
              <option value="">Unmapped</option>{categories.map(c => <option key={c.categoryCode} value={c.categoryCode}>{c.label}</option>)}</select>
          : (mapped.get(a.id) ?? 'Unmapped')}</td></tr>)}</tbody></table>}
      {open?.status === 'DRAFT' && <button type="button" className={button} disabled={busy} onClick={() => run(() => bookToTaxApi.reviewSet(clientId, open.setId, 'submit'), 'Submitted for review.')}>Submit mapping for review</button>}
      {open?.status === 'PENDING_REVIEW' && <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy} onClick={() => run(() => bookToTaxApi.reviewSet(clientId, open.setId, 'approve'), 'Mapping approved.')}>Approve mapping</button>
        <input aria-label="Review note" className={input} value={note} onChange={e => setNote(e.target.value)} placeholder="Note (required to reject)" />
        <button type="button" className={button} disabled={busy || note.trim().length < 5} onClick={() => run(() => bookToTaxApi.reviewSet(clientId, open.setId, 'reject', note), 'Mapping rejected.')}>Reject mapping</button></div>}

      <h4 className="font-bold text-white">Adjustments</h4>
      <ul>{d.adjustments.map(a => <li key={a.adjustmentId}>{a.categoryCode} · {centsText(a.amountCents)} · {a.adjustmentType.toLowerCase()} · {a.description} · {a.status.toLowerCase()}
        {a.status === 'PREPARED' && <><button type="button" className={button} disabled={busy} onClick={() => run(() => bookToTaxApi.reviewAdjustment(clientId, a.adjustmentId, true), 'Adjustment approved.')}>Approve</button>
          <button type="button" className={button} disabled={busy || note.trim().length < 5} onClick={() => run(() => bookToTaxApi.reviewAdjustment(clientId, a.adjustmentId, false, note), 'Adjustment rejected.')}>Reject</button></>}</li>)}</ul>
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void run(async () => { await bookToTaxApi.prepareAdjustment(clientId, { taxYear, returnFamily: family, ...adj }, adjKey.current); adjKey.current = newB2tKey(); }, 'Adjustment prepared for review.'); }}>
        <label className="flex flex-col">Category<select className={input} required value={adj.categoryCode} onChange={e => setAdj({ ...adj, categoryCode: e.target.value })}><option value="">Select</option>
          {categories.map(c => <option key={c.categoryCode} value={c.categoryCode}>{c.label}</option>)}</select></label>
        <label className="flex flex-col">Amount (signed)<input className={input} required inputMode="decimal" value={adj.amount} onChange={e => setAdj({ ...adj, amount: e.target.value })} /></label>
        <label className="flex flex-col">Type<select className={input} value={adj.adjustmentType} onChange={e => setAdj({ ...adj, adjustmentType: e.target.value })}>{['PERMANENT', 'TIMING', 'RECLASSIFICATION'].map(t => <option key={t}>{t}</option>)}</select></label>
        <label className="flex flex-1 flex-col">Description (professional basis)<input className={input} required minLength={5} maxLength={500} value={adj.description} onChange={e => setAdj({ ...adj, description: e.target.value })} /></label>
        <button className={button} disabled={busy}>Prepare adjustment</button>
      </form>

      <h4 className="font-bold text-white">Workpapers</h4>
      <button type="button" className={button} disabled={busy || !approved} onClick={() => run(() => bookToTaxApi.generateWorkpaper(clientId, taxYear, family), 'Workpaper generated.')}>Generate workpaper from approved mapping</button>
      {d.workpapers.map(w => <article key={w.workpaperId} className="space-y-1 rounded-xl border border-slate-800 p-2">
        <p>{new Date(w.createdAt).toLocaleString()} · {w.status.toLowerCase()} · {w.reconciled && w.unmappedAccounts === 0 ? 'reconciled' : `${w.unmappedAccounts} unmapped account(s)`} · by {w.generatedBy}</p>
        <table className="w-full text-left"><caption className="sr-only">Workpaper categories</caption><thead><tr>{['Category', 'Book', 'Adjustments', 'Book + adjustments'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{w.snapshot.categories.map(c => <tr key={c.categoryCode}><td>{c.label}</td><td>{centsText(c.bookCents)}</td><td>{centsText(c.adjustmentCents)}</td><td>{centsText(c.taxBasisCents)}</td></tr>)}</tbody></table>
        {w.snapshot.unmapped.length > 0 && <p role="status">Unmapped: {w.snapshot.unmapped.map(u => `${u.accountNumber} ${centsText(u.netCents)}`).join(', ')}</p>}
        {w.status === 'DRAFT' && <><button type="button" className={button} disabled={busy} onClick={() => run(() => bookToTaxApi.reviewWorkpaper(clientId, w.workpaperId, true), 'Workpaper approved.')}>Approve workpaper</button>
          <button type="button" className={button} disabled={busy || note.trim().length < 5} onClick={() => run(() => bookToTaxApi.reviewWorkpaper(clientId, w.workpaperId, false, note), 'Workpaper rejected.')}>Reject</button></>}
      </article>)}
      <label className="flex flex-col">Review note (used for rejections)<input className={input} value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
    </>}
  </section>;
}
