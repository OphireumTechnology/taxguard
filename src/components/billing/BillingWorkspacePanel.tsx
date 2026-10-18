import React, { useCallback, useEffect, useRef, useState } from 'react';
import { billingApi, billingMessage, ISSUED_INVOICE_STATUSES, newBillingKey, saveBlob, type AgingRow, type Invoice } from '../../services/billingApiService';

/** Staff billing: AR aging, client invoices, draft / submit / approve / return / void, payments and credits. */
export function BillingWorkspacePanel() {
  const [aging, setAging] = useState<{ status: 'loading' | 'ready' | 'error'; rows: AgingRow[]; pending: number; message?: string }>({ status: 'loading', rows: [], pending: 0 });
  const [clientId, setClientId] = useState('');
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [catalog, setCatalog] = useState<Array<{ serviceCode: string; name: string; baseFee: string }>>([]);
  const [line, setLine] = useState({ serviceCode: '', quantity: '1', unitRate: '', overrideReason: '' });
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [pay, setPay] = useState({ amount: '', method: 'CHECK' });
  // One idempotency key per refund operation (created when the form opens, reused for retries of that
  // form). A refused attempt records nothing, so a corrected resubmission is accepted; if a timed-out
  // attempt was in fact recorded, a changed resubmission is refused as key reuse instead of duplicating.
  const [refund, setRefund] = useState<{ paymentId: string; amount: string; reason: string; key: string } | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const keys = useRef<Record<string, string>>({});
  const keyFor = (k: string) => (keys.current[k] ??= newBillingKey());
  const loadAging = useCallback(() => {
    billingApi.aging().then(r => setAging({ status: 'ready', rows: r.clients, pending: r.pendingApproval })).catch(e => setAging({ status: 'error', rows: [], pending: 0, message: billingMessage(e) }));
    billingApi.catalog().then(r => setCatalog(r.items.filter((s: any) => s.isActive))).catch(() => setCatalog([]));
  }, []);
  useEffect(() => { loadAging(); }, [loadAging]);
  const loadInvoices = useCallback((id: string) => { if (!id) return; billingApi.invoices(id).then(r => setInvoices(r.items)).catch(e => { setInvoices([]); setNotice({ error: true, text: billingMessage(e) }); }); }, []);
  const run = async (k: string, op: () => Promise<unknown>, text: string): Promise<boolean> => {
    if (busy) return false;
    setBusy(true); setNotice(null);
    try { await op(); delete keys.current[k]; setNotice({ error: false, text }); loadInvoices(clientId); loadAging(); return true; }
    catch (e) { setNotice({ error: true, text: billingMessage(e) }); return false; }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="billing-heading" className="tg-manager-card">
    <h2 id="billing-heading">Billing</h2>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    <h3>Accounts receivable aging</h3>
    {aging.status === 'loading' && <p role="status">Loading receivables…</p>}
    {aging.status === 'error' && <p role="alert">{aging.message}</p>}
    {aging.status === 'ready' && <><p>{aging.pending} invoice(s) awaiting approval.</p>
      {aging.rows.length === 0 ? <p role="status">No open receivables for your clients.</p> : <div className="tg-manager-scroll"><table><caption className="sr-only">Receivables by age</caption>
        <thead><tr>{['Client', 'Total due', 'Current', '1–30', '31–60', '61–90', '90+', 'Open'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{aging.rows.map(r => <tr key={r.clientId}><td><button type="button" onClick={() => { setClientId(r.clientId); loadInvoices(r.clientId); }}>{r.clientName || r.clientId}</button></td>
          <td>${r.totalDue}</td><td>${r.current}</td><td>${r.days1to30}</td><td>${r.days31to60}</td><td>${r.days61to90}</td><td>${r.over90}</td><td>{r.openInvoices}</td></tr>)}</tbody></table></div>}</>}
    <form className="tg-manager-controls" onSubmit={e => { e.preventDefault(); loadInvoices(clientId.trim()); }}>
      <label>Client identifier<input value={clientId} maxLength={64} onChange={e => setClientId(e.target.value)} /></label><button>Open client billing</button>
    </form>
    {invoices && <>
      <form className="tg-manager-controls" onSubmit={e => { e.preventDefault(); void run('create', () => billingApi.create(clientId, dueDate, keyFor('create')), 'Draft invoice created.'); }}>
        <label>New invoice due date<input type="date" required value={dueDate} onChange={e => setDueDate(e.target.value)} /></label><button disabled={busy}>Create draft invoice</button>
      </form>
      {invoices.length === 0 && <p role="status">No invoices for this client.</p>}
      {invoices.map(inv => <article key={inv.invoiceId} className="tg-manager-card">
        <h4>{inv.invoiceNumber ?? 'Draft'} · {inv.status} · total ${inv.total} · balance ${inv.balanceDue} · due {inv.dueDate}</h4>
        {inv.reviewNote && <p>Reviewer note: {inv.reviewNote}</p>}
        {ISSUED_INVOICE_STATUSES.includes(inv.status) && <p><button type="button" disabled={busy} aria-label={`Download client invoice document ${inv.invoiceNumber ?? inv.invoiceId} (PDF)`}
          onClick={() => { billingApi.document(clientId, inv.invoiceId).then(blob => { saveBlob(blob, `invoice-${(inv.invoiceNumber ?? inv.invoiceId).replace(/[^A-Za-z0-9_-]/g, '_')}.pdf`); setNotice({ error: false, text: 'Client invoice document downloaded (client fields only). Nothing was sent to the client.' }); }).catch(e => setNotice({ error: true, text: billingMessage(e) })); }}>Download client invoice (PDF)</button></p>}
        <ul>{inv.lines.map(l => <li key={l.lineNo}>{l.description} — {l.quantity} × ${l.unitRate} = ${l.amount}{l.rateOverrideReason ? ` (override: ${l.rateOverrideReason})` : ''}</li>)}</ul>
        {inv.status === 'DRAFT' && <form onSubmit={e => { e.preventDefault(); void run('line', () => billingApi.addLine(clientId, inv.invoiceId, { serviceCode: line.serviceCode, quantity: line.quantity,
            ...(line.unitRate ? { unitRate: line.unitRate, overrideReason: line.overrideReason } : {}) }), 'Line added.'); }}>
          <label>Service<select required value={line.serviceCode} onChange={e => setLine({ ...line, serviceCode: e.target.value })}><option value="">Select</option>
            {catalog.map(s => <option key={s.serviceCode} value={s.serviceCode}>{s.name} (${s.baseFee})</option>)}</select></label>
          <label>Quantity<input required inputMode="decimal" value={line.quantity} onChange={e => setLine({ ...line, quantity: e.target.value })} /></label>
          <label>Rate override (optional)<input inputMode="decimal" value={line.unitRate} onChange={e => setLine({ ...line, unitRate: e.target.value })} /></label>
          {line.unitRate && <label>Override reason<input required minLength={5} value={line.overrideReason} onChange={e => setLine({ ...line, overrideReason: e.target.value })} /></label>}
          <button disabled={busy}>Add line</button>
          <button type="button" disabled={busy} onClick={() => run('submit', () => billingApi.transition(clientId, inv.invoiceId, 'submit', inv.rowVersion), 'Submitted for approval.')}>Submit for approval</button>
        </form>}
        {inv.status === 'PENDING_APPROVAL' && <div>
          <label>Note (required to return)<input value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
          <button type="button" disabled={busy} onClick={() => run('approve', () => billingApi.transition(clientId, inv.invoiceId, 'approve', inv.rowVersion), 'Invoice approved and issued.')}>Approve and issue</button>
          <button type="button" disabled={busy || note.trim().length < 5} onClick={() => run('return', () => billingApi.transition(clientId, inv.invoiceId, 'return', inv.rowVersion, note), 'Returned to preparer.')}>Return</button>
        </div>}
        {['ISSUED', 'PARTIALLY_PAID', 'PAST_DUE'].includes(inv.status) && <form onSubmit={e => { e.preventDefault(); void run('pay-' + inv.invoiceId, () => billingApi.recordPayment(clientId, inv.invoiceId, pay.amount, pay.method, keyFor('pay-' + inv.invoiceId)), 'Payment recorded.'); }}>
          <label>Payment amount<input required inputMode="decimal" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} /></label>
          <label>Method<select value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })}>{['CHECK', 'ACH', 'WIRE'].map(m => <option key={m}>{m}</option>)}</select></label>
          <button disabled={busy}>Record payment</button>
          <button type="button" disabled={busy || !pay.amount || note.trim().length < 5} onClick={() => run('credit', () => billingApi.requestCredit(clientId, inv.invoiceId, pay.amount, note), 'Credit requested for approval.')}>Request credit (amount + note)</button>
          <label>Note<input value={note} maxLength={500} onChange={e => setNote(e.target.value)} /></label>
        </form>}
        {inv.credits.filter(cr => cr.status === 'REQUESTED').map(cr => <p key={cr.creditId}>Credit ${cr.amount} requested by {cr.requestedBy}: {cr.reason}
          <button type="button" disabled={busy} onClick={() => run('credit-d', () => billingApi.decideCredit(clientId, cr.creditId, true), 'Credit applied.')}>Apply</button>
          <button type="button" disabled={busy} onClick={() => run('credit-d', () => billingApi.decideCredit(clientId, cr.creditId, false), 'Credit rejected.')}>Reject</button></p>)}
        {inv.payments.length > 0 && <ul aria-label={`Payments for ${inv.invoiceNumber ?? inv.invoiceId}`}>{inv.payments.map(p => {
          const refundable = (Math.round(Number(p.amount) * 100) - Math.round(Number(p.refundedAmount) * 100)) / 100;
          const open = refund?.paymentId === p.paymentId;
          return <li key={p.paymentId}>Payment ${p.amount} ({p.method.replaceAll('_', ' ').toLowerCase()}, {p.status.toLowerCase()}){Number(p.refundedAmount) > 0 && <> · refunded ${p.refundedAmount}</>}
            {refundable > 0 && !open && <button type="button" disabled={busy} aria-label={`Record a refund for payment ${p.paymentId}`} onClick={() => setRefund({ paymentId: p.paymentId, amount: '', reason: '', key: newBillingKey() })}>Record refund</button>}
            {open && <form aria-label={`Refund for payment ${p.paymentId}`} onSubmit={e => { e.preventDefault(); const r = refund!;
              void run('refund', () => billingApi.recordRefund(clientId, r.paymentId, r.amount.trim(), r.reason.trim(), r.key),
                'Refund recorded. TaxGuard records refunds made outside the system; no money was moved.').then(ok => { if (ok) setRefund(null); }); }}>
              <p>Records money already returned to the client outside TaxGuard (up to ${refundable.toFixed(2)}). A practice manager is required; nothing is sent to a payment provider.</p>
              <label>Refund amount<input inputMode="decimal" required value={refund!.amount} onChange={e => setRefund({ ...refund!, amount: e.target.value })} /></label>
              <label>Refund reason (recorded)<input required minLength={5} maxLength={500} value={refund!.reason} onChange={e => setRefund({ ...refund!, reason: e.target.value })} /></label>
              <button disabled={busy || !/^\d{1,12}(\.\d{1,2})?$/.test(refund!.amount.trim()) || refund!.reason.trim().length < 5}>Record refund</button>
              <button type="button" disabled={busy} onClick={() => setRefund(null)}>Cancel</button>
            </form>}</li>;
        })}</ul>}
      </article>)}
    </>}
  </section>;
}
