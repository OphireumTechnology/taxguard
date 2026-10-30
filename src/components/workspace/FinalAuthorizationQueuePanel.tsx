import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TaxEngineRequestError, finalAuthorizationText, readinessText, taxEngineMessage, taxEngineService, type FinalContext, type FinalOutcome,
  type FinalQueueItem } from '../../services/taxEngineService';

/**
 * The signed-in professional's Stage 10 queue (proposal 20261019180000): approved draft return versions a practice
 * manager assigned to them for final authorization, independent of the preparer, the reviewer and quality control.
 * The person reads the readiness and the practice's approved attestation text, confirms it explicitly (nothing is
 * pre-selected) and authorizes or declines. The server re-checks independence, readiness, the final authorization
 * authority and a recent multi-factor sign-in. Authorizing does not sign, file or transmit the return (return use:
 * BLOCKED). Hidden when the durable store is not enabled in this environment.
 */
export function finalOutcomeText(outcome: FinalOutcome | null): string {
  return outcome === 'AUTHORIZED' ? 'authorized' : outcome === 'DECLINED' ? 'declined' : 'not decided yet';
}

export function FinalAuthorizationQueuePanel() {
  const [queue, setQueue] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; items: FinalQueueItem[]; message?: string }>({ status: 'loading', items: [] });
  const [open, setOpen] = useState<{ id: string; data?: FinalContext; message?: string } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [note, setNote] = useState('');
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  const load = useCallback((): Promise<string | null> => {
    setQueue(q => ({ ...q, status: q.status === 'off' ? 'off' : 'loading' }));
    return taxEngineService.finalQueue().then(items => { setQueue({ status: 'ready', items }); return null; })
      .catch(e => {
        if (e instanceof TaxEngineRequestError && (e.status === 503 || e.status === 403)) { setQueue({ status: 'off', items: [] }); return null; }
        const message = taxEngineMessage(e); setQueue({ status: 'error', items: [], message }); return message;
      });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openItem = (item: FinalQueueItem) => {
    if (open?.id === item.returnVersionId) { setOpen(null); return; }
    setOpen({ id: item.returnVersionId }); setAcknowledged(false); setNote('');
    taxEngineService.finalContext(item.returnVersionId).then(data => setOpen(o => o?.id === item.returnVersionId ? { id: item.returnVersionId, data } : o))
      .catch(e => setOpen(o => o?.id === item.returnVersionId ? { id: item.returnVersionId, message: taxEngineMessage(e) } : o));
  };
  const decide = async (item: FinalQueueItem, ctx: FinalContext, outcome: FinalOutcome) => {
    if (busy || !ctx.attestation || !acknowledged) return;
    if (outcome === 'DECLINED' && note.trim().length < 10) { setNotice({ error: true, text: 'Declining needs a note of at least 10 characters.' }); return; }
    setBusy(true); setNotice(null);
    try {
      const decision = await taxEngineService.decideFinal(item.returnVersionId, { outcome, attestationVersion: ctx.attestation.attestationVersion, acknowledged: true,
        ...(note.trim() ? { note: note.trim() } : {}) });
      setOpen(null); setAcknowledged(false); setNote('');
      const failure = await load();
      const text = `Final authorization of ${item.templateId} version ${item.version}: ${finalOutcomeText(decision.outcome)}.`
        + (decision.outcome === 'AUTHORIZED' ? ' The client signature (Stage 11) is next; nothing has been signed or filed.' : '');
      setNotice(failure === null ? { error: false, text } : { error: true, text: `${text} The queue could not be refreshed: ${failure}` });
      setTimeout(() => { if (!document.activeElement || document.activeElement === document.body) heading.current?.focus(); }, 0);
    } catch (e) { setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { setBusy(false); }
  };

  if (queue.status === 'off') return null;
  return <section aria-labelledby="final-queue-heading" className="tg-acct-card">
    <h2 id="final-queue-heading" ref={heading} tabIndex={-1}>My final authorization queue <button type="button" disabled={busy} onClick={() => void load()}>Refresh</button></h2>
    <p>Approved draft returns assigned to you for Stage 10 final authorization. Read the readiness and the practice's attestation before deciding. Return use: BLOCKED.</p>
    <div role="status" aria-label="Final authorization result">{notice && !notice.error && <p>{notice.text}</p>}</div>
    {notice?.error && <p role="alert">{notice.text}</p>}
    {queue.status === 'loading' && queue.items.length === 0 && <p role="status">Loading your final authorization queue…</p>}
    {queue.status === 'error' && <p role="alert">{queue.message}</p>}
    {queue.status === 'ready' && queue.items.length === 0 && <p>No draft return is assigned to you for final authorization.</p>}
    {queue.items.map(item => {
      const name = `${item.templateId} version ${item.version}`; const isOpen = open?.id === item.returnVersionId;
      return <article key={item.assignmentId} aria-label={`Final authorization of ${name}`}>
        <h3>{name} · tax year {item.taxYear} · {finalOutcomeText(item.latestOutcome)}</h3>
        <button type="button" aria-expanded={isOpen} aria-controls={`final-form-${item.returnVersionId}`} onClick={() => openItem(item)}>
          {isOpen ? 'Close' : 'Review'} final authorization of {name}</button>
        <div id={`final-form-${item.returnVersionId}`}>{isOpen && <FinalForm item={item} name={name} state={open!} acknowledged={acknowledged}
          setAcknowledged={setAcknowledged} note={note} setNote={setNote} busy={busy} onDecide={(ctx, outcome) => void decide(item, ctx, outcome)} />}</div>
      </article>;
    })}
  </section>;
}

function FinalForm({ item, name, state, acknowledged, setAcknowledged, note, setNote, busy, onDecide }: { item: FinalQueueItem; name: string;
  state: { data?: FinalContext; message?: string }; acknowledged: boolean; setAcknowledged: (v: boolean) => void; note: string; setNote: (v: string) => void;
  busy: boolean; onDecide: (ctx: FinalContext, outcome: FinalOutcome) => void }) {
  if (state.message) return <p role="alert">{state.message}</p>;
  const ctx = state.data;
  if (!ctx) return <p role="status">Loading the version…</p>;
  const v = ctx.returnVersion; const ackId = `final-ack-${item.returnVersionId}`, noteId = `final-note-${item.returnVersionId}`;
  return <form aria-label={`Final authorization of ${name}`} onSubmit={e => e.preventDefault()}>
    <p>Case {item.caseId} · forms {v.forms.map(f => `${f.formId} (${f.formVersion})`).join(', ')}</p>
    <p>Readiness: {readinessText(ctx.readiness)}. Stage 10: {ctx.readiness.finalAuthorization ? finalAuthorizationText(ctx.readiness) : 'final authorization required'}.</p>
    {!ctx.attestation ? <p role="alert">The practice has no approved attestation text, so final authorization cannot be given.</p> : <>
      <blockquote aria-label={`Attestation version ${ctx.attestation.attestationVersion}`}>{ctx.attestation.text}</blockquote>
      <label htmlFor={ackId}><input id={ackId} type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /> I have reviewed {name} and read
        attestation version {ctx.attestation.attestationVersion}.</label>
      <label htmlFor={noteId}>Note (required to decline)</label>
      <textarea id={noteId} value={note} onChange={e => setNote(e.target.value)} />
      <button type="button" disabled={busy || !acknowledged || !ctx.readiness.ready} onClick={() => onDecide(ctx, 'AUTHORIZED')}>Authorize {name}</button>
      <button type="button" disabled={busy || !acknowledged || !ctx.readiness.ready} onClick={() => onDecide(ctx, 'DECLINED')}>Decline {name}</button>
      <p>Authorizing needs a recent multi-factor sign-in. It does not sign, file or transmit the return.</p>
    </>}
  </form>;
}
