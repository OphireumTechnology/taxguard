import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CONCLUSION_TYPES, conclusionBadge, evidenceText, staleReason, taxEngineMessage, taxEngineService, type ConclusionInput, type ConclusionLinkType,
  type ConclusionReadiness, type ConclusionTrace, type TaxConclusion } from '../../services/taxEngineService';

/**
 * Tax conclusions for the selected case (proposal 20261019100000): governed determinations prepared by the case's
 * preparer and decided by its independent reviewer, each traceable to verified evidence, calculation, rule, research and
 * review. Staleness is derived on the server from what each source was when linked; a stale conclusion cannot be
 * submitted or approved and must be revised. Nothing here is used for a return (return use: BLOCKED).
 */
type Draft = { type: string; statement: string; amount: string; evidence: string; calculation: string; research: string; workpaper: string };
const EMPTY: Draft = { type: 'INCOME_INCLUSION', statement: '', amount: '', evidence: '', calculation: '', research: '', workpaper: '' };
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();
const list = (v: string) => v.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
function linksOf(d: Draft): ConclusionInput['links'] {
  const of = (type: ConclusionLinkType, v: string) => list(v).map(ref => ({ type, ref }));
  return [...of('EVIDENCE', d.evidence), ...of('CALCULATION', d.calculation), ...of('RESEARCH', d.research), ...of('WORKPAPER', d.workpaper)];
}

export function CaseConclusionsPanel({ caseId }: { caseId: string }) {
  const [items, setItems] = useState<{ status: 'loading' | 'ready' | 'error'; list: TaxConclusion[]; message?: string }>({ status: 'loading', list: [] });
  const [readiness, setReadiness] = useState<ConclusionReadiness | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [revising, setRevising] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [trace, setTrace] = useState<{ id: string; data?: ConclusionTrace; message?: string } | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(caseId); current.current = caseId;
  const heading = useRef<HTMLHeadingElement>(null);
  const statement = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(() => {
    const key = caseId;
    setItems(i => ({ ...i, status: 'loading' }));
    return Promise.all([
      taxEngineService.caseConclusions(caseId).then(list => { if (current.current === key) setItems({ status: 'ready', list }); })
        .catch(e => { if (current.current === key) setItems({ status: 'error', list: [], message: taxEngineMessage(e) }); }),
      taxEngineService.conclusionReadiness(caseId).then(r => { if (current.current === key) setReadiness(r); }).catch(() => { if (current.current === key) setReadiness(null); }),
    ]);
  }, [caseId]);
  useEffect(() => { load(); }, [load]);

  const openTrace = (id: string) => {
    if (trace?.id === id) { setTrace(null); return; }
    const key = caseId;
    setTrace({ id });
    taxEngineService.traceConclusion(id).then(data => { if (current.current === key) setTrace(t => t?.id === id ? { id, data } : t); })
      .catch(e => { if (current.current === key) setTrace(t => t?.id === id ? { id, message: taxEngineMessage(e) } : t); });
  };
  const run = async (op: () => Promise<unknown>, success: string, after?: () => void) => {
    if (busy) return;
    const key = caseId;
    setBusy(true); setNotice(null);
    try {
      await op(); if (current.current !== key) return;
      setNotice({ error: false, text: success }); after?.(); setTrace(null);
      // The control that was used is often gone after the reload (a submitted draft has no Submit button): keep keyboard
      // focus in the panel instead of losing it to the page.
      void load().then(() => setTimeout(() => { if (current.current === key && (!document.activeElement || document.activeElement === document.body)) heading.current?.focus(); }, 0));
    }
    catch (e) { if (current.current === key) setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { if (current.current === key) setBusy(false); }
  };
  const body = (): ConclusionInput => ({ type: draft.type, statement: draft.statement.trim(), amount: draft.amount.trim() || null, links: linksOf(draft) });
  const canSave = draft.statement.trim().length >= 10 && list(draft.evidence).length > 0;
  const set = (patch: Partial<Draft>) => setDraft(d => ({ ...d, ...patch }));
  const current_ = items.list.filter(k => k.status !== 'SUPERSEDED');

  const startRevision = (k: TaxConclusion) => {
    setRevising(k.conclusionId); setDraft({ ...EMPTY, type: k.type, statement: k.statement, amount: k.amount ?? '' });
    setTimeout(() => statement.current?.focus(), 0); // the form being filled is above the list
  };

  return <section aria-labelledby="case-conclusions-heading">
    <h4 id="case-conclusions-heading" ref={heading} tabIndex={-1}>Tax conclusions</h4>
    <p>Each conclusion cites verified evidence and, where used, its calculation run, approved research and workpaper. The reviewer can trace it back to the original document. Return use: BLOCKED.</p>
    {/* Live regions stay mounted so that changes to their text are announced. */}
    <div role="status" aria-label="Conclusion readiness">{readiness && <p>{readiness.ready ? 'All current conclusions are approved and current.'
      : readiness.conclusions === 0 ? 'No conclusions are recorded yet.'
      : `Finalization blocked: ${readiness.blockers.map(b => `version ${b.version} ${b.reasons.map(r => r === 'STALE' ? 'stale' : 'not approved').join(' and ')}`).join('; ')}.`}</p>}</div>
    <div role="status" aria-label="Conclusion action result">{notice && !notice.error && <p>{notice.text}</p>}</div>
    {notice?.error && <p role="alert">{notice.text}</p>}
    <form aria-label={revising ? 'Revise the conclusion' : 'Propose a conclusion'} onSubmit={e => { e.preventDefault();
      void (revising ? run(() => taxEngineService.reviseConclusion(revising, body()), 'New conclusion version recorded as a draft.', () => { setDraft(EMPTY); setRevising(null); })
        : run(() => taxEngineService.proposeConclusion(caseId, body()), 'Conclusion recorded as a draft.', () => setDraft(EMPTY))); }}>
      <label>Conclusion type<select value={draft.type} onChange={e => set({ type: e.target.value })}>{CONCLUSION_TYPES.map(t => <option key={t} value={t}>{label(t)}</option>)}</select></label>
      <label>Statement<textarea ref={statement} required minLength={10} maxLength={4000} value={draft.statement} onChange={e => set({ statement: e.target.value })} /></label>
      <label>Amount (optional)<input inputMode="decimal" value={draft.amount} onChange={e => set({ amount: e.target.value })} /></label>
      <label>Verified evidence (extraction:&lt;id&gt; or document:&lt;id&gt;)<input value={draft.evidence} onChange={e => set({ evidence: e.target.value })} /></label>
      <label>Calculation run ids (optional)<input value={draft.calculation} onChange={e => set({ calculation: e.target.value })} /></label>
      <label>Research memo ids (optional)<input value={draft.research} onChange={e => set({ research: e.target.value })} /></label>
      <label>Workpaper ids (optional)<input value={draft.workpaper} onChange={e => set({ workpaper: e.target.value })} /></label>
      <p id="case-conclusion-save-hint">A statement of at least 10 characters and at least one verified evidence reference are required.</p>
      <button disabled={busy || !canSave} aria-describedby="case-conclusion-save-hint">{revising ? 'Record new version' : 'Propose conclusion'}</button>
      {revising && <button type="button" disabled={busy} onClick={() => { setRevising(null); setDraft(EMPTY); }}>Cancel revision</button>}
    </form>
    {items.status === 'loading' && items.list.length === 0 && <p role="status">Loading conclusions…</p>}
    {items.status === 'error' && <p role="alert">{items.message} <button type="button" onClick={load}>Retry</button></p>}
    {items.status === 'ready' && items.list.length === 0 && <p role="status">No conclusions are recorded for this case.</p>}
    {current_.map(k => {
      const badge = conclusionBadge(k); const short = k.conclusionId.slice(0, 8);
      return <article key={k.conclusionId} aria-label={`Conclusion ${short}`} className="tg-conclusion">
        <h5>{label(k.type)} · version {k.version} · status <strong data-conclusion-status>{badge}</strong></h5>
        <p>{k.statement}{k.amount ? ` · ${k.amount}` : ''}</p>
        <p>Prepared by {k.preparedBy}{k.reviewedBy ? ` · ${label(k.status)} by ${k.reviewedBy}` : ''}{k.reviewNote ? ` · ${k.reviewNote}` : ''}</p>
        {k.stale.length > 0 && <ul aria-label="Stale sources">{k.stale.map(s => <li key={s.type + s.ref}>{label(s.type)} {s.ref}: {staleReason(s.reason)}</li>)}</ul>}
        <div className="tg-conclusion-actions">
          <button type="button" aria-expanded={trace?.id === k.conclusionId} aria-controls={`conclusion-lineage-${k.conclusionId}`} onClick={() => openTrace(k.conclusionId)}>{trace?.id === k.conclusionId ? 'Hide' : 'Show'} lineage of conclusion {short}</button>
          {k.status === 'DRAFT' && <button type="button" disabled={busy} onClick={() => run(() => taxEngineService.submitConclusion(k.conclusionId), 'Conclusion submitted for review.')}>Submit conclusion {short} for review</button>}
          {['DRAFT', 'RETURNED', 'REJECTED', 'APPROVED'].includes(k.status) && <button type="button" disabled={busy}
            onClick={() => startRevision(k)}>Revise conclusion {short}</button>}
        </div>
        {/* The lineage follows its toggle and precedes the decision, in reading and focus order. */}
        <div id={`conclusion-lineage-${k.conclusionId}`}>{trace?.id === k.conclusionId && <ConclusionLineage trace={trace} />}</div>
        {k.status === 'READY_FOR_REVIEW' && <form aria-label={`Review conclusion ${short}`} onSubmit={e => e.preventDefault()}>
          <label>Review note<textarea maxLength={2000} aria-describedby={`conclusion-note-hint-${k.conclusionId}`} value={notes[k.conclusionId] ?? ''} onChange={e => setNotes(n => ({ ...n, [k.conclusionId]: e.target.value }))} /></label>
          <button type="button" disabled={busy} onClick={() => run(() => taxEngineService.reviewConclusion(k.conclusionId, 'approve', (notes[k.conclusionId] ?? '').trim()), 'Conclusion approved.')}>Approve conclusion {short}</button>
          <button type="button" disabled={busy || (notes[k.conclusionId] ?? '').trim().length < 10} aria-describedby={`conclusion-note-hint-${k.conclusionId}`} onClick={() => run(() => taxEngineService.reviewConclusion(k.conclusionId, 'return', notes[k.conclusionId].trim()), 'Conclusion returned to the preparer.')}>Return conclusion {short} for correction</button>
          <button type="button" disabled={busy || (notes[k.conclusionId] ?? '').trim().length < 10} aria-describedby={`conclusion-note-hint-${k.conclusionId}`} onClick={() => run(() => taxEngineService.reviewConclusion(k.conclusionId, 'reject', notes[k.conclusionId].trim()), 'Conclusion rejected.')}>Reject conclusion {short}</button>
          <p id={`conclusion-note-hint-${k.conclusionId}`}>Returning or rejecting needs a note of at least 10 characters.</p>
        </form>}
      </article>;
    })}
  </section>;
}

/** Reviewer-facing lineage: summaries, not raw records. */
function ConclusionLineage({ trace }: { trace: { data?: ConclusionTrace; message?: string } }) {
  if (trace.message) return <p role="alert">{trace.message}</p>;
  if (!trace.data) return <p role="status">Loading lineage…</p>;
  const t = trace.data; const of = (type: ConclusionLinkType) => t.sources.filter(s => s.type === type);
  const state = (s: ConclusionTrace['sources'][number]) => t.conclusion.stale.find(x => x.type === s.type && x.ref === s.ref);
  return <section aria-label="Conclusion lineage" className="tg-conclusion-lineage">
    <h6>Calculation and rule</h6>
    {of('CALCULATION').length === 0 ? <p>No calculation run.</p> : <ul>{of('CALCULATION').map(s => <li key={s.ref}>
      Run {s.ref.slice(0, 8)} · rule set {String(s.snapshot.ruleSetId ?? '').slice(0, 8)} (sha256 {String(s.snapshot.ruleSetSha256 ?? '').slice(0, 12)}…) · {label(String(s.current.status ?? s.current.unresolved ?? ''))}
      {s.detail && <> · outputs {Object.entries(s.detail.outputs ?? {}).map(([k, v]) => `${k} = ${v}`).join(', ')}
        <ul>{(s.detail.inputs ?? []).map((i: any) => <li key={i.factPath + i.ref}>{i.factPath} = {i.value} · {evidenceText(i.resolution)}</li>)}</ul></>}
      {state(s) && <strong> · STALE: {staleReason(state(s)!.reason)}</strong>}</li>)}</ul>}
    <h6>Research and authority</h6>
    {of('RESEARCH').length === 0 ? <p>No research memo.</p> : <ul>{of('RESEARCH').map(s => <li key={s.ref}>
      Memo {s.ref.slice(0, 8)} · {label(String(s.current.status ?? s.current.unresolved ?? ''))}{s.detail?.question ? ` · ${s.detail.question}` : ''}
      <ul>{(s.detail?.citations ?? []).map((c: any, n: number) => <li key={n}>{label(c.authorityLevel)}{c.sourceId ? ` · ${c.sourceId}` : ''}{c.reference ? ` · ${c.reference}` : ''}</li>)}</ul>
      {state(s) && <strong>STALE: {staleReason(state(s)!.reason)}</strong>}</li>)}</ul>}
    <h6>Workpaper</h6>
    {of('WORKPAPER').length === 0 ? <p>No workpaper.</p> : <ul>{of('WORKPAPER').map(s => <li key={s.ref}>Workpaper {s.ref.slice(0, 8)} · {label(String(s.current.status ?? s.current.unresolved ?? ''))}{state(s) && <strong> · STALE: {staleReason(state(s)!.reason)}</strong>}</li>)}</ul>}
    <h6>Verified evidence and original documents</h6>
    <ul>{of('EVIDENCE').map(s => <li key={s.ref}>{s.ref} · linked: {evidenceText(s.snapshot as any)}{state(s) ? <strong> · STALE: {staleReason(state(s)!.reason)}</strong> : ' · VERIFIED'}</li>)}</ul>
    <h6>Review history</h6>
    <ul>{t.versions.map(v => <li key={v.conclusionId}>Version {v.version} · {label(v.status)}{v.reviewedBy ? ` by ${v.reviewedBy}` : ''}</li>)}</ul>
    <h6>Audit</h6>
    <ul>{t.audit.map((a, n) => <li key={n}>{label(a.action.replace(/^TAX_CONCLUSION_/, ''))} · version {a.version ?? '?'} · {a.actorUid} · {new Date(a.at).toLocaleString()}</li>)}</ul>
    <p>Form lines: {t.formLines.length === 0 ? 'none mapped yet' : t.formLines.map(f => `${f.formId} ${f.line}`).join(', ')}</p>
  </section>;
}
