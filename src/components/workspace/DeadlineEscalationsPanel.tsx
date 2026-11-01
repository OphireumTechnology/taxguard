import React, { useEffect, useState } from 'react';
import { PracticeRequestError, practiceService, type DeadlineEscalations, type EscalationLevelName } from '../../services/practiceService';
import { dueText, LEVEL_LABELS } from './PracticeOperationsPanel';

const ORDER: EscalationLevelName[] = ['CRITICAL', 'OVERDUE', 'DUE_SOON', 'APPROACHING', 'NORMAL'];

/**
 * Durable deadline escalation for practice managers (Block 85): every open deadline in the actor's scope at or above the
 * chosen level, with counts per level, derived when read from the due date. Nothing is written and no sweep runs. The
 * thresholds are shown with their source: defaults, not a reviewed policy. Hidden when the durable store is off.
 */
export function DeadlineEscalationsPanel() {
  const [minLevel, setMinLevel] = useState(1);
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'off' | 'error'; data?: DeadlineEscalations }>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    setState(s => ({ ...s, status: 'loading' }));
    practiceService.deadlineEscalations(minLevel).then(data => { if (live) setState({ status: 'ready', data }); })
      .catch(e => { if (live) setState({ status: e instanceof PracticeRequestError && (e.status === 503 || e.status === 403) ? 'off' : 'error' }); });
    return () => { live = false; };
  }, [minLevel]);
  if (state.status === 'off') return null;
  const d = state.data;
  return <section aria-labelledby="deadline-escalations-heading" className="tg-manager-card">
    <h2 id="deadline-escalations-heading">Deadline escalation</h2>
    <label>Show from level{' '}<select value={minLevel} onChange={e => setMinLevel(Number(e.target.value))}>
      {[4, 3, 2, 1, 0].map(n => <option key={n} value={n}>{LEVEL_LABELS[ORDER[4 - n]]}</option>)}</select></label>
    {state.status === 'loading' && <p role="status">Loading deadlines…</p>}
    {state.status === 'error' && <p role="alert">Deadlines could not be loaded. Nothing is shown in their place.</p>}
    {d && <>
      <ul className="tg-acct-kpis" aria-label="Open deadlines by level">{ORDER.map(l => <li key={l}><span>{LEVEL_LABELS[l]}</span> <strong>{d.counts[l]}</strong></li>)}</ul>
      {d.deadlines.length === 0 ? <p>No open deadline in your scope is at or above this level.</p> :
        <div className="tg-manager-scroll"><table aria-label="Escalated deadlines"><thead><tr>{['Level', 'Deadline', 'Client / year', 'Authority', 'Due'].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
          <tbody>{d.deadlines.map(x => <tr key={x.deadlineId}><td>{LEVEL_LABELS[x.levelName]}</td><td>{x.title}</td><td>{x.clientId}{x.taxYear ? ` / ${x.taxYear}` : ''}</td>
            <td>{x.authorityType}</td><td><time dateTime={x.dueDate}>{x.dueDate.slice(0, 10)}</time> ({dueText(x.hoursUntilDue)})</td></tr>)}</tbody></table></div>}
      <p title={d.thresholds.source}>Levels are derived when read: approaching within {d.thresholds.approachingHours} hours, due soon within {d.thresholds.dueSoonHours} hours,
        critical after {d.thresholds.criticalOverdueHours} hours overdue{d.thresholds.statutoryOverdueIsCritical ? ' or when a statutory deadline is overdue' : ''}. These are default thresholds, not a reviewed policy.</p>
    </>}
  </section>;
}
