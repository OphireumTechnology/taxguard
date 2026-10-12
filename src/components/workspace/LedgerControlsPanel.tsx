import React, { useCallback, useEffect, useRef, useState } from 'react';
import { bookkeepingService, BookkeepingRequestError, type AccountingPeriodItem, type JournalEntryItem } from '../../services/bookkeepingService';

const MESSAGES: Record<string, string> = {
  MAKER_CHECKER_VIOLATION: 'An independent reviewer must perform this action; the person who prepared or closed it cannot.',
  PERIOD_HAS_UNAPPROVED_ENTRIES: 'Review or resolve every prepared entry in this period before closing it.',
  PERIOD_HARD_CLOSED: 'That date falls in a hard-closed period. An independent reviewer must reopen it first.',
  PERIOD_SOFT_CLOSED: 'That date falls in a soft-closed period, which accepts only reviewed adjusting or reversing entries.',
  PERIOD_CONFLICT: 'The dates overlap an existing period, or that name is already used with different dates.',
  PERIOD_INVALID: 'Enter a period name and dates inside the selected tax year.',
  PERIOD_STATUS_TRANSITION_INVALID: 'That status change is not allowed for this period.',
  REOPEN_REASON_REQUIRED: 'Enter a justification of 5 to 500 characters.',
  REVERSAL_REASON_REQUIRED: 'Enter a reason of 5 to 500 characters.',
  ENTRY_ALREADY_REVERSED: 'This entry already has a reversing entry.',
  INVALID_POSTING_DATE: 'The reversal date must be a valid date on or after the original entry.',
  TRANSACTION_ALREADY_POSTED: 'This transaction is already in the ledger. Reverse its entry to change the categorization.',
  ACCOUNT_NOT_IN_CHART: 'The selected account is not an active account in this client\'s chart of accounts.',
};
export function ledgerMessage(error: unknown): string {
  if (error instanceof BookkeepingRequestError) {
    if (error.status === 403 && error.code !== 'MAKER_CHECKER_VIOLATION') return 'Your role is not authorized for this ledger action.';
    if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
    if (error.status === 404) return 'That record was not found for this client.';
  }
  return 'The ledger service did not confirm this action. Refresh and try again.';
}
/** Entries eligible for each control; the server re-checks every rule. */
export function ledgerActions(entry: JournalEntryItem) {
  return {
    approve: entry.status === 'PREPARED',
    reverse: entry.status === 'POSTED' && !entry.reversedByEntryId && !entry.reversalOfEntryId,
  };
}

const input = 'rounded-lg border border-slate-600 bg-[#06182B] px-2 py-1 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-300';
const button = 'rounded-lg border border-slate-600 px-2 py-1 text-xs font-bold text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-300 disabled:opacity-50';

export function LedgerControlsPanel({ clientId, taxYear, entries, onChanged }: { clientId: string; taxYear: number; entries: JournalEntryItem[]; onChanged: () => void }) {
  const [periods, setPeriods] = useState<{ status: 'loading' | 'ready' | 'error'; items: AccountingPeriodItem[] }>({ status: 'loading', items: [] });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPeriod, setNewPeriod] = useState({ periodName: '', startDate: '', endDate: '' });
  const [reopen, setReopen] = useState<{ id: string; reason: string } | null>(null);
  const [reversal, setReversal] = useState<{ id: string; postingDate: string; reason: string } | null>(null);
  const scopeKey = clientId + '|' + taxYear;
  const latest = useRef(scopeKey); latest.current = scopeKey;

  const loadPeriods = useCallback(() => {
    const key = scopeKey;
    setPeriods({ status: 'loading', items: [] });
    bookkeepingService.getPeriods(clientId, taxYear)
      .then(result => { if (latest.current === key) setPeriods({ status: 'ready', items: Array.isArray(result?.periods) ? result.periods : [] }); })
      .catch(() => { if (latest.current === key) setPeriods({ status: 'error', items: [] }); });
  }, [clientId, taxYear, scopeKey]);
  useEffect(() => { setNotice(null); setReopen(null); setReversal(null); loadPeriods(); }, [loadPeriods]);

  const run = async (operation: () => Promise<unknown>, success: string): Promise<boolean> => {
    if (busy) return false;
    const key = scopeKey;
    setBusy(true); setNotice(null);
    try {
      await operation();
      if (latest.current !== key) return false;
      setNotice({ error: false, text: success }); setReopen(null); setReversal(null); loadPeriods(); onChanged();
      return true;
    } catch (error) {
      if (latest.current === key) setNotice({ error: true, text: ledgerMessage(error) });
      return false;
    } finally { if (latest.current === key) setBusy(false); }
  };

  const pending = entries.filter(e => ledgerActions(e).approve);
  const reversible = entries.filter(e => ledgerActions(e).reverse);
  return <section aria-labelledby="ledger-controls-heading" className="space-y-4 rounded-2xl border border-slate-700/60 bg-[#0D2745] p-4 text-xs text-slate-300">
    <h3 id="ledger-controls-heading" className="font-mono font-bold uppercase tracking-wider text-slate-300">Periods &amp; corrections</h3>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={notice.error ? 'text-red-300' : 'text-emerald-300'}>{notice.text}</p>}

    <div className="space-y-2">
      <h4 className="font-bold text-white">Accounting periods ({taxYear})</h4>
      {periods.status === 'loading' && <p role="status">Loading periods…</p>}
      {periods.status === 'error' && <p role="alert">Periods could not be loaded. <button type="button" className="underline" onClick={loadPeriods}>Retry</button></p>}
      {periods.status === 'ready' && periods.items.length === 0 && <p>No accounting periods are defined for this tax year.</p>}
      {periods.status === 'ready' && periods.items.length > 0 && <ul className="space-y-2">{periods.items.map(p => <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-800 bg-[#06182B] p-2">
        <span className="font-mono text-white">{p.periodName}</span><span>{p.startDate} – {p.endDate}</span><span className="font-bold">{p.status.replace('_', ' ')}</span>
        {p.status === 'OPEN' && <button type="button" className={button} disabled={busy} onClick={() => run(() => bookkeepingService.closePeriod(clientId, taxYear, p.id, 'SOFT_CLOSED'), `${p.periodName} soft-closed.`)}>Soft close</button>}
        {p.status !== 'HARD_CLOSED' && <button type="button" className={button} disabled={busy} onClick={() => run(() => bookkeepingService.closePeriod(clientId, taxYear, p.id, 'HARD_CLOSED'), `${p.periodName} hard-closed.`)}>Hard close</button>}
        {p.status !== 'OPEN' && <button type="button" className={button} disabled={busy} onClick={() => setReopen({ id: p.id, reason: '' })}>Reopen…</button>}
        {reopen?.id === p.id && <form className="flex w-full flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void run(() => bookkeepingService.reopenPeriod(clientId, taxYear, p.id, reopen.reason), `${p.periodName} reopened.`); }}>
          <label className="flex flex-1 flex-col">Justification (recorded)<input className={input} required minLength={5} maxLength={500} value={reopen.reason} onChange={e => setReopen({ id: p.id, reason: e.target.value })} /></label>
          <button className={button} disabled={busy || reopen.reason.trim().length < 5}>Confirm reopen</button><button type="button" className={button} onClick={() => setReopen(null)}>Cancel</button>
        </form>}
      </li>)}</ul>}
      <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void run(() => bookkeepingService.openPeriod(clientId, taxYear, newPeriod.periodName.trim(), newPeriod.startDate, newPeriod.endDate), 'Period defined.').then(ok => { if (ok) setNewPeriod({ periodName: '', startDate: '', endDate: '' }); }); }}>
        <label className="flex flex-col">Period name<input className={input} required maxLength={32} pattern="[A-Za-z0-9_\-]+" placeholder={`${taxYear}-Q1`} value={newPeriod.periodName} onChange={e => setNewPeriod({ ...newPeriod, periodName: e.target.value })} /></label>
        <label className="flex flex-col">Start<input type="date" className={input} required min={`${taxYear}-01-01`} max={`${taxYear}-12-31`} value={newPeriod.startDate} onChange={e => setNewPeriod({ ...newPeriod, startDate: e.target.value })} /></label>
        <label className="flex flex-col">End<input type="date" className={input} required min={`${taxYear}-01-01`} max={`${taxYear}-12-31`} value={newPeriod.endDate} onChange={e => setNewPeriod({ ...newPeriod, endDate: e.target.value })} /></label>
        <button className={button} disabled={busy}>Define period</button>
      </form>
    </div>

    <div className="space-y-2">
      <h4 className="font-bold text-white">Awaiting independent review ({pending.length})</h4>
      {pending.length === 0 ? <p>No prepared entries are waiting for review.</p> : <ul className="space-y-1">{pending.map(e => <li key={e.id} className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-white">{e.entryNumber}</span><span>{e.postingDate}</span><span>{e.description}</span><span>${e.totalDebit.toFixed(2)}</span><span>Prepared by {e.creatorUid}</span>
        <button type="button" className={button} disabled={busy} aria-label={`Approve ${e.entryNumber}`} onClick={() => run(() => bookkeepingService.approveJournalEntry(clientId, taxYear, e.id), `${e.entryNumber} approved and posted.`)}>Approve</button>
      </li>)}</ul>}
    </div>

    <div className="space-y-2">
      <h4 className="font-bold text-white">Correct a posted entry</h4>
      <p>Posted entries are never edited. A reversing entry with debits and credits swapped is prepared and must be approved by an independent reviewer.</p>
      <label className="flex flex-col">Posted entry<select className={input} value={reversal?.id ?? ''} onChange={e => setReversal(e.target.value ? { id: e.target.value, postingDate: reversible.find(r => r.id === e.target.value)?.postingDate ?? '', reason: '' } : null)}>
        <option value="">Select an entry</option>{reversible.map(e => <option key={e.id} value={e.id}>{e.entryNumber} · {e.postingDate} · {e.description}</option>)}</select></label>
      {reversal && <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); void run(() => bookkeepingService.reverseJournalEntry(clientId, taxYear, reversal.id, reversal.postingDate, reversal.reason), 'Reversing entry prepared for review.'); }}>
        <label className="flex flex-col">Reversal date<input type="date" className={input} required value={reversal.postingDate} onChange={e => setReversal({ ...reversal, postingDate: e.target.value })} /></label>
        <label className="flex flex-1 flex-col">Reason (recorded)<input className={input} required minLength={5} maxLength={500} value={reversal.reason} onChange={e => setReversal({ ...reversal, reason: e.target.value })} /></label>
        <button className={button} disabled={busy || reversal.reason.trim().length < 5}>Prepare reversal</button>
      </form>}
    </div>
  </section>;
}
