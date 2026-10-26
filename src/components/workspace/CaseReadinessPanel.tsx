import React, { useCallback, useEffect, useRef, useState } from 'react';
import { dollarsToCents, RISK_OUTCOME_LABELS, RISK_REASON_LABELS, taxEngineMessage, taxEngineService, type CaseDiagnostics, type RiskAssessment } from '../../services/taxEngineService';

/**
 * Readiness and risk for the selected case (proposals 20261018160000 and 20261018170000). Diagnostics are deterministic
 * checks the server runs over the case's durable records; severities come from the governed rule table, and only INFO
 * and WARNING findings can be acknowledged, by the case reviewer or a manager. A risk assessment records the amount a
 * person states against the practice's approved materiality policy; without one, a person reviews. No AI confidence is
 * entered here, and nothing on this panel makes a return usable.
 */
export function CaseReadinessPanel({ caseId, taxYear }: { caseId: string; taxYear: number }) {
  const [diag, setDiag] = useState<{ status: 'loading' | 'ready' | 'error'; data?: CaseDiagnostics; message?: string }>({ status: 'loading' });
  const [risk, setRisk] = useState<{ status: 'loading' | 'ready' | 'error'; items: RiskAssessment[]; message?: string }>({ status: 'loading', items: [] });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [amount, setAmount] = useState('');
  const [unsupported, setUnsupported] = useState(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(caseId); current.current = caseId;

  const load = useCallback(() => {
    const key = caseId;
    setDiag(d => ({ ...d, status: 'loading' }));
    setRisk(r => ({ ...r, status: 'loading' }));
    taxEngineService.caseDiagnostics(caseId).then(data => { if (current.current === key) setDiag({ status: 'ready', data }); })
      .catch(e => { if (current.current === key) setDiag({ status: 'error', message: taxEngineMessage(e) }); });
    taxEngineService.caseRisk(caseId).then(items => { if (current.current === key) setRisk({ status: 'ready', items }); })
      .catch(e => { if (current.current === key) setRisk({ status: 'error', items: [], message: taxEngineMessage(e) }); });
  }, [caseId]);
  useEffect(() => { load(); }, [load]);

  const run = async (op: () => Promise<unknown>, success: string, after?: () => void) => {
    if (busy) return;
    const key = caseId;
    setBusy(true); setNotice(null);
    try { await op(); if (current.current !== key) return; setNotice({ error: false, text: success }); after?.(); load(); }
    catch (e) { if (current.current === key) setNotice({ error: true, text: taxEngineMessage(e) }); }
    finally { if (current.current === key) setBusy(false); }
  };
  const cents = dollarsToCents(amount);
  const d = diag.data;
  const summary = !d ? '' : !d.diagnosedAt ? 'Not diagnosed yet: run the diagnostics to check readiness.'
    : d.ready ? `No blocking or error findings as of ${new Date(d.diagnosedAt).toLocaleString()}.`
    : `Not ready: ${d.blocking} blocking, ${d.errors} ${d.errors === 1 ? 'error' : 'errors'} as of ${new Date(d.diagnosedAt).toLocaleString()}.`;

  return <section aria-labelledby="case-readiness-heading">
    <h4 id="case-readiness-heading">Readiness and risk</h4>
    <p>Checks for this case and tax year {taxYear}. They inform professional review; none of them makes a return usable (return use: BLOCKED).</p>
    {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}

    <h5>Readiness diagnostics</h5>
    {diag.status === 'loading' && !d && <p role="status">Loading diagnostics…</p>}
    {diag.status === 'error' && <p role="alert">{diag.message} <button type="button" onClick={load}>Retry</button></p>}
    {d && <>
      <p data-testid="readiness-summary">{summary}</p>
      <button type="button" disabled={busy} onClick={() => run(() => taxEngineService.runDiagnostics(caseId), 'Diagnostics run recorded.')}>Run diagnostics</button>
      {d.diagnostics.length > 0 && <ul aria-label="Open findings">{d.diagnostics.map(f => {
        const waivable = (f.severity === 'INFO' || f.severity === 'WARNING') && f.status === 'OPEN';
        return <li key={f.diagnostic_id} aria-label={`${f.severity} finding: ${f.rule_code}`} data-severity={f.severity}>
          <strong>[{f.severity}]</strong> {f.message} <span>({f.rule_code} v{f.rule_version} · {f.status.toLowerCase()} · detected {new Date(f.detected_at).toLocaleString()})</span>
          {f.status === 'ACKNOWLEDGED' && <p>Acknowledged by {f.acknowledged_by}: {f.acknowledgement_note}</p>}
          {waivable && <form aria-label={`Acknowledge ${f.rule_code}`} onSubmit={e => { e.preventDefault();
            void run(() => taxEngineService.acknowledgeDiagnostic(f.diagnostic_id, (notes[f.diagnostic_id] ?? '').trim()), 'Finding acknowledged.',
              () => setNotes(n => ({ ...n, [f.diagnostic_id]: '' }))); }}>
            <label>Acknowledgement note<textarea maxLength={1000} value={notes[f.diagnostic_id] ?? ''} onChange={e => setNotes(n => ({ ...n, [f.diagnostic_id]: e.target.value }))} /></label>
            <button disabled={busy || (notes[f.diagnostic_id] ?? '').trim().length < 10}>Acknowledge finding</button>
          </form>}
          {(f.severity === 'BLOCKING' || f.severity === 'ERROR') && <p role="note">Fix the underlying record and run the diagnostics again; this finding cannot be acknowledged.</p>}
        </li>;
      })}</ul>}
    </>}

    <h5>Risk and materiality</h5>
    <form aria-label="Assess risk" onSubmit={e => { e.preventDefault(); if (cents === null) return;
      void run(() => taxEngineService.assessRisk(caseId, cents, unsupported), 'Risk assessment recorded.', () => { setAmount(''); setUnsupported(false); }); }}>
      <label>Amount at stake (USD)<input inputMode="decimal" maxLength={17} value={amount} onChange={e => setAmount(e.target.value)} /></label>
      <label><input type="checkbox" checked={unsupported} onChange={e => setUnsupported(e.target.checked)} /> A position lacks support</label>
      <button disabled={busy || cents === null}>Record risk assessment</button>
    </form>
    {risk.status === 'loading' && risk.items.length === 0 && <p role="status">Loading risk assessments…</p>}
    {risk.status === 'error' && <p role="alert">{risk.message} <button type="button" onClick={load}>Retry</button></p>}
    {risk.status === 'ready' && risk.items.length === 0 && <p role="status">No risk assessments are recorded for this case.</p>}
    {risk.items.length > 0 && <ol aria-label="Risk assessments">{risk.items.map(a => <li key={a.assessment_id} aria-label={`Risk assessment ${a.assessment_id.slice(0, 8)}`} data-outcome={a.outcome}>
      <strong>{RISK_OUTCOME_LABELS[a.outcome]}</strong> · ${(a.amount_cents / 100).toFixed(2)} · materiality {a.materiality.toLowerCase()} · risk {a.risk_level.toLowerCase()}
      {' · '}{a.policy_version === null ? 'no approved policy' : `policy v${a.policy_version}`} · {a.assessed_by} · {new Date(a.assessed_at).toLocaleString()}
      {a.reason_codes.length > 0 && <ul>{a.reason_codes.map(r => <li key={r}>{RISK_REASON_LABELS[r] ?? r}</li>)}</ul>}
    </li>)}</ol>}
  </section>;
}
