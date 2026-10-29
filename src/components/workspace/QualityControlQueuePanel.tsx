import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RETURN_RISK_REASON_LABELS, TaxEngineRequestError, taxEngineMessage, taxEngineService, type QcContext, type QcQueueItem, type QcResultInput } from '../../services/taxEngineService';

/**
 * The signed-in staff member's quality control queue (proposal 20261019170000): approved draft return versions a
 * practice manager assigned to them as a third person. For each item of the practice's approved checklist the
 * reviewer records PASS or FAIL; any FAIL returns the version to its preparer with a note. The server checks
 * independence, the QC authority and the checklist; nothing here signs or files a return (return use: BLOCKED).
 * Hidden when the durable store is not enabled in this environment.
 */
export function qcOutcomeText(outcome: 'QC_PASSED' | 'QC_RETURNED' | null): string {
  return outcome === 'QC_PASSED' ? 'passed' : outcome === 'QC_RETURNED' ? 'returned to the preparer' : 'not recorded yet';
}

export function QualityControlQueuePanel() {
  const [queue, setQueue] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; items: QcQueueItem[]; message?: string }>({ status: 'loading', items: [] });
  const [open, setOpen] = useState<{ id: string; data?: QcContext; message?: string } | null>(null);
  const [results, setResults] = useState<Record<string, QcResultInput>>({});
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const load = useCallback((): Promise<string | null> => {
    setQueue(q => ({ ...q, status: q.status === 'off' ? 'off' : 'loading' }));
    return taxEngineService.qcQueue().then(items => { setQueue({ status: 'ready', items }); return null; })
      .catch(e => {
        if (e instanceof TaxEngineRequestError && (e.status === 503 || e.status === 403)) { setQueue({ status: 'off', items: [] }); return null; }
        const message = taxEngineMessage(e); setQueue({ status: 'error', items: [], message }); return message;
      });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openItem = (item: QcQueueItem) => {
    if (open?.id === item.returnVersionId) { setOpen(null); return; }
    setOpen({ id: item.returnVersionId }); setResults({}); setNote('');
    taxEngineService.qcContext(item.returnVersionId).then(data => setOpen(o => o?.id === item.returnVersionId ? { id: item.returnVersionId, data } : o))
      .catch(e => setOpen(o => o?.id === item.returnVersionId ? { id: item.returnVersionId, message: taxEngineMessage(e) } : o));
  };
  const record = async (item: QcQueueItem, ctx: QcContext) => {
    if (busy || !ctx.checklist) return;
    const missing = ctx.checklist.items.filter(i => !results[i.code]);
    if (missing.length > 0) { setNotice({ error: true, text: `Choose pass or fail for: ${missing.map(i => i.text).join('; ')}` }); return; }
    setBusy(true); setNotice(null);
    try {
      const list = ctx.checklist.items.map(i => {
        const r = results[i.code]; const itemNote = r.note?.trim();
        return itemNote ? { code: i.code, result: r.result, note: itemNote } : { code: i.code, result: r.result };
      });
      const review = await taxEngineService.recordQc(item.returnVersionId, list, note.trim() || undefined);
      setOpen(null);
      const failure = await load();
      const text = `Quality control of ${item.templateId} version ${item.version}: ${qcOutcomeText(review.outcome)}.`;
      setNotice(failure === null ? { error: false, text } : { error: true, text: `${text} The queue could not be refreshed: ${failure}` });
      setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) heading.current?.focus(); }, 0);
    } catch (e) { setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { setBusy(false); }
  };

  if (queue.status === 'off') return null;
  return <section aria-labelledby="qc-queue-heading" className="tg-acct-card">
    <h2 id="qc-queue-heading" ref={heading} tabIndex={-1}>My quality control queue <button type="button" disabled={busy} onClick={() => void load()}>Refresh</button></h2>
    <p>Approved draft returns assigned to you for independent quality control. Record pass or fail for every item of the practice's approved checklist. Return use: BLOCKED.</p>
    <div role="status" aria-label="Quality control result">{notice && !notice.error && <p>{notice.text}</p>}</div>
    {notice?.error && <p role="alert">{notice.text}</p>}
    {queue.status === 'loading' && queue.items.length === 0 && <p role="status">Loading your quality control queue…</p>}
    {queue.status === 'error' && <p role="alert">{queue.message}</p>}
    {queue.status === 'ready' && queue.items.length === 0 && <p>No draft return is assigned to you for quality control.</p>}
    {queue.items.map(item => {
      const name = `${item.templateId} version ${item.version}`; const isOpen = open?.id === item.returnVersionId;
      return <article key={item.assignmentId} aria-label={`Quality control of ${name}`}>
        <h3>{name} · tax year {item.taxYear} · {qcOutcomeText(item.latestOutcome)}</h3>
        <button type="button" aria-expanded={isOpen} aria-controls={`qc-form-${item.returnVersionId}`} onClick={() => openItem(item)}>
          {isOpen ? 'Close' : 'Review'} quality control of {name}</button>
        <div id={`qc-form-${item.returnVersionId}`}>{isOpen && <QcForm item={item} name={name} state={open!} results={results} setResults={setResults}
          note={note} setNote={setNote} busy={busy} onRecord={ctx => void record(item, ctx)} />}</div>
      </article>;
    })}
  </section>;
}

function QcForm({ item, name, state, results, setResults, note, setNote, busy, onRecord }: { item: QcQueueItem; name: string; state: { data?: QcContext; message?: string };
  results: Record<string, QcResultInput>; setResults: React.Dispatch<React.SetStateAction<Record<string, QcResultInput>>>; note: string; setNote: (v: string) => void;
  busy: boolean; onRecord: (ctx: QcContext) => void }) {
  if (state.message) return <p role="alert">{state.message}</p>;
  const ctx = state.data;
  if (!ctx) return <p role="status">Loading the version…</p>;
  const v = ctx.returnVersion;
  return <form aria-label={`Quality control checklist for ${name}`} onSubmit={e => { e.preventDefault(); onRecord(ctx); }}>
    <p>Case {item.caseId} · forms {v.forms.map(f => `${f.formId} (${f.formVersion})`).join(', ')} · calculation verification {ctx.verification?.result ?? 'not recorded'}
      · risk {ctx.risk ? `${ctx.risk.outcome.replace(/_/g, ' ').toLowerCase()} (${ctx.risk.reasonCodes.map(c => RETURN_RISK_REASON_LABELS[c] ?? c).join(' ')})` : 'not assessed'}</p>
    {!ctx.checklist ? <p role="alert">The practice has no approved quality control checklist, so quality control cannot be recorded.</p> : <>
      {ctx.checklist.items.map(i => {
        const r = results[i.code]; const set = (patch: Partial<QcResultInput>) => setResults(all => ({ ...all, [i.code]: { code: i.code, result: 'PASS', ...all[i.code], ...patch } }));
        return <fieldset key={i.code}>
          <legend>{i.text}</legend>
          <label><input type="radio" name={`qc-${item.returnVersionId}-${i.code}`} checked={r?.result === 'PASS'} onChange={() => set({ result: 'PASS' })} /> Pass</label>
          <label><input type="radio" name={`qc-${item.returnVersionId}-${i.code}`} checked={r?.result === 'FAIL'} onChange={() => set({ result: 'FAIL' })} /> Fail</label>
          <label>Note on this item<input value={r?.note ?? ''} disabled={!r} onChange={e => set({ note: e.target.value })} /></label>
        </fieldset>;
      })}
      <label>Note to the preparer (required when any item fails)<textarea value={note} onChange={e => setNote(e.target.value)} /></label>
      <button disabled={busy}>Record quality control of {name}</button>
      <p>Checklist version {ctx.checklist.checklistVersion}. Recording quality control does not sign, file or transmit the return.</p>
    </>}
  </form>;
}
