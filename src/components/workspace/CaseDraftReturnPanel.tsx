import React, { useCallback, useEffect, useRef, useState } from 'react';
import { returnProblemText, taxEngineMessage, taxEngineService, type ReturnTemplate, type ReturnVersion } from '../../services/taxEngineService';

/**
 * Draft return for the selected case (proposal 20261019120000). The server assembles a return version only from the
 * case's current, non-stale form mappings through an approved return template, and records which mapping version of
 * each form it used; the browser only chooses the template. The preparer submits, the case's independent reviewer
 * approves or returns it (Stage 09 draft review). A version whose inputs changed is shown STALE and cannot be
 * submitted or approved. This is a draft: final professional authorization is Stage 10, and nothing is signed or
 * filed (return use: BLOCKED).
 */
const short = (v: string) => v.slice(0, 8);
const words = (s: string) => s.replace(/_/g, ' ').toLowerCase();
export function returnBadge(v: Pick<ReturnVersion, 'status' | 'stale'>): 'STALE' | 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'RETURNED' | 'SUPERSEDED' {
  if (v.status === 'SUPERSEDED') return 'SUPERSEDED';
  return v.stale.length > 0 ? 'STALE' : v.status;
}

export function CaseDraftReturnPanel({ caseId, taxYear, returnFamily }: { caseId: string; taxYear: number; returnFamily: string | null }) {
  const [items, setItems] = useState<{ status: 'loading' | 'ready' | 'error'; list: ReturnVersion[]; message?: string }>({ status: 'loading', list: [] });
  const [templates, setTemplates] = useState<ReturnTemplate[]>([]);
  const [template, setTemplate] = useState('');
  const [open, setOpen] = useState<{ id: string; data?: ReturnVersion; message?: string } | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(caseId); current.current = caseId;
  const heading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    const key = caseId;
    setItems(i => ({ ...i, status: 'loading' }));
    return Promise.all([
      taxEngineService.caseReturns(caseId).then(list => { if (current.current === key) setItems({ status: 'ready', list }); })
        .catch(e => { if (current.current === key) setItems({ status: 'error', list: [], message: taxEngineMessage(e) }); }),
      taxEngineService.returnTemplates(taxYear).then(list => { if (current.current === key) setTemplates(list.filter(t => t.status === 'APPROVED' && t.returnFamily === returnFamily)); })
        .catch(() => { if (current.current === key) setTemplates([]); }),
    ]);
  }, [caseId, taxYear, returnFamily]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (templates.length > 0 && !templates.some(t => t.templateRuleId === template)) setTemplate(templates[0].templateRuleId); }, [templates, template]);
  const selected = templates.find(t => t.templateRuleId === template);

  const focusHeading = (key: string) => setTimeout(() => {
    if (current.current === key && (!document.activeElement || document.activeElement === document.body)) heading.current?.focus();
  }, 0);
  const act = async (work: () => Promise<ReturnVersion>, done: (v: ReturnVersion) => string) => {
    if (busy) return;
    const key = caseId;
    setBusy(true); setNotice(null);
    try {
      const v = await work();
      if (current.current !== key) return;
      setOpen(null);
      // Refresh first, then announce: the result is never read out while the list still shows the previous status.
      await load();
      if (current.current !== key) return;
      setNotice({ error: false, text: done(v) });
      focusHeading(key);
    } catch (e) { if (current.current === key) setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { if (current.current === key) setBusy(false); }
  };
  const prepare = () => template && act(() => taxEngineService.prepareReturn(caseId, template),
    v => v.replayed ? `Already prepared: version ${v.version} is open and unchanged.` : `Prepared ${v.templateId} as version ${v.version}.`);
  const decide = (v: ReturnVersion, action: 'submit' | 'approve' | 'return') => act(
    () => taxEngineService.transitionReturn(v.returnVersionId, action, action === 'return' ? (notes[v.returnVersionId] ?? '') : undefined),
    r => `Version ${r.version} of ${r.templateId}: ${words(r.status)}.`);
  const toggle = (id: string) => {
    if (open?.id === id) { setOpen(null); return; }
    const key = caseId;
    setOpen({ id });
    taxEngineService.returnVersion(id).then(data => { if (current.current === key) setOpen(o => o?.id === id ? { id, data } : o); })
      .catch(e => { if (current.current === key) setOpen(o => o?.id === id ? { id, message: taxEngineMessage(e) } : o); });
  };

  return <section aria-labelledby="case-draft-return-heading">
    <h4 id="case-draft-return-heading" ref={heading} tabIndex={-1}>Draft return</h4>
    <p>The server assembles a draft return only from the case's current form mappings through an approved return template. The preparer submits it and the case's independent reviewer approves or returns it. Final professional authorization is a separate step (Stage 10). Return use: BLOCKED.</p>
    <div role="status" aria-label="Draft return result">{notice && !notice.error && <p>{notice.text}</p>}</div>
    {notice?.error && <p role="alert">{notice.text}</p>}
    <form aria-label="Prepare the draft return" onSubmit={e => { e.preventDefault(); void prepare(); }}>
      <label>Approved return template<select className="max-w-full" value={template} onChange={e => setTemplate(e.target.value)} disabled={templates.length === 0}
        aria-describedby={selected ? 'case-draft-return-template' : undefined}>
        {templates.length === 0 && <option value="">No approved template for {returnFamily ?? 'this return family'} {taxYear}</option>}
        {templates.map(t => <option key={t.templateRuleId} value={t.templateRuleId}>{t.templateId} · template version {t.version} · {t.forms} forms</option>)}
      </select></label>
      {selected && <p id="case-draft-return-template">{selected.jurisdiction} {selected.jurisdictionCode} · in effect {selected.effectiveFrom} to {selected.effectiveTo ?? 'open'}</p>}
      <p id="case-draft-return-hint">Only the case preparer can prepare. Preparation is refused, and nothing is written, if a required form has no current, non-stale mapping or the case has blocking diagnostics.</p>
      <button disabled={busy || !template} aria-describedby="case-draft-return-hint">Prepare draft return</button>
      <button type="button" disabled={busy} onClick={() => void load()}>Refresh draft returns</button>
    </form>
    {items.status === 'loading' && items.list.length === 0 && <p role="status">Loading draft returns…</p>}
    {items.status === 'error' && <p role="alert">{items.message} <button type="button" onClick={() => void load()}>Retry</button></p>}
    {items.status === 'ready' && items.list.length === 0 && <p role="status">No draft return is recorded for this case.</p>}
    {items.list.map(v => {
      const badge = returnBadge(v); const name = `${v.templateId} version ${v.version}`;
      const noteId = `draft-return-note-${v.returnVersionId}`;
      return <article key={v.returnVersionId} aria-label={`Draft return ${name}`} className="tg-draft-return">
        <h5>{v.templateId} · version {v.version} · status <strong data-return-status>{badge}</strong></h5>
        <p>Prepared by {v.preparedBy} · {new Date(v.createdAt).toLocaleString()} · template version {v.templateVersion} (sha256 {v.templateSha256.slice(0, 12)}…)
          {v.reviewedBy && <> · {v.status === 'RETURNED' ? 'returned' : 'reviewed'} by {v.reviewedBy}</>}</p>
        {v.reviewNote && <p>Review note: {v.reviewNote}</p>}
        {v.stale.length > 0 && <ul aria-label="Stale reasons">{v.stale.map((p, n) => <li key={n}>{returnProblemText(p)}</li>)}</ul>}
        <ul aria-label={`Forms of ${name}`}>{v.forms.map(f => <li key={f.formId + f.formVersion}>{f.formId} ({f.formVersion}): form mapping {short(f.mappingId)} version {f.mappingVersion}</li>)}</ul>
        {v.missing.length > 0 && <p>Optional forms without a mapping: {v.missing.map(m => `${m.formId} (${m.formVersion})`).join(', ')}.</p>}
        {badge === 'DRAFT' && <button type="button" disabled={busy} onClick={() => void decide(v, 'submit')}>Submit {name} for review</button>}
        {badge === 'SUBMITTED' && <>
          <button type="button" disabled={busy} onClick={() => void decide(v, 'approve')}>Approve {name}</button>
          <label htmlFor={noteId}>Note for returning {name}</label>
          <input id={noteId} value={notes[v.returnVersionId] ?? ''} onChange={e => setNotes(n => ({ ...n, [v.returnVersionId]: e.target.value }))} />
          <button type="button" disabled={busy} onClick={() => void decide(v, 'return')}>Return {name} to the preparer</button>
        </>}
        <button type="button" aria-expanded={open?.id === v.returnVersionId} aria-controls={`draft-return-lineage-${v.returnVersionId}`} onClick={() => toggle(v.returnVersionId)}>
          {open?.id === v.returnVersionId ? 'Hide' : 'Show'} lineage of {name}</button>
        <div id={`draft-return-lineage-${v.returnVersionId}`}>{open?.id === v.returnVersionId && <ReturnLineage state={open} />}</div>
      </article>;
    })}
  </section>;
}

/** Every line of every form, with the conclusion, calculation run, rule set and evidence it came from (Block 67). */
function ReturnLineage({ state }: { state: { data?: ReturnVersion; message?: string } }) {
  if (state.message) return <p role="alert">{state.message}</p>;
  if (!state.data) return <p role="status">Loading lineage…</p>;
  return <>{(state.data.lineage ?? []).map(m => <table key={m.mappingId} className="tg-draft-return-lineage">
    <caption>{m.formId} {m.formVersion}, form mapping version {m.version}: lines with provenance</caption>
    <thead><tr>{['Schedule', 'Line', 'Field', 'Value', 'Sources'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
    <tbody>{(m.values ?? []).map(v => <tr key={v.schedule + v.line + v.field}>
      <td>{v.schedule}</td><th scope="row">{v.line}</th><td>{v.field}</td><td>{v.value}</td>
      <td><ul>{v.sources.map(s => <li key={s.conclusionId}>
        Conclusion {short(s.conclusionId)} version {s.conclusionVersion} · run {short(s.runId)} · rule set {short(s.ruleSetId)} version {s.ruleSetVersion}
        {s.evidence.length > 0 && <> · evidence {s.evidence.map(e => e.ref).join(', ')}</>}
      </li>)}</ul></td></tr>)}</tbody>
  </table>)}</>;
}
