import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

export interface LiveCommissioningAgent {
  agent_id: string; agent_name: string; registry_status: string; risk_class: string; stopped: boolean;
  model: { configured: boolean; approved: boolean }; prompt: { configured: boolean; approved: boolean };
  grants: { resources: number; non_read: number; data_classes: number; stages: number }; active_approval_policies: number; recorded_runs: number;
  commissioning_state: 'DRAFT' | 'DENIED' | 'RESTRICTED' | 'STOPPED' | 'NOT_COMMISSIONED'; commissioning_record: null; material_actions: 'BLOCKED';
}
export interface LiveCommissioning { source: string; global_stop: boolean; material_actions: 'BLOCKED'; agents: LiveCommissioningAgent[] }

const STATE: Record<string, string> = { DRAFT: 'Draft', DENIED: 'Denied (disabled, offline or retired)', RESTRICTED: 'Restricted', STOPPED: 'Stopped by emergency stop', NOT_COMMISSIONED: 'Not commissioned' };
const yes = (b: boolean) => b ? 'Yes' : 'No';

/** The live records as reported by the server. Pure: no request is made here and nothing can be enabled. */
export function LiveCommissioningTable({ data }: { data: LiveCommissioning }) {
  return <>
    <p role="status">{data.global_stop ? 'A global emergency stop is active for this practice.' : 'No global emergency stop is active.'} Material actions (AI-16): blocked.
      {' '}No agent has a commissioning record.</p>
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">Live governance records for each agent</caption>
        <thead><tr className="text-slate-400">{['Agent', 'Registry status', 'State', 'Model approved', 'Prompt approved', 'Grants (non-read)', 'Approval policies', 'Recorded runs', 'Material actions']
          .map(h => <th key={h} scope="col" className="pr-3">{h}</th>)}</tr></thead>
        <tbody>{data.agents.map(a => <tr key={a.agent_id} className="border-t border-slate-800">
          <th scope="row" className="pr-3 py-1"><span className="font-mono">{a.agent_id}</span> {a.agent_name}</th>
          <td className="pr-3">{a.registry_status}</td><td className="pr-3">{STATE[a.commissioning_state] ?? a.commissioning_state}</td>
          <td className="pr-3">{a.model.configured ? yes(a.model.approved) : 'None configured'}</td><td className="pr-3">{a.prompt.configured ? yes(a.prompt.approved) : 'None configured'}</td>
          <td className="pr-3">{a.grants.resources} ({a.grants.non_read})</td><td className="pr-3">{a.active_approval_policies}</td><td className="pr-3">{a.recorded_runs}</td><td>Blocked</td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

/**
 * Contract C7: per-agent records read from the practice's live governance tables. Read-only: there
 * are no enable, approve or commission controls. Agents keep their registry state (DRAFT stays
 * DRAFT); no commissioning record exists, so none is shown as commissioned.
 */
export function AiLiveCommissioningRecords() {
  const [state, setState] = useState<{ status: 'loading' | 'ready' | 'error' | 'denied'; data?: LiveCommissioning }>({ status: 'loading' });
  const seq = useRef(0);
  const load = useCallback(() => {
    const mine = ++seq.current;
    setState(s => ({ ...s, status: 'loading' }));
    api.caseAuthority.getAiControlCenter('commissioning').then((data: any) => {
      if (mine !== seq.current) return;
      if (!data || !Array.isArray(data.agents) || data.material_actions !== 'BLOCKED') { setState({ status: 'error' }); return; }
      setState({ status: 'ready', data: data as LiveCommissioning });
    }).catch((e: any) => { if (mine === seq.current) setState({ status: e?.status === 403 ? 'denied' : 'error' }); });
  }, []);
  useEffect(() => { load(); return () => { seq.current++; }; }, [load]);
  return <section aria-labelledby="ai-live-commissioning-heading" aria-busy={state.status === 'loading'} className="space-y-2">
    <h3 id="ai-live-commissioning-heading" className="font-semibold text-white">Live governance records</h3>
    <p className="text-slate-400">Read from this practice's governance records. Nothing here starts, enables, approves or commissions an agent.</p>
    {state.status === 'loading' && !state.data && <p role="status">Loading live records…</p>}
    {state.status === 'denied' && <p role="alert">Live governance records are available to governance roles only.</p>}
    {state.status === 'error' && <p role="alert">Live governance records are unavailable. <button type="button" className="underline" onClick={load}>Retry</button></p>}
    {state.data && state.status !== 'error' && <LiveCommissioningTable data={state.data} />}
  </section>;
}
