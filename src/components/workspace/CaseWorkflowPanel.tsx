import React, { useCallback, useEffect, useRef, useState } from 'react';
import { caseMessage, caseService, dependencyLabel, restaffCandidates, stageLabel, type CaseDetail, type CaseQueueItem } from '../../services/caseService';
import { practiceService, type PracticeClientDetail } from '../../services/practiceService';

const label = (v: string) => v.replace(/_/g, ' ');

/** Work queue and canonical 18-stage case detail. Evidence is verified or recorded by the server. */
export function CaseWorkflowPanel() {
  const [role, setRole] = useState('');
  const [queue, setQueue] = useState<{ status: 'loading' | 'ready' | 'error'; items: CaseQueueItem[]; message?: string }>({ status: 'loading', items: [] });
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [statement, setStatement] = useState('');
  const [reason, setReason] = useState('');
  const [returnStage, setReturnStage] = useState('');
  const [teamRole, setTeamRole] = useState<'preparer' | 'reviewer'>('reviewer');
  const [teamUser, setTeamUser] = useState('');
  const [team, setTeam] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; rows: PracticeClientDetail['team'] }>({ status: 'idle', rows: [] });
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const selectedRef = useRef(selected); selectedRef.current = selected;

  const loadQueue = useCallback(() => {
    setQueue(q => ({ ...q, status: 'loading' }));
    caseService.queue(role ? { role } : {}).then(r => setQueue({ status: 'ready', items: r.items })).catch(e => setQueue({ status: 'error', items: [], message: caseMessage(e) }));
  }, [role]);
  useEffect(() => { loadQueue(); }, [loadQueue]);
  const loadDetail = useCallback((caseId: string) => {
    setDetail(null); setConfirmed([]); setStatement('');
    caseService.detail(caseId).then(d => { if (selectedRef.current === caseId) setDetail(d); })
      .catch(e => { if (selectedRef.current === caseId) setNotice({ error: true, text: caseMessage(e) }); });
  }, []);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  const run = async (op: () => Promise<unknown>, success: string) => {
    if (busy || !selected) return;
    const caseId = selected;
    setBusy(true); setNotice(null);
    try { await op(); if (selectedRef.current === caseId) { setNotice({ error: false, text: success }); setReason(''); loadDetail(caseId); loadQueue(); } }
    catch (e) { if (selectedRef.current === caseId) setNotice({ error: true, text: caseMessage(e) }); }
    finally { setBusy(false); }
  };
  const c = detail?.case; const policy = detail?.stagePolicy;
  // Visibility only: the server decides who may restaff (managers and administrators) and re-checks every condition.
  const managing = queue.items.find(q => q.caseId === selected)?.myRole === 'manager';
  const teamClient = managing ? c?.clientId : undefined;
  const loadTeam = useCallback((clientId: string) => {
    setTeam({ status: 'loading', rows: [] });
    practiceService.clientDetail(clientId).then(d => setTeam({ status: 'ready', rows: d.team })).catch(() => setTeam({ status: 'error', rows: [] }));
  }, []);
  useEffect(() => { if (teamClient) loadTeam(teamClient); else setTeam({ status: 'idle', rows: [] }); }, [teamClient, loadTeam]);
  const candidates = c ? restaffCandidates(team.rows, c, teamRole) : [];
  return <section aria-labelledby="case-workflow-heading" className="tg-manager-card">
    <h2 id="case-workflow-heading">Case Workflow</h2>
    <div className="tg-manager-controls"><label>Queue<select value={role} onChange={e => setRole(e.target.value)}><option value="">All my cases</option>
      <option value="preparer">As preparer</option><option value="reviewer">As reviewer</option></select></label><button type="button" onClick={loadQueue}>Refresh queue</button></div>
    {queue.status === 'loading' && <p role="status">Loading cases…</p>}
    {queue.status === 'error' && <p role="alert">{queue.message}</p>}
    {queue.status === 'ready' && queue.items.length === 0 && <p role="status">No cases in this queue.</p>}
    {queue.items.length > 0 && <div className="tg-manager-scroll"><table><caption className="sr-only">Case work queue</caption>
      <thead><tr>{['Case', 'Client / year', 'Return', 'Stage', 'Status', 'My role', 'Next action', 'Next deadline'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>{queue.items.map(q => <tr key={q.caseId}><td><button type="button" aria-pressed={selected === q.caseId} onClick={() => { setSelected(q.caseId); setNotice(null); }}>{q.caseId.slice(0, 16)}</button></td>
        <td>{q.clientName || q.clientId} / {q.taxYear}</td><td>{q.returnFamily ?? 'Not set'}</td><td>{stageLabel(q.activeStage)}</td><td>{q.status}</td><td>{q.myRole}</td>
        <td>{q.blockedDependency ? dependencyLabel(q.blockedDependency) : q.awaitingReviewer ? 'Reviewer attestation' : 'System-verified gate'}</td>
        <td>{q.nextDeadline ? q.nextDeadline.slice(0, 10) : 'None recorded'}</td></tr>)}</tbody></table></div>}

    {selected && <div aria-live="polite">
      {notice && <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
      {!detail && <p role="status">Loading case…</p>}
      {c && policy && <>
        <h3>{stageLabel(c.activeStage)} · {c.status}{c.holdReason ? ` (${c.holdReason})` : ''}</h3>
        <p>Preparer {c.preparerUid} · Reviewer {c.reviewerUid} · {c.returnFamily ?? 'return family not set'} · tax year {c.taxYear}</p>
        <ol className="tg-stage-list">{detail!.stages.map(s => <li key={s.stage} aria-current={s.stage === c.activeStage ? 'step' : undefined}>
          {stageLabel(s.stage)} — {label(s.status.toLowerCase())}{s.evidenceType ? ` (${label(s.evidenceType.toLowerCase())})` : ''}</li>)}</ol>
        {policy.evidence === 'BLOCKED' && <p role="status">{dependencyLabel(policy.dependency)}</p>}
        {policy.evidence === 'SYSTEM_VERIFIED' && <>
          <h4>Gate checks (computed from durable records)</h4>
          <ul>{Object.entries(detail!.pendingChecks || {}).map(([k, v]) => <li key={k}>{v ? 'Met' : 'Not met'}: {label(k.replace(/([A-Z])/g, ' $1').toLowerCase())}</li>)}</ul>
          <button type="button" disabled={busy || c.status !== 'ACTIVE'} onClick={() => run(() => caseService.advance(c.caseId, c.activeStage, c.version), 'Stage completed.')}>Complete {stageLabel(c.activeStage)}</button>
        </>}
        {policy.evidence === 'HUMAN_ATTESTED' && <form onSubmit={e => { e.preventDefault(); void run(() => caseService.advance(c.caseId, c.activeStage, c.version, { confirmed, statement }), 'Stage attested and completed.'); }}>
          <fieldset><legend>Reviewer attestation for {stageLabel(c.activeStage)} (recorded as an attestation, not a system verification)</legend>
            {(policy.checklist || []).map(item => <label key={item}><input type="checkbox" checked={confirmed.includes(item)}
              onChange={e => setConfirmed(e.target.checked ? [...confirmed, item] : confirmed.filter(x => x !== item))} /> {label(item)}</label>)}
            <label>Attestation statement<textarea required minLength={10} maxLength={1000} value={statement} onChange={e => setStatement(e.target.value)} /></label>
          </fieldset>
          <button disabled={busy || c.status !== 'ACTIVE'}>Attest and complete</button>
        </form>}
        <h4>Return or hold</h4>
        <label>Reason (recorded)<input maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></label>
        {c.activeStage > 1 && <><label>Return to stage<select value={returnStage} onChange={e => setReturnStage(e.target.value)}><option value="">Select</option>
          {Array.from({ length: c.activeStage - 1 }, (_, i) => i + 1).map(s => <option key={s} value={s}>{stageLabel(s)}</option>)}</select></label>
          <button type="button" disabled={busy || !returnStage || reason.trim().length < 10} onClick={() => run(() => caseService.returnTo(c.caseId, Number(returnStage), c.version, reason), 'Case returned.')}>Return case</button></>}
        <button type="button" disabled={busy || reason.trim().length < 5 || !['ACTIVE', 'ON_HOLD'].includes(c.status)}
          onClick={() => run(() => caseService.hold(c.caseId, c.status === 'ACTIVE', c.version, reason), c.status === 'ACTIVE' ? 'Case placed on hold.' : 'Case resumed.')}>{c.status === 'ON_HOLD' ? 'Resume case' : 'Place on hold'}</button>
        {managing && <form aria-labelledby="case-team-heading" onSubmit={e => { e.preventDefault(); void run(() => caseService.restaff(c.caseId, teamRole, teamUser, c.version, reason), 'Case team updated.'); }}>
          <h4 id="case-team-heading">Case team</h4>
          <p>Engagement {c.engagementId} · tax year {c.taxYear}. Only people already assigned to this engagement and year in that role can take it over; the reason above is recorded.</p>
          <label>Role<select value={teamRole} onChange={e => { setTeamRole(e.target.value as 'preparer' | 'reviewer'); setTeamUser(''); }}><option value="preparer">Preparer (now {c.preparerUid})</option><option value="reviewer">Reviewer (now {c.reviewerUid})</option></select></label>
          <button type="button" disabled={team.status === 'loading'} onClick={() => loadTeam(c.clientId)}>Refresh team</button>
          {team.status === 'loading' && <p role="status">Loading the engagement team…</p>}
          {team.status === 'error' && <p role="alert">The engagement team could not be loaded. <button type="button" onClick={() => loadTeam(c.clientId)}>Retry</button></p>}
          {team.status === 'ready' && candidates.length === 0 && <p role="status">No one else holds the {teamRole} assignment for this engagement and year. Assign someone in Client Management first.</p>}
          {candidates.length > 0 && <label>New {teamRole}<select value={teamUser} onChange={e => setTeamUser(e.target.value)}><option value="">Select a person</option>
            {candidates.map(u => <option key={u} value={u}>{u}</option>)}</select></label>}
          <button disabled={busy || !teamUser || reason.trim().length < 10 || !['ACTIVE', 'ON_HOLD'].includes(c.status)}>{busy ? 'Saving…' : 'Change case team'}</button>
        </form>}
        <h4>History</h4>
        <ul>{detail!.events.map((ev, i) => <li key={ev.at + i}>{label(ev.action.toLowerCase())} → {stageLabel(ev.toStage)}{ev.evidenceType ? ` · ${label(ev.evidenceType.toLowerCase())}` : ''}{ev.reason ? ` · ${ev.reason}` : ''} · {ev.actorUid} · {new Date(ev.at).toLocaleString()}</li>)}</ul>
      </>}
    </div>}
  </section>;
}
