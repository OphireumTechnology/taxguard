import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AUTHORITY_LABELS, AUTHORITY_LEVELS, taxEngineMessage, taxEngineService, type AuthorityLevel, type ResearchMemo, type TaxSource } from '../../services/taxEngineService';

/**
 * Tax research for the selected case (proposal 20261018150000). A controlled professional workpaper, not a chatbot:
 * every citation states its authority level, only a verified source covering the case year is authoritative, AI
 * inference is labelled as such and never supports an approval, and only the case's independent reviewer decides. The
 * server enforces all of it, including the live assignment; research never feeds a return.
 */
export function CaseResearchPanel({ caseId, taxYear }: { caseId: string; taxYear: number }) {
  const [memos, setMemos] = useState<{ status: 'loading' | 'ready' | 'error'; items: ResearchMemo[]; message?: string }>({ status: 'loading', items: [] });
  const [sources, setSources] = useState<TaxSource[]>([]);
  const [question, setQuestion] = useState('');
  const [citation, setCitation] = useState<Record<string, { level: AuthorityLevel; sourceId: string; reference: string; note: string }>>({});
  const [conclusion, setConclusion] = useState<Record<string, string>>({});
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(caseId); current.current = caseId;

  const load = useCallback(() => {
    const key = caseId;
    setMemos(m => ({ ...m, status: 'loading' }));
    taxEngineService.caseResearch(caseId).then(items => { if (current.current === key) setMemos({ status: 'ready', items }); })
      .catch(e => { if (current.current === key) setMemos({ status: 'error', items: [], message: taxEngineMessage(e) }); });
  }, [caseId]);
  useEffect(() => {
    load();
    taxEngineService.sources().then(items => { if (current.current === caseId) setSources(items); }).catch(() => setSources([]));
  }, [caseId, load]);

  const run = async (op: () => Promise<unknown>, success: string, after?: () => void) => {
    if (busy) return;
    const key = caseId;
    setBusy(true); setNotice(null);
    try { await op(); if (current.current !== key) return; setNotice({ error: false, text: success }); after?.(); load(); }
    catch (e) { if (current.current === key) setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { if (current.current === key) setBusy(false); }
  };
  const authoritative = sources.filter(s => s.status === 'VERIFIED' && s.tax_years.includes(taxYear));
  const draftOf = (memoId: string) => citation[memoId] ?? { level: 'AUTHORITATIVE' as AuthorityLevel, sourceId: '', reference: '', note: '' };
  const setDraft = (memoId: string, patch: Partial<{ level: AuthorityLevel; sourceId: string; reference: string; note: string }>) =>
    setCitation(c => ({ ...c, [memoId]: { ...draftOf(memoId), ...patch } }));

  return <section aria-labelledby="case-research-heading">
    <h4 id="case-research-heading">Tax research</h4>
    <p>Research memos for this case and tax year {taxYear}. A memo supports professional judgement; it is never used for a return (return use: BLOCKED).</p>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    <form aria-label="Open a research memo" onSubmit={e => { e.preventDefault(); void run(() => taxEngineService.openResearch(caseId, question.trim()), 'Research memo opened.', () => setQuestion('')); }}>
      <label>Research question<textarea required minLength={10} maxLength={2000} value={question} onChange={e => setQuestion(e.target.value)} /></label>
      <button disabled={busy || question.trim().length < 10}>Open research memo</button>
    </form>
    {memos.status === 'loading' && memos.items.length === 0 && <p role="status">Loading research…</p>}
    {memos.status === 'error' && <p role="alert">{memos.message} <button type="button" onClick={load}>Retry</button></p>}
    {memos.status === 'ready' && memos.items.length === 0 && <p role="status">No research memos are recorded for this case.</p>}
    {memos.items.map(m => {
      const d = draftOf(m.memo_id);
      return <article key={m.memo_id} aria-label={`Research memo: ${m.question.slice(0, 60)}`} className="tg-research-memo">
        <h5>{m.question}</h5>
        <p>Status: <strong>{m.status.toLowerCase()}</strong> · prepared by {m.prepared_by}{m.reviewed_by ? ` · reviewed by ${m.reviewed_by}` : ''} · opened {new Date(m.created_at).toLocaleString()}
          {' · '}Return use: {m.returnUse}</p>
        {m.conclusion && <p>Conclusion: {m.conclusion}</p>}
        {m.review_note && <p>Review note: {m.review_note}</p>}
        <h6>Authorities</h6>
        {m.citations.length === 0 ? <p>No citations yet.</p> : <ol aria-label="Citations">{m.citations.map(ci => {
          const source = ci.source_id ? sources.find(s => s.source_id === ci.source_id) : undefined;
          return <li key={ci.citation_no} data-authority-level={ci.authority_level}>
            <strong>[{AUTHORITY_LABELS[ci.authority_level]}]</strong>{' '}
            {ci.authority_level === 'AUTHORITATIVE' && <>{source ? `${source.citation} — ${source.title} (${source.authority_type.replace(/_/g, ' ')}, ${source.jurisdiction} ${source.jurisdiction_code}, tax years ${source.tax_years.join(', ')}, ${source.status.toLowerCase()})` : ci.source_id} · </>}
            {ci.reference && <>{ci.reference} · </>}{ci.note} <span>(added by {ci.added_by})</span>
          </li>;
        })}</ol>}
        {m.status === 'DRAFT' && <>
          <form aria-label="Add a citation" onSubmit={e => { e.preventDefault(); void run(() => taxEngineService.citeResearch(m.memo_id, {
            authorityLevel: d.level, ...(d.level === 'AUTHORITATIVE' ? { sourceId: d.sourceId } : {}),
            ...(d.level === 'SECONDARY' || d.level === 'INTERNAL_GUIDANCE' ? { reference: d.reference.trim() } : {}), note: d.note.trim() }), 'Citation added.',
            () => setCitation(c => ({ ...c, [m.memo_id]: { ...d, sourceId: '', reference: '', note: '' } }))); }}>
            <label>Authority level<select value={d.level} onChange={e => setDraft(m.memo_id, { level: e.target.value as AuthorityLevel })}>
              {AUTHORITY_LEVELS.map(l => <option key={l} value={l}>{AUTHORITY_LABELS[l]}</option>)}</select></label>
            {d.level === 'AUTHORITATIVE' && <label>Verified source for {taxYear}<select value={d.sourceId} onChange={e => setDraft(m.memo_id, { sourceId: e.target.value })}>
              <option value="">Select a verified source</option>{authoritative.map(s => <option key={s.source_id} value={s.source_id}>{s.citation} — {s.title}</option>)}</select></label>}
            {(d.level === 'SECONDARY' || d.level === 'INTERNAL_GUIDANCE') && <label>Reference<input maxLength={500} value={d.reference} onChange={e => setDraft(m.memo_id, { reference: e.target.value })} /></label>}
            {d.level === 'AI_INFERENCE' && <p role="note">AI inference is recorded as reasoning only. It cites no source and never supports an approval.</p>}
            <label>Note<textarea maxLength={2000} value={d.note} onChange={e => setDraft(m.memo_id, { note: e.target.value })} /></label>
            <button disabled={busy || d.note.trim().length < 5}>Add citation</button>
          </form>
          <form aria-label="Submit for review" onSubmit={e => { e.preventDefault(); void run(() => taxEngineService.submitResearch(m.memo_id, (conclusion[m.memo_id] ?? '').trim(), m.version), 'Memo submitted for review.'); }}>
            <label>Conclusion<textarea maxLength={8000} value={conclusion[m.memo_id] ?? ''} onChange={e => setConclusion(c => ({ ...c, [m.memo_id]: e.target.value }))} /></label>
            <button disabled={busy || (conclusion[m.memo_id] ?? '').trim().length < 10}>Submit for review</button>
          </form>
        </>}
        {m.status === 'SUBMITTED' && <form aria-label="Review this memo" onSubmit={e => e.preventDefault()}>
          <label>Review note<textarea maxLength={2000} value={reviewNote[m.memo_id] ?? ''} onChange={e => setReviewNote(n => ({ ...n, [m.memo_id]: e.target.value }))} /></label>
          <button type="button" disabled={busy || (reviewNote[m.memo_id] ?? '').trim().length < 10}
            onClick={() => run(() => taxEngineService.reviewResearch(m.memo_id, 'approve', (reviewNote[m.memo_id] ?? '').trim(), m.version), 'Research approved.')}>Approve research</button>
          <button type="button" disabled={busy || (reviewNote[m.memo_id] ?? '').trim().length < 10}
            onClick={() => run(() => taxEngineService.reviewResearch(m.memo_id, 'reject', (reviewNote[m.memo_id] ?? '').trim(), m.version), 'Research rejected.')}>Reject research</button>
        </form>}
      </article>;
    })}
  </section>;
}
