import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookkeepingRequestError, bookkeepingService, type ChartOfAccountItem, type JournalEntryItem } from '../../services/bookkeepingService';
import { LedgerControlsPanel, ledgerMessage } from './LedgerControlsPanel';
import { LedgerReportsPanel } from './LedgerReportsPanel';
import { BookToTaxPanel } from './BookToTaxPanel';

const input = 'rounded-lg border border-slate-600 bg-[#06182B] px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-300';
const button = 'rounded-lg border border-slate-600 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50';

/** A client and tax year chosen by the reviewer; the server checks the reviewer's assignment on every request. */
export function parseLedgerScope(clientId: string, taxYear: string): { clientId: string; taxYear: number } | null {
  const client = clientId.trim();
  const year = Number(taxYear);
  if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(client) || !Number.isInteger(year) || year < 2022 || year > 2200) return null;
  return { clientId: client, taxYear: year };
}

/**
 * Independent review of ledger work prepared by others: prepared journal entries (approve, return, reject), accounting
 * periods, reversals, the book-to-tax mapping, adjustments and workpapers, and the read-only journal search, general
 * ledger and financial audit history. The reviewer is the checker in each
 * maker-checker step; the server enforces the reviewer role, the assignment and that the preparer cannot approve.
 */
export function ReviewerLedgerReviewPanel() {
  const [form, setForm] = useState({ clientId: '', taxYear: '' });
  const [scope, setScope] = useState<{ clientId: string; taxYear: number } | null>(null);
  // loadedKey: the scope whose entries are on screen. A refresh of the same scope keeps the review controls mounted, so
  // their confirmations and refusals stay visible; a different client or year never shows the previous scope's entries.
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error' | 'disabled'; entries: JournalEntryItem[]; loadedKey?: string; message?: string }>({ status: 'idle', entries: [] });
  const [accounts, setAccounts] = useState<ChartOfAccountItem[]>([]);
  const latest = useRef('');

  const load = useCallback(() => {
    if (!scope) return;
    const key = scope.clientId + '|' + scope.taxYear;
    latest.current = key;
    setState(s => s.loadedKey === key ? { ...s, status: 'loading' } : { status: 'loading', entries: [] });
    bookkeepingService.searchJournal(scope.clientId, scope.taxYear, {})
      .then(r => { if (latest.current === key) setState({ status: 'ready', entries: Array.isArray(r?.entries) ? r.entries : [], loadedKey: key }); })
      .catch(e => { if (latest.current !== key) return;
        setState(e instanceof BookkeepingRequestError && e.status === 503 ? { status: 'disabled', entries: [] } : { status: 'error', entries: [], message: ledgerMessage(e) }); });
    bookkeepingService.getChartOfAccounts(scope.clientId, scope.taxYear)
      .then(r => { if (latest.current === key) setAccounts((r?.accounts ?? []).filter(a => a.isActive !== false)); })
      .catch(() => { if (latest.current === key) setAccounts([]); });
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  const chosen = parseLedgerScope(form.clientId, form.taxYear);
  return <section aria-labelledby="reviewer-ledger-heading" className="space-y-3 rounded-2xl border border-slate-700/60 bg-[#0D2745] p-4 text-xs text-slate-300">
    <h3 id="reviewer-ledger-heading" className="font-mono font-bold uppercase tracking-wider text-slate-300">Ledger review</h3>
    <p>Approve, return or reject journal entries and book-to-tax work prepared by others. You cannot approve your own work.</p>
    <form aria-label="Open a client ledger for review" className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); if (chosen) { setAccounts([]); setScope(chosen); } }}>
      <label className="flex flex-col">Client identifier<input className={input} value={form.clientId} maxLength={128} onChange={e => setForm({ ...form, clientId: e.target.value })} /></label>
      <label className="flex flex-col">Ledger tax year<input className={input} inputMode="numeric" value={form.taxYear} maxLength={4} onChange={e => setForm({ ...form, taxYear: e.target.value })} /></label>
      <button className={button} disabled={!chosen}>Open ledger</button>
      {!chosen && (form.clientId || form.taxYear) && <span role="status">Enter a client identifier and a tax year from 2022.</span>}
    </form>
    {scope && <h4 className="font-bold text-white">{scope.clientId} · {scope.taxYear}</h4>}
    {state.status === 'loading' && !state.loadedKey && <p role="status">Loading the ledger for review…</p>}
    {state.status === 'disabled' && <p role="status">The durable ledger is not enabled in this environment, so there is nothing to review.</p>}
    {state.status === 'error' && <p role="alert">{state.message} <button type="button" className="underline" onClick={load}>Retry</button></p>}
    {scope && state.loadedKey === scope.clientId + '|' + scope.taxYear && (state.status === 'ready' || state.status === 'loading') && <>
      <LedgerControlsPanel clientId={scope.clientId} taxYear={scope.taxYear} entries={state.entries} onChanged={load} />
      <BookToTaxPanel clientId={scope.clientId} taxYear={scope.taxYear} accounts={accounts} />
      <LedgerReportsPanel clientId={scope.clientId} taxYear={scope.taxYear} accounts={accounts} />
    </>}
  </section>;
}
