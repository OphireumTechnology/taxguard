import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BillingRequestError, billingApi, billingMessage, ISSUED_INVOICE_STATUSES, newBillingKey, saveBlob, type Invoice } from '../../services/billingApiService';

/** Client view of issued invoices. Payment uses the sandbox provider only (development); no real card is charged. */
export function ClientInvoicesPanel({ clientId }: { clientId: string }) {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'disabled'; items: Invoice[]; message?: string }>({ status: 'loading', items: [] });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [card, setCard] = useState('');
  const keys = useRef<Record<string, string>>({});
  const load = useCallback(() => {
    billingApi.invoices(clientId).then(r => setState({ status: 'ready', items: r.items }))
      .catch(e => setState(e instanceof BillingRequestError && e.code === 'BILLING_UNAVAILABLE' ? { status: 'disabled', items: [] } : { status: 'error', items: [], message: billingMessage(e) }));
  }, [clientId]);
  useEffect(() => { load(); }, [load]);
  if (state.status === 'disabled') return null;
  const pay = async (inv: Invoice) => {
    const k = (keys.current[inv.invoiceId] ??= newBillingKey());
    try { await billingApi.paySandbox(clientId, inv.invoiceId, inv.balanceDue, card.replace(/\s/g, ''), k); delete keys.current[inv.invoiceId]; setNotice({ error: false, text: 'Sandbox payment recorded.' }); load(); }
    catch (e) { setNotice({ error: true, text: billingMessage(e) }); }
  };
  const download = async (inv: Invoice) => {
    try { saveBlob(await billingApi.document(clientId, inv.invoiceId), `invoice-${(inv.invoiceNumber || inv.invoiceId).replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`); setNotice({ error: false, text: 'Invoice document downloaded. It is not a receipt.' }); }
    catch (e) { setNotice({ error: true, text: billingMessage(e) }); }
  };
  return <section aria-labelledby="client-invoices-heading" className="space-y-3 rounded-2xl border border-slate-700 bg-[#0D2745] p-4 text-sm text-slate-200">
    <h3 id="client-invoices-heading" className="font-bold text-white">Invoices</h3>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {state.status === 'loading' && <p role="status">Loading invoices…</p>}
    {state.status === 'error' && <p role="alert">{state.message}</p>}
    {state.status === 'ready' && state.items.length === 0 && <p role="status">No invoices have been issued.</p>}
    {state.items.length > 0 && <>
      <p className="text-slate-400">Development sandbox: card payments accept only published test card numbers and never charge a real card.</p>
      <label className="flex flex-col">Sandbox test card<input value={card} onChange={e => setCard(e.target.value)} inputMode="numeric" autoComplete="off" className="rounded border border-slate-600 bg-[#06182B] px-2 py-1" /></label>
      <table className="w-full text-left"><caption className="sr-only">Your invoices</caption>
        <thead><tr>{['Invoice', 'Issued', 'Due', 'Total', 'Paid', 'Balance', 'Status', ''].map(h => <th key={h} scope="col" className="p-1">{h}</th>)}</tr></thead>
        <tbody>{state.items.map(inv => <tr key={inv.invoiceId} className="border-t border-slate-800"><td className="p-1">{inv.invoiceNumber}</td><td className="p-1">{inv.issueDate}</td>
          <td className="p-1">{inv.dueDate}</td><td className="p-1">${inv.total}</td><td className="p-1">${inv.amountPaid}</td><td className="p-1">${inv.balanceDue}</td><td className="p-1">{inv.status.replace('_', ' ').toLowerCase()}</td>
          <td className="p-1 space-x-2">{ISSUED_INVOICE_STATUSES.includes(inv.status) && <button type="button" className="underline" aria-label={`Download invoice ${inv.invoiceNumber || inv.invoiceId} (PDF)`} onClick={() => download(inv)}>Download PDF</button>}{Number(inv.balanceDue) > 0 && inv.status !== 'VOID' && <button type="button" className="underline" disabled={!card} onClick={() => pay(inv)}>Pay ${inv.balanceDue} (sandbox)</button>}</td></tr>)}</tbody></table>
    </>}
  </section>;
}
