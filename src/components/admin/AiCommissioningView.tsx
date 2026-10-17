import React, { useMemo, useState } from 'react';
import { BLOCKED_CAPABILITIES, commissioningMatrix, type CommissioningRow } from '../../ai/commissioningMatrix';
import { useApp } from '../../context/AppContext';
import { useAdminProviderReadiness } from '../../hooks/useAdminProviderReadiness';
import { AiLiveCommissioningRecords } from './AiLiveCommissioningRecords';

const GATES: Array<[keyof CommissioningRow, string]> = [['registered', 'Registered'], ['handlerImplemented', 'Handler implemented'], ['locallyTested', 'Locally tested'],
  ['providerConfigured', 'Provider configured'], ['humanApproved', 'Human-approved'], ['stagingValidated', 'Staging validated'], ['productionCommissioned', 'Production commissioned']];

/**
 * Commissioning readiness of the 61 canonical agents. The gates come from the source registry and
 * build evidence (src/ai/commissioningMatrix.ts), not from a running agent; the AI provider line is
 * the server's configuration report. Nothing here starts, enables or approves an agent: commissioning
 * goes through governance, budgets, kill switches and the AI-16 material-action decision.
 */
export function AiCommissioningView() {
  const { currentUser, authLifecycleState } = useApp();
  const rows = useMemo(() => commissioningMatrix(), []);
  const [onlyHandlers, setOnlyHandlers] = useState(false);
  const readiness = useAdminProviderReadiness(currentUser, authLifecycleState, 0);
  const ai = readiness.status === 'ready' ? readiness.providers.find(p => p.provider === 'AI') : undefined;
  const shown = onlyHandlers ? rows.filter(r => r.handlerImplemented === 'YES') : rows;
  const count = (k: keyof CommissioningRow) => rows.filter(r => r[k] === 'YES').length;
  return <div className="space-y-3" data-testid="ai-commissioning-view">
    <p role="note" className="text-slate-300">Build evidence from the source registry, not live agent activity. No agent is operational: none has a configured provider, human approval, staging validation or production commissioning.</p>
    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Commissioning totals">
      {GATES.map(([k, label]) => <div key={k} className="rounded-lg border border-slate-700 p-2"><dt className="text-slate-400">{label}</dt><dd className="text-base font-bold text-white">{count(k)} / {rows.length}</dd></div>)}
    </dl>
    <p><strong>AI model provider (server report):</strong>{' '}
      {readiness.status === 'loading' ? 'Loading…' : readiness.status === 'error' ? 'Unavailable — the readiness service did not answer.' : ai ? `${ai.status.replace(/_/g, ' ')} — ${ai.description}` : 'Not reported.'}</p>
    <div role="alert" className="rounded-lg border border-amber-500/40 p-2 text-amber-200">
      <p className="font-semibold">Blocked regardless of agent state (owner decisions required):</p>
      <p>{BLOCKED_CAPABILITIES.join(' · ')}</p>
    </div>
    <label className="inline-flex items-center gap-2"><input type="checkbox" checked={onlyHandlers} onChange={e => setOnlyHandlers(e.target.checked)} /> Show only agents with an implemented handler</label>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">Commissioning gates for each canonical agent</caption>
        <thead><tr className="text-slate-400"><th scope="col" className="pr-3">Agent</th><th scope="col" className="pr-3">Name</th>{GATES.map(([k, label]) => <th key={k} scope="col" className="pr-3">{label}</th>)}<th scope="col">Scope</th></tr></thead>
        <tbody>{shown.map(r => <tr key={r.agentId} className="border-t border-slate-800">
          <th scope="row" className="pr-3 py-1 font-mono">{r.agentId}</th><td className="pr-3">{r.name}</td>
          {GATES.map(([k]) => <td key={k} className={`pr-3 ${r[k] === 'YES' ? 'text-emerald-300' : 'text-slate-400'}`}>{r[k] === 'YES' ? 'Yes' : r[k] === 'PARTIAL' ? 'Partial' : 'No'}</td>)}
          <td>{r.scope}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <AiLiveCommissioningRecords />
  </div>;
}
