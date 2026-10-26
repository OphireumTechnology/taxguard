import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookkeepingRequestError, bookkeepingService, type ChartOfAccountItem, type LedgerWorkQueue } from '../../services/bookkeepingService';
import { ledgerMessage } from './LedgerControlsPanel';
import { LedgerReportsPanel } from './LedgerReportsPanel';
import { BookToTaxPanel } from './BookToTaxPanel';

const money = (cents: number) => (cents < 0 ? '-' : '') + '$' + (Math.abs(cents) / 100).toFixed(2);
type Line = { accountId: string; debit: string; credit: string };
const emptyLines = (): Line[] => [{ accountId: '', debit: '', credit: '' }, { accountId: '', debit: '', credit: '' }];

/** Durable bookkeeper workspace: work queue, journal entries (always reviewed), bank categorization, reconciliation and reports. */
export function BookkeeperLedgerWorkspace({ clientId, taxYear }: { clientId: string; taxYear: number }) {
  const [queue, setQueue] = useState<{ status: 'loading' | 'ready' | 'error' | 'disabled'; data?: LedgerWorkQueue; message?: string }>({ status: 'loading' });
  const [accounts, setAccounts] = useState<ChartOfAccountItem[]>([]);
  const [summary, setSummary] = useState<{ balanced: boolean; netIncome: number; assets: number } | null>(null);
  const [entry, setEntry] = useState({ postingDate: '', description: '', lines: emptyLines() });
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [recon, setRecon] = useState({ accountId: '', statementPeriodStart: '', statementPeriodEnd: '', statementBeginningBalance: '', statementEndingBalance: '' });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const entryKey = useRef(bookkeepingService.newIdempotencyKey());
  // The client and year every response belongs to. The dashboard re-renders this workspace with a new client or year
  // without remounting it, so a slower response for the previous scope is discarded instead of shown under the new one.
  const latest = useRef('');
  const loadedScope = useRef('');
  const load = useCallback(() => {
    const key = clientId + '|' + taxYear;
    latest.current = key;
    if (loadedScope.current !== key) {
      // A new scope starts clean: no previous queue, totals or notice, and no draft that could be submitted to the
      // newly selected client or year by mistake.
      loadedScope.current = key; setQueue({ status: 'loading' }); setAccounts([]); setSummary(null); setNotice(null);
      setCategories({}); setEntry({ postingDate: '', description: '', lines: emptyLines() }); entryKey.current = bookkeepingService.newIdempotencyKey();
      setRecon({ accountId: '', statementPeriodStart: '', statementPeriodEnd: '', statementBeginningBalance: '', statementEndingBalance: '' });
    }
    const current = () => latest.current === key;
    bookkeepingService.getWorkQueue(clientId, taxYear).then(data => { if (current()) setQueue({ status: 'ready', data }); })
      .catch(e => { if (current()) setQueue(e instanceof BookkeepingRequestError && (e.status === 503 || e.code === 'BOOKKEEPER_CAPABILITY_DENIED') ? { status: 'disabled' } : { status: 'error', message: ledgerMessage(e) }); });
    bookkeepingService.getChartOfAccounts(clientId, taxYear).then(r => { if (current()) setAccounts(r.accounts.filter(a => a.isActive !== false)); }).catch(() => { if (current()) setAccounts([]); });
    Promise.all([bookkeepingService.getTrialBalance(clientId, taxYear), bookkeepingService.getFinancialStatements(clientId, taxYear)])
      .then(([tb, fs]) => { if (current()) setSummary({ balanced: tb.trialBalance.isBalanced, netIncome: Math.round(fs.statements.profitAndLoss.netIncome * 100), assets: Math.round(fs.statements.balanceSheet.assets.totalAssets * 100) }); })
      .catch(() => { if (current()) setSummary(null); });
  }, [clientId, taxYear]);
  useEffect(() => { load(); }, [load]);
  if (queue.status === 'disabled') return <p role="status" className="tg-book-empty">The durable ledger workspace is not enabled in this environment. The read-only views remain available.</p>;
  const run = async (op: () => Promise<unknown>, text: string) => {
    if (busy) return false;
    setBusy(true); setNotice(null);
    try { await op(); setNotice({ error: false, text }); load(); return true; } catch (e) { setNotice({ error: true, text: ledgerMessage(e) }); return false; } finally { setBusy(false); }
  };
  const q = queue.data;
  const accountName = (id: string) => { const a = accounts.find(x => x.id === id); return a ? `${a.accountNumber} ${a.accountName}` : id; };
  const totals = entry.lines.reduce((t, l) => ({ d: t.d + Math.round(Number(l.debit || 0) * 100), c: t.c + Math.round(Number(l.credit || 0) * 100) }), { d: 0, c: 0 });
  return <section aria-labelledby="bk-ledger-heading" className="tg-book-card">
    <h2 id="bk-ledger-heading">Ledger workspace — {clientId} / {taxYear}</h2>
    <p>Entries and categorizations you create are held for independent review before they post.</p>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {queue.status === 'loading' && <p role="status">Loading work queue…</p>}
    {queue.status === 'error' && <p role="alert">{queue.message}</p>}
    {summary && <p>Trial balance {summary.balanced ? 'balanced' : 'NOT balanced'} · net income {money(summary.netIncome)} · total assets {money(summary.assets)} (posted entries only)</p>}
    {q && <>
      <h3>Work queue</h3>
      <ul>
        <li>{q.uncategorized.length} bank transaction(s) to categorize{q.possibleDuplicates ? `, ${q.possibleDuplicates} possible duplicate(s)` : ''}</li>
        <li>{q.awaitingReview.length} entr{q.awaitingReview.length === 1 ? 'y' : 'ies'} awaiting reviewer approval</li>
        <li>{q.returnedToMe.length} entr{q.returnedToMe.length === 1 ? 'y' : 'ies'} returned to you for correction</li>
        <li>{q.openReconciliations.length} reconciliation(s) in progress</li>
      </ul>
      {q.returnedToMe.map(e => <p key={e.entryId}>{e.entryNumber} {e.description} — reviewer: {e.reviewNote ?? 'no note'}</p>)}
      <h3>Periods</h3>
      {q.periods.length === 0 ? <p>No periods are defined for {taxYear}.</p> : <table><caption className="sr-only">Period close visibility</caption><thead><tr>{['Period', 'Dates', 'Status', 'Awaiting review', 'Uncategorized'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{q.periods.map(p => <tr key={p.periodId}><td>{p.periodName}</td><td>{p.startDate} – {p.endDate}</td><td>{p.status.replace('_', ' ').toLowerCase()}</td><td>{p.preparedEntries}</td><td>{p.uncategorizedTransactions}</td></tr>)}</tbody></table>}

      <h3>Bank transactions to categorize</h3>
      {q.uncategorized.length === 0 ? <p>Nothing to categorize.</p> : <table><caption className="sr-only">Uncategorized bank transactions</caption><thead><tr>{['Date', 'Description', 'Amount', 'Category', ''].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{q.uncategorized.map(t => <tr key={t.transactionId}><td>{t.transactionDate}</td><td>{t.description}{t.duplicateStatus === 'POSSIBLE_DUPLICATE' ? ' (possible duplicate)' : ''}</td><td>{money(t.amountCents)}</td>
          <td><select aria-label={`Account for ${t.description}`} value={categories[t.transactionId] ?? ''} onChange={e => setCategories({ ...categories, [t.transactionId]: e.target.value })}><option value="">Select account</option>
            {accounts.filter(a => a.id !== t.accountId).map(a => <option key={a.id} value={a.id}>{a.accountNumber} {a.accountName}</option>)}</select></td>
          <td><button type="button" disabled={busy || !categories[t.transactionId]} onClick={() => run(() => bookkeepingService.categorize(clientId, taxYear, t.transactionId, categories[t.transactionId]), 'Categorization submitted for review.')}>Submit</button></td></tr>)}</tbody></table>}

      <h3>New journal entry</h3>
      <form onSubmit={e => { e.preventDefault(); void run(() => bookkeepingService.postJournalEntry(clientId, taxYear, { postingDate: entry.postingDate, description: entry.description,
          lines: entry.lines.filter(l => l.accountId).map(l => ({ accountId: l.accountId, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })) }, entryKey.current), 'Entry submitted for review.')
        .then(ok => { if (ok) { entryKey.current = bookkeepingService.newIdempotencyKey(); setEntry({ postingDate: '', description: '', lines: emptyLines() }); } }); }}>
        <label>Posting date<input type="date" required min={`${taxYear}-01-01`} max={`${taxYear}-12-31`} value={entry.postingDate} onChange={e => setEntry({ ...entry, postingDate: e.target.value })} /></label>
        <label>Description<input required maxLength={500} value={entry.description} onChange={e => setEntry({ ...entry, description: e.target.value })} /></label>
        {entry.lines.map((l, i) => <fieldset key={i}><legend>Line {i + 1}</legend>
          <label>Account<select value={l.accountId} onChange={e => setEntry({ ...entry, lines: entry.lines.map((x, j) => j === i ? { ...x, accountId: e.target.value } : x) })}><option value="">Select</option>
            {accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} {a.accountName}</option>)}</select></label>
          <label>Debit<input inputMode="decimal" value={l.debit} onChange={e => setEntry({ ...entry, lines: entry.lines.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: e.target.value ? '' : x.credit } : x) })} /></label>
          <label>Credit<input inputMode="decimal" value={l.credit} onChange={e => setEntry({ ...entry, lines: entry.lines.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: e.target.value ? '' : x.debit } : x) })} /></label>
        </fieldset>)}
        <button type="button" onClick={() => setEntry({ ...entry, lines: [...entry.lines, { accountId: '', debit: '', credit: '' }] })}>Add line</button>
        <p role="status">Debits {money(totals.d)} · Credits {money(totals.c)} {totals.d === totals.c && totals.d > 0 ? '· balanced' : '· not balanced'}</p>
        <button disabled={busy || totals.d !== totals.c || totals.d === 0}>Submit entry for review</button>
      </form>

      <h3>Reconciliation</h3>
      {q.openReconciliations.map(r => <article key={r.reconciliationId}><p>{accountName(r.accountId)} · {r.statementStart} – {r.statementEnd} · {r.clearedCount} cleared · variance {money(r.varianceCents)}</p>
        <button type="button" disabled={busy || r.varianceCents !== 0} onClick={() => run(() => bookkeepingService.finalizeReconciliation(clientId, taxYear, r.reconciliationId), 'Reconciliation finalized.')}>Finalize</button>
        {q.uncategorized.length > 0 && <p>Categorized transactions can be cleared from the Reconciliation view.</p>}</article>)}
      <form onSubmit={e => { e.preventDefault(); void run(() => bookkeepingService.startReconciliation(clientId, taxYear, recon), 'Reconciliation started.'); }}>
        <label>Account<select required value={recon.accountId} onChange={e => setRecon({ ...recon, accountId: e.target.value })}><option value="">Select</option>
          {accounts.filter(a => ['ASSET', 'LIABILITY'].includes((a as any).accountType)).map(a => <option key={a.id} value={a.id}>{a.accountNumber} {a.accountName}</option>)}</select></label>
        <label>Statement start<input type="date" required value={recon.statementPeriodStart} onChange={e => setRecon({ ...recon, statementPeriodStart: e.target.value })} /></label>
        <label>Statement end<input type="date" required value={recon.statementPeriodEnd} onChange={e => setRecon({ ...recon, statementPeriodEnd: e.target.value })} /></label>
        <label>Beginning balance<input required inputMode="decimal" value={recon.statementBeginningBalance} onChange={e => setRecon({ ...recon, statementBeginningBalance: e.target.value })} /></label>
        <label>Ending balance<input required inputMode="decimal" value={recon.statementEndingBalance} onChange={e => setRecon({ ...recon, statementEndingBalance: e.target.value })} /></label>
        <button disabled={busy}>Start reconciliation</button>
      </form>
    </>}
    <LedgerReportsPanel clientId={clientId} taxYear={taxYear} accounts={accounts} />
    {/* Durable book-to-tax workpapers (proposal 029): mappings and reviewed adjustments; no tax is computed. */}
    <BookToTaxPanel clientId={clientId} taxYear={taxYear} accounts={accounts} />
  </section>;
}
