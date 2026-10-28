import React, { useCallback, useEffect, useRef, useState } from 'react';
import { formProblemText, taxEngineMessage, taxEngineService, type FormMapping, type FormRule } from '../../services/taxEngineService';

/**
 * Deterministic form mapping for the selected case (proposal 20261019110000). The server derives every value from the
 * case's approved, current conclusions through an approved, versioned mapping rule and records its provenance; the
 * browser only chooses the rule. A mapping that no longer matches its sources is shown STALE until the preparer maps
 * again, which records a new version. Nothing here prepares or files a return (return use: BLOCKED).
 */
const short = (v: string) => v.slice(0, 8);
const label = (s: string) => s.replace(/_/g, ' ').toLowerCase();
export function mappingBadge(m: Pick<FormMapping, 'status' | 'stale'>): 'STALE' | 'CURRENT' | 'SUPERSEDED' {
  if (m.status === 'SUPERSEDED') return 'SUPERSEDED';
  return m.stale.length > 0 ? 'STALE' : 'CURRENT';
}

export function CaseFormMappingPanel({ caseId, taxYear, returnFamily }: { caseId: string; taxYear: number; returnFamily: string | null }) {
  const [items, setItems] = useState<{ status: 'loading' | 'ready' | 'error'; list: FormMapping[]; message?: string }>({ status: 'loading', list: [] });
  const [rules, setRules] = useState<FormRule[]>([]);
  const [rule, setRule] = useState('');
  const [open, setOpen] = useState<{ id: string; data?: FormMapping; message?: string } | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(caseId); current.current = caseId;
  const heading = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => {
    const key = caseId;
    setItems(i => ({ ...i, status: 'loading' }));
    return Promise.all([
      taxEngineService.caseFormMappings(caseId).then(list => { if (current.current === key) setItems({ status: 'ready', list }); })
        .catch(e => { if (current.current === key) setItems({ status: 'error', list: [], message: taxEngineMessage(e) }); }),
      taxEngineService.formRules(taxYear).then(list => { if (current.current === key) setRules(list.filter(r => r.status === 'APPROVED' && r.returnFamily === returnFamily)); })
        .catch(() => { if (current.current === key) setRules([]); }),
    ]);
  }, [caseId, taxYear, returnFamily]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (rules.length > 0 && !rules.some(r => r.ruleId === rule)) setRule(rules[0].ruleId); }, [rules, rule]);

  const toggle = (id: string) => {
    if (open?.id === id) { setOpen(null); return; }
    const key = caseId;
    setOpen({ id });
    taxEngineService.formMapping(id).then(data => { if (current.current === key) setOpen(o => o?.id === id ? { id, data } : o); })
      .catch(e => { if (current.current === key) setOpen(o => o?.id === id ? { id, message: taxEngineMessage(e) } : o); });
  };
  const mapNow = async () => {
    if (busy || !rule) return;
    const key = caseId;
    setBusy(true); setNotice(null);
    try {
      const m = await taxEngineService.mapForm(caseId, rule);
      if (current.current !== key) return;
      setNotice({ error: false, text: m.replayed ? `Already mapped: version ${m.version} is current and unchanged.` : `Mapped ${m.formId} as version ${m.version}.` });
      setOpen(null);
      void load().then(() => setTimeout(() => { if (current.current === key && (!document.activeElement || document.activeElement === document.body)) heading.current?.focus(); }, 0));
    } catch (e) { if (current.current === key) setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { if (current.current === key) setBusy(false); }
  };

  return <section aria-labelledby="case-form-mapping-heading">
    <h4 id="case-form-mapping-heading" ref={heading} tabIndex={-1}>Form mapping</h4>
    <p>Form values are derived by the server from approved, current conclusions through an approved mapping rule, each with its conclusion, calculation, rule set and evidence. Return use: BLOCKED.</p>
    <div role="status" aria-label="Form mapping result">{notice && !notice.error && <p>{notice.text}</p>}</div>
    {notice?.error && <p role="alert">{notice.text}</p>}
    <form aria-label="Map the case to a form" onSubmit={e => { e.preventDefault(); void mapNow(); }}>
      <label>Approved mapping rule<select value={rule} onChange={e => setRule(e.target.value)} disabled={rules.length === 0}>
        {rules.length === 0 && <option value="">No approved rule for {returnFamily ?? 'this return family'} {taxYear}</option>}
        {rules.map(r => <option key={r.ruleId} value={r.ruleId}>{r.formId} {r.formVersion} · rule version {r.version} · {r.lines} lines</option>)}
      </select></label>
      <p id="case-form-mapping-hint">Only the case preparer can map. Mapping is refused, and nothing is written, if any line cannot be filled from a single approved, current conclusion with an approved calculation.</p>
      <button disabled={busy || !rule} aria-describedby="case-form-mapping-hint">Map to form</button>
      <button type="button" disabled={busy} onClick={() => void load()}>Refresh form mappings</button>
    </form>
    {items.status === 'loading' && items.list.length === 0 && <p role="status">Loading form mappings…</p>}
    {items.status === 'error' && <p role="alert">{items.message} <button type="button" onClick={() => void load()}>Retry</button></p>}
    {items.status === 'ready' && items.list.length === 0 && <p role="status">No form mappings are recorded for this case.</p>}
    {items.list.map(m => {
      const badge = mappingBadge(m); const name = `${m.formId} ${m.formVersion} version ${m.version}`;
      return <article key={m.mappingId} aria-label={`Form mapping ${name}`} className="tg-form-mapping">
        <h5>{m.formId} ({m.formVersion}) · version {m.version} · status <strong data-mapping-status>{badge}</strong></h5>
        <p>Mapped by {m.mappedBy} · {new Date(m.createdAt).toLocaleString()} · rule version {m.ruleVersion} (sha256 {m.ruleSha256.slice(0, 12)}…)</p>
        {m.stale.length > 0 && <ul aria-label="Stale reasons">{m.stale.map((p, n) => <li key={n}>{formProblemText(p)}</li>)}</ul>}
        {m.missing.length > 0 && <p>Optional lines without a source: {m.missing.map(x => `line ${x.line}`).join(', ')}.</p>}
        <button type="button" aria-expanded={open?.id === m.mappingId} aria-controls={`form-mapping-values-${m.mappingId}`} onClick={() => toggle(m.mappingId)}>
          {open?.id === m.mappingId ? 'Hide' : 'Show'} values of {name}</button>
        <div id={`form-mapping-values-${m.mappingId}`}>{open?.id === m.mappingId && <MappingValues state={open} />}</div>
      </article>;
    })}
  </section>;
}

/** Values with their provenance: every value names the conclusion, calculation run, rule set and evidence it came from. */
function MappingValues({ state }: { state: { data?: FormMapping; message?: string } }) {
  if (state.message) return <p role="alert">{state.message}</p>;
  if (!state.data) return <p role="status">Loading values…</p>;
  const values = state.data.values ?? [];
  return <table className="tg-form-mapping-values">
    <caption>Values of {state.data.formId} {state.data.formVersion} version {state.data.version}, with provenance</caption>
    <thead><tr>{['Schedule', 'Line', 'Field', 'Value', 'Sources'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
    <tbody>{values.map(v => <tr key={v.schedule + v.line + v.field}>
      <td>{v.schedule}</td><th scope="row">{v.line}</th><td>{v.field}</td><td>{v.value} ({label(v.valueType)})</td>
      <td><ul>{v.sources.map(s => <li key={s.conclusionId}>
        Conclusion {short(s.conclusionId)} version {s.conclusionVersion} ({label(s.conclusionType)}) = {s.value} · run {short(s.runId)} · rule set {short(s.ruleSetId)} version {s.ruleSetVersion} (sha256 {s.ruleSetSha256.slice(0, 12)}…)
        {s.evidence.length > 0 && <> · evidence {s.evidence.map(e => e.ref).join(', ')}</>}
      </li>)}</ul></td></tr>)}</tbody>
  </table>;
}
