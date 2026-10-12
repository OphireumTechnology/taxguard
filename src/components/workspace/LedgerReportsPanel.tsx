import React, { useEffect, useRef, useState } from 'react';
import { bookkeepingService, BookkeepingRequestError, type ChartOfAccountItem, type GeneralLedgerAccountItem, type JournalEntryItem, type LedgerHistoryEvent } from '../../services/bookkeepingService';

const input = 'rounded-lg border border-slate-600 bg-[#06182B] px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-300';
const button = 'rounded-lg border border-slate-600 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50';
const money = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
type Load<T> = { status: 'idle' | 'loading' | 'ready' | 'error' | 'unavailable'; data: T };

export function historyLabel(action: string): string {
  return action.replace(/^LEDGER_/, '').toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
}

/** Search, general ledger and audit history for one client and tax year. Read-only. */
export function LedgerReportsPanel({ clientId, taxYear, accounts }: { clientId: string; taxYear: number; accounts: ChartOfAccountItem[] }) {
  const [filter, setFilter] = useState({ q: '', status: '', fromDate: '', toDate: '' });
  const [search, setSearch] = useState<Load<JournalEntryItem[]>>({ status: 'idle', data: [] });
  const [accountId, setAccountId] = useState('');
  const [ledger, setLedger] = useState<Load<GeneralLedgerAccountItem[]>>({ status: 'idle', data: [] });
  const [history, setHistory] = useState<Load<LedgerHistoryEvent[]>>({ status: 'idle', data: [] });
  const scope = clientId + '|' + taxYear; const latest = useRef(scope); latest.current = scope;
  useEffect(() => { setSearch({ status: 'idle', data: [] }); setLedger({ status: 'idle', data: [] }); setHistory({ status: 'idle', data: [] }); setAccountId(''); }, [scope]);

  const load = <T,>(set: (v: Load<T>) => void, empty: T, request: () => Promise<T>) => {
    const key = scope; set({ status: 'loading', data: empty });
    request().then(data => { if (latest.current === key) set({ status: 'ready', data }); })
      .catch(error => { if (latest.current === key) set({ status: error instanceof BookkeepingRequestError && error.status === 503 ? 'unavailable' : 'error', data: empty }); });
  };
  const state = (s: Load<unknown>['status'], what: string) => s === 'loading' ? <p role="status">Loading {what}…</p>
    : s === 'error' ? <p role="alert">The {what} could not be loaded. Try again.</p>
    : s === 'unavailable' ? <p role="status">The {what} requires the durable ledger store, which is not enabled in this environment.</p> : null;

  return <section aria-labelledby="ledger-reports-heading" className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#0D2745] p-4 text-xs text-slate-300">
    <h3 id="ledger-reports-heading" className="font-mono font-bold uppercase tracking-wider text-slate-300">Search, general ledger &amp; history</h3>

    <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); load(setSearch, [], () => bookkeepingService.searchJournal(clientId, taxYear, filter).then(r => r.entries)); }}>
      <label className="flex flex-col">Search text<input className={input} maxLength={100} value={filter.q} onChange={e => setFilter({ ...filter, q: e.target.value })} /></label>
      <label className="flex flex-col">Status<select className={input} value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })}>
        <option value="">Any</option>{['PREPARED', 'POSTED', 'REJECTED', 'CORRECTION_REQUIRED'].map(s => <option key={s} value={s}>{s.replace('_', ' ').toLowerCase()}</option>)}</select></label>
      <label className="flex flex-col">From<input type="date" className={input} value={filter.fromDate} onChange={e => setFilter({ ...filter, fromDate: e.target.value })} /></label>
      <label className="flex flex-col">To<input type="date" className={input} value={filter.toDate} onChange={e => setFilter({ ...filter, toDate: e.target.value })} /></label>
      <button className={button}>Search journal</button>
    </form>
    {state(search.status, 'journal search')}
    {search.status === 'ready' && (search.data.length === 0 ? <p role="status">No journal entries match.</p> : <table className="w-full text-left"><caption className="sr-only">Journal search results</caption>
      <thead><tr>{['Entry', 'Date', 'Description', 'Status', 'Amount'].map(h => <th key={h} scope="col" className="p-1">{h}</th>)}</tr></thead>
      <tbody>{search.data.map(e => <tr key={e.id} className="border-t border-slate-800"><td className="p-1 font-mono">{e.entryNumber}</td><td className="p-1">{e.postingDate}</td>
        <td className="p-1">{e.description}</td><td className="p-1">{e.status}</td><td className="p-1">{money(e.totalDebit)}</td></tr>)}</tbody></table>)}

    <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); load(setLedger, [], () => bookkeepingService.getGeneralLedger(clientId, taxYear, accountId || undefined).then(r => r.accounts)); }}>
      <label className="flex flex-col">Account<select className={input} value={accountId} onChange={e => setAccountId(e.target.value)}>
        <option value="">All accounts with activity</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.accountNumber} · {a.accountName}</option>)}</select></label>
      <button className={button}>Show general ledger</button>
    </form>
    {state(ledger.status, 'general ledger')}
    {ledger.status === 'ready' && (ledger.data.length === 0 ? <p role="status">No posted activity for this selection.</p> : ledger.data.map(a => <div key={a.accountId} className="space-y-1">
      <h4 className="font-bold text-white">{a.accountNumber} · {a.accountName} — ending balance {money(a.endingBalance)}</h4>
      <table className="w-full text-left"><caption className="sr-only">General ledger for {a.accountName}</caption>
        <thead><tr>{['Date', 'Entry', 'Description', 'Debit', 'Credit', 'Balance'].map(h => <th key={h} scope="col" className="p-1">{h}</th>)}</tr></thead>
        <tbody>{a.lines.map((l, i) => <tr key={l.entryId + i} className="border-t border-slate-800"><td className="p-1">{l.postingDate}</td><td className="p-1 font-mono">{l.entryNumber}</td>
          <td className="p-1">{l.description}</td><td className="p-1">{l.debit ? money(l.debit) : ''}</td><td className="p-1">{l.credit ? money(l.credit) : ''}</td><td className="p-1">{money(l.runningBalance)}</td></tr>)}</tbody></table>
    </div>))}

    <button type="button" className={button} onClick={() => load(setHistory, [], () => bookkeepingService.getLedgerHistory(clientId, taxYear).then(r => r.events))}>Show financial audit history</button>
    {state(history.status, 'audit history')}
    {history.status === 'ready' && (history.data.length === 0 ? <p role="status">No ledger activity has been recorded.</p> : <ul className="space-y-1">{history.data.map((h, i) =>
      <li key={h.at + i}><span className="text-white">{historyLabel(h.action)}</span> · {h.actorUid}{h.actorRole ? ` (${h.actorRole})` : ''} · {new Date(h.at).toLocaleString()}</li>)}</ul>)}
  </section>;
}
