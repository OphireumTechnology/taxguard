import React, { useMemo } from 'react';
import { CANONICAL_AGENTS } from '../../ai/registry';
import {
  ARCHITECTURE_OVERVIEW_SOURCE, OVERVIEW_AGENTS, PAGE9_EXAMPLE, PERMISSION_COLUMNS,
  overviewCeiling, overviewDecisions, type DrawnPermission, type OverviewDecision,
} from '../../ai/architectureOverview';

const LABEL: Record<DrawnPermission, string> = { ALLOWED: 'Allowed', NOT_ALLOWED: 'Not allowed', CONDITIONAL: 'Conditional', ILLEGIBLE: 'Unreadable' };
const STATUS: Record<OverviewDecision['status'], string> = { OPEN: 'Open', PARTLY_DECIDED: 'Partly decided', DECIDED: 'Decided' };

/**
 * The owner-supplied Architecture Overview as transcribed in src/ai/architectureOverview.ts, beside the
 * registry it describes. Rendered locally like the commissioning view: it calls no endpoint, and
 * nothing here enables, approves or grants anything to an agent.
 */
export function AiArchitectureOverviewView() {
  const decisions = useMemo(() => overviewDecisions(), []);
  const registry = useMemo(() => new Map(CANONICAL_AGENTS.map(a => [a.agent_id, a])), []);
  const withResponsibility = OVERVIEW_AGENTS.filter(a => a.responsibility !== null).length;
  const withRole = OVERVIEW_AGENTS.filter(a => a.gate_role !== null).length;
  return <div className="space-y-3" data-testid="ai-architecture-overview-view">
    <p role="note" className="text-slate-300">
      Reference only: transcribed from the {ARCHITECTURE_OVERVIEW_SOURCE.title} ({ARCHITECTURE_OVERVIEW_SOURCE.pages} pages, SHA-256 {ARCHITECTURE_OVERVIEW_SOURCE.sha256.slice(0, 12)}…, received {ARCHITECTURE_OVERVIEW_SOURCE.received}).
      Until the owner approves a mapping, every agent stays DRAFT with no permission, stage, model or provider.
    </p>
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Overview totals">
      {([['Agents recorded', `${OVERVIEW_AGENTS.length} / ${CANONICAL_AGENTS.length}`], ['With a page-2 responsibility', `${withResponsibility} / ${OVERVIEW_AGENTS.length}`],
        ['Gate names an approval role', `${withRole} / ${OVERVIEW_AGENTS.length}`], ['Open owner decisions', `${decisions.filter(d => d.status !== 'DECIDED').length} / ${decisions.length}`]] as const)
        .map(([label, value]) => <div key={label} className="rounded-lg border border-slate-700 p-2"><dt className="text-slate-400">{label}</dt><dd className="text-base font-bold text-white">{value}</dd></div>)}
    </dl>
    <section aria-labelledby="ai-overview-decisions" className="rounded-lg border border-amber-500/40 p-2 text-amber-200">
      <h3 id="ai-overview-decisions" className="font-semibold">Owner decisions ({decisions.length})</h3>
      <ul className="list-disc pl-5 space-y-1">{decisions.map(d => <li key={d.id} data-decision-status={d.status}>
        <strong>{d.id} {d.title}.</strong> <span className={d.status === 'DECIDED' ? 'text-emerald-300' : ''}>[{STATUS[d.status]}]</span> {d.detail}
        {d.resolution && <p className="text-emerald-200">{d.resolution}</p>}
      </li>)}</ul>
    </section>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">Architecture overview record for each canonical agent</caption>
        <thead><tr className="text-slate-400">
          {['Agent', 'Overview name', 'Registry name', 'Category', 'Responsibility (page 2)', 'Human gate (page 2)', 'Approval role'].map(h => <th key={h} scope="col" className="pr-3">{h}</th>)}
        </tr></thead>
        <tbody>{OVERVIEW_AGENTS.map(a => <tr key={a.agent_id} className="border-t border-slate-800">
          <th scope="row" className="pr-3 py-1 font-mono">{a.agent_id}</th>
          <td className="pr-3">{a.overview_name}</td>
          <td className="pr-3 text-slate-400">{registry.get(a.agent_id)!.agent_name}</td>
          <td className="pr-3">{registry.get(a.agent_id)!.category}</td>
          <td className="pr-3">{a.responsibility ?? 'Not on page 2'}</td>
          <td className="pr-3">{a.human_gate ?? 'Not on page 2'}</td>
          <td>{a.gate_role ?? 'Owner decision'}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <section aria-labelledby="ai-overview-page9" className="space-y-1">
      <h3 id="ai-overview-page9" className="font-semibold text-white">Page 9 example permissions</h3>
      <p className="text-slate-300">The example narrowed by TaxGuard: return data, verification, approval, signing, filing, the filing provider and the File stage stay with people, and unreadable cells are not guessed. A ceiling for review, not a grant.</p>
      <div className="overflow-x-auto">
        <table className="text-left">
          <caption className="sr-only">Page 9 example permissions after TaxGuard's human-only limits</caption>
          <thead><tr className="text-slate-400"><th scope="col" className="pr-3">Agent</th>{PERMISSION_COLUMNS.map(([key, label]) => <th key={key} scope="col" className="pr-3">{label}</th>)}</tr></thead>
          <tbody>{PAGE9_EXAMPLE.map(row => {
            const ceiling = overviewCeiling(row.agent_id)!;
            return <tr key={row.agent_id} className="border-t border-slate-800">
              <th scope="row" className="pr-3 py-1 font-mono">{row.agent_id}</th>
              {PERMISSION_COLUMNS.map(([key]) => {
                const narrowed = ceiling[key] !== row.drawn[key];
                return <td key={key} className={`pr-3 whitespace-nowrap ${narrowed ? 'text-amber-300' : ceiling[key] === 'ALLOWED' ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {LABEL[ceiling[key]]}{narrowed ? ` (drawn: ${LABEL[row.drawn[key]].toLowerCase()})` : ''}
                </td>;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>
    </section>
  </div>;
}
